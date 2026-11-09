"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Info } from "lucide-react";
import type { ReadinessState } from "@/lib/erp/model";

/** Page header: breadcrumb (section / page), title, description and the page's primary actions. */
export function PageHead({ eyebrow, title, description, actions, crumbs }: { eyebrow: string; title: string; description: string; actions?: ReactNode; crumbs?: { label: string; href: string }[] }) {
  return <header className="erp-head">
    <div>
      <nav aria-label="Breadcrumb"><ol className="erp-crumbs">
        {eyebrow !== title && <li>{eyebrow}</li>}
        {crumbs?.map((crumb) => <li key={crumb.href}><Link href={crumb.href}>{crumb.label}</Link></li>)}
        <li aria-current="page">{title}</li>
      </ol></nav>
      <h1>{title}</h1>{description && <p>{description}</p>}
    </div>
    {actions && <div className="erp-head-actions">{actions}</div>}
  </header>;
}

type Tone = "ok" | "warn" | "bad" | "info" | "neutral";

const toneFor: Record<string, Tone> = {
  Approved: "ok", Complete: "ok", Received: "ok", Passed: "ok", Dispatched: "ok", Invoiced: "ok", "Ready to dispatch": "ok", "Ready for production": "info", Issued: "ok",
  "In review": "warn", Ordered: "warn", "In progress": "info", Running: "info", "In process": "info", Completed: "ok", "In production": "info", Quality: "info", Planned: "neutral", Draft: "neutral",
  "Not ordered": "bad", Engineering: "warn", Procurement: "warn", Blocked: "bad", Failed: "bad", "Not ready": "bad",
};

export function Badge({ children, tone }: { children: string; tone?: Tone }) {
  const resolved = tone ?? toneFor[children] ?? "neutral";
  return <span className={`erp-badge${resolved === "neutral" ? "" : ` erp-badge-${resolved}`}`}>{children}</span>;
}

export function ReadinessBadge({ state, label }: { state: ReadinessState; label?: string }) {
  if (state === "complete") return <Badge tone="ok">{label ?? "Ready"}</Badge>;
  if (state === "incomplete") return <Badge tone="warn">{label ?? "Action needed"}</Badge>;
  return <Badge tone="bad">{label ?? "Blocked"}</Badge>;
}

export function ReadinessIcon({ state }: { state: ReadinessState }) {
  if (state === "complete") return <CheckCircle2 size={16} color="var(--e-ok)" aria-hidden="true" />;
  if (state === "incomplete") return <CircleDashed size={16} color="var(--e-warn)" aria-hidden="true" />;
  return <AlertTriangle size={16} color="var(--e-bad)" aria-hidden="true" />;
}

export function Rule({ children }: { children: ReactNode }) {
  return <p className="erp-rule"><Info size={15} aria-hidden="true" /><span><b>Rule:</b> {children}</span></p>;
}

export function EmptyState({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return <div className="erp-empty"><h3>{title}</h3><p>{text}</p>{children && <div className="erp-head-actions">{children}</div>}</div>;
}

export function ProjectLink({ id, code }: { id: string; code: string }) {
  return <Link className="erp-chip" href={`/demo/projects/${id}`}>{code}</Link>;
}

/** Simple modal with focus handling and Escape to close. */
export function Modal({ label, onClose, children, wide = false }: { label: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; previous?.focus(); };
  }, [onClose]);
  return <div className="erp-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} className={wide ? "erp-dialog" : "erp-dialog-panel"}>{children}</div>
  </div>;
}

export function Field({ id, label, help, error, children, className }: { id: string; label: string; help?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return <div className={`erp-field${className ? ` ${className}` : ""}`}>
    <label htmlFor={id}>{label}</label>
    {children}
    {error ? <span className="erp-error" id={`${id}-error`} role="alert">{error}</span> : help ? <span className="erp-help" id={`${id}-help`}>{help}</span> : null}
  </div>;
}
