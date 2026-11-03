"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CheckCircle2, Link2, Mail, MailOpen, PenLine, RefreshCw, Reply, Send, Sparkles, X } from "lucide-react";
import { BillDialog, SupplierOrderDialog, supplierOrderByNumber, type OrderPrefill } from "@/components/erp/purchasing-ui";
import { connectGmail, disconnectGmail, gmailAvailable, hasToken } from "@/components/erp/gmail";
import { sendFromErp, syncGmail } from "@/components/erp/mailer";
import { Loading } from "@/components/erp/modules";
import { commit, getState, nowIso, todayIso, useErp, useHydrated } from "@/components/erp/store";
import { toast } from "@/components/erp/toast";
import { EmptyState, Field, Modal, PageHead } from "@/components/erp/ui";
import { saveQuotation, type BillInput } from "@/lib/erp/finance";
import { KIND_LABELS, dismissEmail, extractionCheck, draftFromEmail, extractEmail, linkEmail, markEmailRead, type Extraction } from "@/lib/erp/mail";
import {
  addDays, createProjectFromDraft, formatDate, formatMoney, markInvoicePaid, norm, rawMaterialFor, saveRawMaterial, saveSupplier, supplierRows, validateStep,
  type EmailRecord, type ErpState, type ProjectDraft,
} from "@/lib/erp/model";
import { confirmSupplierOrder, receiveSupplierOrder } from "@/lib/erp/purchasing";

type Folder = "inbox" | "sent" | "handled";
type ComposePrefill = { to: string; subject: string; body: string; replyTo?: string };

const time = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  return date.toDateString() === today.toDateString() ? date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : formatDate(iso);
};

export function InboxModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const params = useSearchParams();
  const router = useRouter();
  const [folder, setFolder] = useState<Folder>((params.get("folder") as Folder) || "inbox");
  const [selected, setSelected] = useState<string | null>(params.get("mail"));
  const [compose, setCompose] = useState<ComposePrefill | null>(null);
  const [order, setOrder] = useState<OrderPrefill | null>(null);
  const [bill, setBill] = useState<Partial<BillInput> | null>(null);
  const [projectFrom, setProjectFrom] = useState<{ email: EmailRecord; draft: ProjectDraft } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const head = <PageHead eyebrow="Communication" title="Inbox" description="Customer orders, requests for quotation, supplier quotes, invoices and payment advice. The ERP reads each email and offers the next step, so the data never has to be typed twice." actions={<button type="button" className="erp-btn erp-btn-primary" onClick={() => setCompose({ to: "", subject: "", body: "" })}><PenLine size={15} /> Compose</button>} />;
  if (!hydrated) return <>{head}<Loading /></>;

  const mails = state.emails.filter((mail) => folder === "sent" ? mail.folder === "sent" : folder === "handled" ? mail.folder === "inbox" && (mail.dismissed || (mail.links?.length ?? 0) > 0) : mail.folder === "inbox" && !mail.dismissed && !(mail.links?.length));
  const current = state.emails.find((mail) => mail.id === selected) ?? mails[0] ?? null;
  const counts = { inbox: state.emails.filter((mail) => mail.folder === "inbox" && !mail.dismissed && !(mail.links?.length)).length, sent: state.emails.filter((mail) => mail.folder === "sent").length, handled: state.emails.filter((mail) => mail.folder === "inbox" && (mail.dismissed || (mail.links?.length ?? 0) > 0)).length };
  const open = (mail: EmailRecord) => { setSelected(mail.id); if (!mail.read) commit((value) => markEmailRead(value, mail.id)); };

  const gmail = state.mail.provider === "gmail";
  const connect = async () => {
    if (!gmailAvailable()) return;
    try {
      await connectGmail();
      commit((value) => ({ ...value, mail: { ...value.mail, provider: "gmail" } }));
      setSyncing(true);
      const result = await syncGmail();
      setSyncing(false);
      toast(result.error ?? `Gmail connected. ${result.added} new email${result.added === 1 ? "" : "s"}.`, { tone: result.error ? "bad" : "ok" });
    } catch (error) { setSyncing(false); toast(error instanceof Error ? error.message : "Could not connect Gmail.", { tone: "bad" }); }
  };
  const sync = async () => {
    setSyncing(true);
    const result = await syncGmail();
    setSyncing(false);
    toast(result.error ?? (result.added ? `${result.added} new email${result.added === 1 ? "" : "s"}.` : "No new email."), { tone: result.error ? "bad" : "info" });
  };

  return <>{head}
    <div className="erp-mailbar">
      <span className={`erp-maildot${gmail && hasToken() ? " is-live" : ""}`} aria-hidden="true" />
      {gmail ? <span><b>Gmail</b> {state.mail.address && `· ${state.mail.address}`} · {hasToken() ? `checks every minute while the ERP is open${state.mail.lastSync ? `, last ${time(state.mail.lastSync)}` : ""}` : "session ended, reconnect to check mail"}</span>
        : <span><b>Sample inbox.</b> Demo emails from fictional customers and suppliers.{gmailAvailable() ? " Connect Gmail to work with your own mail." : ""}</span>}
      <span className="erp-head-actions" style={{ marginLeft: "auto" }}>
        {gmail && hasToken() && <button type="button" className="erp-btn erp-btn-sm" disabled={syncing} onClick={sync}><RefreshCw size={13} /> {syncing ? "Checking…" : "Check now"}</button>}
        {gmailAvailable() && (!gmail || !hasToken()) && <button type="button" className="erp-btn erp-btn-sm erp-btn-primary" disabled={syncing} onClick={connect}><Mail size={13} /> {gmail ? "Reconnect Gmail" : "Connect Gmail"}</button>}
        {gmail && <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => { disconnectGmail(); commit((value) => ({ ...value, mail: { ...value.mail, provider: "demo" } })); toast("Back to the sample inbox. Emails already fetched stay in this browser until you delete them.", { tone: "info" }); }}>Use sample inbox</button>}
      </span>
    </div>
    <div className="erp-mail">
      <section className="erp-card erp-maillist" aria-label="Messages">
        <div className="erp-tabs" role="group" aria-label="Folder">
          {(["inbox", "handled", "sent"] as Folder[]).map((item) => <button key={item} type="button" aria-pressed={folder === item} onClick={() => { setFolder(item); setSelected(null); }}>{item === "inbox" ? "To handle" : item === "handled" ? "Handled" : "Sent"} ({counts[item]})</button>)}
        </div>
        {mails.length ? <ul>{mails.map((mail) => {
          const extraction = mail.folder === "inbox" ? extractEmail(state, mail) : null;
          return <li key={mail.id}><button type="button" className={`${current?.id === mail.id ? "is-active" : ""}${mail.read ? "" : " is-unread"}`} onClick={() => open(mail)}>
            <span className="erp-mailfrom"><b>{mail.folder === "sent" ? `To ${mail.to}` : mail.fromName || mail.from}</b><time dateTime={mail.date}>{time(mail.date)}</time></span>
            <span className="erp-mailsubject">{mail.subject}</span>
            <span className="erp-mailtags">{extraction && extraction.kind !== "general" && <span className={`erp-kind is-${extraction.kind}`}>{KIND_LABELS[extraction.kind]}</span>}{mail.links?.map((link) => <span key={link.id} className="erp-kind is-linked"><Link2 size={11} /> {link.label}</span>)}{mail.source === "erp" && <span className="erp-kind">Recorded only</span>}</span>
          </button></li>;
        })}</ul> : <EmptyState title={folder === "inbox" ? "Nothing to handle" : "No messages"} text={folder === "inbox" ? "Every email with order data has been handled." : "Messages appear here as you work."} />}
      </section>
      <section className="erp-card erp-reader" aria-label="Message">
        {current ? <Reader key={current.id} state={state} mail={current}
          onReply={() => setCompose({ to: current.folder === "sent" ? current.to : current.from, subject: current.subject.startsWith("Re:") ? current.subject : `Re: ${current.subject}`, body: `\n\n> ${current.body.split("\n").slice(0, 12).join("\n> ")}` })}
          onCompose={setCompose} onOrder={setOrder} onBill={setBill}
          onProject={(draft) => setProjectFrom({ email: current, draft })}
          onQuote={(id) => router.push(`/demo/quotations?id=${id}`)} />
          : <div className="erp-card-pad"><EmptyState title="No message selected" text="Choose a message on the left." /></div>}
      </section>
    </div>
    {compose && <ComposeDialog prefill={compose} onClose={() => setCompose(null)} />}
    {order && <SupplierOrderDialog prefill={order} onClose={() => setOrder(null)} />}
    {bill && <BillDialog prefill={bill} onClose={() => setBill(null)} />}
    {projectFrom && <EmailProjectDialog email={projectFrom.email} initial={projectFrom.draft} onClose={() => setProjectFrom(null)} />}
  </>;
}

function Reader({ state, mail, onReply, onCompose, onOrder, onBill, onProject, onQuote }: {
  state: ErpState; mail: EmailRecord; onReply: () => void; onCompose: (prefill: ComposePrefill) => void; onOrder: (prefill: OrderPrefill) => void;
  onBill: (prefill: Partial<BillInput>) => void; onProject: (draft: ProjectDraft) => void; onQuote: (id: string) => void;
}) {
  const x = mail.folder === "inbox" ? extractEmail(state, mail) : null;
  return <div className="erp-reader-inner">
    <div className="erp-reader-head">
      <div><h2>{mail.subject}</h2><p><b>{mail.fromName || mail.from}</b> {mail.fromName && <span className="erp-faint">&lt;{mail.from}&gt;</span>}</p><p className="erp-faint">To {mail.to || "—"} · {new Date(mail.date).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}{mail.source === "erp" ? " · recorded in the sample inbox, not delivered" : mail.source === "gmail" ? " · Gmail" : " · sample email"}</p></div>
      <div className="erp-head-actions">
        <button type="button" className="erp-btn erp-btn-sm" onClick={onReply}><Reply size={13} /> Reply</button>
        {mail.folder === "inbox" && <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => commit((value) => markEmailRead(value, mail.id, !mail.read))}>{mail.read ? <><Mail size={13} /> Unread</> : <><MailOpen size={13} /> Read</>}</button>}
        {mail.folder === "inbox" && <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => commit((value) => dismissEmail(value, mail.id, !mail.dismissed))}>{mail.dismissed ? "Back to handle" : <><CheckCircle2 size={13} /> Done</>}</button>}
      </div>
    </div>
    {x && <Extracted state={state} mail={mail} x={x} onCompose={onCompose} onOrder={onOrder} onBill={onBill} onProject={onProject} onQuote={onQuote} />}
    <pre className="erp-mailbody">{mail.body}</pre>
  </div>;
}

function Extracted({ state, mail, x, onCompose, onOrder, onBill, onProject, onQuote }: {
  state: ErpState; mail: EmailRecord; x: Extraction; onCompose: (prefill: ComposePrefill) => void; onOrder: (prefill: OrderPrefill) => void;
  onBill: (prefill: Partial<BillInput>) => void; onProject: (draft: ProjectDraft) => void; onQuote: (id: string) => void;
}) {
  const today = todayIso();
  const spo = supplierOrderByNumber(state, x.supplierOrderNumber);
  const invoice = x.ourInvoiceNumber ? state.invoices.find((item) => item.number === x.ourInvoiceNumber) : null;
  const linked = mail.links ?? [];
  const supplierName = x.counterparty.type === "supplier" ? x.counterparty.name : "";
  const actions: ReactNode[] = [];
  if (x.kind === "customer-po" || (x.kind === "general" && x.lines.length)) {
    actions.push(<button key="project" type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={() => onProject(draftFromEmail(state, mail, x, today))}><Sparkles size={13} /> Create project from this order</button>);
    actions.push(<button key="ack" type="button" className="erp-btn erp-btn-sm" onClick={() => onCompose({ to: mail.from, subject: `Order confirmation ${x.poNumber ?? ""}`.trim(), body: `Dear ${x.counterparty.name || "customer"},\n\nthank you for your order ${x.poNumber ?? ""}. We confirm receipt and will send the delivery confirmation after engineering review.\n\nKind regards\n${state.settings.companyName}` })}><Reply size={13} /> Confirm receipt</button>);
  }
  if (x.kind === "rfq") {
    actions.push(<button key="quote" type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={() => {
      const lines = x.lines.map((line) => {
        const lastPrice = state.lineItems.filter((item) => state.parts.find((part) => part.id === item.partId)?.number === line.partNumber).map((item) => item.unitPrice).filter((price): price is number => price !== null).at(-1);
        return { partNumber: line.partNumber, description: line.description, quantity: line.quantity, unit: line.unit, unitPrice: line.unitPrice ?? lastPrice ?? 0, revision: line.revision };
      });
      const created: { id: string | null } = { id: null };
      commit((value) => {
        const result = saveQuotation(value, null, { customerName: x.counterparty.name || mail.fromName || mail.from, contact: mail.from, date: today, validUntil: addDays(today, 30), currency: x.currency ?? value.settings.defaultCurrency, lines: lines.length ? lines : [{ partNumber: "NEW-001", description: mail.subject, quantity: 1, unit: "pcs", unitPrice: 0, revision: "A" }], notes: "", leadTimeWeeks: 4, emailId: mail.id }, nowIso());
        created.id = result.id;
        if (!result.id) return value;
        const quote = result.state.quotations.find((item) => item.id === result.id);
        return linkEmail(result.state, mail.id, { kind: "quotation", id: result.id, label: quote?.number ?? "Quotation" });
      });
      if (created.id) { toast("Quotation drafted from the email. Add prices and send it.", { tone: "ok" }); onQuote(created.id); }
    }}><Sparkles size={13} /> Draft quotation</button>);
  }
  if (x.kind === "supplier-quote") {
    const priced = x.materials.filter((item) => item.unitPrice !== null);
    if (priced.length || x.leadTimeDays) actions.push(<button key="prices" type="button" className="erp-btn erp-btn-sm" onClick={() => {
      commit((value) => {
        let next = value;
        for (const item of priced) {
          const record = rawMaterialFor(next, item.name);
          if (record) next = saveRawMaterial(next, record.id, { name: record.name, unit: record.unit, stock: record.stock, reorderLevel: record.reorderLevel, unitCost: item.unitPrice, supplierId: record.supplierId, custom: record.custom }, nowIso());
        }
        const supplier = supplierRows(next).find((item) => norm(item.name) === norm(supplierName));
        if (supplier && x.leadTimeDays) next = saveSupplier(next, supplier.id, { name: supplier.name, contact: supplier.contact, email: supplier.email, leadTimeDays: x.leadTimeDays, custom: supplier.custom }, nowIso());
        return linkEmail(next, mail.id, { kind: "prices", id: `${mail.id}-prices`, label: "Prices updated" });
      });
      toast("Unit costs and lead time updated from the quotation.", { tone: "ok" });
    }}>Update prices and lead time</button>);
    actions.push(<button key="order" type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={() => onOrder({ supplier: supplierName, email: mail.from, emailId: mail.id, notes: x.quoteRef ? `As per your quotation ${x.quoteRef}.` : "", lines: (x.materials.length ? x.materials : [{ name: "", quantity: null, unit: "kg", unitPrice: null }]).map((item) => {
      const reqs = state.materialRequirements.filter((req) => norm(req.material) === norm(item.name) && state.procurement.find((record) => record.requirementId === req.id)?.status === "Not ordered");
      return { material: item.name, quantity: item.quantity ?? 0, unit: item.unit, unitPrice: item.unitPrice, requirementIds: reqs.map((req) => req.id) };
    }) })}><Send size={13} /> Order from {supplierName || "supplier"}</button>);
  }
  if (x.kind === "order-confirmation" && spo) {
    if (spo.status === "Sent" || spo.status === "Draft") actions.push(<button key="conf" type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={() => { commit((value) => linkEmail(confirmSupplierOrder(value, spo.id, x.deliveryDate, mail.id, nowIso()), mail.id, { kind: "supplierOrder", id: spo.id, label: spo.number })); toast(`${spo.number} confirmed${x.deliveryDate ? ` for ${formatDate(x.deliveryDate)}` : ""}.`, { tone: "ok" }); }}><CheckCircle2 size={13} /> Mark {spo.number} confirmed{x.deliveryDate ? ` · delivery ${formatDate(x.deliveryDate)}` : ""}</button>);
    else actions.push(<span key="conf-done" className="erp-faint">{spo.number} is {spo.status.toLowerCase()}.</span>);
  }
  if (x.kind === "shipping" && spo && spo.status !== "Received") actions.push(<button key="recv" type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={() => { commit((value) => linkEmail(receiveSupplierOrder(value, spo.id, nowIso()), mail.id, { kind: "supplierOrder", id: spo.id, label: `${spo.number} received` })); toast(`Goods receipt booked for ${spo.number}.`, { tone: "ok" }); }}>Book goods receipt for {spo.number}</button>);
  if (x.kind === "supplier-invoice") {
    const net = x.net ?? x.total ?? 0;
    const taxRate = x.net && x.total && x.total > x.net ? Math.round(((x.total - x.net) / x.net) * 100) : state.settings.taxRate;
    const exists = state.bills.some((item) => x.invoiceNumber && norm(item.number) === norm(x.invoiceNumber) && norm(item.supplier) === norm(supplierName));
    actions.push(exists ? <span key="bill-done" className="erp-faint">This invoice is already recorded.</span> : <button key="bill" type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={() => onBill({ supplier: supplierName || x.counterparty.name, number: x.invoiceNumber ?? "", net, taxRate, currency: x.currency ?? undefined, date: mail.date.slice(0, 10), dueDate: x.dueDate ?? addDays(mail.date.slice(0, 10), 30), supplierOrderId: spo?.id, category: "Raw material", description: x.materials.map((item) => `${item.name}${item.quantity ? `, ${item.quantity} ${item.unit}` : ""}`).join("; ") || mail.subject, emailId: mail.id })}><Sparkles size={13} /> Record supplier bill</button>);
  }
  if (x.kind === "payment") {
    if (invoice && !invoice.paidAt) actions.push(<button key="paid" type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={() => { commit((value) => linkEmail(markInvoicePaid(value, invoice.id, true, nowIso()), mail.id, { kind: "invoice", id: invoice.id, label: `${invoice.number} paid` })); toast(`${invoice.number} marked paid.`, { tone: "ok" }); }}><CheckCircle2 size={13} /> Mark {invoice.number} paid ({formatMoney(invoice.total, invoice.currency)})</button>);
    else if (invoice) actions.push(<span key="paid-done" className="erp-faint">{invoice.number} is already marked paid.</span>);
    else actions.push(<span key="paid-none" className="erp-faint">No invoice with this number in the ERP.</span>);
    if (invoice && x.total !== null && Math.abs(x.total - invoice.total) > 0.01) actions.push(<span key="paid-diff" className="erp-error">Paid amount {x.total} differs from the invoice total {invoice.total}.</span>);
  }
  if (x.kind === "general" && !x.lines.length) actions.push(<span key="none" className="erp-faint">No order data recognised. You can still reply or mark it done.</span>);

  const check = extractionCheck(x);
  return <div className="erp-extract">
    <div className="erp-extract-head"><Sparkles size={15} /><b>Read by BOH ERP</b><span className={`erp-kind is-${x.kind}`}>{KIND_LABELS[x.kind]}</span><small>{check.label}{check.missing.map((name, index) => <span key={name}>{index ? ", " : ": "}{name}</span>)} · rules in your browser, nothing is sent anywhere</small></div>
    {x.fields.length > 0 && <dl className="erp-extract-fields">{x.fields.map((field) => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>}
    {x.lines.length > 0 && <table className="erp-mini-table"><thead><tr><th>Part</th><th>Description</th><th>Rev</th><th className="r">Qty</th><th className="r">Unit price</th></tr></thead><tbody>{x.lines.map((line) => <tr key={line.partNumber}><td>{line.partNumber}</td><td>{line.description}</td><td>{line.revision}</td><td className="r">{line.quantity} {line.unit}</td><td className="r">{line.unitPrice !== null ? formatMoney(line.unitPrice, x.currency ?? "EUR") : "—"}</td></tr>)}</tbody></table>}
    {x.materials.length > 0 && <table className="erp-mini-table"><thead><tr><th>Material</th><th className="r">Qty</th><th className="r">Price</th><th className="r">Current cost</th></tr></thead><tbody>{x.materials.map((item) => { const record = rawMaterialFor(state, item.name); return <tr key={item.name}><td>{item.name}</td><td className="r">{item.quantity ?? "—"} {item.quantity ? item.unit : ""}</td><td className="r">{item.unitPrice !== null ? formatMoney(item.unitPrice, x.currency ?? "EUR") : "—"}</td><td className="r">{record?.unitCost != null ? formatMoney(record.unitCost, state.settings.defaultCurrency) : "—"}</td></tr>; })}</tbody></table>}
    <div className="erp-head-actions">{actions}</div>
    {linked.length > 0 && <p className="erp-faint"><Link2 size={12} /> Linked: {linked.map((item, index) => <span key={item.id}>{index > 0 && ", "}{item.kind === "project" ? <Link className="erp-link" href={`/demo/projects/${item.id}`}>{item.label}</Link> : item.kind === "quotation" ? <Link className="erp-link" href={`/demo/quotations?id=${item.id}`}>{item.label}</Link> : item.label}</span>)}</p>}
  </div>;
}

/** Turns a customer order email into a project: check and correct what was read, then create it. */
function EmailProjectDialog({ email, initial, onClose }: { email: EmailRecord; initial: ProjectDraft; onClose: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const set = (patch: Partial<ProjectDraft>) => setDraft({ ...draft, ...patch });
  const setLine = (index: number, patch: Partial<ProjectDraft["lines"][number]>) => set({ lines: draft.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)) });
  const check = () => {
    const state = getState();
    const found = [0, 1, 2].flatMap((step) => Object.values(validateStep(state, draft, step)));
    return [...new Set(found)];
  };
  const create = () => {
    const problems = check();
    if (problems.length) { setErrors(problems); return; }
    const created: { id: string | null } = { id: null };
    commit((value) => {
      const result = createProjectFromDraft(value, draft, nowIso());
      created.id = result.projectId;
      const project = result.state.projects.find((item) => item.id === result.projectId);
      return linkEmail(result.state, email.id, { kind: "project", id: result.projectId, label: project?.code ?? "Project" });
    });
    toast("Project created from the email. Add drawings, materials and inspection next.", { tone: "ok" });
    onClose();
    if (created.id) router.push(`/demo/projects/${created.id}`);
  };
  const guided = () => {
    commit((value) => ({ ...linkEmail(value, email.id, { kind: "draft", id: `${email.id}-draft`, label: "Opened in guided demo" }), draft: { ...draft, step: 0 }, guide: { step: 1, projectId: null, furthest: 1, v: 2 } }));
    onClose();
    router.push("/demo");
  };
  return <Modal label="Create project from email" wide onClose={onClose}>
    <div className="erp-dialog-bar"><h2>Create a project from this order</h2><button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={onClose}><X size={14} /> Close</button></div>
    <div className="erp-card-pad erp-stack" style={{ gap: 14 }}>
      <p className="erp-faint">Values were read from “{email.subject}”. Check them before creating the project.</p>
      <div className="erp-form-grid">
        <Field id="ep-customer" label="Customer"><input className="erp-input" id="ep-customer" value={draft.customerName} onChange={(event) => set({ customerName: event.target.value })} /></Field>
        <Field id="ep-po" label="Customer PO number"><input className="erp-input" id="ep-po" value={draft.poNumber} onChange={(event) => set({ poNumber: event.target.value.toUpperCase() })} /></Field>
        <Field id="ep-name" label="Project name"><input className="erp-input" id="ep-name" value={draft.projectName} onChange={(event) => set({ projectName: event.target.value })} /></Field>
        <Field id="ep-code" label="Project ID"><input className="erp-input" id="ep-code" value={draft.projectCode} onChange={(event) => set({ projectCode: event.target.value.toUpperCase() })} /></Field>
        <Field id="ep-date" label="PO date"><input className="erp-input" id="ep-date" type="date" value={draft.poDate} onChange={(event) => set({ poDate: event.target.value })} /></Field>
        <Field id="ep-delivery" label="Required delivery"><input className="erp-input" id="ep-delivery" type="date" value={draft.deliveryDate} onChange={(event) => set({ deliveryDate: event.target.value })} /></Field>
      </div>
      <div className="erp-field"><span className="erp-label">Parts on the order</span>
        <div className="erp-order-lines">{draft.lines.map((line, index) => <div key={line.key} className="erp-order-line erp-order-line-5">
          <input className="erp-input" aria-label="Part number" value={line.partNumber} onChange={(event) => setLine(index, { partNumber: event.target.value.toUpperCase() })} />
          <input className="erp-input" aria-label="Description" value={line.description} onChange={(event) => setLine(index, { description: event.target.value })} />
          <input className="erp-input" aria-label="Revision" maxLength={3} value={line.revision} onChange={(event) => setLine(index, { revision: event.target.value.toUpperCase() })} />
          <input className="erp-input" aria-label="Quantity" inputMode="numeric" value={line.quantity} onChange={(event) => setLine(index, { quantity: event.target.value })} />
          <input className="erp-input" aria-label="Unit price" inputMode="decimal" value={line.unitPrice} onChange={(event) => setLine(index, { unitPrice: event.target.value })} />
        </div>)}
          {!draft.lines.length && <p className="erp-faint">No part lines were recognised. Use the guided demo to enter them.</p>}
        </div>
      </div>
      {errors.length > 0 && <ul className="erp-error" role="alert">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
    </div>
    <div className="erp-dialog-foot">
      <span className="erp-faint">Drawings, inspection and material are added afterwards in the project or the guided demo.</span>
      <button type="button" className="erp-btn" onClick={guided}>Continue in guided demo</button>
      <button type="button" className="erp-btn erp-btn-primary" disabled={!draft.lines.length} onClick={create}><Sparkles size={14} /> Create project</button>
    </div>
  </Modal>;
}

export function ComposeDialog({ prefill, onClose, onSent }: { prefill: ComposePrefill; onClose: () => void; onSent?: (emailId: string) => void }) {
  const state = useErp();
  const [values, setValues] = useState(prefill);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const contacts = [...new Set([...state.customers.map((item) => item.contact).filter((item) => item.includes("@")), ...state.suppliers.map((item) => item.email).filter(Boolean)])];
  const send = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.to.trim())) { setError("Enter a valid email address."); return; }
    if (!values.subject.trim()) { setError("Enter a subject."); return; }
    setBusy(true);
    const result = await sendFromErp({ to: values.to.trim(), subject: values.subject.trim(), body: values.body });
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    toast(result.real ? "Email sent from your Gmail." : "Recorded in Sent (sample inbox: not delivered).", { tone: "ok" });
    onSent?.(result.id);
    onClose();
  };
  return <Modal label="New email" onClose={onClose}>
    <form className="erp-stack" style={{ gap: 12 }} onSubmit={(event) => { event.preventDefault(); send(); }}>
      <h2>New email</h2>
      <Field id="mail-to" label="To"><input className="erp-input" id="mail-to" list="mail-contacts" value={values.to} onChange={(event) => setValues({ ...values, to: event.target.value })} /><datalist id="mail-contacts">{contacts.map((item) => <option key={item} value={item} />)}</datalist></Field>
      <Field id="mail-subject" label="Subject"><input className="erp-input" id="mail-subject" value={values.subject} onChange={(event) => setValues({ ...values, subject: event.target.value })} /></Field>
      <Field id="mail-body" label="Message"><textarea className="erp-textarea" id="mail-body" rows={10} value={values.body} onChange={(event) => setValues({ ...values, body: event.target.value })} /></Field>
      {state.mail.provider !== "gmail" && <p className="erp-faint">Sample inbox: the message is recorded in Sent but not delivered.{gmailAvailable() ? " Connect Gmail to send for real." : ""}</p>}
      {error && <p className="erp-error" role="alert">{error}</p>}
      <div className="erp-head-actions" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="erp-btn erp-btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="erp-btn erp-btn-primary" disabled={busy}><Send size={14} /> {busy ? "Sending…" : "Send"}</button>
      </div>
    </form>
  </Modal>;
}

