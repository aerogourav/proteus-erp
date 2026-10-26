"use client";

import Link from "next/link";
import { ArrowRight, Boxes, Factory, FileText, PackageCheck, Receipt, ShieldCheck, ShoppingCart, Sparkles, Truck, Users } from "lucide-react";
import { GuideLink } from "@/components/erp/guide-link";
import { STEPS, WORK_STEPS } from "@/components/erp/guide-steps";
import { useErp, useHydrated } from "@/components/erp/store";
import { Badge, EmptyState, PageHead } from "@/components/erp/ui";
import { STAGE_ORDER, formatDate, formatMoney, partNumber, projectRecords, projectStage, revisionLabel } from "@/lib/erp/model";

/** Overview: what the visitor's project looks like across every department. Read-only. */
export function Overview() {
  const state = useErp();
  const hydrated = useHydrated();
  const head = <PageHead eyebrow="Workspace" title="Overview" description="Everything your project has touched, across every department. Changes are made in the guided demo." />;
  if (!hydrated) return <>{head}<p className="erp-muted" role="status">Loading…</p></>;

  const projectId = state.guide.projectId && state.projects.some((item) => item.id === state.guide.projectId) ? state.guide.projectId : state.projects.at(-1)?.id ?? null;
  if (!projectId) return <>{head}<div className="erp-card"><EmptyState title="No project yet" text="Create your project in the guided demo. Every department on the left fills up from that one record.">
    <GuideLink primary>Start the guided demo</GuideLink>
  </EmptyState></div></>;

  const r = projectRecords(state, projectId);
  const project = r.project!;
  const po = r.purchaseOrders[0];
  const line = r.lineItems[0];
  const stage = projectStage(state, projectId);
  const stageIndex = STAGE_ORDER.indexOf(stage);
  const drawing = r.documents.find((doc) => doc.type === "Drawing");
  const procurement = r.procurement[0];
  const production = r.productionOrders[0];
  const report = r.inspectionReports[0];
  const dispatch = r.dispatches[0];
  const invoice = r.invoices[0];
  const finished = Boolean(invoice);
  const step = Math.min(state.guide.step, STEPS.length - 1);

  const kpis = [
    { label: "Order value", value: po?.value != null ? formatMoney(po.value, po.currency) : "—", note: po ? `${po.number}` : "" },
    { label: "Delivery due", value: po ? formatDate(po.deliveryDate) : "—", note: dispatch ? `Shipped ${formatDate(dispatch.dispatchedAt)}` : "Not shipped yet" },
    { label: "Production", value: production?.status ?? "Not released", note: production ? `${production.number} · ${production.quantity} pcs` : "" },
    { label: "Invoiced", value: invoice ? formatMoney(invoice.total, invoice.currency) : "—", note: invoice ? `${invoice.number} · due ${formatDate(invoice.dueAt)}` : "After dispatch" },
  ];

  const depts = [
    { icon: Users, name: "CRM", href: "/demo/crm", value: r.customer?.name ?? "—", status: r.customer ? "Customer" : "", tone: "ok" as const },
    { icon: ShoppingCart, name: "Sales", href: "/demo/sales", value: po?.number ?? "—", status: po ? (dispatch ? "Delivered" : "Open order") : "" },
    { icon: Boxes, name: "Parts", href: "/demo/parts", value: line ? `${partNumber(state, line.partId)} rev ${revisionLabel(state, line.revisionId)}` : "—", status: line ? `${line.quantity} ${line.unit}` : "" },
    { icon: FileText, name: "Documents", href: "/demo/documents", value: drawing?.number ?? "No drawing yet", status: drawing?.status ?? "" },
    { icon: PackageCheck, name: "Purchasing", href: "/demo/materials", value: r.materialRequirements[0]?.material ?? "No material yet", status: procurement?.status ?? "" },
    { icon: Factory, name: "Production", href: "/demo/production", value: production?.number ?? "Not released", status: production?.status ?? "" },
    { icon: ShieldCheck, name: "Quality", href: "/demo/quality", value: report?.number ?? r.inspectionRequirements[0]?.name ?? "No requirement yet", status: report ? "Passed" : r.inspectionRequirements.length ? "Planned" : "" },
    { icon: Truck, name: "Dispatch", href: "/demo/dispatch", value: dispatch?.number ?? "Not dispatched", status: dispatch ? "Dispatched" : "" },
    { icon: Receipt, name: "Finance", href: "/demo/finance", value: invoice?.number ?? "Not invoiced", status: invoice ? "Invoiced" : "" },
  ];

  return <>{head}<div className="erp-stack">
    <section className="erp-card erp-project-head" aria-labelledby="ov-project">
      <div className="erp-head" style={{ margin: 0 }}>
        <div><span className="erp-eyebrow">{project.code} · {r.customer?.name}</span><h2 id="ov-project" style={{ fontSize: 26 }}>{project.name}</h2></div>
        <Badge>{stage}</Badge>
      </div>
      <ol className="erp-lifecycle" aria-label={`Lifecycle: ${stage}`}>{STAGE_ORDER.map((item, index) => <li key={item} className={index < stageIndex || (finished && index === stageIndex) ? "is-done" : index === stageIndex ? "is-current" : ""}>{item}</li>)}</ol>
      <div className="erp-hint" style={{ margin: 0 }}>
        <Sparkles size={16} />
        <span>{finished ? <><b>Complete.</b> Delivered and invoiced, from one record.</> : <><b>Guided demo:</b> step {Math.max(1, Math.min(step, WORK_STEPS))} of {WORK_STEPS}. Continue to move the project forward.</>}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {!finished && <GuideLink primary>Continue</GuideLink>}
          <Link className="erp-btn erp-btn-sm" href={`/demo/projects/${projectId}`}>Project record</Link>
        </span>
      </div>
    </section>

    <section className="erp-kpis" aria-label="Key figures">
      {kpis.map((kpi) => <article key={kpi.label} className="erp-card erp-kpi"><small>{kpi.label}</small><strong>{kpi.value}</strong>{kpi.note && <span>{kpi.note}</span>}</article>)}
    </section>

    <section aria-labelledby="ov-depts">
      <h2 id="ov-depts" className="erp-section-title">Departments</h2>
      <div className="erp-depts">
        {depts.map(({ icon: Icon, name, href, value, status }) => <Link key={name} href={`${href}?project=${projectId}`} className="erp-card erp-dept">
          <span className="erp-dept-icon"><Icon size={18} /></span>
          <span className="erp-dept-body"><small>{name}</small><strong>{value}</strong></span>
          {status ? <Badge>{status}</Badge> : <span className="erp-faint">Waiting</span>}
          <ArrowRight size={15} className="erp-dept-arrow" />
        </Link>)}
      </div>
    </section>

    <section className="erp-card" aria-labelledby="ov-activity">
      <div className="erp-card-head"><div><h2 id="ov-activity">Recent activity</h2><p>Every change, in order, across departments.</p></div></div>
      <ol className="erp-activity">{state.activity.filter((event) => event.projectId === projectId).slice(0, 8).map((event) => <li key={event.id}><time dateTime={event.at}>{formatDate(event.at)}</time><span>{event.text}</span></li>)}</ol>
    </section>
  </div></>;
}
