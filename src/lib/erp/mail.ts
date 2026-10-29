/**
 * Email in the ERP: storing messages, classifying them and pulling out order data with rules (no AI, nothing leaves the browser).
 * The user always confirms before extracted data changes a record.
 */
import {
  addDays, log, newDraft, norm, normCode, parseAmount, round2, suggestProjectCode, supplierRows, touch,
  type Currency, type EmailRecord, type ErpState, type ProjectDraft,
} from "./model.ts";

export type EmailKind = "customer-po" | "rfq" | "supplier-quote" | "order-confirmation" | "supplier-invoice" | "payment" | "shipping" | "general";

export const KIND_LABELS: Record<EmailKind, string> = {
  "customer-po": "Customer order", rfq: "Request for quotation", "supplier-quote": "Supplier quotation", "order-confirmation": "Order confirmation",
  "supplier-invoice": "Supplier invoice", payment: "Payment advice", shipping: "Shipping notice", general: "General",
};

export type ExtractedLine = { partNumber: string; description: string; quantity: number; unit: string; unitPrice: number | null; revision: string };
export type ExtractedMaterial = { name: string; quantity: number | null; unit: string; unitPrice: number | null };
export type Extraction = {
  kind: EmailKind; confidence: number; counterparty: { type: "customer" | "supplier" | "unknown"; name: string; id: string | null };
  poNumber: string | null; supplierOrderNumber: string | null; invoiceNumber: string | null; ourInvoiceNumber: string | null; quoteRef: string | null;
  deliveryDate: string | null; dueDate: string | null; currency: Currency | null; total: number | null; net: number | null;
  leadTimeDays: number | null; lines: ExtractedLine[]; materials: ExtractedMaterial[]; fields: { label: string; value: string }[];
};

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Finds a date written as 2026-11-27, 27.11.2026, 27/11/2026 or 27 November 2026. */
export function parseDate(text: string): string | null {
  let m = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = text.match(/\b(\d{1,2})[./](\d{1,2})[./](20\d{2})\b/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  m = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})\b/i);
  if (m) return iso(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]);
  m = text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b/i);
  if (m) return iso(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2]);
  return null;
}

function iso(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "1.234,50" (German) and "1,234.50" (English) both become 1234.5. */
export function parseMoney(raw: string): number | null {
  let value = raw.trim();
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value) || /^\d+,\d{1,2}$/.test(value)) value = value.replace(/\./g, "").replace(",", ".");
  const parsed = parseAmount(value);
  return parsed === null || Number.isNaN(parsed) ? null : parsed;
}

const CURRENCY_TOKEN = "(EUR|€|USD|US\\$|\\$|GBP|£)";
function currencyOf(token: string | undefined): Currency | null {
  if (!token) return null;
  if (/EUR|€/.test(token)) return "EUR";
  if (/GBP|£/.test(token)) return "GBP";
  if (/USD|\$/.test(token)) return "USD";
  return null;
}

/** Date that follows one of the given words within the same line. */
function dateNear(text: string, words: RegExp): string | null {
  for (const line of text.split(/\r?\n/)) if (words.test(line)) { const date = parseDate(line); if (date) return date; }
  return null;
}

/** First amount on a line matching the patterns, tried in order of preference. */
function amountNear(text: string, ...patterns: RegExp[]): { amount: number; currency: Currency | null } | null {
  const lines = text.split(/\r?\n/);
  for (const words of patterns) {
    for (const line of lines) {
      if (!words.test(line)) continue;
      const m = line.match(new RegExp(`${CURRENCY_TOKEN}\\s?([\\d.,]+\\d)|([\\d.,]+\\d)\\s?${CURRENCY_TOKEN}`, "i"));
      if (m) { const amount = parseMoney(m[2] ?? m[3]); if (amount !== null) return { amount, currency: currencyOf(m[1] ?? m[4]) }; }
    }
  }
  return null;
}

const PART_PATTERN = /\b([A-Z]{2,6}-\d{2,5}[A-Z]?)\b/;
const UNIT_PATTERN = "(pcs|pc|pieces|piece|units|unit|sets|set|kg|m)\\b";

function unitOf(raw: string) {
  const unit = raw.toLowerCase();
  if (unit.startsWith("p") || unit.startsWith("unit")) return "pcs";
  if (unit.startsWith("set")) return "set";
  return unit;
}

/** Order lines like "50 pcs ACT-204 rev A Hydraulic housing @ EUR 184.00" or "ACT-204 | Housing | 50 pcs | 184.00". */
export function extractLines(body: string): ExtractedLine[] {
  const lines: ExtractedLine[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-*•>]+|\d{1,2}[.)])\s+/, "").trim();
    const part = line.match(PART_PATTERN);
    if (!part) continue;
    if (/^(re:|subject|po number|purchase order|invoice|quotation|our ref|your ref)/i.test(line)) continue;
    const qty = line.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:x\\s*)?${UNIT_PATTERN}`, "i")) ?? line.match(/(?:qty|quantity)[:\s]*(\d+)/i);
    if (!qty) continue;
    const price = line.match(new RegExp(`(?:@|\\bat\\b|unit price|price)[:\\s]*${CURRENCY_TOKEN}?\\s?([\\d.,]+\\d)`, "i")) ?? line.match(new RegExp(`\\|\\s*${CURRENCY_TOKEN}?\\s?([\\d.,]+\\d)\\s*(?:${CURRENCY_TOKEN})?\\s*$`, "i"));
    const rev = line.match(/\brev(?:ision)?\.?\s*([A-Z0-9]{1,3})\b/i);
    let description = line
      .replace(part[0], " ").replace(qty[0], " ").replace(price?.[0] ?? "", " ").replace(rev?.[0] ?? "", " ")
      .replace(/[|,;:@]+/g, " ").replace(/\b(each|per piece|per pc|net)\b/gi, " ").replace(/^\s*[-–—x]\s*/, "").replace(/\s+/g, " ").trim();
    description = description.replace(/^[-–—\s]+|[-–—\s]+$/g, "");
    lines.push({
      partNumber: part[1], description: description || part[1], quantity: Math.round(parseMoney(qty[1]) ?? 0), unit: qty[2] ? unitOf(qty[2]) : "pcs",
      unitPrice: price ? parseMoney(price[2]) : null, revision: rev ? rev[1].toUpperCase() : "A",
    });
  }
  const seen = new Set<string>();
  return lines.filter((line) => line.quantity > 0 && !seen.has(line.partNumber) && seen.add(line.partNumber));
}

/** Raw materials mentioned in the email that the ERP already knows, with quantity and price on the same line when given. */
export function extractMaterials(state: ErpState, body: string): ExtractedMaterial[] {
  const known = [...new Set([...state.rawMaterials.map((item) => item.name), ...state.materialRequirements.map((req) => req.material)])];
  const found: ExtractedMaterial[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const lower = norm(raw);
    const name = known.filter((item) => lower.includes(norm(item))).sort((a, b) => b.length - a.length)[0];
    if (!name || found.some((item) => item.name === name)) continue;
    const rest = raw.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ");
    const qty = rest.match(/(\d+(?:[.,]\d+)?)\s*(kg|m|pcs|pc|set)\b/i);
    const price = rest.match(new RegExp(`${CURRENCY_TOKEN}\\s?([\\d.,]+\\d)|([\\d.,]+\\d)\\s?${CURRENCY_TOKEN}`, "i"));
    found.push({ name, quantity: qty ? parseMoney(qty[1]) : null, unit: qty ? unitOf(qty[2]) : "kg", unitPrice: price ? parseMoney(price[2] ?? price[3]) : null });
  }
  return found;
}

function counterparty(state: ErpState, email: Pick<EmailRecord, "from" | "fromName">): Extraction["counterparty"] {
  const address = email.from.toLowerCase();
  const domain = address.split("@")[1] ?? "";
  const nameLower = norm(email.fromName.replace(/\(.*\)/, ""));
  const supplier = supplierRows(state).find((item) => (item.email && item.email.toLowerCase().split("@")[1] === domain) || (nameLower && (nameLower.includes(norm(item.name)) || norm(item.name).includes(nameLower))));
  if (supplier) return { type: "supplier", name: supplier.name, id: supplier.id.startsWith("virtual:") ? null : supplier.id };
  const customer = state.customers.find((item) => (item.contact && item.contact.toLowerCase().split("@")[1] === domain) || (nameLower && (nameLower.includes(norm(item.name)) || norm(item.name).includes(nameLower))));
  if (customer) return { type: "customer", name: customer.name, id: customer.id };
  const display = email.fromName.replace(/\(.*\)/, "").trim();
  return { type: "unknown", name: display || domain, id: null };
}

/** Classifies an email and extracts the data an ERP user would otherwise copy by hand. */
export function extractEmail(state: ErpState, email: Pick<EmailRecord, "from" | "fromName" | "subject" | "body">): Extraction {
  const text = `${email.subject}\n${email.body}`;
  const lower = text.toLowerCase();
  const party = counterparty(state, email);
  const has = (re: RegExp) => re.test(lower);

  let kind: EmailKind = "general";
  if (has(/remittance|payment advice|we have (now )?paid|has been paid|payment of .* (made|sent)|transferred the amount/)) kind = "payment";
  else if (has(/order confirmation|confirm (your|the) order|we confirm (the|your) (following|order)|confirmed delivery/)) kind = "order-confirmation";
  else if (has(/shipped|dispatch(ed)? notice|shipping notification|tracking number|out for delivery/)) kind = "shipping";
  else if (has(/request for quotation|\brfq\b|please (send|provide) (us )?(a |your )?(quote|quotation|offer)|could you quote/)) kind = "rfq";
  else if (has(/invoice/) && (party.type === "supplier" || has(/amount due|payment due|please pay|due date/))) kind = "supplier-invoice";
  else if (has(/quotation|our offer|we are pleased to (quote|offer)|price per|lead time/) && party.type !== "customer") kind = "supplier-quote";
  else if (has(/purchase order|please find (attached )?our order|we (would like to )?order|order no|po number|\bpo[- ]?\d/)) kind = "customer-po";

  const poMatch = text.match(/\b(?:purchase order|PO)(?:\s*(?:no\.?|number|#))?\s*[:#]?\s*((?:PO-)?[A-Z0-9]+(?:-[A-Z0-9]+)+|\d{4,})/i);
  const spoMatch = text.match(/\b(SPO-\d{4}-\d{3,5})\b/i);
  const ourInvoice = text.match(/\b(INV-\d{4}-\d{3,5})\b/i);
  const invoiceMatch = text.match(/\binvoice\s*(?:no\.?|number|#)?\s*[:#]?\s*([A-Z0-9]+(?:-[A-Z0-9]+)+)/i);
  const quoteMatch = text.match(/\b(?:quotation|quote|offer|our ref)\s*(?:no\.?|number|#|ref\.?)?\s*[:#]?\s*([A-Z]+-?[A-Z0-9]*-?\d{3,})/i);
  const lead = text.match(/lead time[^\d\n]{0,25}(\d+)\s*(working\s+|calendar\s+)?(days?|weeks?)/i);
  const total = amountNear(text, /grand total|total amount|amount due/i, /\btotal\b/i, /order value|amount transferred|amount paid/i, /\bamount\b/i);
  const net = amountNear(text, /\bnet amount\b|subtotal|\bnet\b/i);
  const delivery = dateNear(text, /deliver|required by|need(ed)? by|ship date|delivery date|ETA/i);
  const due = dateNear(text, /due|payable by|payment date/i);
  const lines = kind === "customer-po" || kind === "rfq" || kind === "general" ? extractLines(email.body) : [];
  const materials = extractMaterials(state, email.body);

  const poNumber = poMatch && !/^SPO-/i.test(poMatch[1]) ? normCode(poMatch[1]) : null;
  const currency = total?.currency ?? net?.currency ?? (lower.includes("€") || lower.includes("eur") ? "EUR" : lower.includes("£") || lower.includes("gbp") ? "GBP" : lower.includes("usd") || lower.includes("$") ? "USD" : null);
  const leadTimeDays = lead ? (/week/i.test(lead[3]) ? Number(lead[1]) * 7 : Number(lead[1])) : null;
  let confidence = kind === "general" ? 0.2 : 0.55;
  if (kind === "customer-po") confidence += (poNumber ? 0.2 : 0) + (lines.length ? 0.2 : 0);
  if (kind === "rfq") confidence += lines.length ? 0.3 : 0;
  if (kind === "supplier-quote") confidence += (materials.some((item) => item.unitPrice !== null) ? 0.25 : 0) + (leadTimeDays ? 0.1 : 0);
  if (kind === "supplier-invoice") confidence += (invoiceMatch ? 0.2 : 0) + (total ? 0.2 : 0);
  if (kind === "payment") confidence += ourInvoice ? 0.35 : 0;
  if (kind === "order-confirmation") confidence += spoMatch ? 0.35 : 0;
  if (party.type !== "unknown") confidence += 0.05;

  const fields: { label: string; value: string }[] = [];
  const add = (label: string, value: string | number | null | undefined) => { if (value !== null && value !== undefined && value !== "") fields.push({ label, value: String(value) }); };
  add(party.type === "unknown" ? "Sender" : party.type === "customer" ? "Customer" : "Supplier", party.name);
  add("Customer PO", kind === "customer-po" ? poNumber : null);
  add("Our order", spoMatch?.[1].toUpperCase());
  add("Supplier invoice", kind === "supplier-invoice" ? invoiceMatch?.[1] : null);
  add("Our invoice", ourInvoice?.[1].toUpperCase());
  add("Their reference", kind === "supplier-quote" ? quoteMatch?.[1] : null);
  add("Delivery date", delivery);
  add("Due date", kind === "supplier-invoice" ? due : null);
  add("Lead time", leadTimeDays ? `${leadTimeDays} days` : null);
  add("Total", total ? `${total.currency ?? currency ?? ""} ${total.amount}`.trim() : null);

  return {
    kind, confidence: Math.min(0.98, round2(confidence)), counterparty: party, poNumber: kind === "customer-po" ? poNumber : null, supplierOrderNumber: spoMatch ? spoMatch[1].toUpperCase() : null,
    invoiceNumber: kind === "supplier-invoice" ? invoiceMatch?.[1] ?? null : null, ourInvoiceNumber: ourInvoice ? ourInvoice[1].toUpperCase() : null, quoteRef: quoteMatch?.[1] ?? null,
    deliveryDate: delivery, dueDate: kind === "supplier-invoice" ? due : null, currency, total: total?.amount ?? null, net: net?.amount ?? null, leadTimeDays, lines, materials, fields,
  };
}

/* ============================== Mailbox records ============================== */

export const MAIL_LIMIT = 150;
const BODY_LIMIT = 20000;

/** Adds messages that are not stored yet (matched by id or provider id). Keeps the newest MAIL_LIMIT. */
export function addEmails(state: ErpState, emails: EmailRecord[], now: string): ErpState {
  const known = new Set(state.emails.flatMap((item) => [item.id, item.externalId ?? ""]).filter(Boolean));
  const fresh = emails.filter((item) => !known.has(item.id) && !(item.externalId && known.has(item.externalId))).map((item) => ({ ...item, body: item.body.slice(0, BODY_LIMIT) }));
  if (!fresh.length) return state;
  const all = [...fresh, ...state.emails].sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAIL_LIMIT);
  const incoming = fresh.filter((item) => item.folder === "inbox").length;
  const next = { ...state, emails: all };
  return incoming ? log(next, now, "inbox", `${incoming} new email${incoming === 1 ? "" : "s"} received`, null) : next;
}

export function markEmailRead(state: ErpState, id: string, read = true): ErpState {
  const email = state.emails.find((item) => item.id === id);
  if (!email || email.read === read) return state;
  return { ...state, emails: touch(state.emails, id, (item) => ({ ...item, read })) };
}

export function linkEmail(state: ErpState, id: string, link: { kind: string; id: string; label: string }): ErpState {
  return { ...state, emails: touch(state.emails, id, (item) => ({ ...item, read: true, links: [...(item.links ?? []).filter((existing) => !(existing.kind === link.kind && existing.id === link.id)), link] })) };
}

export function dismissEmail(state: ErpState, id: string, dismissed = true): ErpState {
  return { ...state, emails: touch(state.emails, id, (item) => ({ ...item, dismissed, read: true })) };
}

export function unreadCount(state: ErpState) {
  return state.emails.filter((item) => item.folder === "inbox" && !item.read).length;
}

/** A customer order email as a project draft. Missing values stay empty so the guided steps ask for them. */
export function draftFromEmail(state: ErpState, email: EmailRecord, extraction: Extraction, today: string): ProjectDraft {
  const draft = newDraft(state, today);
  const customerName = extraction.counterparty.type === "supplier" ? "" : extraction.counterparty.name;
  const lines = extraction.lines.length ? extraction.lines : [];
  return {
    ...draft,
    projectName: lines.length === 1 ? lines[0].description : lines.length ? `${lines[0].description} and ${lines.length - 1} more` : email.subject.replace(/^(re|fw|fwd):\s*/i, "").slice(0, 60),
    projectCode: suggestProjectCode(state), poNumber: extraction.poNumber ?? "", description: `From email: ${email.subject}`.slice(0, 120),
    customerName, contact: email.from, poDate: today, deliveryDate: extraction.deliveryDate ?? addDays(today, 42), currency: extraction.currency ?? state.settings.defaultCurrency,
    orderValue: extraction.total !== null && !lines.some((line) => line.unitPrice !== null) ? String(extraction.total) : "",
    lines: lines.map((line, index) => ({ key: `e${index + 1}`, partNumber: line.partNumber, description: line.description, quantity: String(line.quantity), unit: line.unit, unitPrice: line.unitPrice !== null ? String(line.unitPrice) : "", revision: line.revision })),
  };
}

/** Encodes an email for the Gmail API (RFC 2822, base64url). */
export function rawMime(input: { from: string; to: string; subject: string; body: string }) {
  const encodeHeader = (value: string) => (/[^\x20-\x7E]/.test(value) ? `=?UTF-8?B?${base64(value)}?=` : value);
  const message = [
    ...(input.from ? [`From: ${input.from}`] : []), `To: ${input.to}`, `Subject: ${encodeHeader(input.subject)}`, "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", base64(input.body).replace(/.{76}/g, "$&\r\n"),
  ].join("\r\n");
  return base64(message).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
