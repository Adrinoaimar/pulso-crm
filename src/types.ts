export type Module =
  | "inicio"
  | "bandeja"
  | "contactos"
  | "negocios"
  | "automatizacion"
  | "ia"
  | "analitica"
  | "configuracion";
export type User = {
  id: string;
  name: string;
  role: "administrador" | "supervisor" | "agente";
  status: "online" | "busy" | "offline";
};
export type Contact = {
  id: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  tags: string[];
  owner: string;
  consent: boolean;
  duplicate?: boolean;
};
export type Message = {
  id: string;
  from: "contact" | "agent" | "ai";
  body: string;
  time: string;
  note?: boolean;
};
export type Conversation = {
  id: string;
  contactId: string;
  queue: string;
  status: "abierta" | "esperando" | "resuelta";
  priority: "alta" | "media" | "baja";
  assignee: string;
  unread: number;
  sla: number;
  aiMode: "Humano" | "Copiloto" | "Autopiloto";
  tags: string[];
  messages: Message[];
};
export type Deal = {
  id: string;
  contactId: string;
  title: string;
  stage: string;
  value: number;
  probability: number;
  next: string;
};
export type Automation = {
  id: string;
  name: string;
  trigger: string;
  action: string;
  status: "Borrador" | "Activa" | "Pausada" | "Error";
  runs: number;
};
export type Store = {
  contacts: Contact[];
  conversations: Conversation[];
  deals: Deal[];
  automations: Automation[];
  aiEnabled: boolean;
  emergency: boolean;
  aiPrompt: string;
  confidence: number;
};
