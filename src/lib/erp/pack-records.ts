/** Records the industry packs share with the core: customers (entered once) and customer invoices (feed Finance). */
import { addDays, nextId, norm, numberFor, round2, type Customer, type ErpState, type Invoice, type InvoiceLine } from "./model.ts";

/** Finds a customer by name or adds one, so orders, subscriptions and tickets never duplicate a customer. */
export function ensureCustomer(state: ErpState, name: string, contact: string, now: string): { state: ErpState; id: string } {
  const existing = state.customers.find((item) => norm(item.name) === norm(name));
  if (existing) return { state, id: existing.id };
  const [id, next] = nextId(state, "cust");
  const customer: Customer = { id, name: name.trim(), contact: contact.trim(), createdAt: now };
  return { state: { ...next, customers: [...next.customers, customer] }, id };
}

/** A customer invoice that is not tied to a manufacturing project (shop orders, subscriptions). */
export function issueInvoice(state: ErpState, input: { customerId: string; lines: InvoiceLine[]; issuedAt: string; paid?: boolean; paidAt?: string }): { state: ErpState; id: string } {
  const [id, next] = nextId(state, "inv");
  const number = numberFor(`INV-${input.issuedAt.slice(0, 4)}-`, next.invoices.map((item) => item.number), 501);
  const subtotal = round2(input.lines.reduce((sum, line) => sum + line.amount, 0));
  const taxRate = next.settings.taxRate;
  const tax = round2((subtotal * taxRate) / 100);
  const issued = input.issuedAt.slice(0, 10);
  const invoice: Invoice = {
    id, number, projectId: "", purchaseOrderId: "", customerId: input.customerId, currency: next.settings.defaultCurrency, lines: input.lines,
    subtotal, taxRate, tax, total: round2(subtotal + tax), issuedAt: issued, dueAt: addDays(issued, next.settings.paymentTermsDays),
    ...(input.paid ? { paidAt: input.paidAt ?? issued } : {}),
  };
  return { state: { ...next, invoices: [...next.invoices, invoice] }, id };
}

export const customerName = (state: ErpState, id: string) => state.customers.find((item) => item.id === id)?.name ?? "Unknown customer";
