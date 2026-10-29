"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, FolderKanban, Plus, Printer, Send, Trash2, X } from "lucide-react";
import { BohMark } from "@/components/brand/boh-logo";
import { ComposeDialog } from "@/components/erp/inbox";
import { Loading } from "@/components/erp/modules";
import { commit, nowIso, todayIso, useErp, useHydrated } from "@/components/erp/store";
import { toast } from "@/components/erp/toast";
import { Badge, EmptyState, Field, Modal, PageHead, ProjectLink } from "@/components/erp/ui";
import { convertQuote, quoteEmail, quoteError, quoteTotals, saveQuotation, setQuoteStatus, type QuoteInput } from "@/lib/erp/finance";
import { linkEmail } from "@/lib/erp/mail";
import { CURRENCIES, UNITS, addDays, formatDate, formatMoney, type Currency, type ErpState, type Quotation } from "@/lib/erp/model";

type LineDraft = { partNumber: string; description: string; quantity: string; unit: string; unitPrice: string; revision: string };

export function QuotationsModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const params = useSearchParams();
  const [editing, setEditing] = useState<string | "new" | null>(params.get("id"));
  const [printing, setPrinting] = useState<string | null>(null);
  const [mailing, setMailing] = useState<Quotation | null>(null);
  const [converting, setConverting] = useState<Quotation | null>(null);
  const head = <PageHead eyebrow="Commercial" title="Quotations" description="Offers to customers. Draft one from an enquiry email, send it, and turn it into a project with one click when the order comes in." actions={<button type="button" className="erp-btn erp-btn-primary" onClick={() => setEditing("new")}><Plus size={15} /> New quotation</button>} />;
  if (!hydrated) return <>{head}<Loading /></>;
  const today = todayIso();
  const quotes = [...state.quotations].reverse();
  const totals = (quote: Quotation) => quoteTotals(quote, 0).subtotal;
  const open = quotes.filter((quote) => quote.status === "Draft" || quote.status === "Sent");
  const won = quotes.filter((quote) => quote.status === "Accepted").length;
  const decided = quotes.filter((quote) => quote.status === "Accepted" || quote.status === "Rejected").length;
  const columns = "minmax(0,1fr) minmax(0,1.4fr) minmax(0,1.8fr) minmax(0,1fr) minmax(0,1fr) 300px";
  return <>{head}
    <section className="erp-kpis" aria-label="Quotation figures">
      <article className="erp-card erp-kpi"><small>Open quotations</small><strong>{open.length}</strong><span>{formatMoney(open.reduce((sum, quote) => sum + totals(quote), 0), state.settings.defaultCurrency)} net</span></article>
      <article className="erp-card erp-kpi"><small>Hit rate</small><strong>{decided ? `${Math.round((won / decided) * 100)}%` : "—"}</strong><span>{won} won of {decided} decided</span></article>
      <article className="erp-card erp-kpi"><small>Expiring in 7 days</small><strong>{open.filter((quote) => quote.validUntil >= today && quote.validUntil <= addDays(today, 7)).length}</strong></article>
      <article className="erp-card erp-kpi"><small>Converted to projects</small><strong>{quotes.filter((quote) => quote.projectId).length}</strong></article>
    </section>
    <section className="erp-card" style={{ marginTop: 16 }}>{quotes.length ? <div className="erp-rows" role="table">
      <div className="erp-row erp-row-head" role="row" style={{ gridTemplateColumns: columns }}>{["Quotation", "Customer", "Parts", "Value (net)", "Status", ""].map((label) => <span key={label} role="columnheader">{label}</span>)}</div>
      {quotes.map((quote) => {
        const expired = (quote.status === "Sent" || quote.status === "Draft") && quote.validUntil < today;
        const project = quote.projectId ? state.projects.find((item) => item.id === quote.projectId) : null;
        return <div key={quote.id} role="row" className="erp-row" style={{ gridTemplateColumns: columns }}>
          <span><button type="button" className="erp-linkbtn" onClick={() => setEditing(quote.id)}><strong>{quote.number}</strong></button><small>{formatDate(quote.date)} · valid to {formatDate(quote.validUntil)}</small></span>
          <span>{quote.customerName}<small>{quote.contact}</small></span>
          <span>{quote.lines.map((line) => `${line.quantity} × ${line.partNumber}`).join(", ")}<small>{quote.leadTimeWeeks} weeks lead time</small></span>
          <span className="erp-num" style={{ textAlign: "left" }}>{formatMoney(totals(quote), quote.currency)}</span>
          <span><Badge tone={quote.status === "Accepted" ? "ok" : quote.status === "Rejected" || expired ? "bad" : quote.status === "Sent" ? "warn" : "neutral"}>{expired ? "Expired" : quote.status}</Badge>{project && <ProjectLink id={project.id} code={project.code} />}</span>
          <span className="erp-head-actions">
            <button type="button" className="erp-btn erp-btn-sm" aria-label={`Print ${quote.number}`} onClick={() => setPrinting(quote.id)}><Printer size={13} /></button>
            {quote.status === "Draft" && <button type="button" className="erp-btn erp-btn-sm" onClick={() => setMailing(quote)}><Send size={13} /> Send</button>}
            {(quote.status === "Sent" || quote.status === "Draft") && <button type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={() => setConverting(quote)}><CheckCircle2 size={13} /> Won</button>}
            {quote.status === "Sent" && <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" aria-label={`Mark ${quote.number} lost`} onClick={() => commit((value) => setQuoteStatus(value, quote.id, "Rejected", nowIso()))}><X size={13} /> Lost</button>}
          </span>
        </div>;
      })}
    </div> : <EmptyState title="No quotations yet" text="Create one, or draft it straight from a request-for-quotation email in the Inbox." />}</section>
    {editing && <QuoteDialog state={state} quoteId={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    {printing && <QuotePrint state={state} quote={state.quotations.find((quote) => quote.id === printing)!} onClose={() => setPrinting(null)} />}
    {mailing && <ComposeDialog prefill={{ to: mailing.contact.includes("@") ? mailing.contact : "", ...quoteEmail(state, mailing) }} onClose={() => setMailing(null)} onSent={(emailId) => { commit((value) => { const next = setQuoteStatus(value, mailing.id, "Sent", nowIso()); return mailing.emailId ? linkEmail(next, mailing.emailId, { kind: "quotation", id: mailing.id, label: `${mailing.number} sent` }) : next; }); void emailId; }} />}
    {converting && <ConvertDialog quote={converting} onClose={() => setConverting(null)} />}
  </>;
}

function QuoteDialog({ state, quoteId, onClose }: { state: ErpState; quoteId: string | null; onClose: () => void }) {
  const quote = quoteId ? state.quotations.find((item) => item.id === quoteId) ?? null : null;
  const today = todayIso();
  const locked = quote?.status === "Accepted";
  const [values, setValues] = useState({ customerName: quote?.customerName ?? "", contact: quote?.contact ?? "", date: quote?.date ?? today, validUntil: quote?.validUntil ?? addDays(today, 30), currency: (quote?.currency ?? state.settings.defaultCurrency) as Currency, notes: quote?.notes ?? "", leadTimeWeeks: String(quote?.leadTimeWeeks ?? 4) });
  const [lines, setLines] = useState<LineDraft[]>(quote?.lines.map((line) => ({ ...line, quantity: String(line.quantity), unitPrice: String(line.unitPrice) })) ?? [{ partNumber: "", description: "", quantity: "", unit: "pcs", unitPrice: "", revision: "A" }]);
  const [error, setError] = useState("");
  const input: QuoteInput = { ...values, leadTimeWeeks: Number(values.leadTimeWeeks), lines: lines.map((line) => ({ ...line, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice.replace(",", ".")) })) };
  const total = input.lines.reduce((sum, line) => sum + (line.quantity || 0) * (line.unitPrice || 0), 0);
  const setLine = (index: number, patch: Partial<LineDraft>) => setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const knownParts = state.parts.map((part) => ({ part, price: state.lineItems.filter((line) => line.partId === part.id).map((line) => line.unitPrice).filter((price): price is number => price !== null).at(-1) }));
  const submit = () => {
    const problem = quoteError(input);
    if (problem) { setError(problem); return; }
    commit((value) => saveQuotation(value, quoteId, input, nowIso()).state);
    toast(quoteId ? "Quotation saved." : "Quotation created.", { tone: "ok" });
    onClose();
  };
  return <Modal label="Quotation" wide onClose={onClose}>
    <div className="erp-dialog-bar"><h2>{quote ? `Quotation ${quote.number}` : "New quotation"}{locked ? " · accepted" : ""}</h2><button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={onClose}><X size={14} /> Close</button></div>
    <div className="erp-card-pad erp-stack" style={{ gap: 12 }}>
      <div className="erp-form-grid">
        <Field id="q-customer" label="Customer"><input className="erp-input" id="q-customer" list="q-customers" disabled={locked} value={values.customerName} onChange={(event) => setValues({ ...values, customerName: event.target.value })} /><datalist id="q-customers">{state.customers.map((item) => <option key={item.id} value={item.name} />)}</datalist></Field>
        <Field id="q-contact" label="Contact email"><input className="erp-input" id="q-contact" disabled={locked} value={values.contact} onChange={(event) => setValues({ ...values, contact: event.target.value })} /></Field>
        <Field id="q-date" label="Quote date"><input className="erp-input" id="q-date" type="date" disabled={locked} value={values.date} onChange={(event) => setValues({ ...values, date: event.target.value })} /></Field>
        <Field id="q-valid" label="Valid until"><input className="erp-input" id="q-valid" type="date" disabled={locked} value={values.validUntil} onChange={(event) => setValues({ ...values, validUntil: event.target.value })} /></Field>
        <Field id="q-lead" label="Lead time (weeks)"><input className="erp-input" id="q-lead" inputMode="numeric" disabled={locked} value={values.leadTimeWeeks} onChange={(event) => setValues({ ...values, leadTimeWeeks: event.target.value })} /></Field>
        <Field id="q-cur" label="Currency"><select className="erp-select" id="q-cur" disabled={locked} value={values.currency} onChange={(event) => setValues({ ...values, currency: event.target.value as Currency })}>{CURRENCIES.map((item) => <option key={item}>{item}</option>)}</select></Field>
      </div>
      <div className="erp-field"><span className="erp-label">Lines</span>
        <div className="erp-quote-head"><span>Part no.</span><span>Description</span><span>Rev</span><span>Qty</span><span>Unit</span><span>Unit price</span><span /></div>
        {lines.map((line, index) => <div key={index} className="erp-quote-line">
          <input className="erp-input" aria-label="Part number" list="q-parts" disabled={locked} value={line.partNumber} onChange={(event) => { const value = event.target.value.toUpperCase(); const known = knownParts.find((item) => item.part.number === value); setLine(index, known ? { partNumber: value, description: line.description || known.part.description, unitPrice: line.unitPrice || (known.price !== undefined ? String(known.price) : "") } : { partNumber: value }); }} />
          <input className="erp-input" aria-label="Description" disabled={locked} value={line.description} onChange={(event) => setLine(index, { description: event.target.value })} />
          <input className="erp-input" aria-label="Revision" maxLength={3} disabled={locked} value={line.revision} onChange={(event) => setLine(index, { revision: event.target.value.toUpperCase() })} />
          <input className="erp-input" aria-label="Quantity" inputMode="numeric" disabled={locked} value={line.quantity} onChange={(event) => setLine(index, { quantity: event.target.value })} />
          <select className="erp-select" aria-label="Unit" disabled={locked} value={line.unit} onChange={(event) => setLine(index, { unit: event.target.value })}>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select>
          <input className="erp-input" aria-label="Unit price" inputMode="decimal" disabled={locked} value={line.unitPrice} onChange={(event) => setLine(index, { unitPrice: event.target.value })} />
          <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" aria-label="Remove line" disabled={locked || lines.length === 1} onClick={() => setLines(lines.filter((_, i) => i !== index))}><Trash2 size={13} /></button>
        </div>)}
        <datalist id="q-parts">{knownParts.map((item) => <option key={item.part.id} value={item.part.number}>{item.part.description}</option>)}</datalist>
        {!locked && <div><button type="button" className="erp-btn erp-btn-sm" onClick={() => setLines([...lines, { partNumber: "", description: "", quantity: "", unit: "pcs", unitPrice: "", revision: "A" }])}><Plus size={13} /> Add line</button></div>}
      </div>
      <Field id="q-notes" label="Notes on the quotation"><input className="erp-input" id="q-notes" disabled={locked} value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })} placeholder="e.g. tooling included, prices ex works" /></Field>
      {error && <p className="erp-error" role="alert">{error}</p>}
    </div>
    <div className="erp-dialog-foot"><span className="erp-faint">Net total {formatMoney(total, values.currency)}</span><button type="button" className="erp-btn erp-btn-ghost" onClick={onClose}>{locked ? "Close" : "Cancel"}</button>{!locked && <button type="button" className="erp-btn erp-btn-primary" onClick={submit}>Save quotation</button>}</div>
  </Modal>;
}

function ConvertDialog({ quote, onClose }: { quote: Quotation; onClose: () => void }) {
  const router = useRouter();
  const [po, setPo] = useState("");
  const [error, setError] = useState("");
  const submit = () => {
    const holder: { id: string | null; error: string | null } = { id: null, error: null };
    commit((value) => { const result = convertQuote(value, quote.id, po, nowIso()); if ("error" in result) { holder.error = result.error; return value; } holder.id = result.projectId; return result.state; });
    if (holder.error) { setError(holder.error); return; }
    toast(`${quote.number} won. Project created.`, { tone: "ok" });
    onClose();
    if (holder.id) router.push(`/demo/projects/${holder.id}`);
  };
  return <Modal label="Quotation won" onClose={onClose}>
    <form className="erp-stack" style={{ gap: 12 }} onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <h2><FolderKanban size={18} /> {quote.number} won</h2>
      <p>The customer ordered. Enter their purchase order number and the project is created with the quoted parts, quantities and prices.</p>
      <Field id="conv-po" label="Customer’s PO number" error={error || undefined}><input className="erp-input" id="conv-po" value={po} onChange={(event) => setPo(event.target.value.toUpperCase())} placeholder="e.g. PO-2026-2201" /></Field>
      <div className="erp-head-actions" style={{ justifyContent: "flex-end" }}><button type="button" className="erp-btn erp-btn-ghost" onClick={onClose}>Cancel</button><button type="submit" className="erp-btn erp-btn-primary">Create project</button></div>
    </form>
  </Modal>;
}

function QuotePrint({ state, quote, onClose }: { state: ErpState; quote: Quotation; onClose: () => void }) {
  const totals = quoteTotals(quote, state.settings.taxRate);
  return <Modal label={`Quotation ${quote.number}`} wide onClose={onClose}>
    <div className="erp-dialog-bar"><h2>Quotation</h2><div className="erp-head-actions"><button type="button" className="erp-btn erp-btn-sm" onClick={() => window.print()}><Printer size={14} /> Print / save as PDF</button><button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={onClose}><X size={14} /> Close</button></div></div>
    <article className="erp-doc erp-print">
      <div className="erp-doc-top"><div className="erp-doc-brand"><BohMark size={30} /><span>{state.settings.companyName}</span></div><div className="erp-doc-title"><h1>Quotation</h1><span>{quote.number}</span></div></div>
      <span className="erp-doc-stamp">ILLUSTRATIVE DEMO DOCUMENT · FICTIONAL DATA</span>
      <div className="erp-doc-meta">{([["Customer", quote.customerName], ["Contact", quote.contact || "—"], ["Date", formatDate(quote.date)], ["Valid until", formatDate(quote.validUntil)], ["Lead time", `${quote.leadTimeWeeks} weeks`], ["Currency", quote.currency]] as [string, string][]).map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</div>
      <table><thead><tr><th>Part</th><th>Rev</th><th>Description</th><th className="r">Qty</th><th className="r">Unit price</th><th className="r">Amount</th></tr></thead><tbody>
        {quote.lines.map((line) => <tr key={line.partNumber}><td>{line.partNumber}</td><td>{line.revision}</td><td>{line.description}</td><td className="r">{line.quantity} {line.unit}</td><td className="r">{formatMoney(line.unitPrice, quote.currency)}</td><td className="r">{formatMoney(line.unitPrice * line.quantity, quote.currency)}</td></tr>)}
      </tbody><tfoot>
        <tr><td colSpan={5}>Subtotal</td><td className="r">{formatMoney(totals.subtotal, quote.currency)}</td></tr>
        <tr><td colSpan={5}>Tax ({state.settings.taxRate}%)</td><td className="r">{formatMoney(totals.tax, quote.currency)}</td></tr>
        <tr><td colSpan={5}>Total</td><td className="r">{formatMoney(totals.total, quote.currency)}</td></tr>
      </tfoot></table>
      {quote.notes && <p style={{ marginTop: 12 }}>{quote.notes}</p>}
      <p className="erp-doc-foot">Generated by the BOH ERP demo. Prices and parts are fictional.</p>
    </article>
  </Modal>;
}
