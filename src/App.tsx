import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  MessagesSquare,
  Users,
  BriefcaseBusiness,
  Workflow,
  Bot,
  ChartNoAxesCombined,
  Settings,
  Search,
  ChevronsUpDown,
  WifiOff,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import type { Module } from "./types";
import {
  Dashboard,
  Inbox,
  Contacts,
  Pipeline,
  Automations,
  AiCenter,
  Analytics,
  SettingsPage,
} from "./pages";
const primary = [
  ["inicio", "Inicio", LayoutDashboard],
  ["bandeja", "Bandeja", MessagesSquare],
  ["contactos", "Contactos", Users],
  ["negocios", "Negocios", BriefcaseBusiness],
  ["automatizacion", "Automatización", Workflow],
] as const;
const secondary = [
  ["ia", "Agente IA", Bot],
  ["analitica", "Analítica", ChartNoAxesCombined],
  ["configuracion", "Configuración", Settings],
] as const;
const title: Record<Module, string> = {
  inicio: "Centro de operaciones",
  bandeja: "Bandeja compartida",
  contactos: "Contactos",
  negocios: "Embudo comercial",
  automatizacion: "Automatización",
  ia: "Agente IA",
  analitica: "Analítica",
  configuracion: "Configuración",
};
function current(): Module {
  const val = location.hash.slice(1).split("/")[0] as Module;
  return [...primary, ...secondary].some((x) => x[0] === val) ? val : "inicio";
}
export default function App() {
  const [module, setModule] = useState<Module>(current);
  const [expanded, setExpanded] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const search = useRef<HTMLInputElement>(null);
  const go = (m: Module) => {
    setModule(m);
    location.hash = m;
  };
  useEffect(() => {
    const hash = () => setModule(current());
    addEventListener("hashchange", hash);
    const on = () => setOffline(false),
      off = () => setOffline(true);
    addEventListener("online", on);
    addEventListener("offline", off);
    const key = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        search.current?.focus();
      }
      if (e.altKey && e.key >= "1" && e.key <= "5") go(primary[+e.key - 1][0]);
    };
    addEventListener("keydown", key);
    return () => {
      removeEventListener("hashchange", hash);
      removeEventListener("online", on);
      removeEventListener("offline", off);
      removeEventListener("keydown", key);
    };
  }, []);
  return (
    <div className={"app " + (expanded ? "rail-open" : "")}>
      <aside className="rail" aria-label="Navegación principal">
        <button
          className="brand"
          onClick={() => go("inicio")}
          aria-label="Pulso inicio"
        >
          <span>P</span>
          {expanded && <b>PULSO</b>}
        </button>
        <nav>
          {primary.map(([id, label, Icon]) => (
            <button
              key={id}
              className={module === id ? "active" : ""}
              onClick={() => go(id)}
              title={label}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <nav className="secondary">
          {secondary.map(([id, label, Icon]) => (
            <button
              key={id}
              className={module === id ? "active" : ""}
              onClick={() => go(id)}
              title={label}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
          <button
            onClick={() => setExpanded((x) => !x)}
            title="Expandir navegación"
          >
            {expanded ? <PanelLeftClose /> : <PanelLeftOpen />}
            <span>Contraer</span>
          </button>
        </nav>
      </aside>
      <header className="top">
        <div>
          <p className="eyebrow">PULSO / OPERACIÓN</p>
          <h1>{title[module]}</h1>
        </div>
        <label className="global-search">
          <Search />
          <span className="sr-only">Búsqueda global</span>
          <input ref={search} placeholder="Buscar en Pulso" />
          <kbd>/</kbd>
        </label>
        <button className="team">
          <i /> Equipo activo <ChevronsUpDown />
        </button>
        <button className="avatar" aria-label="Menú de Ana Torres">
          AT
        </button>
      </header>
      {offline && (
        <div className="offline">
          <WifiOff /> Sin conexión externa. Modo local activo; mensajes y cambios
          quedan guardados en este navegador.
        </div>
      )}
      <main>
        {module === "inicio" ? (
          <Dashboard go={go} />
        ) : module === "bandeja" ? (
          <Inbox offline={offline} />
        ) : module === "contactos" ? (
          <Contacts />
        ) : module === "negocios" ? (
          <Pipeline />
        ) : module === "automatizacion" ? (
          <Automations />
        ) : module === "ia" ? (
          <AiCenter />
        ) : module === "analitica" ? (
          <Analytics />
        ) : (
          <SettingsPage />
        )}
      </main>
      <nav className="mobile-nav" aria-label="Navegación móvil">
        {primary.map(([id, label, Icon]) => (
          <button
            key={id}
            className={module === id ? "active" : ""}
            onClick={() => go(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
