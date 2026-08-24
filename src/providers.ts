export interface MessagingProvider {
  send(conversationId: string, message: string): Promise<{ id: string }>;
  status(): Promise<"connected" | "pending">;
}
export interface ConversationProvider {
  list(): Promise<unknown[]>;
  resolve(id: string): Promise<void>;
}
export interface CrmRepository<T> {
  all(): Promise<T[]>;
  save(value: T): Promise<T>;
}
export interface AutomationEngine {
  simulate(trigger: string): Promise<string[]>;
}
export interface AiAgentProvider {
  draft(context: string): Promise<{ text: string; confidence: number }>;
}
export interface EventBus {
  publish(topic: string, payload: unknown): void;
}

/** Estado de conexión local. No realiza llamadas externas. */
export type WhatsAppConnection = "disconnected" | "connected";
export type WhatsAppConnectionMethod = "qr" | "api";
type StoredWhatsAppIntegration = {
  apiKey?: string;
  connection: WhatsAppConnection;
  method?: WhatsAppConnectionMethod;
  connectedAt?: string;
  updatedAt?: string;
};

const WHATSAPP_STORAGE_KEY = "pulso.crm.whatsapp";

function readWhatsAppIntegration(): StoredWhatsAppIntegration {
  try {
    const raw = localStorage.getItem(WHATSAPP_STORAGE_KEY);
    if (!raw) return { connection: "disconnected" };
    const value = JSON.parse(raw) as Partial<StoredWhatsAppIntegration>;
    return {
      apiKey: typeof value.apiKey === "string" ? value.apiKey : undefined,
      connection: value.connection === "connected" ? "connected" : "disconnected",
      method: value.method === "qr" || value.method === "api" ? value.method : undefined,
      connectedAt: typeof value.connectedAt === "string" ? value.connectedAt : undefined,
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : undefined,
    };
  } catch {
    return { connection: "disconnected" };
  }
}

function writeWhatsAppIntegration(value: StoredWhatsAppIntegration) {
  try {
    localStorage.setItem(WHATSAPP_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Navegador puede bloquear storage. UI seguirá operativa en modo demo.
  }
}

/** Devuelve metadatos; nunca devuelve clave API. */
export function getWhatsAppIntegration() {
  const value = readWhatsAppIntegration();
  return {
    hasApiKey: Boolean(value.apiKey),
    connection: value.connection,
    method: value.method,
    connectedAt: value.connectedAt,
    updatedAt: value.updatedAt,
  };
}

export function saveWhatsAppApiKey(apiKey: string) {
  const clean = apiKey.trim();
  if (clean.length < 8) throw new Error("La API key debe tener al menos 8 caracteres");
  const previous = readWhatsAppIntegration();
  writeWhatsAppIntegration({
    ...previous,
    apiKey: clean,
    updatedAt: new Date().toISOString(),
  });
}

export function clearWhatsAppApiKey() {
  const previous = readWhatsAppIntegration();
  const { apiKey: _apiKey, ...withoutKey } = previous;
  writeWhatsAppIntegration({ ...withoutKey, updatedAt: new Date().toISOString() });
}

export function setWhatsAppQrConnected() {
  const previous = readWhatsAppIntegration();
  writeWhatsAppIntegration({
    ...previous,
    connection: "connected",
    method: "qr",
    connectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function disconnectWhatsApp() {
  const previous = readWhatsAppIntegration();
  writeWhatsAppIntegration({
    ...previous,
    connection: "disconnected",
    method: undefined,
    connectedAt: undefined,
    updatedAt: new Date().toISOString(),
  });
}

export class LocalMessagingProvider implements MessagingProvider {
  async send() {
    return { id: crypto.randomUUID() };
  }
  async status() {
    return "connected" as const;
  }
}
export class WhatsAppProvider implements MessagingProvider {
  async send(
    _conversationId: string,
    _message: string,
  ): Promise<{ id: string }> {
    if (readWhatsAppIntegration().connection !== "connected") {
      throw new Error("WhatsApp no está conectado");
    }
    // Transporte real se añadirá cuando exista bridge/backend. Demo conserva flujo local.
    return { id: crypto.randomUUID() };
  }
  async status() {
    return readWhatsAppIntegration().connection === "connected"
      ? ("connected" as const)
      : ("pending" as const);
  }
}
