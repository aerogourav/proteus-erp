"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight, Boxes, ClipboardList, Factory, FileText, PackageCheck, Receipt, ShieldCheck, ShoppingCart, Truck, Users,
} from "lucide-react";
import { stepForAction, useOpenGuide } from "@/components/erp/guide-link";
import { OUTPUT_LABELS, OutputDialog, outputAvailability, type OutputKind } from "@/components/erp/outputs";
import { useErp, useHydrated } from "@/components/erp/store";
import { Badge, EmptyState, ReadinessBadge, ReadinessIcon, Rule } from "@/components/erp/ui";
import {
  RULES, STAGE_ORDER, documentCompleteness, formatDate, formatMoney, projectRecords, projectStage, readiness,
  type Readiness, type ResolveAction,
} from "@/lib/erp/model";

type Dialog = { kind: "output"; output: OutputKind } | null;

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const state = useErp();
  const hydrated = useHydrated();
  const [dialog, setDialog] = useState<Dialog>(null);
  const openGuide = useOpenGuide();
  if (!hydrated) return <p className="erp-muted" role="status">Loading project…</p>;
  const records = projectRecords(state, projectId);
  const { project, customer } = records;
  if (!project || !customer) return <div className="erp-card"><EmptyState title="Project not found" text="It may have been removed when the demo was reset."><Link className="erp-btn erp-btn-primary" href="/demo/projects">All projects</Link><Link className="erp-btn" href="/demo">Demo home</Link></EmptyState></div>;

  const ready = readiness(state, projectId);
  const stage = projectStage(state, projectId);
  const stageIndex = STAGE_ORDER.indexOf(stage);
  const po = records.purchaseOrders[0];
  const docs = documentCompleteness(state, projectId);

  // Department views are read-only: every fix opens the matching step of the guided demo.
  const run = (action: ResolveAction) => openGuide(stepForAction(state, action));

  const cards: { key: string; title: string; icon: typeof Boxes; ready: Readiness; rule: string; extra?: string }[] = [
    { key: "engineering", title: "Engineering", icon: FileText, ready: ready.engineering, rule: RULES.engineering, extra: `${docs.approved} of ${docs.total} documents approved` },
    { key: "materials", title: "Materials", icon: PackageCheck, ready: ready.materials, rule: RULES.materials },
    { key: "inspection", title: "Inspection requirements", icon: ClipboardList, ready: ready.inspection, rule: RULES.inspection },
    { key: "production", title: "Production", icon: Factory, ready: ready.production, rule: RULES.production },
    { key: "quality", title: "Quality", icon: ShieldCheck, ready: ready.quality, rule: RULES.quality },
    { key: "dispatch", title: "Delivery", icon: Truck, ready: ready.dispatch, rule: RULES.dispatch, extra: po ? `Due ${formatDate(po.deliveryDate)}` : undefined },
  ];

  const related = [
    { icon: Users, label: "Customer", value: customer.name, href: `/demo/crm?project=${projectId}` },
    { icon: ShoppingCart, label: "Purchase order", value: po ? `${po.number}${po.value !== null ? ` · ${formatMoney(po.value, po.currency)}` : ""}` : "—", href: `/demo/sales?project=${projectId}` },
    { icon: Boxes, label: "Line items · parts", value: records.lineItems.map((line) => `${state.parts.find((part) => part.id === line.partId)?.number} ×${line.quantity}`).join(", "), href: `/demo/parts?project=${projectId}` },
    { icon: FileText, label: "Documents", value: `${records.documents.length} linked · ${docs.approved} approved`, href: `/demo/documents?project=${projectId}` },
    { icon: PackageCheck, label: "Materials & procurement", value: `${records.materialRequirements.length} requirement${records.materialRequirements.length === 1 ? "" : "s"} · ${records.procurement.filter((item) => item.status === "Received").length} received`, href: `/demo/materials?project=${projectId}` },
    { icon: Factory, label: "Production orders", value: records.productionOrders.length ? records.productionOrders.map((order) => `${order.number} (${order.status.toLowerCase()})`).join(", ") : "None yet", href: `/demo/production?project=${projectId}` },
    { icon: ShieldCheck, label: "Inspection", value: `${records.inspectionRequirements.length} requirement${records.inspectionRequirements.length === 1 ? "" : "s"} · ${records.inspectionReports[0] ? records.inspectionReports[0].number : "no report"}`, href: `/demo/quality?project=${projectId}` },
    { icon: Truck, label: "Dispatch", value: records.dispatches[0]?.number ?? "Not dispatched", href: `/demo/dispatch?project=${projectId}` },
    { icon: Receipt, label: "Invoice", value: records.invoices[0] ? `${records.invoices[0].number} · ${formatMoney(records.invoices[0].total, records.invoices[0].currency)}` : "Not invoiced", href: `/demo/finance?project=${projectId}` },
  ];

  const outputs: OutputKind[] = ["po", "production", "inspection", "dispatch", "invoice"];
  const nextStep = Object.values(ready).flatMap((item) => item.reasons).find((reason) => reason.action);

  return <div className="erp-stack">
    <section className="erp-card erp-project-head" aria-labelledby="project-title">
      <div className="erp-head" style={{ margin: 0 }}>
        <div><span className="erp-eyebrow">{project.code}{project.isSample ? " · sample project" : ""}</span><h1 id="project-title">{project.name}</h1>{project.description && <p>{project.description}</p>}</div>
        <Badge>{stage}</Badge>
      </div>
      <div className="erp-project-meta">
        <span>Customer <b>{customer.name}</b></span>
        {po && <span>PO <b>{po.number}</b></span>}
        <span>Line items <b>{records.lineItems.length}</b></span>
        {po && <span>Delivery <b>{formatDate(po.deliveryDate)}</b></span>}
      </div>
      <ol className="erp-lifecycle" aria-label={`Lifecycle: ${stage}`}>{STAGE_ORDER.map((item, index) => <li key={item} className={index < stageIndex ? "is-done" : index === stageIndex ? "is-current" : ""}>{item}</li>)}</ol>
      {nextStep?.action && <div className="erp-hint" style={{ margin: 0 }}><ArrowRight size={16} /><span><b>Next step:</b> {nextStep.text}</span><button type="button" className="erp-btn erp-btn-primary erp-btn-sm" style={{ marginLeft: "auto" }} onClick={() => run(nextStep.action!)}>{nextStep.action.label} in guided demo</button></div>}
    </section>

    <section className="erp-status-grid" aria-label="Readiness">
      {cards.map(({ key, title, icon: Icon, ready: item, rule, extra }) => <article key={key} className="erp-card erp-status">
        <header><h3><Icon size={16} /> {title}</h3><ReadinessBadge state={item.state} /></header>
        <p>{item.summary}{extra ? ` · ${extra}` : ""}</p>
        {item.reasons.length > 0 && <ul className="erp-reasons">{item.reasons.map((reason, index) => <li key={index}>
          <span><ReadinessIcon state={item.state} />{reason.text}</span>
          {reason.action && <button type="button" className="erp-btn erp-btn-sm" onClick={() => run(reason.action!)}>{reason.action.label}</button>}
        </li>)}</ul>}
        <p className="erp-faint">{rule}</p>
      </article>)}
    </section>

    <div className="erp-grid-2">
      <section className="erp-card" aria-labelledby="related-title">
        <div className="erp-card-head"><div><h2 id="related-title">Connected records</h2><p>One project, linked across every module.</p></div></div>
        <nav className="erp-related">{related.map(({ icon: Icon, label, value, href }) => <Link key={label} href={href}><Icon size={16} /><span><small>{label}</small><br />{value}</span><ArrowRight size={14} /></Link>)}</nav>
      </section>
      <div className="erp-stack">
        <section className="erp-card" aria-labelledby="outputs-title">
          <div className="erp-card-head"><div><h2 id="outputs-title">Outputs from the same data</h2><p>Nothing is typed again. Illustrative documents.</p></div></div>
          <div className="erp-outputs" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
            {outputs.map((kind) => { const available = outputAvailability(state, projectId, kind); return <button key={kind} type="button" className="erp-output" disabled={!available.ok} onClick={() => setDialog({ kind: "output", output: kind })}><FileText size={18} /><strong>{OUTPUT_LABELS[kind]}</strong><span>{available.ok ? "Preview & print" : available.reason}</span></button>; })}
          </div>
        </section>
        <section className="erp-card" aria-labelledby="activity-title">
          <div className="erp-card-head"><div><h2 id="activity-title">Activity</h2><p>What changed, in order.</p></div></div>
          <ol className="erp-activity">{state.activity.filter((event) => event.projectId === projectId).slice(0, 8).map((event) => <li key={event.id}><time dateTime={event.at}>{formatDate(event.at)}</time><span>{event.text}</span></li>)}</ol>
        </section>
      </div>
    </div>

    <Rule>Every status on this page is calculated from the linked records. Change a record and the status changes with it.</Rule>

    {dialog?.kind === "output" && <OutputDialog state={state} projectId={projectId} kind={dialog.output} onClose={() => setDialog(null)} />}
  </div>;
}
