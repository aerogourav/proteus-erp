"use client";

import { PackOverview } from "@/components/erp/overview-packs";
import { industryOf } from "@/lib/erp/packs";
import type { ReactNode } from "react";
import { BarList, CHART_COLORS, CHART_NEUTRAL, StackedBar } from "@/components/erp/charts";
import { CustomValuesView } from "@/components/erp/edit";

import Link from "next/link";
import { ArrowRight, Boxes, Building2, Layers, Factory, FileText, PackageCheck, Receipt, ShieldCheck, ShoppingCart, Sparkles, Truck, Users } from "lucide-react";
import { GuideLink, focusProject } from "@/components/erp/guide-link";
import { startAnotherProject } from "@/components/erp/guided";
import { commit } from "@/components/erp/store";
import { useRouter } from "next/navigation";
import { guideSteps, workStepCount } from "@/components/erp/guide-steps";
import { useErp, useHydrated } from "@/components/erp/store";
import { Badge, EmptyState, PageHead } from "@/components/erp/ui";
import { alerts } from "@/lib/erp/alerts";
import { kpiSummary } from "@/lib/erp/shopfloor";
import { STAGE_ORDER, recentActivity, addDays, financeSummary, isProductionComplete, rawMaterialRows, rawMaterialStats, type WidgetKey, formatDate, formatMoney, partNumber, projectRecords, projectStage, revisionLabel } from "@/lib/erp/model";

/** Overview: what the visitor's project looks like across every department. Read-only. */
export function Overview() {
  const state = useErp();
  const hydrated = useHydrated();
  const router = useRouter();
  const head = <PageHead eyebrow="Workspace" title="Overview" description="What needs attention today, the selected project across every department, and the figures behind it." />;
  if (!hydrated) return <>{head}<p className="erp-muted" role="status">Loading…</p></>;
  if (industryOf(state) !== "manufacturing") return <PackOverview state={state} />;

  const projectId = state.guide.projectId && state.projects.some((item) => item.id === state.guide.projectId) ? state.guide.projectId : state.projects.at(-1)?.id ?? null;
  if (!projectId) return <>{head}<div className="erp-card"><EmptyState title="No project yet" text="Create your project in the guided demo. Every department on the left fills up from that one record.">
    <GuideLink primary>Start the guided demo</GuideLink>
  </EmptyState></div></>;

  const r = projectRecords(state, projectId);
  const project = r.project!;
  const po = r.purchaseOrders[0];
  const stage = projectStage(state, projectId);
  const stageIndex = STAGE_ORDER.indexOf(stage);
  const drawings = r.documents.filter((doc) => doc.type === "Drawing");
  const approved = drawings.filter((doc) => doc.status === "Approved").length;
  const received = r.procurement.filter((item) => item.status === "Received").length;
  const orders = r.productionOrders;
  const completeOrders = orders.filter((order) => isProductionComplete(order.status)).length;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const report = r.inspectionReports[0];
  const dispatch = r.dispatches[0];
  const invoice = r.invoices[0];
  const finished = Boolean(invoice);
  const steps = guideSteps(state);
  const WORK_STEPS = workStepCount(steps);
  const step = Math.min(state.guide.step, steps.length - 1);

  const kpis = [
    { label: "Order value", value: po?.value != null ? formatMoney(po.value, po.currency) : "—", note: po ? `${po.number}` : "" },
    { label: "Delivery due", value: po ? formatDate(po.deliveryDate) : "—", note: dispatch ? `Shipped ${formatDate(dispatch.dispatchedAt)}` : "Not shipped yet" },
    { label: "Production", value: orders.length ? `${completeOrders} of ${r.lineItems.length} complete` : "Not released", note: orders.length ? orders.map((order) => order.number).join(", ") : plural(r.lineItems.length, "part") },
    { label: "Invoiced", value: invoice ? formatMoney(invoice.total, invoice.currency) : "—", note: invoice ? `${invoice.number} · due ${formatDate(invoice.dueAt)}` : "After dispatch" },
  ];

  const depts = [
    { icon: Users, name: "CRM", href: "/demo/crm", value: r.customer?.name ?? "—", status: r.customer ? "Customer" : "", tone: "ok" as const },
    { icon: ShoppingCart, name: "Sales", href: "/demo/sales", value: po?.number ?? "—", status: po ? (dispatch ? "Delivered" : "Open order") : "" },
    { icon: Boxes, name: "Parts", href: "/demo/parts", value: r.lineItems.map((line) => `${partNumber(state, line.partId)} rev ${revisionLabel(state, line.revisionId)}`).join(", ") || "—", status: plural(r.lineItems.length, "part") },
    { icon: FileText, name: "Documents", href: "/demo/documents", value: drawings.length ? plural(drawings.length, "drawing") : "No drawing yet", status: drawings.length ? (approved === drawings.length ? "Approved" : `${approved} of ${drawings.length} approved`) : "" },
    { icon: PackageCheck, name: "Purchasing", href: "/demo/materials", value: r.materialRequirements.map((req) => req.material).join(", ") || "No material yet", status: r.procurement.length ? (received === r.procurement.length ? "Received" : `${received} of ${r.procurement.length} received`) : "" },
    { icon: Layers, name: "Raw materials", href: "/demo/raw-materials", value: [...new Set(r.materialRequirements.map((req) => req.material))].join(", ") || "—", status: r.materialRequirements.length ? `${r.materialRequirements.length} requirement${r.materialRequirements.length === 1 ? "" : "s"}` : "" },
    { icon: Building2, name: "Suppliers", href: "/demo/suppliers", value: [...new Set(r.procurement.map((item) => item.supplier).filter(Boolean))].join(", ") || "Not chosen", status: r.procurement.length ? `${r.procurement.filter((item) => item.status !== "Received").length} open` : "" },
    { icon: Factory, name: "Production", href: "/demo/production", value: orders.length ? orders.map((order) => order.number).join(", ") : "Not released", status: orders.length ? (completeOrders === orders.length ? "Complete" : `${completeOrders} of ${orders.length} complete`) : "" },
    { icon: ShieldCheck, name: "Quality", href: "/demo/quality", value: report?.number ?? (r.inspectionRequirements.length ? plural(r.inspectionRequirements.length, "parameter") : "No requirement yet"), status: report ? (report.passed ? "Passed" : "Failed") : r.inspectionRequirements.length ? "Planned" : "" },
    { icon: Truck, name: "Dispatch", href: "/demo/dispatch", value: dispatch?.number ?? "Not dispatched", status: dispatch ? "Dispatched" : "" },
    { icon: Receipt, name: "Finance", href: "/demo/finance", value: invoice?.number ?? "Not invoiced", status: invoice ? "Invoiced" : "" },
  ];

  const switcher = <div className="erp-switcher">
    <label htmlFor="ov-switch">Project</label>
    <select className="erp-select" id="ov-switch" value={projectId} onChange={(event) => commit((value) => focusProject(value, event.target.value))}>
      {[...state.projects].reverse().map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
    </select>
    <button type="button" className="erp-btn erp-btn-sm" onClick={() => { startAnotherProject(); router.push("/demo"); }}>+ New project</button>
  </div>;

  // Portfolio-wide figures for the charts (all projects in this browser).
  const today = new Date().toISOString().slice(0, 10);
  const fin = financeSummary(state, today);
  const stageCounts = STAGE_ORDER.map((item) => ({ stage: item, count: state.projects.filter((p) => projectStage(state, p.id) === item).length }));
  const allOrders = state.productionOrders;
  const statusGroups = [
    { label: "Planned", value: allOrders.filter((o) => o.status === "Planned").length, color: CHART_NEUTRAL },
    { label: "Running / in process", value: allOrders.filter((o) => o.status === "Running" || o.status === "In process" || o.status === "In progress").length, color: CHART_COLORS[1] },
    { label: "Completed", value: allOrders.filter((o) => isProductionComplete(o.status)).length, color: CHART_COLORS[2] },
    { label: "Custom status", value: allOrders.filter((o) => !["Planned", "Running", "In process", "In progress"].includes(o.status) && !isProductionComplete(o.status)).length, color: CHART_COLORS[3] },
  ];
  const materials = rawMaterialRows(state).map((m) => ({ m, ...rawMaterialStats(state, m) }));
  const money = (value: number) => formatMoney(value, state.settings.defaultCurrency);

  const todayKey = today;
  const alertList = alerts(state, todayKey);
  const kpi = kpiSummary(state, { from: addDays(todayKey, -6) }, todayKey);
  const widgets: Record<WidgetKey, ReactNode> = {
    alerts: <section className="erp-card" aria-labelledby="ov-alerts">
      <div className="erp-card-head"><div><h2 id="ov-alerts">Needs attention</h2><p>{alertList.length ? `${alertList.length} item${alertList.length === 1 ? "" : "s"} across departments, most urgent first.` : "Nothing urgent across the departments."}</p></div></div>
      {alertList.length ? <ul className="erp-alerts">{alertList.slice(0, 8).map((item) => <li key={item.id} className={`is-${item.tone}`}><span className="erp-alert-area">{item.area}</span><span>{item.text}</span><Link className="erp-btn erp-btn-sm" href={item.href}>{item.action}</Link></li>)}</ul> : <p className="erp-card-pad erp-ok-text">All clear.</p>}
    </section>,
    shopFloor: <section className="erp-card erp-card-pad erp-stack" aria-labelledby="ov-sf"><h2 id="ov-sf" className="erp-chart-title">Shop floor, last 7 days</h2>
      <div className="erp-mini-stats"><span><small>Operations</small><b>{kpi.operations}</b></span><span><small>Efficiency</small><b>{kpi.efficiency === null ? "—" : `${Math.round(kpi.efficiency)}%`}</b></span><span><small>Scrap</small><b>{kpi.scrapRate === null ? "—" : `${kpi.scrapRate}%`}</b></span><span><small>Running now</small><b>{state.activeOps.length}</b></span></div>
      {state.activeOps.length ? <ul className="erp-reasons">{state.activeOps.map((op) => { const order = state.productionOrders.find((item) => item.id === op.orderId); const who = state.employees.find((item) => item.id === op.employeeId); return <li key={op.id}><span><b style={{ color: "var(--e-text)" }}>{order?.number} · Op {op.seq}</b> · {order ? partNumber(state, order.partId) : ""} · {who?.name} since {new Date(op.start).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span></li>; })}</ul> : <p className="erp-faint">No operation running.</p>}
      <Link className="erp-link" href="/demo/shop-floor">Open the shop floor</Link></section>,
    project: <section className="erp-card erp-project-head" aria-labelledby="ov-project">
      <div className="erp-head" style={{ margin: 0 }}>
        <div><span className="erp-eyebrow">{project.code} · {r.customer?.name}</span><h2 id="ov-project" style={{ fontSize: 26 }}>{project.name}</h2><CustomValuesView state={state} entity="project" custom={project.custom} /></div>
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
    </section>,
    kpis: <section className="erp-kpis" aria-label="Key figures">
      {kpis.map((kpi) => <article key={kpi.label} className="erp-card erp-kpi"><small>{kpi.label}</small><strong>{kpi.value}</strong>{kpi.note && <span>{kpi.note}</span>}</article>)}
    </section>,
    pipeline: <section className="erp-card erp-card-pad erp-stack" aria-labelledby="ov-pipe"><h2 id="ov-pipe" className="erp-chart-title">Project pipeline</h2><p className="erp-faint">All {state.projects.length} project{state.projects.length === 1 ? "" : "s"} by stage.</p>
      <BarList label="Projects by stage" data={stageCounts.filter((item) => item.count > 0).map((item) => ({ label: item.stage, value: item.count, display: String(item.count), color: CHART_COLORS[0] }))} /></section>,
    orderValue: <section className="erp-card erp-card-pad erp-stack" aria-labelledby="ov-value"><h2 id="ov-value" className="erp-chart-title">Order value by project</h2>
      <BarList label="Order value by project" data={fin.projects.filter((row) => row.orderValue > 0).sort((x, y) => y.orderValue - x.orderValue).map((row) => ({ label: row.project.code, value: row.orderValue, display: formatMoney(row.orderValue, row.currency), note: row.project.name, color: CHART_COLORS[1] }))} /></section>,
    production: <section className="erp-card erp-card-pad erp-stack" aria-labelledby="ov-prod"><h2 id="ov-prod" className="erp-chart-title">Production orders by status</h2>
      <StackedBar label="Production orders by status" data={statusGroups.map((item) => ({ ...item, display: String(item.value) }))} empty="No production orders yet." /></section>,
    finance: <section className="erp-card erp-card-pad erp-stack" aria-labelledby="ov-fin"><h2 id="ov-fin" className="erp-chart-title">Revenue and receivables</h2>
      <div className="erp-mini-stats"><span><small>Order book</small><b>{money(fin.orderBook)}</b></span><span><small>Invoiced</small><b>{money(fin.invoiced)}</b></span><span><small>Receivable</small><b>{money(fin.receivable)}</b></span></div>
      <StackedBar label="Invoices by payment status" data={[{ label: "Paid", value: fin.paid, display: money(fin.paid), color: CHART_COLORS[2] }, { label: "Open", value: fin.receivable - fin.overdue, display: money(fin.receivable - fin.overdue), color: CHART_COLORS[1] }, { label: "Overdue", value: fin.overdue, display: money(fin.overdue), color: CHART_COLORS[3] }]} empty="No invoices yet." />
      <Link className="erp-link" href="/demo/finance">Open Finance</Link></section>,
    stock: <section className="erp-card erp-card-pad erp-stack" aria-labelledby="ov-stock"><h2 id="ov-stock" className="erp-chart-title">Raw material demand</h2><p className="erp-faint">{materials.filter((item) => item.lowStock).length} below reorder level.</p>
      <BarList label="Open demand by raw material" data={materials.filter((item) => item.toBuy + item.onOrder > 0).map((item) => ({ label: item.m.name, value: item.toBuy + item.onOrder, display: `${item.toBuy + item.onOrder} ${item.m.unit}`, note: `${item.toBuy} to buy · ${item.onOrder} on order`, color: item.lowStock ? CHART_COLORS[3] : CHART_COLORS[1] }))} empty="No open material demand." />
      <Link className="erp-link" href="/demo/raw-materials">Open Raw materials</Link></section>,
    departments: <section aria-labelledby="ov-depts">
      <h2 id="ov-depts" className="erp-section-title">Departments</h2>
      <div className="erp-depts">
        {depts.map(({ icon: Icon, name, href, value, status }) => <Link key={name} href={`${href}?project=${projectId}`} className="erp-card erp-dept">
          <span className="erp-dept-icon"><Icon size={18} /></span>
          <span className="erp-dept-body"><small>{name}</small><strong>{value}</strong><span>{status ? <Badge>{status}</Badge> : <span className="erp-faint">Waiting</span>}</span></span>
          <ArrowRight size={15} className="erp-dept-arrow" />
        </Link>)}
      </div>
    </section>,
    activity: <section className="erp-card" aria-labelledby="ov-activity">
      <div className="erp-card-head"><div><h2 id="ov-activity">Recent activity</h2><p>Every change, in order, across departments.</p></div></div>
      <ol className="erp-activity">{recentActivity(state, projectId).map((event) => <li key={event.id}><time dateTime={event.at}>{formatDate(event.at)}</time><span>{event.text}</span></li>)}</ol>
    </section>,
  };
  const CHARTS: WidgetKey[] = ["pipeline", "orderValue", "production", "shopFloor", "finance", "stock"];
  const visible = state.settings.widgets.filter((widget) => widget.visible).map((widget) => widget.key);
  // Consecutive chart widgets share a two-column grid.
  const blocks: WidgetKey[][] = [];
  for (const key of visible) {
    const last = blocks.at(-1);
    if (CHARTS.includes(key) && last && CHARTS.includes(last[0])) last.push(key); else blocks.push([key]);
  }

  return <>{head}{switcher}<div className="erp-stack">
    {blocks.map((block) => block.length > 1 || CHARTS.includes(block[0]) ? <div key={block.join("-")} className="erp-grid-2">{block.map((key) => <div key={key}>{widgets[key]}</div>)}</div> : <div key={block[0]}>{widgets[block[0]]}</div>)}
    {!visible.length && <div className="erp-card"><EmptyState title="All widgets are hidden" text="Choose widgets in Configuration → Dashboard."><Link className="erp-btn" href="/demo/configuration">Configure dashboard</Link></EmptyState></div>}
    <p className="erp-faint">Choose and order these widgets in <Link className="erp-link" href="/demo/configuration">Configuration</Link>.</p>
  </div></>;
}
