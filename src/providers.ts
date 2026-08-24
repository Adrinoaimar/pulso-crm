export interface MessagingProvider {
  send(conversationId: string, message: string, recipient?: string): Promise<{ id: string }>;
  status(): Promise<"connected" | "pending">;
}
export interface ConversationProvider { list(): Promise<unknown[]>; resolve(id: string): Promise<void>; }
export interface CrmRepository<T> { all(): Promise<T[]>; save(value: T): Promise<T>; }
export interface AutomationEngine { simulate(trigger: string): Promise<string[]>; }
export interface AiAgentProvider { draft(context: string): Promise<{ text: string; confidence: number }>; }
export interface EventBus { publish(topic: string, payload: unknown): void; }

export type WhatsAppConnection = "disconnected" | "connecting" | "qr" | "connected" | "error";
export type WhatsAppConnectionMethod = "qr" | "api";
export type WhatsAppBackendSnapshot = { status: WhatsAppConnection; qrDataUrl?: string; phone?: string; error?: string; updatedAt?: string };
export type WhatsAppEvent = { type: "status" | "qr" | "message" | string; status?: WhatsAppConnection; qrDataUrl?: string; phone?: string; conversationId?: string; id?: string; text?: string; body?: string; from?: string; sender?: string; chatId?: string; direction?: "inbound" | "outbound"; timestamp?: string };
type StoredWhatsAppIntegration = { apiKey?: string; connection: WhatsAppConnection; method?: WhatsAppConnectionMethod; connectedAt?: string; updatedAt?: string; backendUrl?: string; qrDataUrl?: string; phone?: string; error?: string };

const WHATSAPP_STORAGE_KEY = "pulso.crm.whatsapp";
const BACKEND_URL_KEY = "pulso.crm.whatsapp.backendUrl";
const envBackendUrl = typeof import.meta !== "undefined" ? import.meta.env.VITE_WA_BACKEND_URL : "";

function readWhatsAppIntegration(): StoredWhatsAppIntegration {
  try {
    const raw = localStorage.getItem(WHATSAPP_STORAGE_KEY);
    if (!raw) return { connection: "disconnected" };
    const value = JSON.parse(raw) as Partial<StoredWhatsAppIntegration>;
    return {
      apiKey: typeof value.apiKey === "string" ? value.apiKey : undefined,
      connection: ["connected", "connecting", "qr", "error"].includes(value.connection as string) ? value.connection as WhatsAppConnection : "disconnected",
      method: value.method === "qr" || value.method === "api" ? value.method : undefined,
      connectedAt: typeof value.connectedAt === "string" ? value.connectedAt : undefined,
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : undefined,
      backendUrl: typeof value.backendUrl === "string" ? value.backendUrl : undefined,
      qrDataUrl: typeof value.qrDataUrl === "string" ? value.qrDataUrl : undefined,
      phone: typeof value.phone === "string" ? value.phone : undefined,
      error: typeof value.error === "string" ? value.error : undefined,
    };
  } catch { return { connection: "disconnected" }; }
}

function writeWhatsAppIntegration(value: StoredWhatsAppIntegration) {
  try {
    localStorage.setItem(WHATSAPP_STORAGE_KEY, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("pulso:whatsapp", { detail: value }));
  } catch { /* Storage bloqueado: estado runtime sigue vigente. */ }
}

export function getWhatsAppBackendUrl() {
  try {
    const stored = localStorage.getItem(BACKEND_URL_KEY)?.trim();
    return (stored || (envBackendUrl || "")).trim().replace(/\/$/, "");
  } catch { return (envBackendUrl || "").trim().replace(/\/$/, ""); }
}

export function saveWhatsAppBackendUrl(url: string) {
  const clean = url.trim().replace(/\/$/, "");
  if (clean && !/^https?:\/\//i.test(clean)) throw new Error("La URL debe comenzar con http:// o https://");
  try {
    const previousUrl = localStorage.getItem(BACKEND_URL_KEY)?.trim() || (envBackendUrl || "").trim().replace(/\/$/, "");
    clean ? localStorage.setItem(BACKEND_URL_KEY, clean) : localStorage.removeItem(BACKEND_URL_KEY);
    if (clean !== previousUrl) {
      const previous = readWhatsAppIntegration();
      writeWhatsAppIntegration({ ...previous, connection: "disconnected", method: undefined, qrDataUrl: undefined, error: undefined, updatedAt: new Date().toISOString() });
    }
  } catch { /* noop */ }
  return clean;
}

export function getWhatsAppIntegration() {
  const value = readWhatsAppIntegration();
  const backendUrl = getWhatsAppBackendUrl();
  const staleLocalConnection = Boolean(backendUrl) && value.connection === "connected" && value.backendUrl !== backendUrl;
  return { hasApiKey: Boolean(value.apiKey), connection: staleLocalConnection ? "disconnected" as const : value.connection, method: value.method, connectedAt: value.connectedAt, updatedAt: value.updatedAt, backendUrl, qrDataUrl: staleLocalConnection ? undefined : value.qrDataUrl, phone: value.phone, error: value.error, real: Boolean(backendUrl) };
}

export function saveWhatsAppApiKey(apiKey: string) {
  const clean = apiKey.trim();
  if (clean.length < 8) throw new Error("La API key debe tener al menos 8 caracteres");
  const previous = readWhatsAppIntegration();
  writeWhatsAppIntegration({ ...previous, apiKey: clean, updatedAt: new Date().toISOString() });
}
export function clearWhatsAppApiKey() {
  const previous = readWhatsAppIntegration();
  const { apiKey: _apiKey, ...withoutKey } = previous;
  writeWhatsAppIntegration({ ...withoutKey, updatedAt: new Date().toISOString() });
}

function persistSnapshot(snapshot: WhatsAppBackendSnapshot) {
  const previous = readWhatsAppIntegration();
  writeWhatsAppIntegration({ ...previous, backendUrl: getWhatsAppBackendUrl(), connection: snapshot.status, method: "qr", connectedAt: snapshot.status === "connected" ? previous.connectedAt || new Date().toISOString() : previous.connectedAt, updatedAt: new Date().toISOString(), qrDataUrl: snapshot.qrDataUrl, phone: snapshot.phone, error: snapshot.error });
}
function backendUrlOrThrow() {
  const url = getWhatsAppBackendUrl();
  if (!url) throw new Error("Backend QR no configurado. Define VITE_WA_BACKEND_URL o URL en Configuración.");
  return url;
}
function authHeaders(): Record<string, string> { const value = readWhatsAppIntegration(); return value.apiKey ? { "x-pulso-token": value.apiKey } : {}; }

async function requestBackend(path: string, init: RequestInit = {}) {
  const base = backendUrlOrThrow();
  const response = await fetch(`${base}${path}`, { ...init, headers: { Accept: "application/json", ...authHeaders(), ...(init.headers || {}) } });
  const text = await response.text();
  let payload: unknown = undefined;
  try { payload = text ? JSON.parse(text) : undefined; } catch { payload = undefined; }
  if (!response.ok) {
    const reason = typeof payload === "object" && payload && "error" in payload ? String((payload as { error: unknown }).error) : text;
    throw new Error(reason || `Backend respondió HTTP ${response.status}`);
  }
  return payload as Record<string, unknown> | undefined;
}
function normalizeSnapshot(payload: Record<string, unknown> | undefined): WhatsAppBackendSnapshot {
  const raw = String(payload?.status || payload?.connection || (payload?.connected ? "connected" : "disconnected"));
  const status: WhatsAppConnection = ["connected", "connecting", "qr", "error"].includes(raw) ? raw as WhatsAppConnection : "disconnected";
  return { status, qrDataUrl: typeof payload?.qrDataUrl === "string" ? payload.qrDataUrl : typeof payload?.dataUrl === "string" ? payload.dataUrl : undefined, phone: typeof payload?.phone === "string" ? payload.phone : undefined, error: typeof payload?.error === "string" ? payload.error : typeof payload?.lastError === "string" ? payload.lastError : undefined, updatedAt: new Date().toISOString() };
}

export async function fetchWhatsAppStatus() { const snapshot = normalizeSnapshot(await requestBackend("/api/whatsapp/status")); persistSnapshot(snapshot); return snapshot; }
export async function connectWhatsAppQr() { const snapshot = normalizeSnapshot(await requestBackend("/api/whatsapp/connect", { method: "POST" })); persistSnapshot(snapshot); return snapshot; }
export async function fetchWhatsAppQr() { const snapshot = normalizeSnapshot(await requestBackend("/api/whatsapp/qr")); persistSnapshot(snapshot); return snapshot; }
export async function disconnectWhatsAppRemote() { const snapshot = normalizeSnapshot(await requestBackend("/api/whatsapp/disconnect", { method: "POST" })); persistSnapshot({ ...snapshot, status: "disconnected", qrDataUrl: undefined }); return snapshot; }

export function subscribeWhatsAppStatus(onSnapshot: (snapshot: WhatsAppBackendSnapshot) => void, onError?: (error: Error) => void, intervalMs = 2500) {
  let stopped = false; let timer: number | undefined;
  const poll = async () => {
    try { if (!stopped) onSnapshot(await fetchWhatsAppStatus()); }
    catch (error) { if (!stopped) onError?.(error instanceof Error ? error : new Error("No se pudo consultar backend QR")); }
    finally { if (!stopped) timer = window.setTimeout(poll, intervalMs); }
  };
  void poll();
  return () => { stopped = true; if (timer) window.clearTimeout(timer); };
}

export function subscribeWhatsAppEvents(onEvent: (event: WhatsAppEvent) => void, onError?: (error: Error) => void) {
  let source: EventSource;
  try {
    const apiKey = readWhatsAppIntegration().apiKey;
    const query = apiKey ? `?token=${encodeURIComponent(apiKey)}` : "";
    source = new EventSource(`${backendUrlOrThrow()}/api/events${query}`);
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error("No se pudo abrir eventos del backend"));
    return () => undefined;
  }
  const parse = (event: MessageEvent<string>) => {
    try {
      const payload = JSON.parse(event.data) as WhatsAppEvent;
      onEvent({ ...payload, type: payload.type || event.type });
    }
    catch { onError?.(new Error("Evento SSE inválido")); }
  };
  source.onmessage = parse;
  ["status", "qr"].forEach((name) => source.addEventListener(name, parse as EventListener));
  source.onerror = () => onError?.(new Error("Conexión SSE cerrada"));
  return () => source.close();
}

export class LocalMessagingProvider implements MessagingProvider { async send() { return { id: crypto.randomUUID() }; } async status() { return "connected" as const; } }
export class WhatsAppProvider implements MessagingProvider {
  async send(conversationId: string, message: string, recipient?: string) {
    const state = readWhatsAppIntegration();
    if (state.connection !== "connected") throw new Error("WhatsApp no está conectado");
    const payload = await requestBackend("/api/messages/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: recipient, text: message, conversationId }) });
    return { id: typeof payload?.id === "string" ? payload.id : crypto.randomUUID() };
  }
  async status() { try { return (await fetchWhatsAppStatus()).status === "connected" ? "connected" : "pending"; } catch { return "pending"; } }
}
