import { useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Filter,
  GripVertical,
  MoreHorizontal,
  Paperclip,
  Pause,
  Play,
  Plus,
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
import type { Automation, Contact, Deal, Module } from "./types";
import { Drawer, Empty, Pill, Signal, Toast } from "./components";
const money = (n: number) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    maximumFractionDigits: 0,
  }).format(n);
export function Dashboard({ go }: { go: (m: Module) => void }) {
  const { data } = useStore();
  const open = data.conversations.filter((x) => x.status !== "resuelta");
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
          <strong>4m 18s</strong>
          <small>Objetivo: menos de 5 min</small>
        </article>
        <article>
          <span>Negocios en riesgo</span>
          <strong>3</strong>
          <small className="danger">Requieren seguimiento</small>
        </article>
        <article>
          <span>Valor del embudo</span>
          <strong>{money(data.deals.reduce((s, x) => s + x.value, 0))}</strong>
          <small>4 oportunidades activas</small>
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
          {open.slice(0, 3).map((v) => {
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
                    [
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
                  data.deals
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
  const [selected, setSelected] = useState(
    initial || data.conversations[0]?.id,
  );
  const [queue, setQueue] = useState("Todas");
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState(false);
  const [context, setContext] = useState(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  const list = data.conversations.filter(
    (x) => queue === "Todas" || x.queue === queue,
  );
  const cv = data.conversations.find((x) => x.id === selected);
  const contact = data.contacts.find((x) => x.id === cv?.contactId);
  const update = (patch: Partial<NonNullable<typeof cv>>) =>
    setData((d) => ({
      ...d,
      conversations: d.conversations.map((x) =>
        x.id === selected ? { ...x, ...patch } : x,
      ),
    }));
  const send = () => {
    if (!draft.trim() || !cv) return;
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
                  body: draft,
                  time: "Ahora",
                  note,
                },
              ],
            }
          : x,
      ),
    }));
    setDraft("");
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
                ? data.conversations.length
                : data.conversations.filter((x) => x.queue === q).length}
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
            {data.conversations.filter((x) => x.status === "resuelta").length}
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
              <button className="ai-suggest">
                <Sparkles /> Sugerir
              </button>
            </div>
            <textarea
              ref={composer}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={offline ? "Sin conexión" : "Escribe un mensaje…"}
              disabled={offline}
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
                  : "Enter para enviar · Shift+Enter nueva línea"}
              </small>
              <button
                className="send"
                onClick={send}
                disabled={offline || !draft.trim()}
              >
                <Send /> Enviar
              </button>
            </div>
          </footer>
        </section>
      ) : (
        <Empty
          title="Sin conversación"
          body="Selecciona una conversación para empezar."
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
        </Drawer>
      )}
    </div>
  );
}

export function Contacts() {
  const { data, setData } = useStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Contact | null>(null);
  const [creating, setCreating] = useState(false);
  const list = data.contacts.filter((c) =>
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
            {data.contacts.length} personas · datos persistidos en este
            navegador
          </p>
        </div>
        <button className="primary" onClick={() => setCreating(true)}>
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
            body="Prueba con otro término de búsqueda."
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
            {money(data.deals.reduce((s, x) => s + x.value, 0))} en valor total
          </p>
        </div>
        <button className="primary">
          <Plus /> Nuevo negocio
        </button>
      </div>
      <div className="board">
        {stages.map((stage) => {
          const deals = data.deals.filter((x) => x.stage === stage);
          return (
            <section
              className="stage"
              key={stage}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const d = data.deals.find(
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
                const c = data.contacts.find((x) => x.id === d.contactId)!;
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
                        <small>{c.company}</small>
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
              <button className="add-card">
                <Plus /> Añadir negocio
              </button>
            </section>
          );
        })}
      </div>
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
              <p>
                Conecta proveedores externos cuando sus credenciales estén
                disponibles.
              </p>
              <div className="integration">
                <span className="provider-logo">WA</span>
                <span>
                  <b>WhatsApp</b>
                  <small>Proveedor de mensajería</small>
                </span>
                <Pill tone="warning">Pendiente de API</Pill>
                <button>Configurar</button>
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
                <CircleAlert /> Esta demo no realiza llamadas externas ni
                almacena credenciales.
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
    </div>
  );
}
