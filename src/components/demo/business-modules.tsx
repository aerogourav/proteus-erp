"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { ArrowRight, Plus, Search } from "lucide-react";
import { PageHeader, Panel, StatusPill } from "@/components/demo/demo-ui";
import { demoCompanies, demoContacts, demoFinanceEntries, demoMaterialLots, demoSuppliers, financeTotals, seedOpportunities, type Opportunity, type OpportunityStage } from "@/lib/business-data";
import { parts, productionOrders, documents } from "@/lib/demo-data";
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
  const counts = stages.map((item) => ({ stage: item, count: opportunities.filter((opp) => opp.stage === item).length }));
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
    <div className={styles.configGrid}>{counts.map(({ stage: item, count }) => <Panel key={item} title={item}><strong style={{ fontSize: 24 }}>{count}</strong><div style={{ height: 4, marginTop: 12, background: "#edf1f5" }}><i style={{ display: "block", width: `${opportunities.length ? count / opportunities.length * 100 : 0}%`, height: "100%", background: "#4d83d7" }} /></div></Panel>)}</div>
    {formOpen && <Panel title="Add a synthetic opportunity"><form onSubmit={addOpportunity} className={styles.configGrid}><label className={styles.configLabel}>Opportunity<input required value={name} onChange={(e) => setName(e.target.value)} /></label><label className={styles.configLabel}>Company<select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>{demoCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label><label className={styles.configLabel}>Demo value (EUR)<input required type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} /></label><label className={styles.configLabel}>Expected close<input required type="date" value={expectedClose} onChange={(e) => setExpectedClose(e.target.value)} /></label><label className={styles.configLabel}>Next step<input required value={nextStep} onChange={(e) => setNextStep(e.target.value)} /></label><button className={styles.primaryButton}>Save opportunity</button></form></Panel>}
    <Panel title="Opportunity pipeline" description={`${visible.length} records · values are fictional EUR amounts`}><div className={styles.tableToolbar}><label className={styles.searchField}><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search opportunities" /></label><select aria-label="Filter by stage" value={stage} onChange={(e) => setStage(e.target.value)}><option>All stages</option>{stages.map((item) => <option key={item}>{item}</option>)}</select></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Opportunity</th><th>Company</th><th>Stage</th><th>Demo value</th><th>Expected close</th><th>Next step</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td><Link className={styles.recordLink} href={`/demo/crm/${item.id}`}>{item.name}<span className={styles.subText}>Open detail <ArrowRight size={11} /></span></Link></td><td>{demoCompanies.find((company) => company.id === item.companyId)?.name}</td><td><StatusPill status={item.stage} /></td><td>{money(item.valueCents)}</td><td>{date(item.expectedClose)}</td><td>{item.nextStep}</td></tr>)}</tbody></table></div></Panel>
    <Panel title="Sample companies & contacts"><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Company</th><th>Industry</th><th>Relationship</th><th>Contacts</th><th>Related orders</th></tr></thead><tbody>{demoCompanies.map((company) => <tr key={company.id} id={company.id}><td><strong>{company.name}</strong><span className={styles.subText}>{company.location}</span></td><td>{company.industry}</td><td>{company.relationship}</td><td>{demoContacts.filter((contact) => contact.companyId === company.id).map((contact) => <span key={contact.id} className={styles.subText}>{contact.name} · {contact.email}</span>)}</td><td>{productionOrders.filter((order) => order.customerCompanyId === company.id).map((order) => <Link className={styles.recordLink} key={order.id} href={`/demo/production/${order.id}`}>{order.number}</Link>)}</td></tr>)}</tbody></table></div></Panel>
  </>;
}

export function OpportunityDetail({ id }: { id: string }) {
  const { opportunities } = useOpportunities();
  const opportunity = opportunities.find((item) => item.id === id);
  if (!opportunity) return <><PageHeader eyebrow="CRM RECORD" title="Opportunity not found" description="This synthetic record may have been reset or removed." /><Link className={styles.panelLink} href="/demo/crm">Back to CRM <ArrowRight size={13} /></Link></>;
  const company = demoCompanies.find((item) => item.id === opportunity.companyId);
  const orders = productionOrders.filter((order) => order.customerCompanyId === company?.id);
  return <><PageHeader eyebrow="CRM RECORD" title={opportunity.name} description={`${company?.name ?? "Unknown company"} · sample opportunity`} meta={<StatusPill status={opportunity.stage} />} /><div className={styles.configGrid}><Panel title="Opportunity details"><p>Fictional demo value: <strong>{money(opportunity.valueCents)}</strong></p><p>Expected close: {date(opportunity.expectedClose)}</p><p>Owner: {opportunity.owner}</p><p>Next step: {opportunity.nextStep}</p></Panel><Panel title="Company"><p>{company?.industry} · {company?.location}</p><p>{demoContacts.filter((contact) => contact.companyId === company?.id).map((contact) => `${contact.name} (${contact.email})`).join(" · ")}</p><Link className={styles.panelLink} href={`/demo/finance#${company?.id}`}>Related finance records <ArrowRight size={13} /></Link></Panel></div><Panel title="Related production orders">{orders.length ? orders.map((order) => <p key={order.id}><Link href={`/demo/production/${order.id}`}>{order.number} · {parts.find((part) => part.id === order.partId)?.number}</Link></p>) : <p>No sample production orders are linked to this company.</p>}</Panel><Link className={styles.panelLink} href="/demo/crm">← Back to CRM</Link></>;
}

export function SuppliersWorkspace() {
  const [query, setQuery] = useState("");
  const rows = demoSuppliers.filter((supplier) => `${supplier.name} ${supplier.categories.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  return <><PageHeader eyebrow="PROCUREMENT" title="Suppliers" description="Synthetic supplier records connected to raw-material lots and reference documents." meta={<span>DEMO REGISTER</span>} /><div className={styles.configToolbar}><p>Supplier records are fictional examples. No vendor qualification or certification is verified.</p><label className={styles.searchField}><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search suppliers" /></label></div><div className={styles.configGrid}>{rows.map((supplier) => { const lots = demoMaterialLots.filter((lot) => lot.supplierId === supplier.id); return <section id={supplier.id} key={supplier.id} className={`${styles.card} ${styles.configCard}`}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><h2>{supplier.name}</h2><StatusPill status={supplier.status} /></div><p>{supplier.note}</p><p>{supplier.categories.join(" · ")}</p><p>{supplier.contact} · {supplier.email}</p><strong>{lots.length} linked material lots</strong>{lots.map((lot) => <p key={lot.id}><Link href={`/demo/materials#${lot.id}`}>{lot.code} · {lot.lotNumber}</Link> · <Link href={`/demo/documents/${lot.certificateDocumentId}`}>reference</Link></p>)}</section>; })}</div></>;
}

export function MaterialsWorkspace() {
  return <><PageHeader eyebrow="INVENTORY & TRACEABILITY" title="Raw materials" description="Synthetic lot records connect supplier references, parts, and production orders." meta={<span>{demoMaterialLots.length} SAMPLE LOTS</span>} /><div className={styles.notice}>Certificate references below are metadata only. No certificate file is included, and these records do not verify material conformity.</div><Panel title="Material lots" description="Quantities are illustrative kilograms in the sample workspace."><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Lot / material</th><th>Specification</th><th>Supplier</th><th>Available / reserved</th><th>Certificate reference</th><th>Linked work</th></tr></thead><tbody>{demoMaterialLots.map((lot) => { const supplier = demoSuppliers.find((item) => item.id === lot.supplierId); return <tr id={lot.id} key={lot.id}><td><strong>{lot.code}</strong><span className={styles.subText}>{lot.name} · {lot.lotNumber}</span></td><td>{lot.specification}<span className={styles.subText}>{lot.grade}</span></td><td><Link href={`/demo/suppliers#${lot.supplierId}`}>{supplier?.name}</Link></td><td>{lot.available} kg / {lot.reserved} kg</td><td><StatusPill status={lot.traceability} /><span className={styles.subText}><Link href={`/demo/documents/${lot.certificateDocumentId}`}>{documents.find((doc) => doc.id === lot.certificateDocumentId)?.number ?? lot.certificateDocumentId}</Link></span></td><td>{lot.partIds.map((partId) => { const part = parts.find((item) => item.id === partId); return part ? <span key={partId} className={styles.subText}><Link href={`/demo/parts/${partId}`}>{part.number}</Link></span> : null; })}{lot.orderIds.map((orderId) => { const order = productionOrders.find((item) => item.id === orderId); return order ? <span key={orderId} className={styles.subText}><Link href={`/demo/production/${orderId}`}>{order.number}</Link></span> : null; })}<span className={styles.subText}>Received {date(lot.receivedOn)}</span></td></tr>; })}</tbody></table></div></Panel></>;
}

export function FinanceWorkspace() {
  const totals = financeTotals(demoFinanceEntries);
  const paid = totals.cashMovements;
  const months = [...new Set(paid.map((entry) => entry.date.slice(0, 7)))].sort();
  const chart = months.map((month) => ({ month, incoming: paid.filter((entry) => entry.direction === "Receivable" && entry.date.startsWith(month)).reduce((sum, item) => sum + item.amountCents, 0), outgoing: paid.filter((entry) => entry.direction === "Payable" && entry.date.startsWith(month)).reduce((sum, item) => sum + item.amountCents, 0) }));
  return <><PageHeader eyebrow="FINANCIAL VISIBILITY" title="Finance" description="A lightweight view of fictional invoices and paid sample transactions—not an accounting system." meta={<span>EUR · SYNTHETIC DATA</span>} /><div className={styles.configGrid}>{[["Receivables total", totals.revenueCents], ["Payables total", totals.expenseCents], ["Open receivables", totals.receivablesCents], ["Open payables", totals.payablesCents], ["Overdue receivables", totals.overdueReceivableCents], ["Overdue payables", totals.overduePayableCents]].map(([label, amount]) => <Panel key={label} title={String(label)}><h2 style={{ margin: "10px 0", fontSize: 22 }}>{money(Number(amount))}</h2><small>Calculated from listed demo entries</small></Panel>)}</div><Panel title="Paid cash movements" description="Monthly paid entries only. Incoming and outgoing values are derived from the synthetic transaction list."><div className={styles.configGrid}>{chart.map((item) => <div key={item.month} className={styles.card} style={{ padding: 16 }}><strong>{monthLabel(item.month)}</strong><p>In {money(item.incoming)}</p><p>Out {money(item.outgoing)}</p><div aria-label={`${item.month}: incoming ${money(item.incoming)}, outgoing ${money(item.outgoing)}`} style={{ display: "flex", height: 9, background: "#eef1f4" }}><i style={{ width: `${Math.max(4, item.incoming / Math.max(item.incoming, item.outgoing, 1) * 50)}%`, background: "#438469" }} /><i style={{ width: `${Math.max(4, item.outgoing / Math.max(item.incoming, item.outgoing, 1) * 50)}%`, background: "#6388bd" }} /></div></div>)}</div><p className={styles.subText}>Green = paid receivables · Blue = paid payables</p></Panel><Panel title="Accounts receivable & payable" description="All amounts and invoices are fictional examples."><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Invoice</th><th>Direction</th><th>Account</th><th>Description</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{demoFinanceEntries.map((entry) => { const company = demoCompanies.find((item) => item.id === entry.companyId); const supplier = demoSuppliers.find((item) => item.id === entry.supplierId); return <tr id={entry.id} key={entry.id}><td>{entry.invoice}</td><td>{entry.direction}</td><td>{company ? <Link href={`/demo/crm#${company.id}`}>{company.name}</Link> : supplier ? <Link href={`/demo/suppliers#${supplier.id}`}>{supplier.name}</Link> : "—"}</td><td>{entry.description}</td><td>{date(entry.date)}</td><td>{money(entry.amountCents)}</td><td><StatusPill status={entry.status} /></td></tr>; })}</tbody></table></div></Panel><div className={styles.notice}>This demonstration does not perform accounting, tax filing, banking, payment processing, or bookkeeping. No financial service is connected.</div></>;
}

