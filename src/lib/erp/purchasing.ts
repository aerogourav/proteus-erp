/**
 * Supplier purchase orders: ordering raw material from a supplier from inside the ERP,
 * the email that goes with it, confirmation and goods receipt.
 */
import {
  addDays, formatDate, formatMoney, log, nextId, norm, numberFor, rawMaterialFor, rawMaterialRows, rawMaterialStats, round2, supplierRows, touch, upsertRawMaterial, upsertSupplier,
  type Currency, type EmailRecord, type ErpState, type SupplierOrder, type SupplierOrderLine,
} from "./model.ts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SupplierOrderInput = { supplier: string; email: string; currency: Currency; expectedAt: string; notes: string; lines: SupplierOrderLine[] };

export function supplierOrderError(input: SupplierOrderInput): string | null {
  if (!input.supplier.trim()) return "Choose a supplier.";
  if (input.email.trim() && !EMAIL_PATTERN.test(input.email.trim())) return "The supplier email address doesn't look complete.";
  if (!input.lines.length) return "Add at least one material.";
  for (const line of input.lines) {
    if (!line.material.trim()) return "Name every material.";
    if (!(line.quantity > 0)) return `Enter a quantity above 0 for ${line.material}.`;
    if (line.unitPrice !== null && !(line.unitPrice >= 0)) return `Enter a valid price for ${line.material}.`;
  }
  return null;
}

export function createSupplierOrder(state: ErpState, input: SupplierOrderInput, now: string): { state: ErpState; id: string | null } {
  if (supplierOrderError(input)) return { state, id: null };
  let next = upsertSupplier(state, input.supplier, now, input.email);
  const supplier = next.suppliers.find((item) => norm(item.name) === norm(input.supplier));
  if (supplier && !supplier.email && input.email.trim()) next = { ...next, suppliers: touch(next.suppliers, supplier.id, (item) => ({ ...item, email: input.email.trim() })) };
  const [id, withId] = nextId(next, "spo");
  const number = numberFor("SPO-2026-", (withId.supplierOrders ?? []).map((order) => order.number), 1);
  const order: SupplierOrder = {
    id, number, supplier: supplier?.name ?? input.supplier.trim(), email: input.email.trim() || supplier?.email || "", currency: input.currency,
    lines: input.lines.map((line) => ({ material: line.material.trim(), quantity: round2(line.quantity), unit: line.unit, unitPrice: line.unitPrice === null ? null : round2(line.unitPrice), requirementIds: line.requirementIds })),
    status: "Draft", createdAt: now, expectedAt: input.expectedAt, notes: input.notes.trim(), emailIds: [],
  };
  // Name the supplier on linked purchase recommendations.
  const linked = new Set(order.lines.flatMap((line) => line.requirementIds));
  next = { ...withId, supplierOrders: [...(withId.supplierOrders ?? []), order], procurement: withId.procurement.map((record) => linked.has(record.requirementId) && record.status === "Not ordered" ? { ...record, supplier: order.supplier, updatedAt: now } : record) };
  return { state: log(next, now, "procurement", `Supplier order ${number} drafted for ${order.supplier}`, null), id };
}

export function supplierOrderTotal(order: SupplierOrder) {
  return round2(order.lines.reduce((sum, line) => sum + (line.unitPrice ?? 0) * line.quantity, 0));
}

/** The order email, written so the supplier can confirm by replying. */
export function supplierOrderEmail(state: ErpState, order: SupplierOrder) {
  const company = state.settings.companyName || "Our company";
  const lines = order.lines.map((line, index) => `${index + 1}. ${line.quantity} ${line.unit} ${line.material}${line.unitPrice !== null ? ` @ ${formatMoney(line.unitPrice, order.currency)} per ${line.unit}` : ""}`);
  const total = supplierOrderTotal(order);
  const subject = `Purchase order ${order.number} from ${company}`;
  const body = [
    `Dear ${order.supplier} team,`,
    "",
    `please supply the following under purchase order ${order.number}:`,
    "",
    ...lines,
    "",
    ...(total > 0 ? [`Order value: ${formatMoney(total, order.currency)} (net)`] : []),
    `Required delivery: ${formatDate(order.expectedAt)}`,
    ...(order.notes ? ["", `Notes: ${order.notes}`] : []),
    "",
    "Please confirm this order and the delivery date by replying to this email, quoting the order number.",
    "Mill certificates (EN 10204 3.1) are required with the delivery.",
    "",
    "Kind regards",
    currentSender(state),
    company,
  ].join("\n");
  return { subject, body };
}

function currentSender(state: ErpState) {
  const user = state.currentUserId ? state.employees.find((item) => item.id === state.currentUserId) : null;
  return user ? `${user.name}, ${user.role}` : "Purchasing";
}

/** Marks the order sent and its linked purchase recommendations ordered. */
export function markSupplierOrderSent(state: ErpState, orderId: string, emailId: string | null, now: string): ErpState {
  const order = (state.supplierOrders ?? []).find((item) => item.id === orderId);
  if (!order || order.status !== "Draft") return state;
  const linked = new Set(order.lines.flatMap((line) => line.requirementIds));
  const next: ErpState = {
    ...state,
    supplierOrders: touch(state.supplierOrders, orderId, (item) => ({ ...item, status: "Sent", sentAt: now, emailIds: emailId ? [...item.emailIds, emailId] : item.emailIds })),
    procurement: state.procurement.map((record) => linked.has(record.requirementId) && record.status === "Not ordered" ? { ...record, status: "Ordered", supplier: order.supplier, updatedAt: now } : record),
    rawMaterials: state.rawMaterials.map((material) => {
      const line = order.lines.find((item) => norm(item.material) === norm(material.name));
      return line && line.unitPrice !== null ? { ...material, unitCost: line.unitPrice } : material;
    }),
  };
  return log(next, now, "procurement", `Supplier order ${order.number} sent to ${order.supplier}${order.email ? ` (${order.email})` : ""}`, null);
}

export function confirmSupplierOrder(state: ErpState, orderId: string, expectedAt: string | null, emailId: string | null, now: string): ErpState {
  const order = (state.supplierOrders ?? []).find((item) => item.id === orderId);
  if (!order || (order.status !== "Sent" && order.status !== "Draft")) return state;
  const next: ErpState = { ...state, supplierOrders: touch(state.supplierOrders, orderId, (item) => ({ ...item, status: "Confirmed", confirmedAt: now, expectedAt: expectedAt || item.expectedAt, emailIds: emailId ? [...item.emailIds, emailId] : item.emailIds })) };
  return log(next, now, "procurement", `Supplier order ${order.number} confirmed by ${order.supplier}${expectedAt ? ` · delivery ${formatDate(expectedAt)}` : ""}`, null);
}

/**
 * Goods receipt: linked purchase recommendations become "Received" and stock goes up by the delivered quantity.
 * Unit prices on the order update the raw material's unit cost.
 */
export function receiveSupplierOrder(state: ErpState, orderId: string, now: string): ErpState {
  const order = (state.supplierOrders ?? []).find((item) => item.id === orderId);
  if (!order || order.status === "Received" || order.status === "Cancelled") return state;
  let next: ErpState = state;
  for (const line of order.lines) {
    next = upsertRawMaterial(next, line.material, { unit: line.unit, unitCost: line.unitPrice });
    next = { ...next, rawMaterials: next.rawMaterials.map((material) => norm(material.name) === norm(line.material) ? { ...material, stock: round2(material.stock + line.quantity), unitCost: line.unitPrice ?? material.unitCost } : material) };
  }
  const linked = new Set(order.lines.flatMap((line) => line.requirementIds));
  next = {
    ...next,
    procurement: next.procurement.map((record) => linked.has(record.requirementId) && record.status !== "Received" ? { ...record, status: "Received", supplier: order.supplier, updatedAt: now } : record),
    supplierOrders: touch(next.supplierOrders, orderId, (item) => ({ ...item, status: "Received", receivedAt: now })),
  };
  return log(next, now, "procurement", `Goods received for ${order.number}: ${order.lines.map((line) => `${line.quantity} ${line.unit} ${line.material}`).join(", ")}`, null);
}

export function cancelSupplierOrder(state: ErpState, orderId: string, now: string): ErpState {
  const order = (state.supplierOrders ?? []).find((item) => item.id === orderId);
  if (!order || order.status === "Received" || order.status === "Cancelled") return state;
  const linked = new Set(order.lines.flatMap((line) => line.requirementIds));
  const next: ErpState = {
    ...state,
    supplierOrders: touch(state.supplierOrders, orderId, (item) => ({ ...item, status: "Cancelled" })),
    procurement: state.procurement.map((record) => linked.has(record.requirementId) && record.status === "Ordered" ? { ...record, status: "Not ordered", updatedAt: now } : record),
  };
  return log(next, now, "procurement", `Supplier order ${order.number} cancelled`, null);
}

export function attachEmailToOrder(state: ErpState, orderId: string, emailId: string): ErpState {
  return { ...state, supplierOrders: touch(state.supplierOrders, orderId, (item) => item.emailIds.includes(emailId) ? item : { ...item, emailIds: [...item.emailIds, emailId] }) };
}

/* ---------- What to order ---------- */

export type ReorderSuggestion = { material: string; unit: string; quantity: number; supplier: string; email: string; unitPrice: number | null; requirementIds: string[]; reason: string };

/**
 * What purchasing should order now: unordered project demand plus enough to get back above the reorder level.
 * Grouped by preferred supplier so one email covers several materials.
 */
export function reorderSuggestions(state: ErpState): ReorderSuggestion[] {
  const suggestions: ReorderSuggestion[] = [];
  for (const material of rawMaterialRows(state)) {
    const stats = rawMaterialStats(state, material);
    const reqs = state.materialRequirements.filter((req) => norm(req.material) === norm(material.name) && state.procurement.find((record) => record.requirementId === req.id)?.status === "Not ordered");
    const demand = round2(reqs.reduce((sum, req) => sum + req.quantity, 0));
    const refill = material.reorderLevel > 0 && material.stock + stats.onOrder < material.reorderLevel ? round2(material.reorderLevel * 2 - material.stock - stats.onOrder) : 0;
    const quantity = round2(demand + refill);
    if (quantity <= 0) continue;
    const recordSupplier = reqs.map((req) => state.procurement.find((record) => record.requirementId === req.id)?.supplier ?? "").find(Boolean) ?? "";
    const supplierName = stats.supplier ?? recordSupplier;
    const supplier = supplierRows(state).find((item) => norm(item.name) === norm(supplierName));
    suggestions.push({
      material: material.name, unit: material.unit, quantity, supplier: supplier?.name ?? supplierName, email: supplier?.email ?? "", unitPrice: material.unitCost,
      requirementIds: reqs.map((req) => req.id), reason: [demand > 0 ? `${demand} ${material.unit} for ${new Set(reqs.map((req) => req.projectId)).size} project(s)` : "", refill > 0 ? `${refill} ${material.unit} to refill stock` : ""].filter(Boolean).join(" + "),
    });
  }
  return suggestions;
}

/* ---------- Demo supplier replies ---------- */

/** In the sample inbox, suppliers answer an order email with a confirmation. Clearly marked as simulated. */
export function demoSupplierConfirmation(state: ErpState, order: SupplierOrder, now: string): EmailRecord {
  const supplier = state.suppliers.find((item) => norm(item.name) === norm(order.supplier));
  const lead = supplier?.leadTimeDays ?? 7;
  const date = addDays(now.slice(0, 10), lead);
  return {
    id: `mail-${order.id}-conf-${Date.parse(now).toString(36)}`, folder: "inbox", from: order.email || "orders@supplier.example", fromName: `${order.supplier} (simulated reply)`, to: state.mail.address || "purchasing@your-company.example",
    subject: `Order confirmation ${order.number}`, date: now, read: false, source: "demo",
    body: [
      "Hello,", "",
      `thank you for your purchase order ${order.number}. We confirm the following:`, "",
      ...order.lines.map((line) => `- ${line.quantity} ${line.unit} ${line.material}${line.unitPrice !== null ? ` @ ${formatMoney(line.unitPrice, order.currency)}` : ""}`),
      "", `Confirmed delivery date: ${date}`, "Certificates 3.1 will be included.", "", "Best regards", `${order.supplier} order desk`,
      "", "(This reply was simulated by the BOH ERP demo. Connect Gmail to work with real supplier emails.)",
    ].join("\n"),
  };
}

export const materialUnitCost = (state: ErpState, name: string) => rawMaterialFor(state, name)?.unitCost ?? null;
