/**
 * Software / SaaS rules. Monthly recurring revenue (MRR) comes from plan × seats less discount; every change is kept
 * in the subscription's history, so MRR trend, movements and churn are computed, not typed in. Pure, unit-tested.
 */
import { addDays, log, nextId, numberFor, round2, touch, type ErpState, type MrrChange, type Plan, type Subscription, type Ticket, type TicketPriority, type TicketStatus } from "./model.ts";
import { customerName, ensureCustomer, issueInvoice } from "./pack-records.ts";

export const planOf = (state: ErpState, planId: string) => state.plans.find((item) => item.id === planId);

/** List price per seat and month (yearly plans are spread over 12 months). */
export const monthlySeatPrice = (plan: Plan) => (plan.interval === "year" ? plan.pricePerSeat / 12 : plan.pricePerSeat);

/** What the subscription would bring in per month if it is (or becomes) paying. */
export function contractMrr(state: ErpState, input: Pick<Subscription, "planId" | "seats" | "discountPct">) {
  const plan = planOf(state, input.planId);
  return plan ? round2(monthlySeatPrice(plan) * input.seats * (1 - input.discountPct / 100)) : 0;
}

/** Current MRR: trials and cancelled subscriptions bring in nothing. */
export const mrrOf = (state: ErpState, sub: Subscription) => (sub.status === "Active" || sub.status === "Past due" ? contractMrr(state, sub) : 0);

const change = (sub: Subscription, entry: MrrChange): Subscription => ({ ...sub, history: [...sub.history, entry] });

/** Next renewal on or after today, counted in whole months or years from the start date. */
export function nextRenewal(state: ErpState, sub: Subscription, today: string) {
  const plan = planOf(state, sub.planId);
  const step = plan?.interval === "year" ? 12 : 1;
  const start = new Date(`${sub.startedAt}T12:00:00Z`);
  for (let months = step; months < 1200; months += step) {
    const date = new Date(start);
    date.setUTCMonth(start.getUTCMonth() + months);
    const iso = date.toISOString().slice(0, 10);
    if (iso >= today) return iso;
  }
  return sub.renewsAt;
}

export type SubscriptionInput = { customer: string; contact: string; planId: string; seats: number; discountPct: number; trialDays: number };

export function subscriptionError(state: ErpState, input: SubscriptionInput): string | null {
  if (!input.customer.trim()) return "Enter the customer.";
  if (!planOf(state, input.planId)) return "Choose a plan.";
  if (!Number.isInteger(input.seats) || input.seats < 1) return "Seats must be a whole number of at least 1.";
  if (!(input.discountPct >= 0 && input.discountPct <= 100)) return "Discount must be between 0 and 100%.";
  if (!Number.isInteger(input.trialDays) || input.trialDays < 0 || input.trialDays > 90) return "Trial must be 0 to 90 days.";
  return null;
}

export function createSubscription(input: ErpState, sub: SubscriptionInput, now: string): { state: ErpState; id: string | null } {
  if (subscriptionError(input, sub)) return { state: input, id: null };
  const customer = ensureCustomer(input, sub.customer, sub.contact, now);
  const [id, next] = nextId(customer.state, "sub");
  const today = now.slice(0, 10);
  const trial = sub.trialDays > 0;
  const plan = planOf(next, sub.planId)!;
  const base: Subscription = {
    id, customerId: customer.id, planId: sub.planId, seats: sub.seats, discountPct: sub.discountPct, status: trial ? "Trial" : "Active",
    startedAt: today, ...(trial ? { trialEndsAt: addDays(today, sub.trialDays) } : {}),
    renewsAt: addDays(today, plan.interval === "year" ? 365 : 30), history: [], billed: [],
  };
  const record = trial ? base : change(base, { at: now, mrr: contractMrr(next, base), kind: "new", note: `${plan.name} × ${sub.seats}` });
  const text = trial ? `Trial started for ${customerName(next, customer.id)} on ${plan.name}` : `New subscription: ${customerName(next, customer.id)} on ${plan.name} × ${sub.seats}`;
  return { state: log({ ...next, subscriptions: [...next.subscriptions, record] }, now, "subscriptions", text, null), id };
}

export function convertTrial(state: ErpState, id: string, now: string): ErpState {
  const sub = state.subscriptions.find((item) => item.id === id);
  if (!sub || sub.status !== "Trial") return state;
  const mrr = contractMrr(state, sub);
  const next = { ...state, subscriptions: touch(state.subscriptions, id, (item) => change({ ...item, status: "Active" }, { at: now, mrr, kind: "new", note: "Trial converted" })) };
  return log(next, now, "subscriptions", `${customerName(state, sub.customerId)} converted from trial`, null);
}

/** Plan, seat or discount change on a paying subscription, recorded as expansion or contraction. */
export function changeSubscription(state: ErpState, id: string, input: Pick<Subscription, "planId" | "seats" | "discountPct">, now: string): ErpState {
  const sub = state.subscriptions.find((item) => item.id === id);
  if (!sub || sub.status === "Cancelled" || !planOf(state, input.planId) || !Number.isInteger(input.seats) || input.seats < 1 || !(input.discountPct >= 0 && input.discountPct <= 100)) return state;
  const before = contractMrr(state, sub);
  const after = contractMrr(state, input);
  if (before === after && sub.planId === input.planId && sub.seats === input.seats) return state;
  const updated = { ...sub, ...input };
  const paying = sub.status === "Active" || sub.status === "Past due";
  const record = paying && before !== after ? change(updated, { at: now, mrr: after, kind: after > before ? "expansion" : "contraction", note: `${planOf(state, input.planId)!.name} × ${input.seats}` }) : updated;
  return log({ ...state, subscriptions: touch(state.subscriptions, id, () => record) }, now, "subscriptions", `${customerName(state, sub.customerId)}: ${planOf(state, input.planId)!.name} × ${input.seats}${paying ? ` (MRR ${before} → ${after})` : ""}`, null);
}

export function cancelSubscription(state: ErpState, id: string, reason: string, now: string): ErpState {
  const sub = state.subscriptions.find((item) => item.id === id);
  if (!sub || sub.status === "Cancelled") return state;
  const record = change({ ...sub, status: "Cancelled", cancelledAt: now.slice(0, 10) }, { at: now, mrr: 0, kind: "churn", note: reason.trim() || "Cancelled" });
  return log({ ...state, subscriptions: touch(state.subscriptions, id, () => record) }, now, "subscriptions", `${customerName(state, sub.customerId)} cancelled: ${reason.trim() || "no reason given"}`, null);
}

export function reactivateSubscription(state: ErpState, id: string, now: string): ErpState {
  const sub = state.subscriptions.find((item) => item.id === id);
  if (!sub || sub.status !== "Cancelled") return state;
  const record = change({ ...sub, status: "Active", cancelledAt: undefined }, { at: now, mrr: contractMrr(state, sub), kind: "reactivation", note: "Reactivated" });
  return log({ ...state, subscriptions: touch(state.subscriptions, id, () => record) }, now, "subscriptions", `${customerName(state, sub.customerId)} reactivated`, null);
}

export function setPastDue(state: ErpState, id: string, pastDue: boolean, now: string): ErpState {
  const sub = state.subscriptions.find((item) => item.id === id);
  if (!sub || (pastDue ? sub.status !== "Active" : sub.status !== "Past due")) return state;
  return log({ ...state, subscriptions: touch(state.subscriptions, id, (item) => ({ ...item, status: pastDue ? "Past due" : "Active" })) }, now, "subscriptions", `${customerName(state, sub.customerId)} ${pastDue ? "marked past due" : "payment received, active again"}`, null);
}

/** Invoices every paying subscription once for the given month (YYYY-MM). Returns how many invoices were issued. */
export function runBilling(state: ErpState, period: string, now: string, paid = false): { state: ErpState; count: number } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return { state, count: 0 };
  let next = state;
  let count = 0;
  for (const sub of state.subscriptions) {
    if ((sub.status !== "Active" && sub.status !== "Past due") || sub.billed.includes(period) || sub.startedAt.slice(0, 7) > period) continue;
    const plan = planOf(next, sub.planId);
    if (!plan) continue;
    const amount = contractMrr(next, sub);
    const unitPrice = round2(amount / sub.seats);
    const invoice = issueInvoice(next, { customerId: sub.customerId, lines: [{ description: `${plan.name} subscription, ${period}${sub.discountPct ? ` (${sub.discountPct}% discount)` : ""}`, quantity: sub.seats, unit: "seat", unitPrice, amount }], issuedAt: `${period}-01`, paid, paidAt: `${period}-05` });
    next = { ...invoice.state, subscriptions: touch(invoice.state.subscriptions, sub.id, (item) => ({ ...item, billed: [...item.billed, period] })) };
    count += 1;
  }
  return { state: count ? log(next, now, "subscriptions", `Billing run ${period}: ${count} invoice${count === 1 ? "" : "s"} issued`, null) : state, count };
}

/** MRR of one subscription at a moment, from its history (the last change at or before then). */
export function mrrAt(sub: Subscription, iso: string) {
  let mrr = 0;
  for (const entry of sub.history) if (entry.at <= iso) mrr = entry.mrr;
  return mrr;
}

export function saasKpis(state: ErpState, today: string) {
  const endOf = (month: string) => `${month}-31T23:59:59.999Z`;
  const months: string[] = [];
  const d = new Date(`${today.slice(0, 7)}-01T12:00:00Z`);
  for (let i = 5; i >= 0; i -= 1) { const m = new Date(d); m.setUTCMonth(m.getUTCMonth() - i); months.push(m.toISOString().slice(0, 7)); }
  const nowIso = `${today}T23:59:59.999Z`;
  const total = (iso: string) => round2(state.subscriptions.reduce((sum, sub) => sum + mrrAt(sub, iso), 0));
  const mrr = round2(state.subscriptions.reduce((sum, sub) => sum + mrrOf(state, sub), 0));
  const thisMonth = today.slice(0, 7);
  // Movements and churn cover the last 30 days, so the figures are meaningful on any day of the month.
  const monthStart = new Date(Date.parse(nowIso) - 30 * 86400000).toISOString();
  const movements = { new: 0, expansion: 0, contraction: 0, churn: 0, reactivation: 0 };
  for (const sub of state.subscriptions) {
    let previous = 0;
    for (const entry of sub.history) {
      if (entry.at >= monthStart && entry.at <= nowIso) movements[entry.kind] = round2(movements[entry.kind] + Math.abs(entry.mrr - previous));
      previous = entry.mrr;
    }
  }
  const startMrr = total(new Date(Date.parse(monthStart) - 1).toISOString());
  const paying = state.subscriptions.filter((sub) => sub.status === "Active" || sub.status === "Past due");
  const yearAgo = new Date(Date.parse(nowIso) - 365 * 86400000).toISOString();
  const cohort = state.subscriptions.filter((sub) => mrrAt(sub, yearAgo) > 0);
  const cohortThen = cohort.reduce((sum, sub) => sum + mrrAt(sub, yearAgo), 0);
  const cohortNow = cohort.reduce((sum, sub) => sum + mrrAt(sub, nowIso), 0);
  return {
    mrr, arr: round2(mrr * 12), customers: paying.length, trials: state.subscriptions.filter((sub) => sub.status === "Trial"),
    pastDue: state.subscriptions.filter((sub) => sub.status === "Past due"), arpa: paying.length ? round2(mrr / paying.length) : 0,
    months: months.map((month) => ({ month, mrr: month === thisMonth ? mrr : total(endOf(month)) })),
    movements, netNew: round2(movements.new + movements.expansion + movements.reactivation - movements.contraction - movements.churn),
    churnRate: startMrr ? movements.churn / startMrr : 0,
    nrr: cohortThen ? cohortNow / cohortThen : null,
    // Contract renewals: annual plans coming up in the next 90 days (monthly plans renew every month by design).
    renewals: paying.filter((sub) => planOf(state, sub.planId)?.interval === "year").map((sub) => ({ sub, date: nextRenewal(state, sub, today) })).filter((item) => item.date <= addDays(today, 90)).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/* ---------------- Support ---------------- */

export type TicketInput = { customer: string; contact: string; subject: string; priority: TicketPriority; assigneeId: string | null };

export function createTicket(input: ErpState, ticket: TicketInput, now: string): { state: ErpState; id: string | null } {
  if (!ticket.customer.trim() || !ticket.subject.trim()) return { state: input, id: null };
  const customer = ensureCustomer(input, ticket.customer, ticket.contact, now);
  const [id, next] = nextId(customer.state, "tkt");
  const number = numberFor("T-", next.tickets.map((item) => item.number), 1001);
  const record: Ticket = { id, number, customerId: customer.id, subject: ticket.subject.trim(), priority: ticket.priority, status: "Open", createdAt: now, assigneeId: ticket.assigneeId };
  return { state: log({ ...next, tickets: [...next.tickets, record] }, now, "support", `Ticket ${number} opened: ${record.subject}`, null), id };
}

/** First reply stamps the response time; later replies only move the status. */
export function replyTicket(state: ErpState, id: string, waitOnCustomer: boolean, now: string): ErpState {
  const ticket = state.tickets.find((item) => item.id === id);
  if (!ticket || ticket.status === "Solved") return state;
  const status: TicketStatus = waitOnCustomer ? "Waiting on customer" : "Open";
  return log({ ...state, tickets: touch(state.tickets, id, (item) => ({ ...item, status, firstResponseAt: item.firstResponseAt ?? now })) }, now, "support", `Ticket ${ticket.number} answered`, null);
}

export function setTicketStatus(state: ErpState, id: string, status: TicketStatus, now: string): ErpState {
  const ticket = state.tickets.find((item) => item.id === id);
  if (!ticket || ticket.status === status) return state;
  const solved = status === "Solved";
  return log({ ...state, tickets: touch(state.tickets, id, (item) => ({ ...item, status, solvedAt: solved ? now : undefined, firstResponseAt: item.firstResponseAt ?? (solved ? now : undefined) })) }, now, "support", `Ticket ${ticket.number} ${solved ? "solved" : `set to ${status.toLowerCase()}`}`, null);
}

export function ticketKpis(state: ErpState, today: string) {
  const nowMs = Date.parse(`${today}T23:59:59Z`);
  const recent = state.tickets.filter((ticket) => ticket.firstResponseAt && nowMs - Date.parse(ticket.createdAt) <= 30 * 86400000);
  const hours = recent.map((ticket) => (Date.parse(ticket.firstResponseAt!) - Date.parse(ticket.createdAt)) / 3600000);
  const open = state.tickets.filter((ticket) => ticket.status !== "Solved");
  return {
    open, urgent: open.filter((ticket) => ticket.priority === "Urgent" || ticket.priority === "High"), unanswered: open.filter((ticket) => !ticket.firstResponseAt),
    firstResponseHours: hours.length ? round2(hours.reduce((sum, value) => sum + value, 0) / hours.length) : null,
    solvedThisWeek: state.tickets.filter((ticket) => ticket.solvedAt && nowMs - Date.parse(ticket.solvedAt) <= 7 * 86400000).length,
  };
}
