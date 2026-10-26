"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, type ChangeEvent, type FormEvent } from "react";
import { ArrowRight, Building2, Download, FilePlus2, PackageCheck, Plus, Search, Upload } from "lucide-react";
import { PageHeader, Panel, StatusPill } from "@/components/demo/demo-ui";
import { FinanceMovementGraphic, MaterialPositionGraphic, OpportunityPipelineGraphic } from "@/components/demo/module-graphics";
import { demoCompanies, demoContacts, financeTotals, seedOpportunities, type DemoSupplier, type FinanceEntry, type MaterialLot, type Opportunity, type OpportunityStage } from "@/lib/business-data";
import { useDemoBusinessRecords } from "@/components/demo/business-records-context";
import { useDemoConfiguration } from "@/components/demo/configuration-context";
import { FinanceEntryEditor, MaterialLotEditor, SupplierEditor } from "@/components/demo/business-record-forms";
import { getDemoBill, saveDemoBill } from "@/lib/demo-bill-storage";
import styles from "./demo.module.css";

const money = (cents: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);
const date = (value: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/Berlin" }).format(new Date(`${value}T12:00:00Z`));
const monthLabel = (value: string) => new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "Europe/Berlin" }).format(new Date(`${value}-01T12:00:00Z`));
const stages: OpportunityStage[] = ["Lead", "Qualified", "Proposal", "Won", "Lost"];
const storageKey = "proteus-demo-opportunities-v1";
const changedEvent = "proteus-demo-opportunities-change";
let cachedRaw: string | null = null;
let cachedOpportunities = seedOpportunities;

function useOpportunities() {
  const opportunities = useSyncExternalStore((callback) => {
    window.addEventListener(changedEvent, callback); window.addEventListener("storage", callback);
    return () => { window.removeEventListener(changedEvent, callback); window.removeEventListener("storage", callback); };
  }, () => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== cachedRaw) {
        cachedRaw = raw;
        const parsed: unknown = raw ? JSON.parse(raw) : seedOpportunities;
        cachedOpportunities = Array.isArray(parsed) && parsed.every((item) => item && typeof item.id === "string" && typeof item.companyId === "string" && typeof item.name === "string" && stages.includes(item.stage) && Number.isInteger(item.valueCents)) ? parsed as Opportunity[] : seedOpportunities;
      }
    } catch { cachedOpportunities = seedOpportunities; }
    return cachedOpportunities;
  }, () => seedOpportunities);
  const save = (next: Opportunity[]) => { cachedRaw = JSON.stringify(next); cachedOpportunities = next; try { localStorage.setItem(storageKey, cachedRaw); } catch { /* Keep this session usable if storage is restricted. */ } window.dispatchEvent(new Event(changedEvent)); };
  return { opportunities, save };
}
export function CrmWorkspace() {
  const { productionOrders } = useDemoBusinessRecords();
  const { opportunities, save } = useOpportunities();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("All stages");
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState(demoCompanies[0].id);
  const [value, setValue] = useState("");
  const [expectedClose, setExpectedClose] = useState("2026-12-15");
  const [nextStep, setNextStep] = useState("");
  const visible = useMemo(() => opportunities.filter((item) => `${item.name} ${demoCompanies.find((company) => company.id === item.companyId)?.name ?? ""}`.toLowerCase().includes(query.toLowerCase()) && (stage === "All stages" || item.stage === stage)), [opportunities, query, stage]);
  const stageMetrics = stages.map((item) => {
    const inStage = opportunities.filter((opp) => opp.stage === item);
    return { stage: item, count: inStage.length, valueCents: inStage.reduce((sum, opp) => sum + opp.valueCents, 0) };
  });
  const openValueCents = opportunities.filter((item) => ["Lead", "Qualified", "Proposal"].includes(item.stage)).reduce((sum, item) => sum + item.valueCents, 0);
  const wonValueCents = opportunities.filter((item) => item.stage === "Won").reduce((sum, item) => sum + item.valueCents, 0);
  function addOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const euroValue = Number(value);
    if (!name.trim() || !Number.isFinite(euroValue) || euroValue < 0 || !expectedClose || !nextStep.trim()) { setNotice("Complete each field with a valid value."); return; }
    const next = [{ id: `opp-${Date.now()}`, companyId, name: name.trim(), stage: "Lead" as const, valueCents: Math.round(euroValue * 100), currency: "EUR" as const, expectedClose, owner: "Demo team", nextStep: nextStep.trim() }, ...opportunities];
    save(next); setFormOpen(false); setNotice("Opportunity saved in this browser’s demo workspace."); setName(""); setValue(""); setNextStep("");
  }
  return <>
    <PageHeader eyebrow="CUSTOMER RELATIONSHIPS" title="CRM" description="A synthetic pipeline connected to sample companies, production orders, and finance records." meta={<span>LOCAL DEMO DATA</span>} />
    <div className={styles.configToolbar}><p>All companies, contacts, and opportunities shown here are fictional. Changes to opportunities are saved only in this browser.</p><button className={styles.primaryButton} onClick={() => setFormOpen((open) => !open)}><Plus size={14} /> New opportunity</button></div>
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    <OpportunityPipelineGraphic metrics={stageMetrics} openValueCents={openValueCents} wonValueCents={wonValueCents} selectedStage={stage} onSelectStage={setStage} formatValue={money} />
    {formOpen && <Panel title="Add a synthetic opportunity"><form onSubmit={addOpportunity} className={styles.configGrid}><label className={styles.configLabel}>Opportunity<input required value={name} onChange={(e) => setName(e.target.value)} /></label><label className={styles.configLabel}>Company<select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>{demoCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label><label className={styles.configLabel}>Demo value (EUR)<input required type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} /></label><label className={styles.configLabel}>Expected close<input required type="date" value={expectedClose} onChange={(e) => setExpectedClose(e.target.value)} /></label><label className={styles.configLabel}>Next step<input required value={nextStep} onChange={(e) => setNextStep(e.target.value)} /></label><button className={styles.primaryButton}>Save opportunity</button></form></Panel>}
    <Panel title="Opportunity pipeline" description={`${visible.length} records · values are fictional EUR amounts`}><div className={styles.tableToolbar}><label className={styles.searchField}><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search opportunities" /></label><select aria-label="Filter by stage" value={stage} onChange={(e) => setStage(e.target.value)}><option>All stages</option>{stages.map((item) => <option key={item}>{item}</option>)}</select></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Opportunity</th><th>Company</th><th>Stage</th><th>Demo value</th><th>Expected close</th><th>Next step</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td><Link className={styles.recordLink} href={`/demo/classic/crm/${item.id}`}>{item.name}<span className={styles.subText}>Open detail <ArrowRight size={11} /></span></Link></td><td>{demoCompanies.find((company) => company.id === item.companyId)?.name}</td><td><StatusPill status={item.stage} /></td><td>{money(item.valueCents)}</td><td>{date(item.expectedClose)}</td><td>{item.nextStep}</td></tr>)}</tbody></table></div></Panel>
    <Panel title="Sample companies & contacts"><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Company</th><th>Industry</th><th>Relationship</th><th>Contacts</th><th>Related orders</th></tr></thead><tbody>{demoCompanies.map((company) => <tr key={company.id} id={company.id}><td><strong>{company.name}</strong><span className={styles.subText}>{company.location}</span></td><td>{company.industry}</td><td>{company.relationship}</td><td>{demoContacts.filter((contact) => contact.companyId === company.id).map((contact) => <span key={contact.id} className={styles.subText}>{contact.name} · {contact.email}</span>)}</td><td>{productionOrders.filter((order) => order.customerCompanyId === company.id).map((order) => <Link className={styles.recordLink} key={order.id} href={`/demo/classic/production/${order.id}`}>{order.number}</Link>)}</td></tr>)}</tbody></table></div></Panel>
  </>;
}

export function OpportunityDetail({ id }: { id: string }) {
  const { opportunities } = useOpportunities();
  const { productionOrders, parts } = useDemoBusinessRecords();
  const opportunity = opportunities.find((item) => item.id === id);
  if (!opportunity) return <><PageHeader eyebrow="CRM RECORD" title="Opportunity not found" description="This synthetic record may have been reset or removed." /><Link className={styles.panelLink} href="/demo/classic/crm">Back to CRM <ArrowRight size={13} /></Link></>;
  const company = demoCompanies.find((item) => item.id === opportunity.companyId);
  const orders = productionOrders.filter((order) => order.customerCompanyId === company?.id);
  return <><PageHeader eyebrow="CRM RECORD" title={opportunity.name} description={`${company?.name ?? "Unknown company"} · sample opportunity`} meta={<StatusPill status={opportunity.stage} />} /><div className={styles.configGrid}><Panel title="Opportunity details"><p>Fictional demo value: <strong>{money(opportunity.valueCents)}</strong></p><p>Expected close: {date(opportunity.expectedClose)}</p><p>Owner: {opportunity.owner}</p><p>Next step: {opportunity.nextStep}</p></Panel><Panel title="Company"><p>{company?.industry} · {company?.location}</p><p>{demoContacts.filter((contact) => contact.companyId === company?.id).map((contact) => `${contact.name} (${contact.email})`).join(" · ")}</p><Link className={styles.panelLink} href={`/demo/classic/finance#${company?.id}`}>Related finance records <ArrowRight size={13} /></Link></Panel></div><Panel title="Related production orders">{orders.length ? orders.map((order) => <p key={order.id}><Link href={`/demo/classic/production/${order.id}`}>{order.number} · {parts.find((part) => part.id === order.partId)?.number}</Link></p>) : <p>No sample production orders are linked to this company.</p>}</Panel><Link className={styles.panelLink} href="/demo/classic/crm">← Back to CRM</Link></>;
}

export function SuppliersWorkspace() {
  const { suppliers, materialLots, setSuppliers, addActivity } = useDemoBusinessRecords();
  const [query, setQuery] = useState("");
  const [supplierForm, setSupplierForm] = useState<DemoSupplier | null | undefined>(undefined);
  const [notice, setNotice] = useState("");
  const rows = suppliers.filter((supplier) => `${supplier.name} ${supplier.categories.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  const saveSupplier = (supplier: DemoSupplier) => {
    if (suppliers.some((item) => item.id !== supplier.id && item.name.toLowerCase() === supplier.name.toLowerCase())) { setNotice("That supplier name is already in use."); return; }
    const exists = suppliers.some((item) => item.id === supplier.id);
    setSuppliers(exists ? suppliers.map((item) => item.id === supplier.id ? supplier : item) : [supplier, ...suppliers]);
    addActivity({ title: exists ? "Supplier record updated" : "Supplier record created", subject: supplier.name, recordId: supplier.id, kind: "Supplier" });
    setSupplierForm(undefined); setNotice(`${supplier.name} saved in this browser.`);
  };
  return <><PageHeader eyebrow="PROCUREMENT" title="Suppliers" description="Synthetic supplier records connected to raw-material lots and reference documents." meta={<span>{suppliers.length} DEMO SUPPLIERS</span>} /><div className={styles.configToolbar}><p>Supplier records are fictional examples. No vendor qualification or certification is verified.</p><div className={styles.toolbarActions}><label className={styles.searchField}><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search suppliers" /></label><button type="button" className={styles.primaryButton} onClick={() => { setNotice(""); setSupplierForm(null); }}><Plus size={14} /> Add supplier</button></div></div>{notice && <p role="status" className={styles.notice}>{notice}</p>}<div className={styles.supplierGrid}>{rows.map((supplier) => {
    const lots = materialLots.filter((lot) => lot.supplierId === supplier.id);
    const initials = supplier.name.split(" ").slice(0, 2).map((word) => word[0]).join("");
    return <section id={supplier.id} key={supplier.id} className={`${styles.card} ${styles.supplierCard}`}>
      <header className={styles.supplierCardHead}><span className={styles.supplierAvatar}>{initials}<Building2 size={12} /></span><span className={styles.supplierCardTitle}><strong>{supplier.name}</strong><small><b>{lots.length}</b> linked material lots</small></span><StatusPill status={supplier.status} /><button type="button" className={styles.smallAction} onClick={() => setSupplierForm(supplier)}>Edit</button></header>
      <div className={styles.supplierCategories}>{supplier.categories.map((category) => <span key={category}>{category}</span>)}</div>
      <div className={styles.supplierNetwork}>
        <div className={styles.supplierRecord}><span className={styles.supplierRecordIcon}><Building2 size={15} /></span><small>SUPPLIER RECORD</small><strong>{supplier.contact}</strong><span>{supplier.email}</span></div>
        <span className={styles.supplierConnector} aria-hidden="true"><i /></span>
        <div className={styles.supplierLotList}><small>CONNECTED SAMPLE LOTS</small>{lots.length ? lots.map((lot) => <div className={styles.supplierLot} key={lot.id}><span className={styles.supplierLotIcon}><PackageCheck size={14} /></span><span className={styles.supplierLotCopy}><Link href={`/demo/classic/materials#${lot.id}`}>{lot.code}</Link><small>{lot.lotNumber}</small></span><span className={styles.supplierLotLinks}><StatusPill status={lot.traceability} />{lot.certificateDocumentId && <Link href={`/demo/classic/documents/${lot.certificateDocumentId}`} aria-label={`Open reference for ${lot.code}`}><ArrowRight size={13} /></Link>}</span></div>) : <p className={styles.empty}>No linked sample lots.</p>}</div>
      </div>
      <p className={styles.supplierNote}>{supplier.note}</p>
    </section>;
  })}{rows.length === 0 && <div className={styles.empty}>No suppliers match this search.</div>}</div>{supplierForm !== undefined && <SupplierEditor initial={supplierForm ?? undefined} onClose={() => setSupplierForm(undefined)} onSave={saveSupplier} />}</>;
}

export function MaterialsWorkspace() {
  const { documents } = useDemoConfiguration();
  const { materialLots, suppliers, parts, productionOrders, setMaterialLots, setProductionOrders, addActivity } = useDemoBusinessRecords();
  const [lotForm, setLotForm] = useState<MaterialLot | null | undefined>(undefined);
  const [notice, setNotice] = useState("");
  const saveLot = (lot: MaterialLot) => {
    if (materialLots.some((item) => item.id !== lot.id && (item.code.toLowerCase() === lot.code.toLowerCase() || item.lotNumber.toLowerCase() === lot.lotNumber.toLowerCase()))) { setNotice("That material code or supplier lot number is already in use."); return; }
    const exists = materialLots.some((item) => item.id === lot.id);
    setMaterialLots(exists ? materialLots.map((item) => item.id === lot.id ? lot : item) : [lot, ...materialLots]);
    const linkedOrders = productionOrders.map((order) => {
      const orderIds = lot.orderIds.includes(order.id) ? [...new Set([...(order.materialLotIds ?? []), lot.id])] : (order.materialLotIds ?? []).filter((id) => id !== lot.id);
      return JSON.stringify(orderIds) === JSON.stringify(order.materialLotIds ?? []) ? order : { ...order, materialLotIds: orderIds };
    });
    setProductionOrders(linkedOrders);
    addActivity({ title: exists ? "Raw-material lot updated" : "Raw-material lot created", subject: lot.code, recordId: lot.id, kind: "Raw material" });
    setLotForm(undefined); setNotice(`${lot.code} saved in this browser.`);
  };
  return <><PageHeader eyebrow="INVENTORY & TRACEABILITY" title="Raw materials" description="Synthetic lot records connect supplier references, parts, and production orders." meta={<span>{materialLots.length} SAMPLE LOTS</span>} /><div className={styles.configToolbar}><p>Record quantities are illustrative kilograms in this browser-local demo.</p><button type="button" className={styles.primaryButton} onClick={() => { setNotice(""); setLotForm(null); }}><Plus size={14} /> Add material lot</button></div><div className={styles.notice}>Certificate references below are metadata only. No certificate file is included, and these records do not verify material conformity.</div><MaterialPositionGraphic lots={materialLots} /><Panel title="Material lots" description="Synthetic material records and their linked work."><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Lot / material</th><th>Specification</th><th>Supplier</th><th>Available / reserved</th><th>Certificate reference</th><th>Linked work</th><th>Actions</th></tr></thead><tbody>{materialLots.map((lot) => { const supplier = suppliers.find((item) => item.id === lot.supplierId); const certificate = documents.find((doc) => doc.id === lot.certificateDocumentId); const partItems = lot.partIds.map((partId) => ({ partId, part: parts.find((item) => item.id === partId) })); return <tr id={lot.id} key={lot.id}><td><strong>{lot.code}</strong><span className={styles.subText}>{lot.name} · {lot.lotNumber}</span></td><td>{lot.specification}<span className={styles.subText}>{lot.grade}</span></td><td>{supplier ? <Link href={`/demo/classic/suppliers#${supplier.id}`}>{supplier.name}</Link> : "—"}</td><td>{lot.available} kg / {lot.reserved} kg</td><td><StatusPill status={lot.traceability} />{certificate && <span className={styles.subText}><Link href={`/demo/classic/documents/${certificate.id}`}>{certificate.number}</Link></span>}{!certificate && <span className={styles.subText}>No reference linked</span>}</td><td>{partItems.map(({ partId, part }) => part && <span key={partId} className={styles.subText}><Link href={`/demo/classic/parts/${partId}`}>{part.number}</Link></span>)}{lot.orderIds.map((orderId) => { const order = productionOrders.find((item) => item.id === orderId); return order ? <span key={orderId} className={styles.subText}><Link href={`/demo/classic/production/${orderId}`}>{order.number}</Link></span> : null; })}<span className={styles.subText}>Received {date(lot.receivedOn)}</span></td><td><button type="button" className={styles.smallAction} onClick={() => setLotForm(lot)}>Edit</button></td></tr>; })}</tbody></table></div></Panel>{notice && <p role="status" className={styles.notice}>{notice}</p>}{lotForm !== undefined && <MaterialLotEditor initial={lotForm ?? undefined} onClose={() => setLotForm(undefined)} onSave={saveLot} />}</>;
}

export function FinanceWorkspace() {
  const { financeEntries, suppliers, setFinanceEntries, addActivity } = useDemoBusinessRecords();
  const [entryForm, setEntryForm] = useState<FinanceEntry | null | undefined>(undefined);
  const [invoicePreview, setInvoicePreview] = useState<FinanceEntry | null>(null);
  const [notice, setNotice] = useState("");
  const totals = financeTotals(financeEntries);
  const paid = totals.cashMovements;
  const months = [...new Set(paid.map((entry) => entry.date.slice(0, 7)))].sort();
  const chart = months.map((month) => ({ month, incoming: paid.filter((entry) => entry.direction === "Receivable" && entry.date.startsWith(month)).reduce((sum, item) => sum + item.amountCents, 0), outgoing: paid.filter((entry) => entry.direction === "Payable" && entry.date.startsWith(month)).reduce((sum, item) => sum + item.amountCents, 0) }));
  const saveEntry = (entry: FinanceEntry) => {
    const exists = financeEntries.some((item) => item.id === entry.id);
    setFinanceEntries(exists ? financeEntries.map((item) => item.id === entry.id ? entry : item) : [entry, ...financeEntries]);
    addActivity({ title: exists ? "Finance record updated" : "Payment record created", subject: entry.invoice, recordId: entry.id, kind: "Finance" });
    setEntryForm(undefined); setNotice(`${entry.invoice} saved in this browser.`);
  };
  const generateInvoice = (entry: FinanceEntry) => {
    const newReference = entry.invoice.startsWith("TRX-DEMO");
    const generated = newReference ? `${entry.direction === "Receivable" ? "INV" : "BILL"}-DEMO-${entry.date.slice(0, 4)}-${String(financeEntries.length + 1).padStart(3, "0")}` : entry.invoice;
    const updated = { ...entry, invoice: generated, invoiceGenerated: true };
    if (newReference) {
      setFinanceEntries(financeEntries.map((item) => item.id === entry.id ? updated : item));
      addActivity({ title: "Demo invoice generated", subject: generated, recordId: entry.id, kind: "Finance" });
    }
    setInvoicePreview(updated);
  };
  const attachBill = async (event: ChangeEvent<HTMLInputElement>, entry: FinanceEntry) => {
    const file = event.currentTarget.files?.[0]; event.currentTarget.value = "";
    if (!file) return;
    if (!new Set(["application/pdf", "image/png", "image/jpeg"]).has(file.type) || file.size > 1_000_000) { setNotice("Choose a synthetic PDF, PNG, or JPG bill under 1 MB."); return; }
    try {
      const billAttachment = await saveDemoBill(entry.id, file);
      setFinanceEntries(financeEntries.map((item) => item.id === entry.id ? { ...item, billAttachment } : item));
      addActivity({ title: "Synthetic bill attached", subject: entry.invoice, recordId: entry.id, kind: "Finance" });
      setNotice(`${file.name} saved locally against ${entry.invoice}.`);
    } catch { setNotice("The synthetic bill could not be saved in this browser."); }
  };
  const downloadBill = async (entry: FinanceEntry) => {
    try {
      const file = await getDemoBill(entry.id);
      if (!file) { setNotice("The local attachment is unavailable. Attach the synthetic file again."); return; }
      const url = URL.createObjectURL(file); const anchor = document.createElement("a"); anchor.href = url; anchor.download = entry.billAttachment?.name ?? "synthetic-bill"; anchor.click(); URL.revokeObjectURL(url);
    } catch { setNotice("The local attachment is unavailable. Attach the synthetic file again."); }
  };
  const downloadInvoice = (entry: FinanceEntry) => {
    const account = entry.companyId ? demoCompanies.find((company) => company.id === entry.companyId)?.name : suppliers.find((supplier) => supplier.id === entry.supplierId)?.name;
    const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char] ?? char);
    const html = `<!doctype html><html><meta charset="utf-8"><title>${escape(entry.invoice)} · Synthetic demo</title><style>body{font:16px Arial,sans-serif;max-width:760px;margin:60px auto;color:#2A303B}small{color:#6D7483}.label{color:#0E7A52;font-weight:bold;letter-spacing:.12em}table{width:100%;margin-top:38px;border-collapse:collapse}td{padding:14px;border-bottom:1px solid #E2E3E6}.amount{text-align:right;font-weight:bold}.notice{margin-top:45px;padding:14px;background:#fff6e8;color:#8a5b1c}</style><p class="label">BOH ERP · SYNTHETIC DEMO</p><h1>${entry.direction === "Receivable" ? "Demo invoice preview" : "Demo bill record"}</h1><small>${escape(entry.invoice)} · ${escape(date(entry.date))}</small><table><tr><td>Sample account</td><td>${escape(account ?? "No account linked")}</td></tr><tr><td>Description</td><td>${escape(entry.description)}</td></tr><tr><td>Status</td><td>${escape(entry.status)}</td></tr><tr><td>Total · EUR</td><td class="amount">${escape(money(entry.amountCents))}</td></tr></table><p class="notice">Illustrative synthetic demo only. This is not a tax invoice, payment instruction, accounting record, or fiscal document.</p></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${entry.invoice}-demo.html`; anchor.click(); URL.revokeObjectURL(url);
  };
  return <><PageHeader eyebrow="FINANCIAL VISIBILITY" title="Finance" description="A lightweight view of fictional invoices and paid sample transactions—not an accounting system." meta={<span>EUR · SYNTHETIC DATA</span>} /><div className={styles.financeSummary}>
    <div className={styles.financeSummaryCard}><span>Receivables total</span><strong>{money(totals.revenueCents)}</strong><small>Open {money(totals.receivablesCents)} · Overdue {money(totals.overdueReceivableCents)}</small></div>
    <div className={styles.financeSummaryCard}><span>Payables total</span><strong>{money(totals.expenseCents)}</strong><small>Open {money(totals.payablesCents)} · Overdue {money(totals.overduePayableCents)}</small></div>
  </div><FinanceMovementGraphic months={chart} formatMonth={monthLabel} formatValue={money} /><div className={styles.configToolbar}><p>Synthetic demo transactions only. No real accounting or payment processing is connected.</p><button type="button" className={styles.primaryButton} onClick={() => { setNotice(""); setEntryForm(null); }}><Plus size={14} /> New payment record</button></div>{notice && <p role="status" className={styles.notice}>{notice}</p>}<Panel title="Accounts receivable & payable" description="All amounts and references are fictional examples."><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Reference</th><th>Direction</th><th>Account</th><th>Description</th><th>Date</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>{financeEntries.map((entry) => { const company = demoCompanies.find((item) => item.id === entry.companyId); const supplier = suppliers.find((item) => item.id === entry.supplierId); return <tr id={entry.id} key={entry.id}><td><strong>{entry.invoice}</strong>{entry.invoiceGenerated && <span className={styles.subText}>Demo invoice created</span>}</td><td>{entry.direction}</td><td>{company ? <Link href={`/demo/classic/crm#${company.id}`}>{company.name}</Link> : supplier ? <Link href={`/demo/classic/suppliers#${supplier.id}`}>{supplier.name}</Link> : "—"}</td><td>{entry.description}</td><td>{date(entry.date)}</td><td>{money(entry.amountCents)}</td><td><StatusPill status={entry.status} /></td><td><div className={styles.financeRowActions}><button type="button" className={styles.smallAction} onClick={() => setEntryForm(entry)}>Edit</button><button type="button" className={styles.smallAction} onClick={() => generateInvoice(entry)}><FilePlus2 size={12} /> Generate invoice</button><label className={styles.smallAction}><Upload size={12} /> {entry.billAttachment ? "Replace bill" : "Attach bill"}<input type="file" accept="application/pdf,image/png,image/jpeg" aria-label={`Attach a synthetic bill to ${entry.invoice}`} onChange={(event) => void attachBill(event, entry)} /></label>{entry.billAttachment && <button type="button" className={styles.smallAction} onClick={() => void downloadBill(entry)}><Download size={12} /> {entry.billAttachment.name}</button>}</div></td></tr>; })}</tbody></table></div></Panel><div className={styles.notice}>Invoices are downloadable illustrative HTML previews, not tax invoices or accounting documents. Attach only synthetic PDF, PNG, or JPG bills (max 1 MB); files stay in this browser and are not sent to a server.</div>{entryForm !== undefined && <FinanceEntryEditor initial={entryForm ?? undefined} onClose={() => setEntryForm(undefined)} onSave={saveEntry} />}{invoicePreview && <div className={styles.configBackdrop} role="presentation"><section className={styles.configDialog} role="dialog" aria-modal="true" aria-label="Synthetic invoice preview"><h2>Synthetic invoice preview</h2><div className={styles.invoicePreview}><span>BOH ERP · DEMO WORKSPACE</span><strong>{invoicePreview.direction === "Receivable" ? "Illustrative invoice" : "Illustrative bill record"}</strong><div><small>Reference</small><b>{invoicePreview.invoice}</b></div><div><small>Transaction date</small><b>{date(invoicePreview.date)}</b></div><div><small>Description</small><b>{invoicePreview.description}</b></div><div><small>Amount</small><b>{money(invoicePreview.amountCents)}</b></div><p>This synthetic preview is not a tax invoice, payment instruction, or accounting record.</p></div><div className={styles.configDialogActions}><button type="button" onClick={() => setInvoicePreview(null)}>Close</button><button type="button" className={styles.configAction} onClick={() => downloadInvoice(invoicePreview)}>Download demo preview</button></div></section></div>}</>;
}

