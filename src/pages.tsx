import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  CircleAlert,
  CheckCircle2,
  Clock3,
  Filter,
  GripVertical,
  MoreHorizontal,
  Paperclip,
  Pause,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  KeyRound,
  LockKeyhole,
  Link2Off,
  Search,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  UsersRound,
  Workflow,
} from "lucide-react";
import { useStore } from "./store";
import { users } from "./data";
import type { Automation, Contact, Conversation, Deal, Message, Module, Store } from "./types";
import { Drawer, Empty, Pill, Signal, Toast } from "./components";
import {
  clearWhatsAppApiKey,
  disconnectWhatsAppRemote,
  connectWhatsAppQr,
  fetchWhatsAppMessages,
  fetchWhatsAppQr,
  fetchWhatsAppStatus,
  getWhatsAppIntegration,
  getWhatsAppBackendUrl,
  saveWhatsAppBackendUrl,
  saveWhatsAppApiKey,
  subscribeWhatsAppStatus,
  subscribeWhatsAppEvents,
  type WhatsAppEvent,
  type WhatsAppMessage,
  WhatsAppProvider,
} from "./providers";
const money = (n: number) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Respuesta determinista para la demo local. No necesita red ni una API:
 * sirve para probar Copiloto/Autopiloto mientras se conecta un proveedor QR.
 */
const localAiReply = (message: string, contactName: string) => {
  const text = message.toLowerCase();
  const needsHuman = /(persona|humano|asesor|contrato|reclamo|denuncia|datos sensibles)/i.test(message);
  if (needsHuman) {
    return {
      body: `Entiendo, ${contactName.split(" ")[0]}. He avisado al equipo para que una persona continúe contigo.`,
      escalates: true,
    };
  }
  if (/(precio|cotiz|costo|plan|tarifa)/i.test(text)) {
    return {
      body: `Gracias por escribir, ${contactName.split(" ")[0]}. Puedo preparar una cotización a tu medida. ¿Cuántas personas usarán el servicio y cuándo desean iniciar?`,
      escalates: false,
    };
  }
  if (/(hola|buenas|información|info)/i.test(text)) {
    return {
      body: `¡Hola, ${contactName.split(" ")[0]}! Soy el asistente de Pulso. Cuéntame qué necesitas y te ayudo enseguida.`,
      escalates: false,
    };
  }
  return {
    body: `Gracias por tu mensaje, ${contactName.split(" ")[0]}. Revisaré tu solicitud y te propongo el siguiente paso. ¿Qué fecha te viene mejor?`,
    escalates: false,
  };
};

const remotePhone = (value: string) => value.replace(/\D/g, "");
const remoteConversationId = (chatId: string) => `wa-${chatId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
const remoteMessageTime = (timestamp?: string) => {
  if (!timestamp) return "Ahora";
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) return "Ahora";
  return new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" }).format(date);
};
const remoteContact = (chatId: string): Contact => {
  const phone = remotePhone(chatId);
  return {
    id: `wa-contact-${chatId.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
    name: phone ? `WhatsApp +${phone}` : "Contacto de WhatsApp",
    phone: phone ? `+${phone}` : chatId,
    email: "",
    company: "WhatsApp",
    tags: ["WhatsApp"],
    owner: "Ana Torres",
    consent: true,
  };
};
const remoteConversation = (chatId: string, messages: Message[]): Conversation => {
  const last = messages.at(-1);
  return {
    id: remoteConversationId(chatId),
    contactId: remoteContact(chatId).id,
    queue: "WhatsApp",
    status: last?.from === "contact" ? "abierta" : "esperando",
    priority: "media",
    assignee: "Ana Torres",
    unread: 0,
    sla: 0,
    aiMode: "Copiloto",
    tags: ["WhatsApp"],
    messages,
  };
};
const remoteStore = (data: Store, remoteMessages: WhatsAppMessage[]): Store => {
  const grouped = new Map<string, WhatsAppMessage[]>();
  for (const message of remoteMessages) {
    if (!message.chatId || !message.text.trim()) continue;
    const group = grouped.get(message.chatId) || [];
    group.push(message);
    grouped.set(message.chatId, group);
  }
  const contacts: Contact[] = [];
  const conversations: Conversation[] = [];
  for (const [chatId, values] of grouped) {
    const messages: Message[] = values
      .sort((a, b) => new Date(a.timestamp).valueOf() - new Date(b.timestamp).valueOf())
      .map((message) => ({
        id: message.id,
        from: message.direction === "outbound" || message.fromMe ? "agent" : "contact",
        body: message.text,
        time: remoteMessageTime(message.timestamp),
      }));
    contacts.push(remoteContact(chatId));
    conversations.push(remoteConversation(chatId, messages));
  }
  return { ...data, contacts, conversations };
};
const eventToRemoteMessage = (event: WhatsAppEvent): WhatsAppMessage | null => {
  const text = event.text || event.body || "";
  const chatId = event.chatId || event.from || event.sender || event.phone || "";
  if (!text.trim() || !chatId) return null;
  return {
    id: event.id || crypto.randomUUID(),
    direction: event.direction === "outbound" ? "outbound" : "inbound",
    chatId,
    sender: event.sender || event.from || null,
    text,
    timestamp: event.timestamp || new Date().toISOString(),
    fromMe: event.direction === "outbound",
  };
};
const addRemoteMessage = (data: Store, message: WhatsAppMessage): Store => {
  const contact = remoteContact(message.chatId);
  const id = remoteConversationId(message.chatId);
  const nextMessage: Message = {
    id: message.id,
    from: message.direction === "outbound" || message.fromMe ? "agent" : "contact",
    body: message.text,
    time: remoteMessageTime(message.timestamp),
  };
  const existing = data.conversations.find((item) => item.id === id);
  if (!existing) {
    return {
      ...data,
      contacts: [contact, ...data.contacts.filter((item) => item.id !== contact.id)],
      conversations: [remoteConversation(message.chatId, [nextMessage]), ...data.conversations],
    };
  }
  if (existing.messages.some((item) => item.id === nextMessage.id)) return data;
  return {
    ...data,
    conversations: data.conversations.map((item) => item.id === id ? {
      ...item,
      messages: [...item.messages, nextMessage],
      unread: nextMessage.from === "contact" ? item.unread + 1 : item.unread,
      status: nextMessage.from === "contact" ? "abierta" : "esperando",
    } : item),
  };
};
export function Dashboard({ go }: { go: (m: Module) => void }) {
  const { data } = useStore();
  const integration = getWhatsAppIntegration();
  const realConnected = integration.real && integration.connection === "connected";
  const open = (realConnected ? data.conversations.filter((x) => x.id.startsWith("wa-")) : data.conversations).filter((x) => x.status !== "resuelta");
  const deals = realConnected ? data.deals.filter((deal) => !/^d[1-4]$/.test(deal.id)) : data.deals;
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">HOY · 24 AGO</p>
          <h2>Todo bajo control</h2>
          <p>Prioridades comerciales y carga del equipo, en una sola vista.</p>
        </div>
        <button className="primary" onClick={() => go("bandeja")}>
          Abrir bandeja <ArrowRight />
        </button>
      </div>
      <section className="metrics">
        <article>
          <span>Conversaciones abiertas</span>
          <strong>{open.length}</strong>
          <small>
            <b>+12%</b> vs. semana anterior
          </small>
        </article>
        <article>
          <span>Primera respuesta</span>
          <strong>{realConnected ? "—" : "4m 18s"}</strong>
          <small>{realConnected ? "Sin datos reales todavía" : "Objetivo: menos de 5 min"}</small>
        </article>
        <article>
          <span>Negocios en riesgo</span>
          <strong>{realConnected ? "0" : "3"}</strong>
          <small className={realConnected ? undefined : "danger"}>{realConnected ? "Sin datos reales todavía" : "Requieren seguimiento"}</small>
        </article>
        <article>
          <span>Valor del embudo</span>
          <strong>{money(deals.reduce((s, x) => s + x.value, 0))}</strong>
          <small>{realConnected ? "Sin negocios reales todavía" : "4 oportunidades activas"}</small>
        </article>
      </section>
      <div className="dash-grid">
        <section className="panel priority">
          <header>
            <div>
              <p className="eyebrow">COLA PRIORITARIA</p>
              <h3>Responder ahora</h3>
            </div>
            <button className="link" onClick={() => go("bandeja")}>
              Ver bandeja
            </button>
          </header>
          {open.length === 0 ? (
            <div className="empty">
              <p>{realConnected ? "No hay conversaciones reales pendientes." : "No hay conversaciones pendientes."}</p>
            </div>
          ) : open.slice(0, 3).map((v) => {
            const c = data.contacts.find((x) => x.id === v.contactId)!;
            return (
              <button
                className="queue-row"
                key={v.id}
                onClick={() => {
                  location.hash = "bandeja/" + v.id;
                  go("bandeja");
                }}
              >
                <Signal state={v.priority} />
                <span className="avatar small">
                  {c.name
                    .split(" ")
                    .map((x) => x[0])
                    .join("")}
                </span>
                <span>
                  <b>{c.name}</b>
                  <small>{v.messages.at(-1)?.body}</small>
                </span>
                <Pill tone={v.sla < 10 ? "danger" : "warning"}>
                  <Clock3 />
                  {v.sla} min
                </Pill>
                <ArrowUpRight />
              </button>
            );
          })}
        </section>
        <section className="panel workload">
          <header>
            <div>
              <p className="eyebrow">EQUIPO</p>
              <h3>Carga activa</h3>
            </div>
            <UsersRound />
          </header>
          {users.map((u, i) => (
            <div className="work-row" key={u.id}>
              <span className="avatar small">
                {u.name
                  .split(" ")
                  .map((x) => x[0])
                  .join("")}
              </span>
              <span>
                <b>{u.name}</b>
                <small>
                  {
                    realConnected ? "Sin datos reales" : [
                      "5 conversaciones",
                      "3 conversaciones",
                      "2 conversaciones",
                    ][i]
                  }
                </small>
              </span>
              <div className="bar">
                <i style={{ width: [86, 58, 38][i] + "%" }} />
              </div>
            </div>
          ))}
        </section>
      </div>
      <section className="panel funnel">
        <header>
          <div>
            <p className="eyebrow">EMBUDO</p>
            <h3>Distribución comercial</h3>
          </div>
          <button className="link" onClick={() => go("negocios")}>
            Abrir negocios
          </button>
        </header>
        <div className="funnel-bars">
          {["Nuevo", "Calificado", "Propuesta", "Ganado"].map((s, i) => (
            <div key={s} style={{ width: [100, 82, 64, 43][i] + "%" }}>
              <span>{s}</span>
              <b>
                {money(
                  deals
                    .filter((x) => x.stage === s)
                    .reduce((a, x) => a + x.value, 0),
                )}
              </b>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
export function Inbox({ offline }: { offline: boolean }) {
  const { data, setData } = useStore();
  const initial = location.hash.split("/")[1];
  const [selected, setSelected] = useState<string | undefined>(
    initial || data.conversations[0]?.id,
  );
  const [integration, setIntegration] = useState(getWhatsAppIntegration);
  const remoteSyncRef = useRef(false);
  const [queue, setQueue] = useState("Todas");
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState(false);
  const [context, setContext] = useState(false);
  const [toast, setToast] = useState("");
  const composer = useRef<HTMLTextAreaElement>(null);
  const realBackend = integration.real;
  const remoteConnected = realBackend && integration.connection === "connected";
  const visibleConversations = remoteConnected
    ? data.conversations.filter((item) => item.id.startsWith("wa-"))
    : data.conversations;
  const list = visibleConversations.filter(
    (x) => queue === "Todas" || x.queue === queue,
  );
  const cv = visibleConversations.find((x) => x.id === selected);
  const contact = data.contacts.find((x) => x.id === cv?.contactId);
  useEffect(() => {
    const sync = () => {
      const next = getWhatsAppIntegration();
      setIntegration(next);
      if (next.connection !== "connected") remoteSyncRef.current = false;
    };
    window.addEventListener("pulso:whatsapp", sync);
    return () => window.removeEventListener("pulso:whatsapp", sync);
  }, []);
  useEffect(() => {
    if (!realBackend) return;
    return subscribeWhatsAppStatus((snapshot) => {
      setIntegration(getWhatsAppIntegration());
      if (snapshot.status !== "connected") remoteSyncRef.current = false;
    }, (error) => setToast(`Backend WhatsApp: ${error.message}`));
  }, [realBackend]);
  useEffect(() => {
    if (!remoteConnected || remoteSyncRef.current) return;
    remoteSyncRef.current = true;
    void fetchWhatsAppMessages().then((messages) => {
      setData((current) => {
        const next = remoteStore(current, messages);
        setSelected(next.conversations.some((item) => item.id === selected) ? selected : next.conversations[0]?.id);
        return next;
      });
    }).catch((error) => {
      // Connected mode must never fall back to seeded/demo conversations.
      setData((current) => {
        const next = remoteStore(current, []);
        setSelected(undefined);
        return next;
      });
      setToast(error instanceof Error ? `No se pudieron cargar mensajes reales: ${error.message}` : "No se pudieron cargar mensajes reales");
    });
  }, [remoteConnected, selected, setData]);
  useEffect(() => {
    if (!realBackend) return;
    return subscribeWhatsAppEvents((event) => {
      if (event.type !== "message" || event.direction === "outbound") return;
      const message = eventToRemoteMessage(event);
      if (!message) return;
      setData((d) => addRemoteMessage(d, message));
      if (!selected || !data.conversations.some((item) => item.id === remoteConversationId(message.chatId))) {
        setSelected(remoteConversationId(message.chatId));
      }
    });
  }, [realBackend, selected, data.conversations, setData]);
  const update = (patch: Partial<NonNullable<typeof cv>>) =>
    setData((d) => ({
      ...d,
      conversations: d.conversations.map((x) =>
        x.id === selected ? { ...x, ...patch } : x,
      ),
    }));
  const send = async () => {
    if (!draft.trim() || !cv) return;
    const body = draft.trim();
    const integration = getWhatsAppIntegration();
    if (!note && integration.real && integration.connection === "connected") {
      try {
        const result = await new WhatsAppProvider().send(cv.id, body, contact?.phone);
        setData((d) => ({
          ...d,
          conversations: d.conversations.map((x) => x.id === cv.id ? {
            ...x,
            messages: [...x.messages, { id: result.id, from: "agent", body, time: "Ahora", note: false }],
            unread: 0,
            status: "esperando",
          } : x),
        }));
        setDraft("");
        return;
      } catch (error) {
        setToast(error instanceof Error ? `No enviado: ${error.message}` : "No enviado: error de backend");
        setTimeout(() => setToast(""), 3200);
        return;
      }
    }
    setData((d) => ({
      ...d,
      conversations: d.conversations.map((x) =>
        x.id === cv.id
          ? {
              ...x,
              messages: [
                ...x.messages,
                {
                  id: crypto.randomUUID(),
                  from: "agent",
                  body,
                  time: "Ahora",
                  note,
                },
              ],
              unread: 0,
              status: note ? x.status : "esperando",
            }
          : x,
      ),
    }));
    setDraft("");
    setToast(note ? "Nota interna guardada" : integration.real ? "Modo demo: backend no conectado" : "Mensaje local guardado (modo demo)");
    setTimeout(() => setToast(""), 2600);
  };
  const suggest = () => {
    if (!cv || !contact) return;
    const incoming = [...cv.messages].reverse().find((m) => m.from === "contact");
    if (!incoming) return;
    setDraft(localAiReply(incoming.body, contact.name).body);
    setNote(false);
    composer.current?.focus();
  };
  const simulateIncoming = () => {
    if (!cv || !contact) return;
    const incoming = "¿Podrían compartir información y próximos pasos?";
    setData((d) => ({
      ...d,
      conversations: d.conversations.map((x) => {
        if (x.id !== cv.id) return x;
        const incomingMessage = {
          id: crypto.randomUUID(),
          from: "contact" as const,
          body: incoming,
          time: "Ahora",
        };
        const base = {
          ...x,
          messages: [...x.messages, incomingMessage],
          unread: x.unread + 1,
          status: "abierta" as const,
        };
        if (x.aiMode !== "Autopiloto" || !d.aiEnabled || d.emergency) return base;
        const reply = localAiReply(incoming, contact.name);
        return {
          ...base,
          messages: [
            ...base.messages,
            {
              id: crypto.randomUUID(),
              from: "ai" as const,
              body: reply.body,
              time: "Ahora",
            },
          ],
          status: reply.escalates ? ("esperando" as const) : ("abierta" as const),
        };
      }),
    }));
    setToast(
      cv.aiMode === "Autopiloto" && data.aiEnabled && !data.emergency
        ? "Mensaje recibido y respuesta IA enviada"
        : "Mensaje de prueba recibido",
    );
    setTimeout(() => setToast(""), 2600);
  };
  const createDeal = () => {
    if (!contact) return;
    const deal: Deal = {
      id: crypto.randomUUID(),
      contactId: contact.id,
      title: `Nueva oportunidad · ${contact.company}`,
      stage: "Nuevo",
      value: 0,
      probability: 15,
      next: "Definir siguiente paso",
    };
    setData((d) => ({ ...d, deals: [deal, ...d.deals] }));
    setContext(false);
    setToast("Negocio creado en etapa Nuevo");
    setTimeout(() => setToast(""), 2600);
  };
  return (
    <div
      className="inbox"
      onKeyDown={(e) => {
        if (
          e.key.toLowerCase() === "r" &&
          document.activeElement?.tagName !== "TEXTAREA"
        )
          composer.current?.focus();
      }}
    >
      <aside className="queues">
        <div className="panel-title">
          <p className="eyebrow">COLAS</p>
          <button className="icon-btn">
            <Plus />
          </button>
        </div>
        {["Todas", "Ventas", "Soporte", "Renovaciones"].map((q) => (
          <button
            key={q}
            className={queue === q ? "selected" : ""}
            onClick={() => setQueue(q)}
          >
            <span>{q}</span>
            <b>
              {q === "Todas"
                ? visibleConversations.length
                : visibleConversations.filter((x) => x.queue === q).length}
            </b>
          </button>
        ))}
        <p className="eyebrow filter-title">VISTAS</p>
        <button>
          <span>Sin asignar</span>
          <b>0</b>
        </button>
        <button>
          <span>Por vencer</span>
          <b className="red">2</b>
        </button>
        <button>
          <span>Resueltas</span>
          <b>
            {visibleConversations.filter((x) => x.status === "resuelta").length}
          </b>
        </button>
      </aside>
      <section
        className="conversation-list"
        role="listbox"
        aria-label="Conversaciones"
      >
        <header>
          <label>
            <Search />
            <input placeholder="Buscar conversaciones" />
          </label>
          <button className="icon-btn">
            <Filter />
          </button>
        </header>
        <div className="list-meta">
          <b>{list.length} conversaciones</b>
          <button>
            Más recientes <ChevronDown />
          </button>
        </div>
        {list.map((v) => {
          const c = data.contacts.find((x) => x.id === v.contactId)!;
          return (
            <button
              role="option"
              aria-selected={selected === v.id}
              className={
                "conversation-item " + (selected === v.id ? "selected" : "")
              }
              key={v.id}
              onClick={() => {
                setSelected(v.id);
                location.hash = "bandeja/" + v.id;
              }}
            >
              <Signal state={v.status === "resuelta" ? "done" : v.priority} />
              <span className="avatar small">
                {c.name
                  .split(" ")
                  .map((x) => x[0])
                  .join("")}
              </span>
              <span className="conv-copy">
                <span>
                  <b>{c.name}</b>
                  <time>{v.messages.at(-1)?.time}</time>
                </span>
                <small>{v.messages.at(-1)?.body}</small>
                <span className="tagline">
                  <em>{v.queue}</em>
                  {v.tags.map((t) => (
                    <em key={t}>{t}</em>
                  ))}
                </span>
              </span>
              {v.unread > 0 && <b className="unread">{v.unread}</b>}
            </button>
          );
        })}
      </section>
      {cv && contact ? (
        <section className="chat">
          <header>
            <button className="avatar" onClick={() => setContext(true)}>
              {contact.name
                .split(" ")
                .map((x) => x[0])
                .join("")}
            </button>
            <div>
              <h3>{contact.name}</h3>
              <p>
                {contact.company} · {cv.queue}
              </p>
            </div>
            <select
              aria-label="Responsable"
              value={cv.assignee}
              onChange={(e) => update({ assignee: e.target.value })}
            >
              {users.map((u) => (
                <option key={u.id}>{u.name}</option>
              ))}
            </select>
            <button className="icon-btn" onClick={() => setContext(true)}>
              <MoreHorizontal />
            </button>
          </header>
          <div className={"ai-banner " + cv.aiMode.toLowerCase()}>
            <Bot />
            <span>
              <b>{cv.aiMode}</b>
              <small>
                {cv.aiMode === "Humano"
                  ? "Respuestas solo por el equipo."
                  : cv.aiMode === "Copiloto"
                    ? "La IA prepara borradores; tú decides qué enviar."
                    : "La IA responde dentro de límites y escala excepciones."}
              </small>
            </span>
            <select
              value={cv.aiMode}
              onChange={(e) =>
                update({ aiMode: e.target.value as typeof cv.aiMode })
              }
            >
              <option>Humano</option>
              <option>Copiloto</option>
              <option>Autopiloto</option>
            </select>
          </div>
          <div className="messages" role="log" aria-live="polite">
            <div className="day">HOY</div>
            {cv.messages.map((m) => (
              <article
                className={"message " + m.from + (m.note ? " note" : "")}
                key={m.id}
              >
                {m.note && <small>NOTA INTERNA</small>}
                <p>{m.body}</p>
                <time>
                  {m.time}
                  {m.from !== "contact" && " · ✓✓"}
                </time>
              </article>
            ))}
          </div>
          <footer className={"composer " + (note ? "is-note" : "")}>
            <div className="composer-tabs">
              <button
                className={!note ? "active" : ""}
                onClick={() => setNote(false)}
              >
                Respuesta
              </button>
              <button
                className={note ? "active" : ""}
                onClick={() => setNote(true)}
              >
                Nota interna
              </button>
              <button className="ai-suggest" onClick={suggest} title="Usar respuesta local de IA">
                <Sparkles /> Sugerir
              </button>
              {!remoteConnected && (
                <button className="ai-suggest" onClick={simulateIncoming} title="Agregar un mensaje de prueba">
                  <Bot /> Simular entrada
                </button>
              )}
            </div>
            <textarea
              ref={composer}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Escribe un mensaje…"
            />
            <div>
              <button
                className="icon-btn"
                disabled
                title="Adjuntos próximamente"
              >
                <Paperclip />
              </button>
              <small>
                {note
                  ? "Solo visible para tu equipo"
                  : offline
                    ? "Modo local · Enter para enviar"
                    : "Enter para enviar · Shift+Enter nueva línea"}
              </small>
              <button
                className="send"
                onClick={send}
                disabled={!draft.trim()}
              >
                <Send /> Enviar
              </button>
            </div>
          </footer>
        </section>
      ) : (
        <Empty
          title={remoteConnected ? "Sin mensajes de WhatsApp" : "Sin conversación"}
          body={remoteConnected ? "La cuenta está conectada. Cuando llegue un mensaje nuevo aparecerá aquí." : "Selecciona una conversación para empezar."}
        />
      )}
      {context && contact && (
        <Drawer title="Contexto del contacto" onClose={() => setContext(false)}>
          <div className="contact-hero">
            <span className="avatar">{contact.name.slice(0, 2)}</span>
            <h3>{contact.name}</h3>
            <p>{contact.company}</p>
          </div>
          <dl className="details">
            <dt>Teléfono</dt>
            <dd>{contact.phone}</dd>
            <dt>Correo</dt>
            <dd>{contact.email}</dd>
            <dt>Responsable</dt>
            <dd>{contact.owner}</dd>
            <dt>Consentimiento</dt>
            <dd>{contact.consent ? "Registrado" : "Pendiente"}</dd>
          </dl>
          <h3>Negocios</h3>
          {data.deals
            .filter((d) => d.contactId === contact.id)
            .map((d) => (
              <div className="mini-deal" key={d.id}>
                <b>{d.title}</b>
                <span>
                  {money(d.value)} · {d.stage}
                </span>
              </div>
            ))}
          <div className="drawer-actions">
            <button className="primary" onClick={createDeal}>
              <Plus /> Crear negocio
            </button>
          </div>
        </Drawer>
      )}
      {toast && <Toast>{toast}</Toast>}
    </div>
  );
}

export function Contacts() {
  const { data, setData } = useStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Contact | null>(null);
  const [creating, setCreating] = useState(false);
  const integration = getWhatsAppIntegration();
  const realConnected = integration.real && integration.connection === "connected";
  const visibleContacts = realConnected ? data.contacts.filter((contact) => !/^c[1-4]$/.test(contact.id)) : data.contacts;
  const list = visibleContacts.filter((c) =>
    (c.name + c.company + c.phone).toLowerCase().includes(q.toLowerCase()),
  );
  const add = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const c: Contact = {
      id: crypto.randomUUID(),
      name: String(fd.get("name")),
      phone: String(fd.get("phone")),
      email: String(fd.get("email")),
      company: String(fd.get("company")),
      tags: ["Nuevo"],
      owner: "Ana Torres",
      consent: false,
    };
    setData((d) => ({ ...d, contacts: [c, ...d.contacts] }));
    setCreating(false);
  };
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">BASE COMERCIAL</p>
          <h2>Contactos</h2>
          <p>
            {visibleContacts.length} personas · datos persistidos en este
            navegador
          </p>
        </div>
        <button className="primary" onClick={() => setCreating(true)} disabled={realConnected && !visibleContacts.length}>
          <Plus /> Nuevo contacto
        </button>
      </div>
      <section className="table-panel">
        <div className="toolbar">
          <label>
            <Search />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar nombre, empresa o teléfono"
            />
          </label>
          <button>
            <Filter /> Filtrar
          </button>
          <button>
            <SlidersHorizontal /> Columnas
          </button>
        </div>
        {list.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Contacto</th>
                  <th>Empresa</th>
                  <th>Etiquetas</th>
                  <th>Responsable</th>
                  <th>Consentimiento</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} onClick={() => setOpen(c)}>
                    <td>
                      <span className="person">
                        <span className="avatar small">
                          {c.name
                            .split(" ")
                            .map((x) => x[0])
                            .join("")}
                        </span>
                        <span>
                          <b>{c.name}</b>
                          <small>{c.phone}</small>
                        </span>
                      </span>
                    </td>
                    <td>{c.company}</td>
                    <td>
                      {c.tags.map((t) => (
                        <Pill key={t}>{t}</Pill>
                      ))}
                      {c.duplicate && (
                        <Pill tone="warning">Posible duplicado</Pill>
                      )}
                    </td>
                    <td>{c.owner}</td>
                    <td>
                      {c.consent ? (
                        <Pill tone="success">Registrado</Pill>
                      ) : (
                        <span className="muted">Pendiente</span>
                      )}
                    </td>
                    <td>
                      <button className="icon-btn">
                        <MoreHorizontal />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Sin resultados"
            body={realConnected ? "Aún no hay contactos reales de WhatsApp." : "Prueba con otro término de búsqueda."}
          />
        )}
      </section>
      {(open || creating) && (
        <Drawer
          title={creating ? "Crear contacto" : "Detalle del contacto"}
          onClose={() => {
            setOpen(null);
            setCreating(false);
          }}
        >
          {creating ? (
            <form className="form" onSubmit={add}>
              <label>
                Nombre
                <input name="name" required />
              </label>
              <label>
                Teléfono
                <input name="phone" required />
              </label>
              <label>
                Correo
                <input name="email" type="email" required />
              </label>
              <label>
                Empresa
                <input name="company" required />
              </label>
              <button className="primary">Guardar contacto</button>
            </form>
          ) : (
            open && (
              <>
                <div className="contact-hero">
                  <span className="avatar">{open.name.slice(0, 2)}</span>
                  <h3>{open.name}</h3>
                  <p>{open.company}</p>
                </div>
                {open.duplicate && (
                  <div className="notice warning">
                    <CircleAlert /> Posible duplicado. Revisa antes de fusionar.
                  </div>
                )}
                <dl className="details">
                  <dt>Teléfono</dt>
                  <dd>{open.phone}</dd>
                  <dt>Correo</dt>
                  <dd>{open.email}</dd>
                  <dt>Propietario</dt>
                  <dd>{open.owner}</dd>
                  <dt>Consentimiento</dt>
                  <dd>{open.consent ? "Registrado" : "Pendiente"}</dd>
                </dl>
                <h3>Actividad reciente</h3>
                <div className="activity">
                  <i />
                  <span>
                    <b>Contacto actualizado</b>
                    <small>Hoy · 09:31</small>
                  </span>
                </div>
                <div className="activity">
                  <i />
                  <span>
                    <b>Conversación iniciada</b>
                    <small>Ayer · 16:20</small>
                  </span>
                </div>
              </>
            )
          )}
        </Drawer>
      )}
    </div>
  );
}

const stages = ["Nuevo", "Calificado", "Propuesta", "Ganado"];
export function Pipeline() {
  const { data, setData } = useStore();
  const [toast, setToast] = useState("");
  const [creating, setCreating] = useState(false);
  const integration = getWhatsAppIntegration();
  const realConnected = integration.real && integration.connection === "connected";
  const visibleDeals = realConnected ? data.deals.filter((deal) => !/^d[1-4]$/.test(deal.id)) : data.deals;
  const visibleContacts = realConnected ? data.contacts.filter((contact) => !/^c[1-4]$/.test(contact.id)) : data.contacts;
  const move = (deal: Deal, stage: string) => {
    setData((d) => ({
      ...d,
      deals: d.deals.map((x) => (x.id === deal.id ? { ...x, stage } : x)),
    }));
    setToast(`${deal.title} movido a ${stage}`);
    setTimeout(() => setToast(""), 2200);
  };
  return (
    <div className="page board-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">PIPELINE PRINCIPAL</p>
          <h2>Negocios</h2>
          <p>
            {money(visibleDeals.reduce((s, x) => s + x.value, 0))} en valor total
          </p>
        </div>
        <button className="primary" onClick={() => setCreating(true)} disabled={realConnected && !visibleContacts.length}>
          <Plus /> Nuevo negocio
        </button>
      </div>
      <div className="board">
        {stages.map((stage) => {
          const deals = visibleDeals.filter((x) => x.stage === stage);
          return (
            <section
              className="stage"
              key={stage}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const d = visibleDeals.find(
                  (x) => x.id === e.dataTransfer.getData("text"),
                );
                if (d) move(d, stage);
              }}
            >
              <header>
                <span>
                  <i className={"stage-dot " + stage} />
                  <b>{stage}</b>
                  <em>{deals.length}</em>
                </span>
                <strong>{money(deals.reduce((s, x) => s + x.value, 0))}</strong>
              </header>
              {deals.map((d) => {
                const c = visibleContacts.find((x) => x.id === d.contactId);
                return (
                  <article
                    className="deal-card"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text", d.id)}
                    key={d.id}
                  >
                    <Signal
                      state={
                        stage === "Ganado"
                          ? "done"
                          : d.probability < 40
                            ? "warning"
                            : "media"
                      }
                    />
                    <div>
                      <div className="deal-top">
                        <GripVertical />
                        <small>{c?.company || "Contacto no disponible"}</small>
                      </div>
                      <h3>{d.title}</h3>
                      <strong>{money(d.value)}</strong>
                      <div className="deal-meta">
                        <Pill>{d.probability}%</Pill>
                        <span>
                          <Clock3 /> {d.next}
                        </span>
                      </div>
                      <label className="stage-select">
                        Mover a
                        <select
                          value={d.stage}
                          onChange={(e) => move(d, e.target.value)}
                        >
                          {stages.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </article>
                );
              })}
              <button className="add-card" onClick={() => setCreating(true)} disabled={realConnected && !visibleContacts.length}>
                <Plus /> Añadir negocio
              </button>
            </section>
          );
        })}
      </div>
      {creating && (
        <Drawer title="Nuevo negocio" onClose={() => setCreating(false)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const contactId = String(fd.get("contactId"));
              const deal: Deal = {
                id: crypto.randomUUID(),
                contactId,
                title: String(fd.get("title")),
                stage: String(fd.get("stage")),
                value: Number(fd.get("value")) || 0,
                probability: Number(fd.get("probability")) || 10,
                next: String(fd.get("next")),
              };
              setData((d) => ({ ...d, deals: [deal, ...d.deals] }));
              setCreating(false);
              setToast(`${deal.title} creado en ${deal.stage}`);
              setTimeout(() => setToast(""), 2200);
            }}
          >
            <label>
              Nombre del negocio
              <input name="title" required placeholder="Ej. Plan empresa" />
            </label>
            <label>
              Contacto
              <select name="contactId" required defaultValue={visibleContacts[0]?.id}>
                {visibleContacts.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name} · {c.company}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Etapa
              <select name="stage" defaultValue="Nuevo">
                {stages.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label>
              Valor estimado (PEN)
              <input name="value" type="number" min="0" step="100" defaultValue="0" />
            </label>
            <label>
              Probabilidad (%)
              <input name="probability" type="number" min="0" max="100" defaultValue="20" />
            </label>
            <label>
              Próximo paso
              <input name="next" required defaultValue="Definir siguiente paso" />
            </label>
            <button className="primary" type="submit"><Plus /> Crear negocio</button>
          </form>
        </Drawer>
      )}
      {toast && <Toast>{toast}</Toast>}
    </div>
  );
}

export function Automations() {
  const { data, setData } = useStore();
  const [editing, setEditing] = useState<Automation | null>(null);
  const blank: Automation = {
    id: "",
    name: "",
    trigger: "Mensaje recibido",
    action: "Asignar a Ana Torres",
    status: "Borrador",
    runs: 0,
  };
  const save = (status: Automation["status"]) => {
    if (!editing?.name) return;
    const value = {
      ...editing,
      status,
      id: editing.id || crypto.randomUUID(),
    };
    setData((d) => ({
      ...d,
      automations: d.automations.some((x) => x.id === value.id)
        ? d.automations.map((x) => (x.id === value.id ? value : x))
        : [...d.automations, value],
    }));
    setEditing(null);
  };
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">REGLAS OPERATIVAS</p>
          <h2>Automatización</h2>
          <p>Flujos previsibles, ordenados y auditables.</p>
        </div>
        <button className="primary" onClick={() => setEditing(blank)}>
          <Plus /> Nueva automatización
        </button>
      </div>
      <section className="panel automation-list">
        <header>
          <span>Nombre</span>
          <span>Disparador</span>
          <span>Acción</span>
          <span>Estado</span>
          <span>Ejecuciones</span>
        </header>
        {data.automations.map((a) => (
          <button key={a.id} onClick={() => setEditing(a)}>
            <span>
              <Workflow />
              <b>{a.name}</b>
            </span>
            <span>{a.trigger}</span>
            <span>{a.action}</span>
            <Pill
              tone={
                a.status === "Activa"
                  ? "success"
                  : a.status === "Error"
                    ? "danger"
                    : "neutral"
              }
            >
              {a.status}
            </Pill>
            <span className="mono">{a.runs}</span>
          </button>
        ))}
      </section>
      {editing && (
        <Drawer
          title={editing.id ? "Editar automatización" : "Nueva automatización"}
          onClose={() => setEditing(null)}
        >
          <div className="recipe">
            <label>
              Nombre
              <input
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
                placeholder="Ej. Seguimiento de ventas"
              />
            </label>
            <section>
              <span className="step">1</span>
              <div>
                <p className="eyebrow">CUANDO</p>
                <h3>Disparador</h3>
                <select
                  value={editing.trigger}
                  onChange={(e) =>
                    setEditing({ ...editing, trigger: e.target.value })
                  }
                >
                  {[
                    "Conversación creada",
                    "Mensaje recibido",
                    "Sin respuesta por 24 h",
                    "Etapa cambiada",
                    "Etiqueta añadida",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </div>
            </section>
            <section>
              <span className="step">2</span>
              <div>
                <p className="eyebrow">ENTONCES</p>
                <h3>Acción</h3>
                <select
                  value={editing.action}
                  onChange={(e) =>
                    setEditing({ ...editing, action: e.target.value })
                  }
                >
                  {[
                    "Asignar a Ana Torres",
                    "Etiquetar como Prioritario",
                    "Mover a Calificado",
                    "Crear tarea de seguimiento",
                    "Activar IA en Copiloto",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </div>
            </section>
            <div className="simulation">
              <Sparkles />
              <span>
                <b>Resultado de prueba</b>
                <small>
                  Al recibir un mensaje, Pulso ejecutará:{" "}
                  {editing.action.toLowerCase()}.
                </small>
              </span>
            </div>
            <div className="drawer-actions">
              <button onClick={() => save("Borrador")}>
                Guardar borrador
              </button>
              <button
                className="primary"
                disabled={!editing.name}
                onClick={() => save("Activa")}
              >
                Activar
              </button>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}

export function AiCenter() {
  const { data, setData } = useStore();
  const [test, setTest] = useState("¿Tienen disponibilidad para 20 usuarios?");
  const [answer, setAnswer] = useState("");
  const toggle = () =>
    setData((d) => ({
      ...d,
      emergency: !d.emergency,
      aiEnabled: d.emergency ? d.aiEnabled : false,
    }));
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">CONTROL CENTRAL</p>
          <h2>Agente IA</h2>
          <p>
            Define qué puede hacer, cuándo debe pausar y cómo escala al equipo.
          </p>
        </div>
        <Pill tone={data.aiEnabled && !data.emergency ? "success" : "danger"}>
          {data.emergency
            ? "Pausa de emergencia"
            : data.aiEnabled
              ? "IA activa"
              : "IA pausada"}
        </Pill>
      </div>
      <div className={"emergency " + (data.emergency ? "active" : "")}>
        <span>
          <ShieldAlert />
          <span>
            <b>Interruptor de emergencia</b>
            <small>
              Pausa todas las respuestas automáticas. Las conversaciones siguen
              disponibles al equipo.
            </small>
          </span>
        </span>
        <button onClick={toggle}>
          {data.emergency ? <Play /> : <Pause />}
          {data.emergency ? "Reanudar IA" : "Pausar toda la IA"}
        </button>
      </div>
      <div className="ai-grid">
        <section className="panel ai-policy">
          <header>
            <div>
              <p className="eyebrow">POLÍTICA GLOBAL</p>
              <h3>Comportamiento</h3>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={data.aiEnabled && !data.emergency}
                disabled={data.emergency}
                onChange={(e) =>
                  setData((d) => ({ ...d, aiEnabled: e.target.checked }))
                }
              />
              <span />
            </label>
          </header>
          <label>
            Instrucciones
            <textarea
              value={data.aiPrompt}
              onChange={(e) =>
                setData((d) => ({ ...d, aiPrompt: e.target.value }))
              }
            />
          </label>
          <label>
            Confianza mínima <b>{data.confidence}%</b>
            <input
              type="range"
              min="50"
              max="95"
              value={data.confidence}
              onChange={(e) =>
                setData((d) => ({ ...d, confidence: +e.target.value }))
              }
            />
            <small>
              Debajo de {data.confidence}%, crea borrador y solicita revisión
              humana.
            </small>
          </label>
          <div className="rules">
            <b>Escalar siempre cuando</b>
            {[
              "Solicitan hablar con una persona",
              "Consultan precios no documentados",
              "Comparten datos sensibles",
              "Expresan una objeción fuera de política",
            ].map((x) => (
              <span key={x}>
                <Check />
                {x}
              </span>
            ))}
          </div>
        </section>
        <section className="panel playground">
          <header>
            <div>
              <p className="eyebrow">PLAYGROUND</p>
              <h3>Prueba antes de activar</h3>
            </div>
            <Bot />
          </header>
          <label>
            Mensaje del contacto
            <textarea value={test} onChange={(e) => setTest(e.target.value)} />
          </label>
          <button
            className="primary"
            onClick={() =>
              setAnswer(
                test.toLowerCase().includes("precio")
                  ? "No tengo un precio verificado para ese caso. Crearé un borrador y pediré ayuda al equipo."
                  : "Puedo ayudarte a preparar una propuesta. ¿Cuál es la fecha estimada de inicio?",
              )
            }
          >
            <Sparkles /> Simular respuesta
          </button>
          {answer && (
            <div className="preview">
              <span className="avatar small">IA</span>
              <p>{answer}</p>
              <Pill tone="info">Confianza 68% · Borrador</Pill>
            </div>
          )}
        </section>
      </div>
      <section className="panel audit">
        <header>
          <div>
            <p className="eyebrow">REGISTRO</p>
            <h3>Decisiones recientes</h3>
          </div>
          <button className="link">Ver auditoría</button>
        </header>
        <div>
          <span className="mono">10:08</span>
          <Pill tone="warning">Escaló</Pill>
          <b>Solicitud humana detectada</b>
          <span>Conversación con Sofía Paredes</span>
        </div>
        <div>
          <span className="mono">09:43</span>
          <Pill tone="info">Borrador</Pill>
          <b>Confianza debajo del umbral</b>
          <span>Conversación con Camila Vega</span>
        </div>
      </section>
    </div>
  );
}

export function Analytics() {
  const rows = [
    ["Lun", 28, 82],
    ["Mar", 41, 70],
    ["Mié", 34, 92],
    ["Jue", 52, 63],
    ["Vie", 46, 78],
    ["Sáb", 19, 48],
    ["Dom", 25, 56],
  ];
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">ÚLTIMOS 7 DÍAS</p>
          <h2>Analítica</h2>
          <p>Rendimiento de conversaciones, ventas e intervención IA.</p>
        </div>
        <select>
          <option>Últimos 7 días</option>
          <option>Últimos 30 días</option>
        </select>
      </div>
      <section className="metrics">
        <article>
          <span>Conversaciones</span>
          <strong>245</strong>
          <small>
            <b>+8,4%</b> periodo anterior
          </small>
        </article>
        <article>
          <span>SLA cumplido</span>
          <strong>91,2%</strong>
          <small>Objetivo 90%</small>
        </article>
        <article>
          <span>Conversión</span>
          <strong>18,6%</strong>
          <small>
            <b>+2,1 pt</b> periodo anterior
          </small>
        </article>
        <article>
          <span>Intervención IA</span>
          <strong>64%</strong>
          <small>38 escalaciones humanas</small>
        </article>
      </section>
      <div className="analytics-grid">
        <section className="panel chart">
          <header>
            <div>
              <p className="eyebrow">VOLUMEN</p>
              <h3>Conversaciones por día</h3>
            </div>
            <Pill tone="success">245 total</Pill>
          </header>
          <div className="bars" aria-label="Gráfico de conversaciones">
            {rows.map(([day, value]) => (
              <div key={day as string}>
                <i style={{ height: (value as number) * 2 + "px" }}>
                  <span>{value}</span>
                </i>
                <b>{day}</b>
              </div>
            ))}
          </div>
          <table className="sr-only">
            <caption>Conversaciones por día</caption>
            <tbody>
              {rows.map((x) => (
                <tr key={x[0]}>
                  <th>{x[0]}</th>
                  <td>{x[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="panel channel">
          <header>
            <div>
              <p className="eyebrow">CANALES</p>
              <h3>Distribución</h3>
            </div>
          </header>
          {[
            ["WhatsApp", 72],
            ["Web", 18],
            ["Instagram", 10],
          ].map(([name, value]) => (
            <div key={name as string}>
              <span>
                <b>{name}</b>
                <strong>{value}%</strong>
              </span>
              <div className="progress">
                <i style={{ width: value + "%" }} />
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const [section, setSection] = useState("Integraciones");
  const [integration, setIntegration] = useState(getWhatsAppIntegration);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrStatus, setQrStatus] = useState(integration.connection);
  const [qrDataUrl, setQrDataUrl] = useState(integration.qrDataUrl);
  const [qrError, setQrError] = useState("");
  const [backendUrl, setBackendUrl] = useState(integration.backendUrl);
  const [backendUrlDraft, setBackendUrlDraft] = useState(integration.backendUrl);
  const [backendError, setBackendError] = useState("");
  const [apiOpen, setApiOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiError, setApiError] = useState("");
  const syncIntegration = () => {
    const value = getWhatsAppIntegration();
    setIntegration(value);
    setBackendUrl(value.backendUrl);
    setBackendUrlDraft(value.backendUrl);
    setQrStatus(value.connection);
    setQrDataUrl(value.qrDataUrl);
  };
  const connectedByQr = integration.connection === "connected" && integration.real;

  useEffect(() => {
    if (!integration.real) return;
    return subscribeWhatsAppStatus((snapshot) => {
      setQrStatus(snapshot.status);
      setQrDataUrl(snapshot.qrDataUrl);
      setIntegration(getWhatsAppIntegration());
      if (snapshot.error) setQrError(snapshot.error);
    }, (error) => setQrError(error.message));
  }, [qrOpen, integration.real]);

  const openQr = () => {
    setQrError("");
    setQrStatus(integration.connection);
    setQrDataUrl(integration.qrDataUrl);
    setQrOpen(true);
    if (!integration.real) return;
    void (async () => {
      try {
        const current = integration.connection === "connected" ? await fetchWhatsAppStatus() : await connectWhatsAppQr();
        setQrStatus(current.status);
        setQrDataUrl(current.qrDataUrl);
        syncIntegration();
      } catch (error) {
        setQrStatus("error");
        setQrError(error instanceof Error ? error.message : "No se pudo iniciar conexión QR");
      }
    })();
  };
  const refreshQr = async () => {
    if (!integration.real) return;
    try {
      const current = qrStatus === "disconnected" || qrStatus === "error"
        ? await connectWhatsAppQr()
        : await fetchWhatsAppQr();
      setQrStatus(current.status);
      setQrDataUrl(current.qrDataUrl);
      setQrError("");
    } catch (error) { setQrError(error instanceof Error ? error.message : "No se pudo obtener QR"); }
  };
  const disconnect = async () => {
    if (!integration.real) return;
    try { await disconnectWhatsAppRemote(); syncIntegration(); setQrStatus("disconnected"); setQrDataUrl(undefined); }
    catch (error) { setQrError(error instanceof Error ? error.message : "No se pudo desconectar"); }
  };
  const saveBackend = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try { const clean = saveWhatsAppBackendUrl(backendUrlDraft); setBackendUrl(clean); setBackendError(""); syncIntegration(); }
    catch (error) { setBackendError(error instanceof Error ? error.message : "URL inválida"); }
  };
  const submitApiKey = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      saveWhatsAppApiKey(apiKey);
      setApiKey("");
      setApiError("");
      setApiOpen(false);
      syncIntegration();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "API key no válida");
    }
  };
  const removeApiKey = () => {
    clearWhatsAppApiKey();
    syncIntegration();
  };
  return (
    <div className="page settings-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN</p>
          <h2>Configuración</h2>
          <p>Equipo, operación, IA e integraciones.</p>
        </div>
      </div>
      <div className="settings-layout">
        <nav>
          {[
            "Equipo y roles",
            "Etapas",
            "Etiquetas",
            "Canales",
            "Horarios",
            "Agente IA",
            "Integraciones",
            "Auditoría",
          ].map((x) => (
            <button
              className={section === x ? "active" : ""}
              onClick={() => setSection(x)}
              key={x}
            >
              {x}
              <ArrowRight />
            </button>
          ))}
        </nav>
        <section className="panel settings-content">
          <p className="eyebrow">{section.toUpperCase()}</p>
          <h3>{section}</h3>
          {section === "Integraciones" ? (
            <>
              <p>Conecta WhatsApp por QR real usando bridge Baileys. Demo local existe solo para revisar interfaz.</p>
              <form className="backend-url-form" onSubmit={saveBackend}>
                <label>URL del backend QR
                  <input value={backendUrlDraft} onChange={(event) => setBackendUrlDraft(event.target.value)} placeholder="https://tu-backend.example.com" inputMode="url" />
                </label>
                <button type="submit">Guardar URL</button>
                {backendError && <small className="api-error">{backendError}</small>}
              </form>
              <div className="integration integration-whatsapp">
                <span className="provider-logo">WA</span>
                <span>
                  <b>WhatsApp</b>
                  <small>{integration.real ? "Bridge configurado · QR real" : "Sin backend configurado · demo local explícito"}</small>
                </span>
                <Pill tone={connectedByQr ? "success" : integration.connection === "error" ? "danger" : integration.real ? "info" : "warning"}>
                  {connectedByQr ? "Conectado por QR real" : integration.connection === "error" ? "Error de backend" : integration.real ? "Backend listo" : "Modo demo"}
                </Pill>
                <span className="integration-actions">
                  <button className="primary" onClick={openQr} disabled={!integration.real} title={!integration.real ? "Configura URL de backend primero" : undefined}>
                    <QrCode /> {connectedByQr ? "Gestionar QR" : "Conectar QR real"}
                  </button>
                  {connectedByQr && (
                    <button onClick={disconnect} title="Desconectar sesión QR">
                      <Link2Off /> Desconectar
                    </button>
                  )}
                </span>
              </div>
              <div className="integration integration-api">
                <span className="provider-logo"><KeyRound /></span>
                <span>
                  <b>API key opcional</b>
                  <small>{integration.hasApiKey ? "Clave guardada en este navegador" : "Añade clave para conectar un proveedor compatible"}</small>
                </span>
                <Pill tone={integration.hasApiKey ? "success" : "neutral"}>
                  {integration.hasApiKey ? "Configurada" : "No configurada"}
                </Pill>
                <span className="integration-actions">
                  <button onClick={() => { setApiError(""); setApiOpen(true); }}>
                    <KeyRound /> {integration.hasApiKey ? "Actualizar" : "Agregar API key"}
                  </button>
                  {integration.hasApiKey && <button onClick={removeApiKey}>Eliminar</button>}
                </span>
              </div>
              <div className="integration">
                <span className="provider-logo">WH</span>
                <span>
                  <b>Webhook</b>
                  <small>Eventos de automatización</small>
                </span>
                <Pill>Próximamente</Pill>
                <button disabled>Configurar</button>
              </div>
              <div className="notice">
                <LockKeyhole /> API key queda en este navegador y se envía solo al backend configurado. Sin URL, no se generan QR falsos.
              </div>
            </>
          ) : (
            <Empty
              title={`${section} listo para configurar`}
              body="Esta sección conservará los cambios localmente durante la demostración."
              action={<button className="primary">Añadir configuración</button>}
            />
          )}
        </section>
      </div>
      {qrOpen && (
        <Drawer title="Vincular WhatsApp por QR" onClose={() => setQrOpen(false)}>
          <div className="qr-connect">
            {qrStatus === "connected" ? (
              <div className="qr-success">
                <CheckCircle2 />
                <h3>WhatsApp conectado</h3>
                <p>Sesión real vinculada en bridge{integration.phone ? ` · ${integration.phone}` : ""}.</p>
                <Pill tone="success">Conectado por QR</Pill>
              </div>
            ) : (
              <>
                {qrDataUrl ? <img className="qr-visual qr-image" src={qrDataUrl} alt="Código QR real de WhatsApp" /> : <div className="qr-placeholder"><QrCode /><span>Esperando QR del backend…</span></div>}
                <h3>{qrStatus === "error" ? "No se pudo conectar" : "Escanea este código desde WhatsApp"}</h3>
                <p>Abre WhatsApp, entra a Dispositivos vinculados y confirma código mostrado por bridge.</p>
                <div className="qr-status"><span className={qrStatus === "error" ? "qr-pulse error" : "qr-pulse"} />{qrStatus === "error" ? "Backend con error" : qrStatus === "connecting" ? "Iniciando sesión…" : "Esperando escaneo…"}</div>
                {qrError && <p className="api-error" role="alert">{qrError}</p>}
                <button className="link qr-refresh" onClick={refreshQr}>
                  <RefreshCw /> Obtener nuevo QR
                </button>
              </>
            )}
            {qrStatus === "connected" && (
              <button className="qr-disconnect" onClick={disconnect}><Link2Off /> Desconectar sesión</button>
            )}
          </div>
        </Drawer>
      )}
      {apiOpen && (
        <Drawer title="Agregar API key" onClose={() => setApiOpen(false)}>
          <form className="api-key-form" onSubmit={submitApiKey}>
            <div className="notice warning"><LockKeyhole /> Se guardará únicamente en localStorage de este navegador. Nunca quedará visible después de guardar.</div>
            <label>
              API key
              <input
                autoFocus
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Pega tu clave aquí"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            {apiError && <p className="api-error" role="alert">{apiError}</p>}
            <div className="drawer-actions">
              <button type="button" onClick={() => setApiOpen(false)}>Cancelar</button>
              <button className="primary" type="submit" disabled={apiKey.trim().length < 8}>Guardar clave</button>
            </div>
          </form>
        </Drawer>
      )}
    </div>
  );
}
