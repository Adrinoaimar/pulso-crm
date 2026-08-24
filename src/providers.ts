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
    throw new Error("Pendiente de API");
  }
  async status() {
    return "pending" as const;
  }
}
