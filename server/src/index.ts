import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import makeWASocket, {
  DisconnectReason,
  makeCacheableSignalKeyStore,
  Browsers,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import { pino } from "pino";
import QRCode from "qrcode";

type ConnectionState = "disconnected" | "connecting" | "qr" | "connected";

type PublicStatus = {
  connection: ConnectionState;
  qr: string | null;
  qrDataUrl: string | null;
  phone: string | null;
  error: string | null;
  lastError: string | null;
  updatedAt: string;
};

type MessageEvent = {
  id: string;
  direction: "inbound" | "outbound";
  chatId: string;
  sender: string | null;
  text: string;
  timestamp: string;
  fromMe: boolean;
};

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";
const authDir = resolve(root, process.env.AUTH_DIR ?? ".data/auth");
const messageStorePath = resolve(root, process.env.MESSAGE_STORE ?? ".data/messages.json");
const corsOrigin = process.env.CORS_ORIGIN ?? "*";
const apiToken = process.env.API_TOKEN?.trim();
const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

let socket: WASocket | null = null;
let reconnectTimer: NodeJS.Timeout | undefined;
let manualStop = false;
let connecting: Promise<void> | null = null;
let status: PublicStatus = {
  connection: "disconnected",
  qr: null,
  qrDataUrl: null,
  phone: null,
  error: null,
  lastError: null,
  updatedAt: new Date().toISOString(),
};

const messages: MessageEvent[] = [];
const sseClients = new Set<ServerResponse>();

async function loadMessages() {
  try {
    const raw = await readFile(messageStorePath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) messages.push(...parsed.slice(-200));
  } catch {
    // First boot or an ephemeral Render filesystem: start with an empty inbox.
  }
}

function persistMessages() {
  void mkdir(dirname(messageStorePath), { recursive: true })
    .then(() => writeFile(messageStorePath, JSON.stringify(messages), "utf8"))
    .catch((error) => logger.warn({ error }, "No se pudo persistir el historial WhatsApp"));
}

function setStatus(patch: Partial<PublicStatus>) {
  const next = { ...status, ...patch };
  if (Object.prototype.hasOwnProperty.call(patch, "lastError")) next.error = patch.lastError ?? null;
  if (Object.prototype.hasOwnProperty.call(patch, "error")) next.lastError = patch.error ?? null;
  status = { ...next, updatedAt: new Date().toISOString() };
  broadcast("status", status);
}

function broadcast(event: string, payload: unknown) {
  const body = event === "status" ? { ...(payload as PublicStatus), status: (payload as PublicStatus).connection } : payload;
  const data = `event: ${event}\ndata: ${JSON.stringify(body)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch {
      sseClients.delete(client);
    }
  }
}

function rememberMessage(message: MessageEvent) {
  if (messages.some((item) => item.id === message.id && item.chatId === message.chatId && item.direction === message.direction)) return;
  messages.push(message);
  if (messages.length > 200) messages.splice(0, messages.length - 200);
  persistMessages();
  broadcast("message", message);
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function authOk(req: IncomingMessage, url?: URL) {
  if (!apiToken) return true;
  const supplied = req.headers["x-pulso-token"] ?? req.headers["x-api-key"] ?? req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? url?.searchParams.get("token");
  if (supplied === apiToken) return true;
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  return requestUrl.searchParams.get("token") === apiToken;
}

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {} as Record<string, unknown>;
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("JSON inválido");
  }
}

function json(res: ServerResponse, code: number, payload: unknown) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function textFromMessage(message: any) {
  const content = message?.message;
  if (!content) return "";
  return (
    content.conversation ??
    content.extendedTextMessage?.text ??
    content.imageMessage?.caption ??
    content.videoMessage?.caption ??
    ""
  );
}

function normalizeRecipient(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes("@")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) throw new Error("Destinatario WhatsApp inválido");
  return `${digits}@s.whatsapp.net`;
}

function rememberBaileysMessages(incoming: any[]) {
  for (const message of incoming) {
    const text = textFromMessage(message);
    const chatId = message?.key?.remoteJid ?? "";
    if (!chatId || !text) continue;
    rememberMessage({
      id: message.key.id ?? crypto.randomUUID(),
      direction: message.key.fromMe ? "outbound" : "inbound",
      chatId,
      sender: message.key.participant ?? (message.key.fromMe ? socket?.user?.id ?? null : chatId),
      text,
      timestamp: new Date(Number(message.messageTimestamp ?? Date.now()) * 1000).toISOString(),
      fromMe: Boolean(message.key.fromMe),
    });
  }
}

async function startSocket(): Promise<void> {
  if (connecting) return connecting;
  if (socket && status.connection === "connected") return;
  manualStop = false;
  connecting = (async () => {
    await mkdir(authDir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    setStatus({ connection: "connecting", qr: null, qrDataUrl: null, lastError: null });
    socket = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: false,
      logger,
      markOnlineOnConnect: false,
      browser: Browsers.macOS("Desktop"),
      syncFullHistory: true,
    });
    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        let qrDataUrl: string | null = null;
        try {
          qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 360 });
        } catch (error) {
          logger.warn({ error }, "No se pudo generar imagen QR");
        }
        setStatus({ connection: "qr", qr, qrDataUrl, lastError: null });
      }
      if (connection === "open") {
        setStatus({
          connection: "connected",
          qr: null,
          qrDataUrl: null,
          phone: socket?.user?.id ?? null,
          lastError: null,
        });
        logger.info({ phone: socket?.user?.id }, "WhatsApp conectado");
      }
      if (connection === "close") {
        const code = (lastDisconnect?.error as any)?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        const reason = errorMessage(lastDisconnect?.error ?? "Conexión cerrada");
        socket = null;
        setStatus({ connection: "disconnected", qr: null, qrDataUrl: null, lastError: reason });
        if (!manualStop && !loggedOut) {
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => void startSocket(), 2500);
        }
      }
    });
    socket.ev.on("messages.upsert", ({ messages: incoming, type }) => {
      if (type === "notify" || type === "append") rememberBaileysMessages(incoming);
    });
    socket.ev.on("messaging-history.set", ({ messages: history }) => rememberBaileysMessages(history));
  })().finally(() => {
    connecting = null;
  });
  return connecting;
}

async function stopSocket() {
  manualStop = true;
  clearTimeout(reconnectTimer);
  const current = socket;
  socket = null;
  if (current) {
    try {
      current.ws.close();
    } catch {
      // Socket may already be closed.
    }
  }
  setStatus({ connection: "disconnected", qr: null, qrDataUrl: null, phone: null });
}

async function sendMessage(to: string, text: string) {
  if (!socket || status.connection !== "connected") throw new Error("WhatsApp no está conectado");
  const jid = normalizeRecipient(to);
  const result = await socket.sendMessage(jid, { text });
  const id = result?.key?.id ?? crypto.randomUUID();
  rememberMessage({
    id,
    direction: "outbound",
    chatId: jid,
    sender: socket.user?.id ?? null,
    text,
    timestamp: new Date().toISOString(),
    fromMe: true,
  });
  return { id, chatId: jid };
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Pulso-Token, X-Api-Key");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (url.pathname === "/health" && req.method === "GET") {
    return json(res, 200, { ok: true, service: "pulso-crm-whatsapp", now: new Date().toISOString() });
  }
  if (!authOk(req, url)) return json(res, 401, { error: "No autorizado" });
  if (url.pathname === "/api/whatsapp/status" && req.method === "GET") return json(res, 200, { ...status, status: status.connection });
  if (url.pathname === "/api/whatsapp/qr" && req.method === "GET") {
    return json(res, 200, { connection: status.connection, status: status.connection, qr: status.qr, dataUrl: status.qrDataUrl, qrDataUrl: status.qrDataUrl, updatedAt: status.updatedAt });
  }
  if (url.pathname === "/api/whatsapp/messages" && req.method === "GET") return json(res, 200, { messages });
  if ((url.pathname === "/api/whatsapp/events" || url.pathname === "/api/events") && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", Connection: "keep-alive", "Access-Control-Allow-Origin": corsOrigin });
    res.write(`event: status\ndata: ${JSON.stringify({ ...status, status: status.connection })}\n\n`);
    sseClients.add(res);
    const heartbeat = setInterval(() => {
      try { res.write(": ping\n\n"); } catch { clearInterval(heartbeat); sseClients.delete(res); }
    }, 25_000);
    req.on("close", () => { clearInterval(heartbeat); sseClients.delete(res); });
    return;
  }
  if (url.pathname === "/api/whatsapp/connect" && req.method === "POST") {
    await startSocket();
    return json(res, 202, status);
  }
  if (url.pathname === "/api/whatsapp/disconnect" && req.method === "POST") {
    await stopSocket();
    return json(res, 200, status);
  }
  if ((url.pathname === "/api/whatsapp/send" || url.pathname === "/api/messages/send") && req.method === "POST") {
    try {
      const body = await readJson(req);
      const to = typeof body.to === "string" ? body.to : typeof body.chatId === "string" ? body.chatId : "";
      const text = typeof body.message === "string" ? body.message.trim() : typeof body.text === "string" ? body.text.trim() : "";
      if (!to || !text) return json(res, 400, { error: "Campos requeridos: to, message" });
      return json(res, 200, await sendMessage(to, text));
    } catch (error) {
      return json(res, 409, { error: errorMessage(error) });
    }
  }
  return json(res, 404, { error: "Ruta no encontrada" });
}

const server = http.createServer((req, res) => {
  void handle(req, res).catch((error) => {
    logger.error({ error }, "Error HTTP");
    if (!res.headersSent) json(res, 500, { error: "Error interno" });
    else res.end();
  });
});

void loadMessages().finally(() => {
  server.listen(port, host, () => {
    logger.info({ host, port, authDir, messageStorePath }, "Pulso CRM WhatsApp bridge listo");
  });
});

process.on("SIGINT", async () => {
  await stopSocket();
  server.close(() => process.exit(0));
});
process.on("SIGTERM", async () => {
  await stopSocket();
  server.close(() => process.exit(0));
});
