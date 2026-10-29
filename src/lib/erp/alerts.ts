/** What needs attention today, across departments. Pure, derived from the records. */
import { addDays, formatDate, isProductionComplete, projectStage, rawMaterialRows, rawMaterialStats, type ErpState } from "./model.ts";
import { reorderSuggestions } from "./purchasing.ts";

export type AlertTone = "bad" | "warn" | "info";
export type Alert = { id: string; tone: AlertTone; area: string; text: string; href: string; action: string };

export function alerts(state: ErpState, today: string, nowIso = `${today}T12:00:00.000Z`): Alert[] {
  const list: Alert[] = [];
  const soon = addDays(today, 7);
  for (const order of state.purchaseOrders) {
    const stage = projectStage(state, order.projectId);
    if (stage === "Dispatched" || stage === "Invoiced") continue;
    const project = state.projects.find((item) => item.id === order.projectId);
    if (order.deliveryDate < today) list.push({ id: `late-${order.id}`, tone: "bad", area: "Delivery", text: `${order.number} (${project?.code}) was due ${formatDate(order.deliveryDate)} and is not dispatched. Stage: ${stage}.`, href: `/demo/projects/${order.projectId}`, action: "Open project" });
    else if (order.deliveryDate <= soon) list.push({ id: `soon-${order.id}`, tone: "warn", area: "Delivery", text: `${order.number} (${project?.code}) is due ${formatDate(order.deliveryDate)}. Stage: ${stage}.`, href: `/demo/projects/${order.projectId}`, action: "Open project" });
  }
  const review = state.documents.filter((doc) => doc.status !== "Approved");
  if (review.length) list.push({ id: "docs", tone: "warn", area: "Engineering", text: `${review.length} document${review.length === 1 ? "" : "s"} waiting for approval.`, href: "/demo/documents", action: "Review" });
  const low = rawMaterialRows(state).filter((material) => rawMaterialStats(state, material).lowStock);
  if (low.length) list.push({ id: "stock", tone: "warn", area: "Stock", text: `${low.length} raw material${low.length === 1 ? " is" : "s are"} below the reorder level: ${low.map((item) => item.name).slice(0, 3).join(", ")}${low.length > 3 ? "…" : ""}.`, href: "/demo/materials", action: "Order" });
  const toOrder = reorderSuggestions(state).filter((item) => item.requirementIds.length);
  if (toOrder.length) list.push({ id: "buy", tone: "info", area: "Purchasing", text: `${toOrder.length} material${toOrder.length === 1 ? "" : "s"} needed for projects ${toOrder.length === 1 ? "is" : "are"} not ordered yet.`, href: "/demo/materials", action: "Order" });
  const overdueInvoices = state.invoices.filter((invoice) => !invoice.paidAt && invoice.dueAt < today);
  if (overdueInvoices.length) list.push({ id: "ar", tone: "bad", area: "Finance", text: `${overdueInvoices.length} customer invoice${overdueInvoices.length === 1 ? " is" : "s are"} overdue.`, href: "/demo/finance?view=invoices", action: "Chase" });
  const billsDue = state.bills.filter((bill) => !bill.paidAt && bill.dueDate <= soon);
  if (billsDue.length) list.push({ id: "ap", tone: billsDue.some((bill) => bill.dueDate < today) ? "bad" : "warn", area: "Finance", text: `${billsDue.length} supplier bill${billsDue.length === 1 ? "" : "s"} due within 7 days${billsDue.some((bill) => bill.dueDate < today) ? " or overdue" : ""}.`, href: "/demo/finance?view=bills", action: "Pay" });
  const unread = state.emails.filter((mail) => mail.folder === "inbox" && !mail.read && !mail.dismissed).length;
  if (unread) list.push({ id: "mail", tone: "info", area: "Inbox", text: `${unread} new email${unread === 1 ? "" : "s"} with order data to review.`, href: "/demo/inbox", action: "Open inbox" });
  const awaiting = state.supplierOrders.filter((order) => order.status === "Sent" || order.status === "Confirmed");
  const lateSupplier = awaiting.filter((order) => order.expectedAt < today);
  if (lateSupplier.length) list.push({ id: "spo-late", tone: "warn", area: "Purchasing", text: `${lateSupplier.length} supplier order${lateSupplier.length === 1 ? " is" : "s are"} past the expected delivery date.`, href: "/demo/materials", action: "Check" });
  const longRunning = state.activeOps.filter((op) => Date.parse(nowIso) - Date.parse(op.start) > 10 * 3600000);
  if (longRunning.length) list.push({ id: "ops", tone: "warn", area: "Shop floor", text: `${longRunning.length} operation${longRunning.length === 1 ? " has" : "s have"} been running for more than 10 hours. Was it ended?`, href: "/demo/shop-floor", action: "Check" });
  const quotes = state.quotations.filter((quote) => quote.status === "Sent" && quote.validUntil >= today && quote.validUntil <= soon);
  if (quotes.length) list.push({ id: "quotes", tone: "info", area: "Sales", text: `${quotes.length} quotation${quotes.length === 1 ? " expires" : "s expire"} within 7 days. Follow up.`, href: "/demo/quotations", action: "Follow up" });
  const idle = state.productionOrders.filter((order) => !isProductionComplete(order.status) && !state.activeOps.some((op) => op.orderId === order.id) && order.startDate && order.startDate < today && !state.opLogs.some((entry) => entry.orderId === order.id && entry.end.slice(0, 10) >= addDays(today, -3)));
  if (idle.length) list.push({ id: "idle", tone: "info", area: "Production", text: `${idle.length} production order${idle.length === 1 ? " has" : "s have"} had no shop-floor activity for 3 days.`, href: "/demo/shop-floor", action: "Open shop floor" });
  const order: Record<AlertTone, number> = { bad: 0, warn: 1, info: 2 };
  return list.sort((a, b) => order[a.tone] - order[b.tone]);
}
