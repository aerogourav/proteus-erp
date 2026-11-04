/**
 * Finance beyond invoices: quotations, supplier bills, payroll (salary slips), project costing and the company overview.
 * Illustrative business logic for the demo, not an accounting or payroll system.
 */
import {
  addDays, createProjectFromDraft, firstInvalidStep, formatMoney, jobCost, log, newDraft, nextId, norm, numberFor, requirementCost, round2, suggestProjectCode, touch,
  type Bill, type BillCategory, type Currency, type ErpState, type Payslip, type ProjectDraft, type QuoteLine, type QuoteStatus, type Quotation,
} from "./model.ts";
import { labourCost } from "./shopfloor.ts";

/** Converts an amount into the default currency with the configured rates. */
export function toBase(state: ErpState, amount: number, from: Currency) {
  const fx = state.settings.fx;
  const to = state.settings.defaultCurrency;
  if (from === to) return amount;
  return round2((amount * (fx[from] ?? 1)) / (fx[to] ?? 1));
}

const monthOf = (iso: string) => iso.slice(0, 7);

/* ============================== Quotations ============================== */

export type QuoteInput = { customerName: string; contact: string; date: string; validUntil: string; currency: Currency; lines: QuoteLine[]; notes: string; leadTimeWeeks: number; emailId?: string };

export function quoteError(input: QuoteInput): string | null {
  if (!input.customerName.trim()) return "Enter the customer.";
  if (!input.date || !input.validUntil) return "Enter the quote date and validity.";
  if (input.validUntil < input.date) return "Validity must be on or after the quote date.";
  if (!input.lines.length) return "Add at least one line.";
  for (const line of input.lines) {
    if (!line.partNumber.trim() || !line.description.trim()) return "Every line needs a part number and description.";
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) return `Enter a whole quantity for ${line.partNumber}.`;
    if (!(line.unitPrice >= 0)) return `Enter a price for ${line.partNumber}.`;
  }
  if (!(input.leadTimeWeeks >= 0)) return "Enter a lead time.";
  return null;
}

const cleanLines = (lines: QuoteLine[]) => lines.map((line) => ({ partNumber: line.partNumber.trim().toUpperCase(), description: line.description.trim(), quantity: line.quantity, unit: line.unit || "pcs", unitPrice: round2(line.unitPrice), revision: (line.revision || "A").trim().toUpperCase() }));

export function saveQuotation(state: ErpState, id: string | null, input: QuoteInput, now: string): { state: ErpState; id: string | null } {
  if (quoteError(input)) return { state, id: null };
  const record = { customerName: input.customerName.trim(), contact: input.contact.trim(), date: input.date, validUntil: input.validUntil, currency: input.currency, lines: cleanLines(input.lines), notes: input.notes.trim(), leadTimeWeeks: Math.round(input.leadTimeWeeks) };
  if (id) {
    const quote = state.quotations.find((item) => item.id === id);
    if (!quote || quote.status === "Accepted") return { state, id: null };
    return { state: log({ ...state, quotations: touch(state.quotations, id, (item) => ({ ...item, ...record })) }, now, "sales", `Quotation ${quote.number} updated`, null), id };
  }
  const [newId, next] = nextId(state, "qt");
  const number = numberFor(`QT-${input.date.slice(0, 4)}-`, state.quotations.map((item) => item.number), 1);
  const quote: Quotation = { id: newId, number, ...record, status: "Draft", ...(input.emailId ? { emailId: input.emailId } : {}) };
  return { state: log({ ...next, quotations: [...next.quotations, quote] }, now, "sales", `Quotation ${number} created for ${quote.customerName}`, null), id: newId };
}

export function quoteTotals(quote: Pick<Quotation, "lines">, taxRate: number) {
  const subtotal = round2(quote.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
  const tax = round2((subtotal * taxRate) / 100);
  return { subtotal, tax, total: round2(subtotal + tax) };
}

export function setQuoteStatus(state: ErpState, id: string, status: QuoteStatus, now: string): ErpState {
  const quote = state.quotations.find((item) => item.id === id);
  if (!quote || quote.status === status || quote.status === "Accepted") return state;
  return log({ ...state, quotations: touch(state.quotations, id, (item) => ({ ...item, status })) }, now, "sales", `Quotation ${quote.number} marked ${status.toLowerCase()}`, null);
}

export function quoteEmail(state: ErpState, quote: Quotation) {
  const totals = quoteTotals(quote, state.settings.taxRate);
  const company = state.settings.companyName || "Our company";
  return {
    subject: `Quotation ${quote.number} from ${company}`,
    body: [
      `Dear ${quote.customerName} team,`, "", `thank you for your enquiry. We are pleased to quote as follows (quotation ${quote.number}):`, "",
      ...quote.lines.map((line, index) => `${index + 1}. ${line.partNumber} rev ${line.revision} · ${line.description} · ${line.quantity} ${line.unit} @ ${formatMoney(line.unitPrice, quote.currency)} = ${formatMoney(line.unitPrice * line.quantity, quote.currency)}`),
      "", `Total (net): ${formatMoney(totals.subtotal, quote.currency)}`, `Lead time: ${quote.leadTimeWeeks} weeks after order and approved drawings`, `Valid until: ${quote.validUntil}`,
      ...(quote.notes ? ["", quote.notes] : []), "", "We look forward to your order.", "", "Kind regards", company,
    ].join("\n"),
  };
}

/** The project draft an accepted quotation turns into. */
export function quoteToDraft(state: ErpState, quote: Quotation, poNumber: string, today: string): ProjectDraft {
  const draft = newDraft(state, today);
  return {
    ...draft, projectName: quote.lines.length === 1 ? quote.lines[0].description : `${quote.lines[0].description} and ${quote.lines.length - 1} more`,
    projectCode: suggestProjectCode(state, today.slice(0, 4)), poNumber: poNumber.trim().toUpperCase(), description: `From quotation ${quote.number}`,
    customerName: quote.customerName, contact: quote.contact, poDate: today, deliveryDate: addDays(today, Math.max(1, quote.leadTimeWeeks) * 7), currency: quote.currency,
    lines: quote.lines.map((line, index) => ({ key: `q${index + 1}`, partNumber: line.partNumber, description: line.description, quantity: String(line.quantity), unit: line.unit, unitPrice: String(line.unitPrice), revision: line.revision || "A" })),
  };
}

/** Accepts the quotation and creates the project with the customer's PO number. Returns an error message instead when it cannot. */
export function convertQuote(state: ErpState, id: string, poNumber: string, now: string): { state: ErpState; projectId: string } | { error: string } {
  const quote = state.quotations.find((item) => item.id === id);
  if (!quote) return { error: "Quotation not found." };
  if (quote.projectId) return { error: "This quotation already became a project." };
  const draft = quoteToDraft(state, quote, poNumber, now.slice(0, 10));
  if (firstInvalidStep(state, draft) !== -1) return { error: !poNumber.trim() ? "Enter the customer's PO number." : "The PO number is already used or not valid (3–30 letters, digits or hyphens)." };
  const created = createProjectFromDraft(state, draft, now);
  const next = log({ ...created.state, quotations: touch(created.state.quotations, id, (item) => ({ ...item, status: "Accepted" as QuoteStatus, projectId: created.projectId })) }, now, "sales", `Quotation ${quote.number} accepted · project created`, created.projectId);
  return { state: next, projectId: created.projectId };
}

/* ============================== Supplier bills ============================== */

export type BillInput = { number: string; supplier: string; category: BillCategory; date: string; dueDate: string; currency: Currency; net: number; taxRate: number; description: string; supplierOrderId?: string; projectId?: string; emailId?: string; quantity?: number };

export function billError(state: ErpState, input: BillInput, id: string | null = null): string | null {
  if (!input.supplier.trim()) return "Enter the supplier.";
  if (!input.number.trim()) return "Enter the supplier's invoice number.";
  if (!input.date || !input.dueDate) return "Enter the bill date and due date.";
  if (input.dueDate < input.date) return "The due date must be on or after the bill date.";
  if (!(input.net >= 0)) return "Enter the net amount.";
  if (!(input.taxRate >= 0 && input.taxRate <= 30)) return "Tax rate must be between 0 and 30%.";
  if (state.bills.some((bill) => bill.id !== id && norm(bill.supplier) === norm(input.supplier) && norm(bill.number) === norm(input.number))) return "This supplier invoice is already recorded.";
  return null;
}

export function saveBill(state: ErpState, id: string | null, input: BillInput, now: string, file?: Bill["file"]): ErpState {
  if (billError(state, input, id)) return state;
  const net = round2(input.net);
  const tax = round2((net * input.taxRate) / 100);
  const record = {
    number: input.number.trim(), supplier: input.supplier.trim(), category: input.category, date: input.date, dueDate: input.dueDate, currency: input.currency, net, taxRate: input.taxRate, tax, total: round2(net + tax),
    description: input.description.trim(), ...(input.supplierOrderId ? { supplierOrderId: input.supplierOrderId } : {}), ...(input.projectId ? { projectId: input.projectId } : {}), ...(input.emailId ? { emailId: input.emailId } : {}), ...(input.quantity !== undefined && input.quantity > 0 ? { quantity: round2(input.quantity) } : {}), ...(file ? { file } : {}),
  };
  if (id) return log({ ...state, bills: touch(state.bills, id, (item) => ({ ...item, ...record })) }, now, "finance", `Supplier bill ${record.number} updated`, record.projectId ?? null);
  const [newId, next] = nextId(state, "bill");
  return log({ ...next, bills: [...next.bills, { id: newId, ...record }] }, now, "finance", `Supplier bill ${record.number} from ${record.supplier} recorded · ${formatMoney(record.total, record.currency)}`, record.projectId ?? null);
}

/** Differences between a supplier bill and the supplier order it belongs to: net amount and, when the bill states one, quantity. */
export function billOrderMismatch(state: ErpState, bill: Bill): string[] {
  const order = bill.supplierOrderId ? (state.supplierOrders ?? []).find((item) => item.id === bill.supplierOrderId) : null;
  if (!order) return [];
  const warnings: string[] = [];
  const priced = order.lines.every((line) => line.unitPrice !== null);
  const orderNet = round2(order.lines.reduce((sum, line) => sum + (line.unitPrice ?? 0) * line.quantity, 0));
  if (priced && order.currency === bill.currency && Math.abs(orderNet - bill.net) > 0.01) warnings.push(`Bill net ${formatMoney(bill.net, bill.currency)} differs from ${order.number} at ${formatMoney(orderNet, order.currency)}.`);
  if (priced && order.currency !== bill.currency) warnings.push(`Bill is in ${bill.currency}, ${order.number} in ${order.currency}. Check the amount.`);
  const orderQty = round2(order.lines.reduce((sum, line) => sum + line.quantity, 0));
  if (bill.quantity !== undefined && Math.abs(bill.quantity - orderQty) > 0.001) warnings.push(`Bill quantity ${bill.quantity} differs from ${orderQty} ordered on ${order.number}.`);
  return warnings;
}

export function markBillPaid(state: ErpState, id: string, paid: boolean, now: string): ErpState {
  const bill = state.bills.find((item) => item.id === id);
  if (!bill || Boolean(bill.paidAt) === paid) return state;
  return log({ ...state, bills: touch(state.bills, id, (item) => ({ ...item, paidAt: paid ? now.slice(0, 10) : undefined })) }, now, "finance", `Supplier bill ${bill.number} marked ${paid ? "paid" : "unpaid"}`, bill.projectId ?? null);
}

export function deleteBill(state: ErpState, id: string, now: string): ErpState {
  const bill = state.bills.find((item) => item.id === id);
  if (!bill || bill.paidAt) return state;
  return log({ ...state, bills: state.bills.filter((item) => item.id !== id) }, now, "finance", `Supplier bill ${bill.number} removed`, bill.projectId ?? null);
}

/* ============================== Payroll ============================== */

export function employeeHours(state: ErpState, employeeId: string, period: string) {
  return round2(state.opLogs.filter((entry) => entry.employeeId === employeeId && monthOf(entry.end) === period).reduce((sum, entry) => sum + entry.minutes, 0) / 60);
}

/** Gross-to-net with the illustrative percentages from Configuration. */
export function payslipFigures(state: ErpState, gross: number) {
  const { incomeTaxPct, socialPct, employerPct } = state.settings.payroll;
  const incomeTax = round2((gross * incomeTaxPct) / 100);
  const social = round2((gross * socialPct) / 100);
  return { gross: round2(gross), incomeTax, social, net: round2(gross - incomeTax - social), employerCost: round2(gross * (1 + employerPct / 100)) };
}

/**
 * Creates one salary slip per active employee for the month (YYYY-MM) that does not have one yet.
 * Salaried staff get their monthly salary; hourly staff get logged shop-floor hours × rate.
 */
export function runPayroll(state: ErpState, period: string, now: string): ErpState {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return state;
  let next = state;
  let count = 0;
  for (const employee of state.employees.filter((item) => item.active)) {
    if (next.payslips.some((slip) => slip.employeeId === employee.id && slip.period === period)) continue;
    const hours = employeeHours(state, employee.id, period);
    const gross = employee.pay === "salary" ? employee.monthlySalary : round2(hours * employee.hourlyRate);
    if (gross <= 0) continue;
    const [id, withId] = nextId(next, "ps");
    const slip: Payslip = { id, number: `PS-${period}-${employee.code}`, employeeId: employee.id, period, hours, ...payslipFigures(state, gross), issuedAt: now.slice(0, 10) };
    next = { ...withId, payslips: [...withId.payslips, slip] };
    count += 1;
  }
  return count ? log(next, now, "finance", `Payroll ${period}: ${count} salary slip${count === 1 ? "" : "s"} issued`, null) : state;
}

export function markPayslipPaid(state: ErpState, id: string, paid: boolean, now: string): ErpState {
  const slip = state.payslips.find((item) => item.id === id);
  if (!slip || Boolean(slip.paidAt) === paid) return state;
  return log({ ...state, payslips: touch(state.payslips, id, (item) => ({ ...item, paidAt: paid ? now.slice(0, 10) : undefined })) }, now, "finance", `Salary slip ${slip.number} marked ${paid ? "paid" : "unpaid"}`, null);
}

/* ============================== Costing and overview ============================== */

/** What a project earns and costs: material from unit costs, labour from the shop-floor log, plus bills booked to it. */
export function projectCosting(state: ErpState, projectId: string) {
  const order = state.purchaseOrders.find((item) => item.projectId === projectId);
  const currency = order?.currency ?? state.settings.defaultCurrency;
  const lines = state.lineItems.filter((line) => line.projectId === projectId);
  const orderValue = order?.value ?? round2(lines.reduce((sum, line) => sum + (line.unitPrice ?? 0) * line.quantity, 0));
  // Closed jobs count with the material cost and exchange rates frozen when they closed.
  const orders = state.productionOrders.filter((item) => item.projectId === projectId);
  const closed = orders.filter((item) => item.costSnapshot);
  const closedLines = new Set(closed.map((item) => item.lineItemId));
  const material = round2(closed.reduce((sum, item) => sum + jobCost(state, item.id).material, 0)
    + state.materialRequirements.filter((req) => req.projectId === projectId && !(req.lineItemId && closedLines.has(req.lineItemId))).reduce((sum, req) => sum + (requirementCost(state, req) ?? 0), 0));
  const labour = labourCost(state, projectId);
  const frozenFx = orders.length > 0 && closed.length === orders.length ? closed[0].costSnapshot?.fx : undefined;
  const base = (amount: number, from: Currency) => (frozenFx ? toBase({ ...state, settings: { ...state.settings, fx: frozenFx } }, amount, from) : toBase(state, amount, from));
  const external = round2(state.bills.filter((bill) => bill.projectId === projectId && bill.category !== "Raw material").reduce((sum, bill) => sum + base(bill.net, bill.currency), 0));
  const cost = round2(material + labour + external);
  const value = base(orderValue, currency);
  return { currency: state.settings.defaultCurrency, orderValue: value, material, labour, external, cost, margin: round2(value - cost), marginPct: value > 0 ? Math.round(((value - cost) / value) * 100) : null };
}

export function lastMonths(today: string, count: number) {
  const months: string[] = [];
  const date = new Date(`${today.slice(0, 7)}-15T12:00:00Z`);
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(date);
    d.setUTCMonth(d.getUTCMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}

/** Company-wide figures in the default currency. Cash is the movement recorded in the demo, not a bank balance. */
export function companyFinance(state: ErpState, today: string, period: string = "all") {
  const inPeriod = (iso: string) => period === "all" || monthOf(iso) === period;
  const base = (amount: number, currency: Currency) => toBase(state, amount, currency);
  const sum = (values: number[]) => round2(values.reduce((total, value) => total + value, 0));
  const issued = state.invoices.filter((item) => !item.cancelledAt);
  const unpaidInvoices = issued.filter((item) => !item.paidAt);
  const unpaidBills = state.bills.filter((item) => !item.paidAt);
  const receivable = sum(unpaidInvoices.map((item) => base(item.total, item.currency)));
  const overdueReceivable = sum(unpaidInvoices.filter((item) => item.dueAt < today).map((item) => base(item.total, item.currency)));
  const payable = sum(unpaidBills.map((item) => base(item.total, item.currency)));
  const overduePayable = sum(unpaidBills.filter((item) => item.dueDate < today).map((item) => base(item.total, item.currency)));
  const cashIn = sum(issued.filter((item) => item.paidAt).map((item) => base(item.total, item.currency)));
  const cashOutBills = sum(state.bills.filter((item) => item.paidAt).map((item) => base(item.total, item.currency)));
  const cashOutPayroll = sum(state.payslips.filter((item) => item.paidAt).map((item) => item.employerCost));
  const revenue = sum(issued.filter((item) => inPeriod(item.issuedAt)).map((item) => base(item.subtotal, item.currency)));
  const byCategory = new Map<BillCategory, number>();
  for (const bill of state.bills.filter((item) => inPeriod(item.date))) byCategory.set(bill.category, round2((byCategory.get(bill.category) ?? 0) + base(bill.net, bill.currency)));
  const payroll = sum(state.payslips.filter((item) => period === "all" || item.period === period).map((item) => item.employerCost));
  const costs = round2(sum([...byCategory.values()]) + payroll);
  const months = lastMonths(today, 6).map((month) => ({
    month,
    revenue: sum(issued.filter((item) => monthOf(item.issuedAt) === month).map((item) => base(item.subtotal, item.currency))),
    costs: round2(sum(state.bills.filter((item) => monthOf(item.date) === month).map((item) => base(item.net, item.currency))) + sum(state.payslips.filter((item) => item.period === month).map((item) => item.employerCost))),
  }));
  const quotesOpen = state.quotations.filter((quote) => quote.status === "Sent" || quote.status === "Draft");
  return {
    revenue, receivable, overdueReceivable, payable, overduePayable, cashIn, cashOut: round2(cashOutBills + cashOutPayroll), netCash: round2(cashIn - cashOutBills - cashOutPayroll),
    costsByCategory: [...byCategory.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    payroll, costs, result: round2(revenue - costs), months,
    pipeline: sum(quotesOpen.map((quote) => base(quoteTotals(quote, 0).subtotal, quote.currency))), quotesOpen: quotesOpen.length,
    labourLogged: labourCost(state),
  };
}
