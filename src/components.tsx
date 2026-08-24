import type { ReactNode } from "react";
import { X } from "lucide-react";
export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={"pill " + tone}>{children}</span>;
}
export function Signal({ state }: { state: string }) {
  return (
    <span className={"signal " + state} aria-label={"Estado " + state}>
      <i />
      <i />
      <i />
    </span>
  );
}
export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-mark">∅</span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
export function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="drawer-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Toast({ children }: { children: ReactNode }) {
  return (
    <div className="toast" role="status" aria-live="polite">
      {children}
    </div>
  );
}
