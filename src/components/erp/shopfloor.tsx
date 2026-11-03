"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, CircleStop, Download, Play, Plus, Timer, Trash2, UserRound, X } from "lucide-react";
import { BarList, CHART_COLORS, Columns, Stat } from "@/components/erp/charts";
import { downloadBlob } from "@/components/erp/file-store";
import { Loading, NoProjects } from "@/components/erp/modules";
import { commit, nowIso, todayIso, useErp, useHydrated } from "@/components/erp/store";
import { toast } from "@/components/erp/toast";
import { Badge, EmptyState, Field, Modal, PageHead, ProjectLink, Rule } from "@/components/erp/ui";
import { OverrideDialog } from "@/components/erp/override-dialog";
import { addDays, approver, formatDate, formatMoney, isProductionComplete, operationProgress, partNumber, releaseGate, revisionLabel, type ErpState, type OperationDef, type ProductionOrder } from "@/lib/erp/model";
import {
  OPERATION_LIBRARY, WORK_CENTERS, cancelOperation, employeeById, endBlocker, endOperation, hasOwnRouting, kpiSummary, logsToCsv,
  orderOperations, routingError, routingFor, saveRouting, setCurrentUser, startBlocker, startOperation,
} from "@/lib/erp/shopfloor";

type View = "terminal" | "kpi" | "log" | "routings";

const minutesSince = (iso: string, now: number) => Math.max(0, (now - Date.parse(iso)) / 60000);
export const duration = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, "0")} min` : `${Math.round(minutes)} min`);

/** A clock that ticks every second while mounted (for running operations). */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
  return now;
}

export function ShopFloorModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const params = useSearchParams();
  const [view, setView] = useState<View>((params.get("view") as View) || "terminal");
  const head = <PageHead eyebrow="Operations" title="Shop floor KPI" description="Operators start and end each operation of a part. Every operation becomes a log entry with time, person, employee ID, part and quantities, and the KPIs come from that log." />;
  if (!hydrated) return <>{head}<Loading /></>;
  if (!state.productionOrders.length && !state.opLogs.length) return <>{head}<NoProjects what="production orders" /></>;
  return <>{head}
    <div className="erp-tabs" role="group" aria-label="Shop floor view" style={{ marginBottom: 16 }}>
      {([["terminal", "Operator terminal"], ["kpi", "KPI dashboard"], ["log", `Operation log (${state.opLogs.length})`], ["routings", "Routings"]] as [View, string][]).map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>)}
    </div>
    {view === "terminal" && <Terminal state={state} />}
    {view === "kpi" && <KpiDashboard state={state} />}
    {view === "log" && <OperationLog state={state} />}
    {view === "routings" && <Routings state={state} />}
  </>;
}

/* ============================== Terminal ============================== */

function Terminal({ state }: { state: ErpState }) {
  const now = useNow();
  const operator = employeeById(state, state.currentUserId);
  const [ending, setEnding] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const employees = state.employees.filter((item) => item.active);
  const open = state.productionOrders.filter((order) => !isProductionComplete(order.status));
  const done = state.productionOrders.filter((order) => isProductionComplete(order.status));
  const mine = operator ? state.activeOps.find((op) => op.employeeId === operator.id) : null;
  return <div className="erp-stack">
    <section className="erp-card erp-operator">
      <span className="erp-operator-icon"><UserRound size={22} /></span>
      <Field id="sf-operator" label="Operator"><select className="erp-select erp-select-lg" id="sf-operator" value={operator?.id ?? ""} onChange={(event) => commit((value) => setCurrentUser(value, event.target.value || null))}>
        <option value="">Choose who you are…</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code} · {item.role}</option>)}
      </select></Field>
      <div className="erp-operator-meta">{operator ? <><b>{operator.code}</b><small>{operator.department}</small></> : <small>Every log entry records the operator and employee ID.</small>}</div>
      {mine && <div className="erp-operator-run"><Timer size={15} /> Running: <b>Op {mine.seq}</b> on {state.productionOrders.find((order) => order.id === mine.orderId)?.number} · {duration(minutesSince(mine.start, now))}</div>}
    </section>
    {!employees.length && <div className="erp-card"><EmptyState title="No people yet" text="Add employees with their employee ID in People first."><Link className="erp-btn erp-btn-primary" href="/demo/people">Open People</Link></EmptyState></div>}
    <div className="erp-terminal">
      {open.map((order) => <OrderCard key={order.id} state={state} order={order} now={now} operatorId={operator?.id ?? null} onEnd={setEnding} />)}
      {!open.length && <div className="erp-card"><EmptyState title="No open production orders" text="Create a production order in Production; its operations appear here." /></div>}
    </div>
    {done.length > 0 && <section className="erp-card">
      <button type="button" className="erp-card-head erp-linkbtn" style={{ width: "100%", textAlign: "left" }} aria-expanded={showDone} onClick={() => setShowDone(!showDone)}><div><h2>Completed orders ({done.length})</h2><p>Download the operation log file of any order.</p></div></button>
      {showDone && <ul className="erp-reasons erp-card-pad">{done.map((order) => { const logs = state.opLogs.filter((entry) => entry.orderId === order.id); return <li key={order.id}><span><b style={{ color: "var(--e-text)" }}>{order.number}</b> · {partNumber(state, order.partId)} · {logs.length} operations · {duration(logs.reduce((sum, entry) => sum + entry.minutes, 0))}</span>{logs.length > 0 && <button type="button" className="erp-btn erp-btn-sm" onClick={() => downloadBlob(logsToCsv(state, logs), `${order.number}-operation-log.csv`, "text/csv;charset=utf-8")}><Download size={13} /> Log file</button>}</li>; })}</ul>}
    </section>}
    {ending && <EndDialog state={state} activeId={ending} onClose={() => setEnding(null)} />}
    <Rule>A job starts only when its drawing is approved for the ordered revision and its material is in stock; a newer drawing revision stops further operations. Book partial quantities across shifts, and several people can work on one order. Good + scrap can never exceed the parts that arrived at an operation. The order completes when every operation is booked.</Rule>
  </div>;
}

function OrderCard({ state, order, now, operatorId, onEnd }: { state: ErpState; order: ProductionOrder; now: number; operatorId: string | null; onEnd: (activeId: string) => void }) {
  const project = state.projects.find((item) => item.id === order.projectId);
  const part = state.parts.find((item) => item.id === order.partId);
  const ops = orderOperations(state, order);
  const startable = ops.filter((op) => !op.done && op.remaining > 0);
  const [choice, setChoice] = useState<number | null>(null);
  const [overriding, setOverriding] = useState(false);
  const target = startable.find((op) => op.seq === choice) ?? startable[0] ?? null;
  const doneCount = ops.filter((op) => op.status === "done").length;
  const blocker = startBlocker(state, order.id, operatorId, target?.seq);
  const gate = releaseGate(state, order);
  const actives = ops.flatMap((op) => op.actives.map((active) => ({ active, op })));
  return <article className={`erp-card erp-opcard${actives.length ? " is-running" : ""}`}>
    <header>
      <div><span className="erp-eyebrow">{order.number} · {project && <ProjectLink id={project.id} code={project.code} />}</span><h3>{part?.number} rev {revisionLabel(state, order.revisionId)}</h3><p>{part?.description} · {order.quantity} pcs{order.notes ? ` · ${order.notes}` : ""}</p></div>
      <Badge>{order.status}</Badge>
    </header>
    <ol className="erp-opstrip" aria-label="Operations">{ops.map((op) => <li key={op.seq} className={`is-${op.status}`} title={`${op.seq} ${op.name} · ${op.workCenter} · ${op.booked} of ${op.incoming} booked`}><b>{op.seq}</b><span>{op.name}</span>{op.status === "partial" || op.status === "running" ? <small>{op.booked}/{op.incoming}</small> : null}</li>)}</ol>
    <div className="erp-progress-bar" aria-label={`${doneCount} of ${ops.length} operations done`}><span style={{ width: `${(doneCount / Math.max(1, ops.length)) * 100}%` }} /></div>
    {gate && <div className="erp-gate" role="alert"><b>Release check:</b> {gate}{approver(state) && <button type="button" className="erp-btn erp-btn-sm" onClick={() => setOverriding(true)}>Override with reason</button>}</div>}
    {order.releaseOverride && <p className="erp-faint">Released by override: {order.releaseOverride.by} · “{order.releaseOverride.reason}”</p>}
    {actives.map(({ active, op }) => {
      const runner = employeeById(state, active.employeeId);
      const elapsed = minutesSince(active.start, now);
      return <div key={active.id} className="erp-opnow">
        <div><small>Running now</small><strong>Op {op.seq} · {op.name}</strong><span>{op.workCenter} · planned {duration(op.planned)} · {op.remaining} of {op.incoming} pcs still to book</span></div>
        <div className="erp-opclock"><span className={elapsed > op.planned ? "is-over" : ""}><Timer size={14} /> {duration(elapsed)}</span><small>{runner?.name} ({runner?.code}) since {new Date(active.start).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</small>
          <div className="erp-head-actions"><button type="button" className="erp-btn erp-btn-danger erp-btn-lg" onClick={() => onEnd(active.id)}><CircleStop size={18} /> End Op {op.seq}</button></div></div>
      </div>;
    })}
    {target ? <div className="erp-opnow">
      <div><small>{target.status === "partial" ? "Continue" : "Next operation"}</small><strong>Op {target.seq} · {target.name}</strong><span>{target.workCenter} · planned {duration(target.planned)} · {target.remaining} pcs waiting</span>
        {startable.length > 1 && <label className="erp-faint">Work on <select className="erp-select" aria-label="Operation to start" value={target.seq} onChange={(event) => setChoice(Number(event.target.value))}>{startable.map((op) => <option key={op.seq} value={op.seq}>Op {op.seq} {op.name} · {op.remaining} waiting</option>)}</select></label>}
      </div>
      <div className="erp-opclock"><button type="button" className="erp-btn erp-btn-primary erp-btn-lg" disabled={Boolean(blocker)} onClick={() => { commit((value) => startOperation(value, order.id, operatorId!, nowIso(), target.seq)); toast(`Op ${target.seq} ${target.name} started on ${order.number}.`, { tone: "ok" }); }}><Play size={18} /> Start Op {target.seq}</button>{blocker && <small className="erp-faint">{blocker}</small>}</div>
    </div> : !actives.length && <p className="erp-faint">{ops.every((op) => op.done) ? "All operations done." : "Waiting for parts from the previous operation."}</p>}
    {ops.some((op) => op.logs.length) && <details className="erp-opdone"><summary>{doneCount} done · {duration(ops.flatMap((op) => op.logs).reduce((sum, entry) => sum + entry.minutes, 0))} logged</summary>
      <ul>{ops.flatMap((op) => op.logs).map((entry) => <li key={entry.id}><b>Op {entry.seq} {entry.operation}</b> · {entry.employeeName} ({entry.employeeCode}) · {formatDate(entry.end)} · {duration(entry.minutes)} (plan {duration(entry.plannedMinutes)}) · {entry.qtyGood} good{entry.qtyScrap ? `, ${entry.qtyScrap} scrap` : ""}{entry.notes ? ` · ${entry.notes}` : ""}</li>)}</ul>
      <button type="button" className="erp-btn erp-btn-sm" onClick={() => downloadBlob(logsToCsv(state, state.opLogs.filter((entry) => entry.orderId === order.id)), `${order.number}-operation-log.csv`, "text/csv;charset=utf-8")}><Download size={13} /> Log file</button>
    </details>}
    {overriding && <OverrideDialog state={state} order={order} onClose={() => setOverriding(false)} />}
  </article>;
}

function EndDialog({ state, activeId, onClose }: { state: ErpState; activeId: string; onClose: () => void }) {
  const active = state.activeOps.find((item) => item.id === activeId);
  const order = active ? state.productionOrders.find((item) => item.id === active.orderId) : null;
  const waiting = order && active ? operationProgress(state, order).find((item) => item.seq === active.seq)?.remaining ?? 0 : 0;
  const [good, setGood] = useState(String(waiting));
  const [scrap, setScrap] = useState("0");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  if (!active || !order) return null;
  const op = orderOperations(state, order).find((item) => item.seq === active.seq);
  const input = { qtyGood: Number(good), qtyScrap: Number(scrap), notes };
  const submit = () => {
    const problem = endBlocker(state, activeId, input);
    if (problem) { setError(problem); return; }
    commit((value) => endOperation(value, activeId, input, nowIso()));
    const after = endOperation(state, activeId, input, nowIso());
    const closed = isProductionComplete(after.productionOrders.find((item) => item.id === order.id)?.status ?? "");
    toast(closed ? `${order.number} completed. All operations booked.` : input.qtyGood + input.qtyScrap < waiting ? `Op ${active.seq} partly booked: ${waiting - input.qtyGood - input.qtyScrap} pcs still to do.` : `Op ${active.seq} booked.`, { tone: "ok" });
    onClose();
  };
  return <Modal label={`End operation ${active.seq}`} onClose={onClose}>
    <form className="erp-stack" style={{ gap: 12 }} onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <h2>End Op {active.seq} · {op?.name}</h2>
      <p className="erp-faint">{order.number} · {partNumber(state, order.partId)} · {waiting} pcs still to book at this operation. Book fewer if the rest is done later or by someone else.</p>
      <div className="erp-form-grid">
        <Field id="end-good" label="Good parts"><input className="erp-input erp-input-lg" id="end-good" inputMode="numeric" value={good} onChange={(event) => setGood(event.target.value)} /></Field>
        <Field id="end-scrap" label="Scrap"><input className="erp-input erp-input-lg" id="end-scrap" inputMode="numeric" value={scrap} onChange={(event) => setScrap(event.target.value)} /></Field>
      </div>
      <Field id="end-notes" label="Notes (optional)"><input className="erp-input" id="end-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. tool change, reason for scrap" /></Field>
      {error && <p className="erp-error" role="alert">{error}</p>}
      <div className="erp-head-actions" style={{ justifyContent: "space-between" }}>
        <button type="button" className="erp-btn erp-btn-ghost" onClick={() => { commit((value) => cancelOperation(value, activeId, nowIso())); onClose(); }}>Started by mistake</button>
        <span className="erp-head-actions"><button type="button" className="erp-btn erp-btn-ghost" onClick={onClose}>Back</button><button type="submit" className="erp-btn erp-btn-primary"><CircleStop size={15} /> End and log</button></span>
      </div>
    </form>
  </Modal>;
}

/* ============================== KPIs ============================== */

function KpiDashboard({ state }: { state: ErpState }) {
  const today = todayIso();
  const [range, setRange] = useState<"7" | "30" | "all">("30");
  const [employeeId, setEmployeeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const kpi = kpiSummary(state, { from: range === "all" ? undefined : addDays(today, -Number(range) + 1), employeeId: employeeId || undefined, projectId: projectId || undefined }, today);
  const money = (value: number) => formatMoney(value, state.settings.defaultCurrency);
  const pct = (value: number | null) => (value === null ? "—" : `${Math.round(value)}%`);
  return <div className="erp-stack">
    <div className="erp-toolbar">
      <select className="erp-select" aria-label="Period" value={range} onChange={(event) => setRange(event.target.value as typeof range)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="all">All time</option></select>
      <select className="erp-select" aria-label="Operator" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">All operators</option>{state.employees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <select className="erp-select" aria-label="Project" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">All projects</option>{state.projects.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select>
    </div>
    <section className="erp-kpis erp-kpis-4" aria-label="Shop floor figures">
      <Stat label="Operations logged" value={kpi.operations} note={`${kpi.running} running now · ${kpi.openOrders} open orders`} />
      <Stat label="Hours logged" value={(kpi.minutes / 60).toFixed(1)} note={`Planned ${(kpi.planned / 60).toFixed(1)} h`} />
      <Stat label="Efficiency" value={pct(kpi.efficiency)} note="Planned ÷ actual time" tone={kpi.efficiency !== null && kpi.efficiency < 85 ? "warn" : undefined} />
      <Stat label="Scrap rate" value={pct(kpi.scrapRate)} note={`${kpi.scrap} scrap of ${kpi.good + kpi.scrap}`} tone={kpi.scrapRate !== null && kpi.scrapRate > 2 ? "warn" : undefined} />
      <Stat label="Performance × quality" value={pct(kpi.performanceQuality)} note="Not OEE: availability is not measured" />
      <Stat label="Labour cost" value={money(kpi.labourCost)} note="Logged time × hourly rate" />
      <Stat label="Good parts" value={kpi.good} />
      <Stat label="Avg. per operation" value={kpi.operations ? duration(kpi.minutes / kpi.operations) : "—"} />
    </section>
    <section className="erp-card erp-card-pad erp-stack"><h2 className="erp-chart-title">Logged minutes per day</h2><p className="erp-faint">Last 14 days{employeeId || projectId ? ", filtered" : ""}.</p>
      <Columns label="Logged minutes per day" categories={kpi.days.map((day) => day.date.slice(5).replace("-", "."))} series={[{ name: "Minutes", color: CHART_COLORS[1], values: kpi.days.map((day) => day.minutes) }]} format={(value) => `${Math.round(value)} min`} /></section>
    <div className="erp-grid-2">
      <section className="erp-card erp-card-pad erp-stack"><h2 className="erp-chart-title">Hours by operation</h2>
        <BarList label="Hours by operation" data={kpi.byOperation.map((row) => ({ label: row.label, value: row.minutes, display: `${(row.minutes / 60).toFixed(1)} h`, note: `${row.operations} ops · efficiency ${pct(row.efficiency)} · scrap ${pct(row.scrapRate)}`, color: CHART_COLORS[0] }))} empty="No operations logged in this period." /></section>
      <section className="erp-card erp-card-pad erp-stack"><h2 className="erp-chart-title">Hours by operator</h2>
        <BarList label="Hours by operator" data={kpi.byEmployee.map((row) => ({ label: row.label, value: row.minutes, display: `${(row.minutes / 60).toFixed(1)} h`, note: `${row.operations} ops · efficiency ${pct(row.efficiency)} · ${money(row.cost)}`, color: CHART_COLORS[2] }))} empty="No operations logged in this period." /></section>
    </div>
    <section className="erp-card"><div className="erp-card-head"><div><h2>Plan versus actual by operation</h2><p>Efficiency over 100% means faster than planned. Adjust routing times when an operation is always off.</p></div></div>
      <div className="erp-rows" role="table">
        <div className="erp-row erp-row-head" role="row" style={{ gridTemplateColumns: "minmax(0,1.5fr) repeat(6,minmax(0,1fr))" }}>{["Operation", "Ops", "Planned", "Actual", "Efficiency", "Scrap", "Cost"].map((label) => <span key={label} role="columnheader">{label}</span>)}</div>
        {kpi.byOperation.map((row) => <div key={row.key} role="row" className="erp-row" style={{ gridTemplateColumns: "minmax(0,1.5fr) repeat(6,minmax(0,1fr))" }}><strong>{row.label}</strong><span>{row.operations}</span><span>{duration(row.planned)}</span><span>{duration(row.minutes)}</span><span><Badge tone={row.efficiency === null ? "neutral" : row.efficiency >= 95 ? "ok" : row.efficiency >= 80 ? "warn" : "bad"}>{pct(row.efficiency)}</Badge></span><span>{pct(row.scrapRate)}</span><span>{money(row.cost)}</span></div>)}
        {!kpi.byOperation.length && <p className="erp-faint erp-card-pad">No operations logged in this period.</p>}
      </div>
    </section>
    <Rule>Performance × quality comes from the operation log. It is not OEE: OEE also needs availability from machine run-time data, which this demo does not collect.</Rule>
  </div>;
}

/* ============================== Log ============================== */

function OperationLog({ state }: { state: ErpState }) {
  const [orderId, setOrderId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const logs = state.opLogs.filter((entry) => (!orderId || entry.orderId === orderId) && (!employeeId || entry.employeeId === employeeId)).slice().reverse();
  const columns = "minmax(0,.9fr) minmax(0,1fr) minmax(0,1.2fr) minmax(0,1.3fr) minmax(0,1.2fr) minmax(0,.8fr) minmax(0,.8fr)";
  const stamp = todayIso();
  return <div className="erp-stack">
    <div className="erp-toolbar">
      <select className="erp-select" aria-label="Production order" value={orderId} onChange={(event) => setOrderId(event.target.value)}><option value="">All production orders</option>{state.productionOrders.map((order) => <option key={order.id} value={order.id}>{order.number} · {partNumber(state, order.partId)}</option>)}</select>
      <select className="erp-select" aria-label="Operator" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">All operators</option>{state.employees.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select>
      <button type="button" className="erp-btn erp-btn-primary erp-btn-sm" disabled={!logs.length} onClick={() => downloadBlob(logsToCsv(state, logs.slice().reverse()), `operation-log-${stamp}.csv`, "text/csv;charset=utf-8")}><Download size={13} /> Download log file (CSV)</button>
      <button type="button" className="erp-btn erp-btn-sm" disabled={!logs.length} onClick={() => downloadBlob(JSON.stringify(logs.slice().reverse(), null, 2), `operation-log-${stamp}.json`, "application/json")}><Download size={13} /> JSON</button>
    </div>
    <section className="erp-card">{logs.length ? <div className="erp-rows" role="table">
      <div className="erp-row erp-row-head" role="row" style={{ gridTemplateColumns: columns }}>{["Date", "Employee", "Operation", "Part", "Order · project", "Time", "Qty"].map((label) => <span key={label} role="columnheader">{label}</span>)}</div>
      {logs.map((entry) => { const project = state.projects.find((item) => item.id === entry.projectId); return <div key={entry.id} role="row" className="erp-row" style={{ gridTemplateColumns: columns }}>
        <span>{formatDate(entry.start)}<small>{new Date(entry.start).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}–{new Date(entry.end).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</small></span>
        <span>{entry.employeeName}<small>{entry.employeeCode}</small></span>
        <span><strong>Op {entry.seq} {entry.operation}</strong><small>{entry.workCenter}</small></span>
        <span>{entry.partNumber} rev {entry.revision}<small>{entry.partDescription}</small></span>
        <span>{entry.orderNumber}<small>{project?.code}</small></span>
        <span>{duration(entry.minutes)}<small>plan {duration(entry.plannedMinutes)}</small></span>
        <span>{entry.qtyGood}{entry.qtyScrap ? <small>{entry.qtyScrap} scrap</small> : null}{entry.notes ? <small title={entry.notes}>📝 {entry.notes}</small> : null}</span>
      </div>; })}
    </div> : <EmptyState title="No operations logged" text="Start and end operations in the operator terminal." />}</section>
    <p className="erp-faint">The log file has one row per operation: log ID, date, start, end, duration, planned time, efficiency, employee ID, username, production order, project, customer, part number, revision, description, operation number and name, work center, good and scrap quantity, notes.</p>
  </div>;
}

/* ============================== Routings ============================== */

function Routings({ state }: { state: ErpState }) {
  const [editing, setEditing] = useState<string | null>(null);
  return <div className="erp-stack">
    <section className="erp-card"><div className="erp-rows" role="table">
      <div className="erp-row erp-row-head" role="row" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,2.4fr) minmax(0,.8fr) 120px" }}>{["Part", "Operations", "Plan / pc", ""].map((label) => <span key={label} role="columnheader">{label}</span>)}</div>
      {state.parts.map((part) => { const ops = routingFor(state, part.id); return <div key={part.id} role="row" className="erp-row" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,2.4fr) minmax(0,.8fr) 120px" }}>
        <span><strong>{part.number}</strong><small>{part.description}</small></span>
        <span>{ops.map((op) => `${op.seq} ${op.name}`).join(" → ")}{!hasOwnRouting(state, part.id) && <small>Default routing. Edit it to match this part.</small>}</span>
        <span>{duration(ops.reduce((sum, op) => sum + op.runMinPerPc, 0))}</span>
        <span><button type="button" className="erp-btn erp-btn-sm" onClick={() => setEditing(part.id)}>Edit routing</button></span>
      </div>; })}
    </div></section>
    <Rule>A production order keeps the routing it started with. Changes apply to orders whose first operation has not started yet.</Rule>
    {editing && <RoutingDialog state={state} partId={editing} onClose={() => setEditing(null)} />}
  </div>;
}

export function RoutingDialog({ state, partId, onClose }: { state: ErpState; partId: string; onClose: () => void }) {
  const [ops, setOps] = useState(() => routingFor(state, partId).map((op) => ({ ...op, setup: String(op.setupMin), run: String(op.runMinPerPc) })));
  const [error, setError] = useState("");
  const set = (index: number, patch: Partial<(typeof ops)[number]>) => setOps(ops.map((op, i) => (i === index ? { ...op, ...patch } : op)));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= ops.length) return;
    const next = [...ops];
    [next[index], next[target]] = [next[target], next[index]];
    setOps(next.map((op, i) => ({ ...op, seq: (i + 1) * 10 })));
  };
  const toDefs = (): OperationDef[] => ops.map((op) => ({ seq: Number(op.seq), name: op.name, workCenter: op.workCenter, setupMin: Number(op.setup.replace(",", ".")), runMinPerPc: Number(op.run.replace(",", ".")) }));
  const submit = () => {
    const defs = toDefs();
    const problem = routingError(defs);
    if (problem) { setError(problem); return; }
    commit((value) => saveRouting(value, partId, defs, nowIso()));
    toast(`Routing for ${partNumber(state, partId)} saved.`, { tone: "ok" });
    onClose();
  };
  return <Modal label="Edit routing" wide onClose={onClose}>
    <div className="erp-dialog-bar"><h2>Routing · {partNumber(state, partId)}</h2><button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={onClose}><X size={14} /> Close</button></div>
    <div className="erp-card-pad erp-stack" style={{ gap: 10 }}>
      <div className="erp-routing-head"><span>No.</span><span>Operation</span><span>Work center</span><span>Setup min</span><span>Min / pc</span><span /></div>
      {ops.map((op, index) => <div key={index} className="erp-routing-row">
        <input className="erp-input" aria-label="Operation number" inputMode="numeric" value={op.seq} onChange={(event) => set(index, { seq: Number(event.target.value) || 0 })} />
        <input className="erp-input" aria-label="Operation" list="op-library" value={op.name} onChange={(event) => { const preset = OPERATION_LIBRARY.find((item) => item.name === event.target.value); set(index, preset ? { name: preset.name, workCenter: preset.workCenter, setup: String(preset.setupMin), run: String(preset.runMinPerPc) } : { name: event.target.value }); }} />
        <input className="erp-input" aria-label="Work center" list="work-centers" value={op.workCenter} onChange={(event) => set(index, { workCenter: event.target.value.toUpperCase() })} />
        <input className="erp-input" aria-label="Setup minutes" inputMode="decimal" value={op.setup} onChange={(event) => set(index, { setup: event.target.value })} />
        <input className="erp-input" aria-label="Minutes per piece" inputMode="decimal" value={op.run} onChange={(event) => set(index, { run: event.target.value })} />
        <span className="erp-head-actions"><button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" aria-label="Move up" onClick={() => move(index, -1)}><ArrowUp size={13} /></button><button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" aria-label="Move down" onClick={() => move(index, 1)}><ArrowDown size={13} /></button><button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" aria-label="Remove" disabled={ops.length === 1} onClick={() => setOps(ops.filter((_, i) => i !== index))}><Trash2 size={13} /></button></span>
      </div>)}
      <datalist id="op-library">{OPERATION_LIBRARY.map((item) => <option key={item.name} value={item.name} />)}</datalist>
      <datalist id="work-centers">{WORK_CENTERS.map((item) => <option key={item} value={item} />)}</datalist>
      <div><button type="button" className="erp-btn erp-btn-sm" onClick={() => setOps([...ops, { seq: (Math.max(0, ...ops.map((op) => op.seq)) + 10), name: "", workCenter: "", setupMin: 0, runMinPerPc: 0, setup: "0", run: "1" }])}><Plus size={13} /> Add operation</button></div>
      {error && <p className="erp-error" role="alert">{error}</p>}
    </div>
    <div className="erp-dialog-foot"><span className="erp-faint">Planned time per order = setup + minutes per piece × quantity.</span><button type="button" className="erp-btn erp-btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="erp-btn erp-btn-primary" onClick={submit}>Save routing</button></div>
  </Modal>;
}
