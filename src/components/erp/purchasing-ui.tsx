"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Mail, PackageCheck, Plus, Receipt, Send, Trash2, X } from "lucide-react";
import { scheduleDemoSupplierReply, sendFromErp } from "@/components/erp/mailer";
import { commit, getState, nowIso, todayIso, useErp } from "@/components/erp/store";
import { toast } from "@/components/erp/toast";
import { Badge, EmptyState, Field, Modal } from "@/components/erp/ui";
import { saveBill, billError, type BillInput } from "@/lib/erp/finance";
import { linkEmail } from "@/lib/erp/mail";
import {
  BILL_CATEGORIES, CURRENCIES, UNITS, addDays, formatDate, formatMoney, norm, rawMaterialRows, supplierRows,
  type BillCategory, type Currency, type ErpState, type SupplierOrder,
} from "@/lib/erp/model";
import {
  cancelSupplierOrder, confirmSupplierOrder, createSupplierOrder, markSupplierOrderSent, receiveSupplierOrder, reorderSuggestions, supplierOrderEmail, supplierOrderError, supplierOrderTotal,
  type SupplierOrderInput,
} from "@/lib/erp/purchasing";

type Line = { material: string; quantity: string; unit: string; unitPrice: string; requirementIds: string[] };

export type OrderPrefill = { supplier?: string; email?: string; lines?: { material: string; quantity: number; unit: string; unitPrice: number | null; requirementIds?: string[] }[]; notes?: string; emailId?: string };

const toNum = (value: string) => Number(value.replace(",", "."));

/** Order raw material from a supplier without leaving the ERP: the email is written for you and sent from here. */
export function SupplierOrderDialog({ prefill, onClose }: { prefill: OrderPrefill; onClose: () => void }) {
  const state = useErp();
  const suppliers = supplierRows(state);
  const materials = rawMaterialRows(state);
  const supplierRecord = (name: string) => suppliers.find((item) => norm(item.name) === norm(name));
  const leadFor = (name: string) => supplierRecord(name)?.leadTimeDays ?? 7;
  const [supplier, setSupplier] = useState(prefill.supplier ?? "");
  const [email, setEmail] = useState(prefill.email ?? (prefill.supplier ? supplierRecord(prefill.supplier)?.email ?? "" : ""));
  const [currency, setCurrency] = useState<Currency>(state.settings.defaultCurrency);
  const [expectedAt, setExpectedAt] = useState(addDays(todayIso(), leadFor(prefill.supplier ?? "")));
  const [notes, setNotes] = useState(prefill.notes ?? "");
  const [lines, setLines] = useState<Line[]>(prefill.lines?.length ? prefill.lines.map((line) => ({ material: line.material, quantity: String(line.quantity), unit: line.unit, unitPrice: line.unitPrice === null ? "" : String(line.unitPrice), requirementIds: line.requirementIds ?? [] })) : [{ material: "", quantity: "", unit: "kg", unitPrice: "", requirementIds: [] }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input: SupplierOrderInput = { supplier, email, currency, expectedAt, notes, lines: lines.map((line) => ({ material: line.material, quantity: toNum(line.quantity), unit: line.unit, unitPrice: line.unitPrice.trim() ? toNum(line.unitPrice) : null, requirementIds: line.requirementIds })) };
  const previewOrder: SupplierOrder = { id: "preview", number: "SPO-2026-…", supplier: supplier || "Supplier", email, currency, lines: input.lines.filter((line) => line.material.trim()), status: "Draft", createdAt: nowIso(), expectedAt, notes, emailIds: [] };
  const mail = supplierOrderEmail(state, previewOrder);
  const realMail = state.mail.provider === "gmail";
  const setLine = (index: number, patch: Partial<Line>) => setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const chooseSupplier = (name: string) => {
    setSupplier(name);
    const record = supplierRecord(name);
    if (record) { setEmail(record.email); setExpectedAt(addDays(todayIso(), record.leadTimeDays ?? 7)); }
  };
  const chooseMaterial = (index: number, name: string) => {
    const record = materials.find((item) => norm(item.name) === norm(name));
    setLine(index, { material: name, ...(record ? { unit: record.unit, unitPrice: lines[index].unitPrice || (record.unitCost !== null ? String(record.unitCost) : "") } : {}) });
  };
  const submit = async (send: boolean) => {
    const problem = supplierOrderError(input) ?? (send && !email.trim() ? "Enter the supplier's email address to send the order." : null);
    if (problem) { setError(problem); return; }
    setBusy(true);
    const created: { id: string | null } = { id: null };
    commit((value) => { const result = createSupplierOrder(value, input, nowIso()); created.id = result.id; return result.state; });
    const order = getState().supplierOrders.find((item) => item.id === created.id);
    if (!order) { setBusy(false); setError("The order could not be saved."); return; }
    if (!send) { setBusy(false); toast(`${order.number} saved as draft.`, { tone: "ok" }); onClose(); return; }
    const content = supplierOrderEmail(getState(), order);
    const sent = await sendFromErp({ to: order.email, ...content });
    setBusy(false);
    if (sent.error) { setError(`${order.number} was saved as a draft, but the email was not sent: ${sent.error}`); return; }
    commit((value) => {
      let next = markSupplierOrderSent(value, order.id, sent.id, nowIso());
      if (prefill.emailId) next = linkEmail(next, prefill.emailId, { kind: "supplierOrder", id: order.id, label: order.number });
      return next;
    });
    toast(sent.real ? `${order.number} emailed to ${order.email} from your Gmail.` : `${order.number} recorded as sent (sample inbox: no real email left the browser).`, { tone: "ok", href: "/demo/inbox?folder=sent", action: "See email" });
    scheduleDemoSupplierReply(order.id);
    onClose();
  };
  return <Modal label="Order from supplier" wide onClose={onClose}>
    <div className="erp-dialog-bar"><h2>Order from a supplier</h2><button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={onClose}><X size={14} /> Close</button></div>
    <div className="erp-compose">
      <div className="erp-stack" style={{ gap: 12 }}>
        <div className="erp-form-grid">
          <Field id="spo-supplier" label="Supplier"><input className="erp-input" id="spo-supplier" list="spo-suppliers" value={supplier} onChange={(event) => chooseSupplier(event.target.value)} placeholder="Pick or type a supplier" /><datalist id="spo-suppliers">{suppliers.map((item) => <option key={item.id} value={item.name} />)}</datalist></Field>
          <Field id="spo-email" label="Supplier email"><input className="erp-input" id="spo-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="orders@supplier.com" /></Field>
          <Field id="spo-date" label="Required delivery"><input className="erp-input" id="spo-date" type="date" value={expectedAt} onChange={(event) => setExpectedAt(event.target.value)} /></Field>
          <Field id="spo-cur" label="Currency"><select className="erp-select" id="spo-cur" value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>{CURRENCIES.map((item) => <option key={item}>{item}</option>)}</select></Field>
        </div>
        <div className="erp-field"><span className="erp-label">Materials</span>
          <div className="erp-order-lines">
            {lines.map((line, index) => <div key={index} className="erp-order-line">
              <input className="erp-input" aria-label="Material" list="spo-materials" placeholder="Material" value={line.material} onChange={(event) => chooseMaterial(index, event.target.value)} />
              <input className="erp-input" aria-label="Quantity" inputMode="decimal" placeholder="Qty" value={line.quantity} onChange={(event) => setLine(index, { quantity: event.target.value })} />
              <select className="erp-select" aria-label="Unit" value={line.unit} onChange={(event) => setLine(index, { unit: event.target.value })}>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select>
              <input className="erp-input" aria-label="Unit price" inputMode="decimal" placeholder="Price / unit" value={line.unitPrice} onChange={(event) => setLine(index, { unitPrice: event.target.value })} />
              <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, i) => i !== index))}><Trash2 size={13} /></button>
              {line.requirementIds.length > 0 && <small className="erp-faint">For {line.requirementIds.length} project requirement{line.requirementIds.length === 1 ? "" : "s"}</small>}
            </div>)}
            <datalist id="spo-materials">{materials.map((item) => <option key={item.id} value={item.name} />)}</datalist>
          </div>
          <div><button type="button" className="erp-btn erp-btn-sm" onClick={() => setLines([...lines, { material: "", quantity: "", unit: "kg", unitPrice: "", requirementIds: [] }])}><Plus size={13} /> Add material</button></div>
        </div>
        <Field id="spo-notes" label="Notes for the supplier (optional)"><input className="erp-input" id="spo-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. cut to 300 mm lengths" /></Field>
        {error && <p className="erp-error" role="alert">{error}</p>}
      </div>
      <div className="erp-mailpreview" aria-label="Email preview">
        <p className="erp-label"><Mail size={13} /> Email that will be sent {realMail ? "from your Gmail" : "(sample inbox: recorded, not delivered)"}</p>
        <div><small>To</small><b>{email || "—"}</b></div>
        <div><small>Subject</small><b>{mail.subject}</b></div>
        <pre>{mail.body}</pre>
      </div>
    </div>
    <div className="erp-dialog-foot">
      <span className="erp-faint">Value {formatMoney(supplierOrderTotal(previewOrder), currency)} · purchase recommendations for linked projects switch to “Ordered”.</span>
      <button type="button" className="erp-btn erp-btn-ghost" disabled={busy} onClick={() => submit(false)}>Save draft</button>
      <button type="button" className="erp-btn erp-btn-primary" disabled={busy} onClick={() => submit(true)}><Send size={14} /> {busy ? "Sending…" : "Send order by email"}</button>
    </div>
  </Modal>;
}

/** What to order now, grouped by supplier, with one button per supplier. */
export function ReorderPanel({ onOrder }: { onOrder: (prefill: OrderPrefill) => void }) {
  const state = useErp();
  const suggestions = reorderSuggestions(state);
  if (!suggestions.length) return null;
  const groups = new Map<string, typeof suggestions>();
  for (const item of suggestions) groups.set(item.supplier || "No supplier yet", [...(groups.get(item.supplier || "No supplier yet") ?? []), item]);
  return <section className="erp-card" style={{ marginBottom: 16 }}>
    <div className="erp-card-head"><div><h2>Order now</h2><p>Unordered project demand plus refills for materials below their reorder level, grouped by preferred supplier.</p></div></div>
    <div className="erp-reorder">
      {[...groups.entries()].map(([supplier, items]) => <article key={supplier} className="erp-reorder-group">
        <div><b>{supplier}</b><small>{items[0].email || "No email on file"}</small></div>
        <ul>{items.map((item) => <li key={item.material}><span>{item.quantity} {item.unit} {item.material}</span><small>{item.reason}</small></li>)}</ul>
        <button type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={() => onOrder({ supplier: supplier === "No supplier yet" ? "" : supplier, email: items[0].email, lines: items.map((item) => ({ material: item.material, quantity: item.quantity, unit: item.unit, unitPrice: item.unitPrice, requirementIds: item.requirementIds })) })}><Mail size={13} /> Order by email</button>
      </article>)}
    </div>
  </section>;
}

export function SupplierOrdersSection({ onBill }: { onBill: (prefill: Partial<BillInput>) => void }) {
  const state = useErp();
  const orders = [...state.supplierOrders].reverse();
  const today = todayIso();
  const send = async (order: SupplierOrder) => {
    if (!order.email) { toast(`Add the supplier's email on ${order.number} first (Suppliers tab).`, { tone: "bad" }); return; }
    const sent = await sendFromErp({ to: order.email, ...supplierOrderEmail(state, order) });
    if (sent.error) { toast(sent.error, { tone: "bad" }); return; }
    commit((value) => markSupplierOrderSent(value, order.id, sent.id, nowIso()));
    toast(`${order.number} sent${sent.real ? "" : " (recorded in the sample inbox)"}.`, { tone: "ok" });
    scheduleDemoSupplierReply(order.id);
  };
  return <section className="erp-card" style={{ marginBottom: 16 }}>
    <div className="erp-card-head"><div><h2>Supplier orders</h2><p>Orders sent from the ERP, with the supplier’s confirmation, goods receipt and bill.</p></div></div>
    {orders.length ? <div className="erp-rows" role="table">
      <div className="erp-row erp-row-head" role="row" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.2fr) minmax(0,2fr) minmax(0,.9fr) minmax(0,1fr) 260px" }}>{["Order", "Supplier", "Materials", "Value", "Status", ""].map((label) => <span key={label} role="columnheader">{label}</span>)}</div>
      {orders.map((order) => {
        const late = (order.status === "Sent" || order.status === "Confirmed") && order.expectedAt < today;
        const billed = state.bills.some((bill) => bill.supplierOrderId === order.id);
        return <div key={order.id} role="row" className="erp-row" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.2fr) minmax(0,2fr) minmax(0,.9fr) minmax(0,1fr) 260px" }}>
          <span><strong>{order.number}</strong><small>{formatDate(order.createdAt)}</small></span>
          <span>{order.supplier}<small>{order.email || "No email"}</small></span>
          <span>{order.lines.map((line) => `${line.quantity} ${line.unit} ${line.material}`).join(" · ")}</span>
          <span className="erp-num" style={{ textAlign: "left" }}>{formatMoney(supplierOrderTotal(order), order.currency)}</span>
          <span><Badge tone={order.status === "Received" ? "ok" : order.status === "Cancelled" ? "bad" : late ? "bad" : order.status === "Draft" ? "neutral" : "warn"}>{order.status}</Badge><small>{late ? `Late · expected ${formatDate(order.expectedAt)}` : order.status === "Received" ? `Received ${formatDate(order.receivedAt ?? "")}` : `Expected ${formatDate(order.expectedAt)}`}</small></span>
          <span className="erp-head-actions">
            {order.status === "Draft" && <button type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={() => send(order)}><Send size={13} /> Send</button>}
            {order.status === "Sent" && <button type="button" className="erp-btn erp-btn-sm" onClick={() => commit((value) => confirmSupplierOrder(value, order.id, null, null, nowIso()))}><CheckCircle2 size={13} /> Confirmed</button>}
            {(order.status === "Sent" || order.status === "Confirmed") && <button type="button" className="erp-btn erp-btn-sm" onClick={() => { commit((value) => receiveSupplierOrder(value, order.id, nowIso())); toast(`Goods received for ${order.number}. Stock updated.`, { tone: "ok" }); }}><PackageCheck size={13} /> Receive</button>}
            {order.status !== "Draft" && order.status !== "Cancelled" && !billed && <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => onBill({ supplier: order.supplier, supplierOrderId: order.id, net: supplierOrderTotal(order), currency: order.currency, category: "Raw material", description: order.lines.map((line) => `${line.material}, ${line.quantity} ${line.unit}`).join("; ") })}><Receipt size={13} /> Bill</button>}
            {order.emailIds.length > 0 && <Link className="erp-btn erp-btn-ghost erp-btn-sm" href={`/demo/inbox?mail=${order.emailIds[order.emailIds.length - 1]}`} aria-label={`Emails for ${order.number}`}><Mail size={13} /></Link>}
            {(order.status === "Draft" || order.status === "Sent") && <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" aria-label={`Cancel ${order.number}`} onClick={() => commit((value) => cancelSupplierOrder(value, order.id, nowIso()))}><X size={13} /></button>}
          </span>
        </div>;
      })}
    </div> : <EmptyState title="No supplier orders yet" text="Use “Order by email” to order material. The order email is written for you and sent from here." />}
  </section>;
}

/* ---------- Supplier bills ---------- */

export function BillDialog({ prefill, billId, onClose }: { prefill: Partial<BillInput>; billId?: string; onClose: () => void }) {
  const state = useErp();
  const existing = billId ? state.bills.find((bill) => bill.id === billId) : null;
  const today = todayIso();
  const [values, setValues] = useState({
    number: existing?.number ?? prefill.number ?? "", supplier: existing?.supplier ?? prefill.supplier ?? "", category: (existing?.category ?? prefill.category ?? "Raw material") as BillCategory,
    date: existing?.date ?? prefill.date ?? today, dueDate: existing?.dueDate ?? prefill.dueDate ?? addDays(today, 30), currency: (existing?.currency ?? prefill.currency ?? state.settings.defaultCurrency) as Currency,
    net: String(existing?.net ?? prefill.net ?? ""), taxRate: String(existing?.taxRate ?? prefill.taxRate ?? state.settings.taxRate), description: existing?.description ?? prefill.description ?? "",
    projectId: existing?.projectId ?? prefill.projectId ?? "", supplierOrderId: existing?.supplierOrderId ?? prefill.supplierOrderId ?? "",
  });
  const [error, setError] = useState("");
  const set = (patch: Partial<typeof values>) => setValues({ ...values, ...patch });
  const input: BillInput = { ...values, net: toNum(values.net), taxRate: toNum(values.taxRate), projectId: values.projectId || undefined, supplierOrderId: values.supplierOrderId || undefined, emailId: prefill.emailId };
  const submit = () => {
    const problem = billError(state, input, billId ?? null);
    if (problem) { setError(problem); return; }
    commit((value) => {
      let next = saveBill(value, billId ?? null, input, nowIso());
      if (prefill.emailId) {
        const bill = next.bills.find((item) => norm(item.number) === norm(input.number) && norm(item.supplier) === norm(input.supplier));
        if (bill) next = linkEmail(next, prefill.emailId, { kind: "bill", id: bill.id, label: `Bill ${bill.number}` });
      }
      return next;
    });
    toast(`Supplier bill ${input.number} ${billId ? "updated" : "recorded"}.`, { tone: "ok", href: "/demo/finance?view=bills", action: "Open" });
    onClose();
  };
  const net = toNum(values.net) || 0;
  const tax = Math.round(net * (toNum(values.taxRate) || 0)) / 100;
  return <Modal label="Supplier bill" onClose={onClose}>
    <form className="erp-stack" style={{ gap: 12 }} onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <h2>{billId ? "Edit supplier bill" : "Record a supplier bill"}</h2>
      <div className="erp-form-grid">
        <Field id="bill-supplier" label="Supplier"><input className="erp-input" id="bill-supplier" list="bill-suppliers" value={values.supplier} onChange={(event) => set({ supplier: event.target.value })} /><datalist id="bill-suppliers">{supplierRows(state).map((item) => <option key={item.id} value={item.name} />)}</datalist></Field>
        <Field id="bill-number" label="Supplier’s invoice number"><input className="erp-input" id="bill-number" value={values.number} onChange={(event) => set({ number: event.target.value })} /></Field>
        <Field id="bill-cat" label="Category"><select className="erp-select" id="bill-cat" value={values.category} onChange={(event) => set({ category: event.target.value as BillCategory })}>{BILL_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></Field>
        <Field id="bill-cur" label="Currency"><select className="erp-select" id="bill-cur" value={values.currency} onChange={(event) => set({ currency: event.target.value as Currency })}>{CURRENCIES.map((item) => <option key={item}>{item}</option>)}</select></Field>
        <Field id="bill-date" label="Bill date"><input className="erp-input" id="bill-date" type="date" value={values.date} onChange={(event) => set({ date: event.target.value })} /></Field>
        <Field id="bill-due" label="Due date"><input className="erp-input" id="bill-due" type="date" value={values.dueDate} onChange={(event) => set({ dueDate: event.target.value })} /></Field>
        <Field id="bill-net" label="Net amount"><input className="erp-input" id="bill-net" inputMode="decimal" value={values.net} onChange={(event) => set({ net: event.target.value })} /></Field>
        <Field id="bill-tax" label="Tax rate (%)"><input className="erp-input" id="bill-tax" inputMode="decimal" value={values.taxRate} onChange={(event) => set({ taxRate: event.target.value })} /></Field>
        <Field id="bill-project" label="Project (optional)"><select className="erp-select" id="bill-project" value={values.projectId} onChange={(event) => set({ projectId: event.target.value })}><option value="">Company overhead</option>{state.projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</select></Field>
        <Field id="bill-spo" label="Supplier order (optional)"><select className="erp-select" id="bill-spo" value={values.supplierOrderId} onChange={(event) => set({ supplierOrderId: event.target.value })}><option value="">None</option>{state.supplierOrders.map((order) => <option key={order.id} value={order.id}>{order.number} · {order.supplier}</option>)}</select></Field>
      </div>
      <Field id="bill-desc" label="Description"><input className="erp-input" id="bill-desc" value={values.description} onChange={(event) => set({ description: event.target.value })} /></Field>
      <p className="erp-faint">Total {formatMoney(net + tax, values.currency)} (tax {formatMoney(tax, values.currency)})</p>
      {error && <p className="erp-error" role="alert">{error}</p>}
      <div className="erp-head-actions" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="erp-btn erp-btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="erp-btn erp-btn-primary">{billId ? "Save" : "Record bill"}</button>
      </div>
    </form>
  </Modal>;
}

export function supplierOrderByNumber(state: ErpState, number: string | null) {
  return number ? state.supplierOrders.find((order) => order.number.toUpperCase() === number.toUpperCase()) ?? null : null;
}
