"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, MessageSquareReply, Plus, Receipt, RotateCcw, UserCheck, XCircle } from "lucide-react";
import { BarList, CHART_COLORS, Columns, Stat } from "@/components/erp/charts";
import { useEditor } from "@/components/erp/edit";
import { Loading } from "@/components/erp/modules";
import { commit, nowIso, todayIso, useErp, useHydrated } from "@/components/erp/store";
import { toast } from "@/components/erp/toast";
import { Badge, EmptyState, PageHead, Rule } from "@/components/erp/ui";
import {
  cancelSubscription, changeSubscription, contractMrr, convertTrial, createSubscription, createTicket, mrrOf, nextRenewal, planOf, reactivateSubscription,
  replyTicket, runBilling, saasKpis, setPastDue, setTicketStatus, subscriptionError, ticketKpis,
} from "@/lib/erp/saas";
import { customerName } from "@/lib/erp/pack-records";
import { formatDate, formatMoney, type ErpState, type Subscription, type Ticket, type TicketPriority } from "@/lib/erp/model";

const money = (state: ErpState, value: number) => formatMoney(value, state.settings.defaultCurrency);
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const monthLabel = (month: string) => new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));
const subTone = (status: Subscription["status"]) => (status === "Active" ? "ok" as const : status === "Trial" ? "info" as const : status === "Past due" ? "bad" as const : "neutral" as const);

/* ============================== Subscriptions ============================== */

type SubView = "paying" | "trials" | "cancelled" | "all";

export function SubscriptionsModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const params = useSearchParams();
  const router = useRouter();
  const editor = useEditor();
  const [view, setView] = useState<SubView>("paying");
  const head = <PageHead eyebrow="Revenue" title="Subscriptions" description="Customers, plans and seats. Monthly recurring revenue (MRR) is plan price × seats − discount; every change is kept, so growth and churn are measured, not typed in." actions={<>
    <button type="button" className="erp-btn" onClick={bill}><Receipt size={15} /> Run billing</button>
    <button type="button" className="erp-btn erp-btn-primary" onClick={() => openNew(state, editor.open)}><Plus size={15} /> New subscription</button>
  </>} />;
  useEffect(() => { if (hydrated && params.get("new") === "1") { openNew(state, editor.open); router.replace("/demo/subscriptions"); } }, [hydrated, params, router, state, editor.open]);
  if (!hydrated) return <>{head}<Loading /></>;
  const today = todayIso();
  const k = saasKpis(state, today);
  const subs = state.subscriptions.filter((sub) => view === "all" || (view === "paying" ? sub.status === "Active" || sub.status === "Past due" : view === "trials" ? sub.status === "Trial" : sub.status === "Cancelled"))
    .sort((a, b) => mrrOf(state, b) - mrrOf(state, a) || contractMrr(state, b) - contractMrr(state, a));
  const columns = "minmax(0,1.6fr) minmax(0,1.2fr) 110px 110px 120px minmax(0,1.6fr)";
  return <>{head}
    <section className="erp-kpis erp-kpis-6" aria-label="Subscription figures">
      <Stat label="MRR" value={money(state, k.mrr)} note={`ARR ${money(state, k.arr)}`} />
      <Stat label="Net new MRR, 30 days" value={`${k.netNew >= 0 ? "+" : "−"}${money(state, Math.abs(k.netNew))}`} note={`New ${money(state, k.movements.new)} · churn ${money(state, k.movements.churn)}`} tone={k.netNew < 0 ? "bad" : undefined} />
      <Stat label="Paying customers" value={k.customers} note={`ARPA ${money(state, k.arpa)}`} />
      <Stat label="Trials" value={k.trials.length} note={k.trials.length ? `Next ends ${formatDate([...k.trials].sort((a, b) => (a.trialEndsAt ?? "").localeCompare(b.trialEndsAt ?? ""))[0]!.trialEndsAt ?? "")}` : "None running"} />
      <Stat label="Revenue churn, 30 days" value={pct(k.churnRate)} note="Churned MRR ÷ MRR 30 days ago" tone={k.churnRate > 0.03 ? "warn" : undefined} />
      <Stat label="Net revenue retention" value={k.nrr === null ? "—" : pct(k.nrr)} note="Customers from 12 months ago, MRR now vs then" />
    </section>
    <div className="erp-grid-2" style={{ marginTop: 16 }}>
      <section className="erp-card erp-card-pad erp-stack"><h2 className="erp-chart-title">MRR, last 6 months</h2>
        <Columns label="MRR by month" categories={k.months.map((row) => monthLabel(row.month))} series={[{ name: "MRR", color: CHART_COLORS[0], values: k.months.map((row) => row.mrr) }]} format={(value) => money(state, value)} />
      </section>
      <section className="erp-card erp-card-pad erp-stack"><h2 className="erp-chart-title">MRR movements, last 30 days</h2>
        <BarList label="MRR movements" empty="No changes in the last 30 days." data={([["New", k.movements.new, 0], ["Expansion", k.movements.expansion, 2], ["Reactivation", k.movements.reactivation, 1], ["Contraction", k.movements.contraction, 3], ["Churn", k.movements.churn, 3]] as const).filter(([, value]) => value > 0).map(([label, value, color]) => ({ label, value, display: `${label === "Contraction" || label === "Churn" ? "−" : "+"}${money(state, value)}`, color: CHART_COLORS[color] }))} />
      </section>
    </div>
    <div className="erp-tabs" role="group" aria-label="Subscription view" style={{ margin: "18px 0 16px" }}>
      {([["paying", "Paying"], ["trials", `Trials (${k.trials.length})`], ["cancelled", "Cancelled"], ["all", "All"]] as [SubView, string][]).map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>)}
    </div>
    <section className="erp-card">
      {subs.length ? <div className="erp-rows" role="table">
        <div className="erp-row erp-row-head" role="row" style={{ gridTemplateColumns: columns }}>{["Customer", "Plan", "MRR", "Status", "Renews", ""].map((label) => <span key={label} role="columnheader">{label}</span>)}</div>
        {subs.map((sub) => {
          const plan = planOf(state, sub.planId);
          return <div key={sub.id} role="row" className="erp-row" style={{ gridTemplateColumns: columns }}>
            <span><strong>{customerName(state, sub.customerId)}</strong><small>Since {formatDate(sub.startedAt)}{sub.cancelledAt ? ` · cancelled ${formatDate(sub.cancelledAt)}` : ""}</small></span>
            <span>{plan?.name} × {sub.seats}<small>{sub.discountPct ? `${sub.discountPct}% discount` : "List price"}</small></span>
            <span className="erp-num" style={{ textAlign: "left" }}><b>{money(state, mrrOf(state, sub))}</b>{sub.status === "Trial" && <small>{money(state, contractMrr(state, sub))} after trial</small>}</span>
            <span><Badge tone={subTone(sub.status)}>{sub.status}</Badge>{sub.status === "Trial" && sub.trialEndsAt && <small>ends {formatDate(sub.trialEndsAt)}</small>}</span>
            <span>{sub.status === "Cancelled" ? "—" : formatDate(nextRenewal(state, sub, today))}</span>
            <span className="erp-head-actions">
              {sub.status === "Trial" && <button type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={() => { commit((value) => convertTrial(value, sub.id, nowIso())); toast(`${customerName(state, sub.customerId)} is now a paying customer.`, { tone: "ok" }); }}><UserCheck size={13} /> Convert</button>}
              {sub.status === "Past due" && <button type="button" className="erp-btn erp-btn-sm" onClick={() => commit((value) => setPastDue(value, sub.id, false, nowIso()))}><CheckCircle2 size={13} /> Paid</button>}
              {sub.status !== "Cancelled" && <button type="button" className="erp-btn erp-btn-sm" onClick={() => openChange(state, editor.open, sub)}>Change</button>}
              {sub.status !== "Cancelled" && <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => openCancel(state, editor.open, sub)}><XCircle size={13} /> Cancel</button>}
              {sub.status === "Cancelled" && <button type="button" className="erp-btn erp-btn-sm" onClick={() => commit((value) => reactivateSubscription(value, sub.id, nowIso()))}><RotateCcw size={13} /> Reactivate</button>}
            </span>
          </div>;
        })}
      </div> : <EmptyState title="Nothing here" text="Subscriptions in this view appear here." />}
    </section>
    <div style={{ marginTop: 14 }}><Rule>Trials bring in no MRR until converted. Plan, seat and discount changes count as expansion or contraction; cancellations as churn. A billing run invoices each paying subscription once per month and the invoices appear in Finance.</Rule></div>
    {editor.dialog}
  </>;
}

function bill() {
  const period = todayIso().slice(0, 7);
  let issued = 0;
  commit((value) => { const result = runBilling(value, period, nowIso()); issued = result.count; return result.state; });
  toast(issued ? `${issued} invoice${issued === 1 ? "" : "s"} issued for ${period}. See Finance → Customer invoices.` : `Every paying subscription is already invoiced for ${period}.`, { tone: issued ? "ok" : "info", href: issued ? "/demo/finance?view=invoices" : undefined, action: issued ? "Open" : undefined });
}

function openNew(state: ErpState, open: ReturnType<typeof useEditor>["open"]) {
  open({
    title: "New subscription",
    fields: [
      { key: "customer", label: "Customer", required: true, list: state.customers.map((item) => item.name) }, { key: "contact", label: "Contact email", type: "email" },
      { key: "plan", label: "Plan", type: "select", options: state.plans.map((plan) => plan.name) }, { key: "seats", label: "Seats", type: "number", required: true },
      { key: "discount", label: "Discount %", type: "number" }, { key: "trial", label: "Trial days (0 = paying from today)", type: "number" },
    ],
    initial: { customer: "", contact: "", plan: state.plans[1]?.name ?? state.plans[0]?.name ?? "", seats: "5", discount: "0", trial: "14" },
    onSave: (values) => {
      const input = { customer: values.customer ?? "", contact: values.contact ?? "", planId: state.plans.find((plan) => plan.name === values.plan)?.id ?? "", seats: Number(values.seats), discountPct: Number(values.discount || 0), trialDays: Number(values.trial || 0) };
      const problem = subscriptionError(state, input);
      if (problem) return problem;
      commit((value) => createSubscription(value, input, nowIso()).state);
      return null;
    },
  });
}

function openChange(state: ErpState, open: ReturnType<typeof useEditor>["open"], sub: Subscription) {
  open({
    title: `Change ${customerName(state, sub.customerId)}`,
    fields: [{ key: "plan", label: "Plan", type: "select", options: state.plans.map((plan) => plan.name) }, { key: "seats", label: "Seats", type: "number", required: true }, { key: "discount", label: "Discount %", type: "number" }],
    initial: { plan: planOf(state, sub.planId)?.name ?? "", seats: String(sub.seats), discount: String(sub.discountPct) },
    onSave: (values) => {
      const input = { planId: state.plans.find((plan) => plan.name === values.plan)?.id ?? sub.planId, seats: Number(values.seats), discountPct: Number(values.discount || 0) };
      if (!Number.isInteger(input.seats) || input.seats < 1) return "Seats must be a whole number of at least 1.";
      if (!(input.discountPct >= 0 && input.discountPct <= 100)) return "Discount must be between 0 and 100%.";
      const before = contractMrr(state, sub);
      const after = contractMrr(state, input);
      commit((value) => changeSubscription(value, sub.id, input, nowIso()));
      if (before !== after) toast(`MRR ${after > before ? "up" : "down"} ${money(state, Math.abs(after - before))} (${after > before ? "expansion" : "contraction"}).`, { tone: "info" });
      return null;
    },
  });
}

function openCancel(state: ErpState, open: ReturnType<typeof useEditor>["open"], sub: Subscription) {
  open({
    title: `Cancel ${customerName(state, sub.customerId)}?`,
    fields: [{ key: "reason", label: "Reason", required: true, list: ["Budget cuts", "Moved to a competitor", "Not using it enough", "Company closed", "Missing feature"] }],
    initial: { reason: "" },
    onSave: (values) => { commit((value) => cancelSubscription(value, sub.id, values.reason ?? "", nowIso())); return null; },
  });
}

/* ============================== Support ============================== */

const PRIORITY_RANK: Record<TicketPriority, number> = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
const priorityTone = (priority: TicketPriority) => (priority === "Urgent" ? "bad" as const : priority === "High" ? "warn" as const : "neutral" as const);
const hoursSince = (iso: string) => Math.max(0, (Date.now() - Date.parse(iso)) / 3600000);
const ageText = (hours: number) => (hours < 1 ? "just now" : hours < 24 ? `${Math.round(hours)} h` : `${Math.round(hours / 24)} d`);

export function SupportModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const editor = useEditor();
  const [showSolved, setShowSolved] = useState(false);
  const head = <PageHead eyebrow="Customer success" title="Support" description="Tickets linked to the customer and their subscription, so support knows who is paying for what. First response time is measured from the first reply." actions={<button type="button" className="erp-btn erp-btn-primary" onClick={() => openTicket(state, editor.open)}><Plus size={15} /> New ticket</button>} />;
  if (!hydrated) return <>{head}<Loading /></>;
  const k = ticketKpis(state, todayIso());
  const tickets = state.tickets.filter((ticket) => showSolved || ticket.status !== "Solved")
    .sort((a, b) => Number(a.status === "Solved") - Number(b.status === "Solved") || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt.localeCompare(b.createdAt));
  const columns = "minmax(0,2fr) minmax(0,1.3fr) 100px 150px 80px minmax(0,1.4fr)";
  const subscriptionOf = (ticket: Ticket) => state.subscriptions.find((sub) => sub.customerId === ticket.customerId && sub.status !== "Cancelled");
  return <>{head}
    <section className="erp-kpis" aria-label="Support figures">
      <Stat label="Open tickets" value={k.open.length} note={`${k.unanswered.length} not answered yet`} tone={k.unanswered.length ? "warn" : undefined} />
      <Stat label="Urgent or high" value={k.urgent.length} tone={k.urgent.length ? "bad" : undefined} />
      <Stat label="First response, 30 days" value={k.firstResponseHours === null ? "—" : `${k.firstResponseHours.toFixed(1)} h`} note="Average time to first reply" />
      <Stat label="Solved, last 7 days" value={k.solvedThisWeek} />
    </section>
    <section className="erp-card" style={{ marginTop: 16 }}>
      <div className="erp-card-head"><div><h2>Tickets</h2><p>Most urgent first.</p></div><label className="erp-check"><input type="checkbox" checked={showSolved} onChange={(event) => setShowSolved(event.target.checked)} /> Show solved</label></div>
      {tickets.length ? <div className="erp-rows" role="table">
        <div className="erp-row erp-row-head" role="row" style={{ gridTemplateColumns: columns }}>{["Ticket", "Customer", "Priority", "Status", "Age", ""].map((label) => <span key={label} role="columnheader">{label}</span>)}</div>
        {tickets.map((ticket) => {
          const sub = subscriptionOf(ticket);
          const assignee = state.employees.find((item) => item.id === ticket.assigneeId);
          return <div key={ticket.id} role="row" className="erp-row" style={{ gridTemplateColumns: columns }}>
            <span><strong>{ticket.subject}</strong><small>{ticket.number}{assignee ? ` · ${assignee.name}` : " · unassigned"}</small></span>
            <span>{customerName(state, ticket.customerId)}<small>{sub ? `${planOf(state, sub.planId)?.name} × ${sub.seats} · ${money(state, mrrOf(state, sub))} MRR` : "No active subscription"}</small></span>
            <span><Badge tone={priorityTone(ticket.priority)}>{ticket.priority}</Badge></span>
            <span><Badge tone={ticket.status === "Solved" ? "ok" : ticket.status === "Open" ? "info" : "neutral"}>{ticket.status}</Badge>{!ticket.firstResponseAt && ticket.status !== "Solved" && <small>No reply yet</small>}</span>
            <span>{ageText(hoursSince(ticket.createdAt))}</span>
            <span className="erp-head-actions">
              {ticket.status !== "Solved" && <button type="button" className="erp-btn erp-btn-sm" onClick={() => { commit((value) => replyTicket(value, ticket.id, true, nowIso())); toast(`Reply recorded on ${ticket.number}; waiting on the customer.`); }}><MessageSquareReply size={13} /> Reply</button>}
              {ticket.status !== "Solved" && <button type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={() => commit((value) => setTicketStatus(value, ticket.id, "Solved", nowIso()))}><CheckCircle2 size={13} /> Solve</button>}
              {ticket.status === "Solved" && <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => commit((value) => setTicketStatus(value, ticket.id, "Open", nowIso()))}><RotateCcw size={13} /> Reopen</button>}
            </span>
          </div>;
        })}
      </div> : <EmptyState title="Inbox zero" text="No open tickets. Nice." />}
    </section>
    <div style={{ marginTop: 14 }}><Rule>Replies are recorded here, not emailed: this demo does not contact customers. A reply sets the ticket to “waiting on customer”; the first one sets the response time.</Rule></div>
    {editor.dialog}
  </>;
}

function openTicket(state: ErpState, open: ReturnType<typeof useEditor>["open"]) {
  open({
    title: "New ticket",
    fields: [
      { key: "customer", label: "Customer", required: true, list: state.customers.map((item) => item.name) }, { key: "subject", label: "Subject", required: true },
      { key: "priority", label: "Priority", type: "select", options: ["Low", "Normal", "High", "Urgent"] },
      { key: "assignee", label: "Assign to", type: "select", options: ["Unassigned", ...state.employees.filter((item) => item.active).map((item) => item.name)] },
    ],
    initial: { customer: "", subject: "", priority: "Normal", assignee: state.employees.find((item) => item.id === state.currentUserId)?.name ?? "Unassigned" },
    onSave: (values) => {
      if (!values.customer?.trim() || !values.subject?.trim()) return "Enter the customer and a subject.";
      const input = { customer: values.customer, contact: "", subject: values.subject, priority: (values.priority ?? "Normal") as TicketPriority, assigneeId: state.employees.find((item) => item.name === values.assignee)?.id ?? null };
      commit((value) => createTicket(value, input, nowIso()).state);
      return null;
    },
  });
}

/* ============================== Overview figures ============================== */

export function SaasFigures({ state }: { state: ErpState }) {
  const today = todayIso();
  const k = saasKpis(state, today);
  const t = ticketKpis(state, today);
  return <>
    <section className="erp-kpis" aria-label="Key figures">
      <Stat label="MRR" value={money(state, k.mrr)} note={`ARR ${money(state, k.arr)}`} />
      <Stat label="Net new MRR, 30 days" value={`${k.netNew >= 0 ? "+" : "−"}${money(state, Math.abs(k.netNew))}`} tone={k.netNew < 0 ? "bad" : undefined} />
      <Stat label="Net revenue retention" value={k.nrr === null ? "—" : pct(k.nrr)} note="12-month cohort" />
      <Stat label="Open support tickets" value={t.open.length} note={t.urgent.length ? `${t.urgent.length} urgent or high` : "None urgent"} tone={t.urgent.length ? "warn" : undefined} />
    </section>
    <div className="erp-grid-2" style={{ marginTop: 16 }}>
      <section className="erp-card erp-card-pad erp-stack"><h2 className="erp-chart-title">MRR, last 6 months</h2>
        <Columns label="MRR by month" categories={k.months.map((row) => monthLabel(row.month))} series={[{ name: "MRR", color: CHART_COLORS[0], values: k.months.map((row) => row.mrr) }]} format={(value) => money(state, value)} />
      </section>
      <section className="erp-card">
        <div className="erp-card-head"><div><h2>Annual renewals, next 90 days</h2><p>{k.renewals.length ? `${money(state, k.renewals.reduce((sum, row) => sum + mrrOf(state, row.sub), 0))} MRR on annual contracts up for renewal.` : "No annual contracts renew in the next 90 days."}</p></div><Link className="erp-btn erp-btn-sm" href="/demo/subscriptions">All subscriptions <ArrowRight size={14} /></Link></div>
        <div className="erp-rows">{k.renewals.slice(0, 6).map(({ sub, date }) => <div key={sub.id} className="erp-row" style={{ gridTemplateColumns: "minmax(0,1.4fr) 110px 110px" }}>
          <span><strong>{customerName(state, sub.customerId)}</strong><small>{planOf(state, sub.planId)?.name} × {sub.seats}</small></span><span>{formatDate(date)}</span><span className="erp-num" style={{ textAlign: "left" }}>{money(state, mrrOf(state, sub))}</span>
        </div>)}</div>
      </section>
    </div>
  </>;
}
