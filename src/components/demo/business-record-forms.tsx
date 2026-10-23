"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { demoCompanies } from "@/lib/business-data";
import type { DemoSupplier, FinanceEntry, MaterialLot } from "@/lib/business-data";
import type { Part, ProductionOrder } from "@/lib/demo-data";
import { useDemoBusinessRecords } from "@/components/demo/business-records-context";
import { useDemoConfiguration } from "@/components/demo/configuration-context";
import styles from "@/components/demo/demo.module.css";

const uid = () => crypto.randomUUID();
const today = () => new Date().toISOString().slice(0, 10);
const dateInput = (value?: string) => {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = value ? new Date(value) : new Date(Number.NaN);
  return Number.isNaN(parsed.valueOf()) ? today() : parsed.toISOString().slice(0, 10);
};
const displayDate = (value: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/Berlin" }).format(new Date(`${value}T12:00:00Z`));

function nextOrderNumber(orders: ProductionOrder[]) {
  const year = new Date().getFullYear();
  const sequence = Math.max(0, ...orders.map((order) => Number(order.number.match(/-(\d+)$/)?.[1] ?? 0))) + 1;
  return `MO-${year}-${String(sequence).padStart(4, "0")}`;
}

function nextMaterialCode(lots: MaterialLot[]) { return `RM-DEMO-${String(lots.length + 1).padStart(3, "0")}`; }
function nextTransactionReference(entries: FinanceEntry[]) { return `TRX-DEMO-${new Date().getFullYear()}-${String(entries.length + 1).padStart(3, "0")}`; }

function RecordDialog({ title, onClose, onSubmit, children, saveLabel = "Save record" }: { title: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; children: ReactNode; saveLabel?: string }) {
  return <div className={styles.configBackdrop} role="presentation"><section className={styles.configDialog} role="dialog" aria-modal="true" aria-label={title}>
    <h2>{title}</h2><form onSubmit={onSubmit}><div className={styles.configDialogBody}>{children}<p className={styles.recordEditorNote}>Synthetic demonstration data only. Changes are saved in this browser.</p></div><div className={styles.configDialogActions}><button type="button" onClick={onClose}>Cancel</button><button className={styles.configAction} type="submit">{saveLabel}</button></div></form>
  </section></div>;
}

export function PartEditor({ initial, onClose, onSave }: { initial?: Part; onClose: () => void; onSave: (part: Part) => void }) {
  const { parts } = useDemoBusinessRecords();
  const [number, setNumber] = useState(initial?.number ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [material, setMaterial] = useState(initial?.material ?? "");
  const [revision, setRevision] = useState(initial?.currentRevision ?? "A");
  const [status, setStatus] = useState<Part["status"]>(initial?.status ?? "In development");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (parts.some((item) => item.id !== initial?.id && item.number.toLowerCase() === number.trim().toLowerCase())) { setError("That part number is already in use."); return; }
    setError("");
    const date = displayDate(today());
    const changedRevision = !!initial && initial.currentRevision !== revision.trim();
    const history = initial?.revisionHistory ?? [];
    onSave({ id: initial?.id ?? `part-${uid()}`, number: number.trim(), name: name.trim(), material: material.trim(), currentRevision: revision.trim(), status, description: description.trim(), revisionHistory: changedRevision ? [{ revision: revision.trim(), date, note: "Revision updated in the demo record editor", status }, ...history] : initial?.revisionHistory ?? [{ revision: revision.trim(), date, note: "Synthetic part record created", status }] });
  };
  return <RecordDialog title={initial ? "Edit part" : "Add part"} onClose={onClose} onSubmit={submit}>
    <label className={styles.configLabel}>Part number<input autoFocus required value={number} onChange={(event) => setNumber(event.target.value)} placeholder="AP-1300" /></label>
    <label className={styles.configLabel}>Part name<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label className={styles.configLabel}>Material<input required value={material} onChange={(event) => setMaterial(event.target.value)} placeholder="Aluminium 6082-T6" /></label>
    <div className={styles.formRow}><label className={styles.configLabel}>Current revision<input required value={revision} onChange={(event) => setRevision(event.target.value)} /></label><label className={styles.configLabel}>Lifecycle status<select value={status} onChange={(event) => setStatus(event.target.value as Part["status"])}><option>In development</option><option>Released</option><option>On hold</option></select></label></div>
    <label className={styles.configLabel}>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>{error && <p className={styles.formError} role="alert">{error}</p>}
  </RecordDialog>;
}

export function ProductionOrderEditor({ initial, onClose, onSave }: { initial?: ProductionOrder; onClose: () => void; onSave: (order: ProductionOrder) => void }) {
  const { parts, productionOrders, materialLots } = useDemoBusinessRecords();
  const { documents } = useDemoConfiguration();
  const defaultPart = parts.find((part) => part.id === initial?.partId) ?? parts[0];
  const [number, setNumber] = useState(initial?.number ?? nextOrderNumber(productionOrders));
  const [partId, setPartId] = useState(initial?.partId ?? defaultPart?.id ?? "");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [status, setStatus] = useState<ProductionOrder["status"]>(initial?.status ?? "Queued");
  const [plannedStart, setPlannedStart] = useState(dateInput(initial?.plannedStart));
  const [plannedDue, setPlannedDue] = useState(dateInput(initial?.plannedDue));
  const [workflow, setWorkflow] = useState(initial?.workflow ?? "Standard route");
  const [customerId, setCustomerId] = useState(initial?.customerCompanyId ?? demoCompanies[0]?.id ?? "");
  const [materialLotId, setMaterialLotId] = useState(initial?.materialLotIds?.[0] ?? "");
  const [error, setError] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (productionOrders.some((item) => item.id !== initial?.id && item.number.toLowerCase() === number.trim().toLowerCase())) { setError("That production order number is already in use."); return; }
    const part = parts.find((item) => item.id === partId);
    if (!part) return;
    setError("");
    const linkedDocuments = documents.filter((document) => document.partId === partId).map((document) => document.id);
    const previousLots = initial?.materialLotIds ?? [];
    const remainingLots = previousLots.filter((id) => id !== previousLots[0] && id !== materialLotId);
    onSave({ id: initial?.id ?? `mo-${new Date().getFullYear()}-${uid()}`, number: number.trim(), partId, partRevision: part.currentRevision, quantity: Number(quantity), status, plannedStart: displayDate(plannedStart), plannedDue: displayDate(plannedDue), workflow: workflow.trim(), documentIds: initial?.partId === partId ? [...new Set([...initial.documentIds, ...linkedDocuments])] : linkedDocuments, activity: initial?.activity ?? "Order created in the synthetic demo workspace", customerCompanyId: customerId || undefined, materialLotIds: [...remainingLots, ...(materialLotId ? [materialLotId] : [])] });
  };
  return <RecordDialog title={initial ? "Edit production order" : "New production order"} onClose={onClose} onSubmit={submit}>
    <label className={styles.configLabel}>Order number<input autoFocus required value={number} onChange={(event) => setNumber(event.target.value)} /></label>
    <label className={styles.configLabel}>Part<select required value={partId} onChange={(event) => setPartId(event.target.value)}>{parts.map((part) => <option key={part.id} value={part.id}>{part.number} · {part.name} (Rev {part.currentRevision})</option>)}</select></label>
    <div className={styles.formRow}><label className={styles.configLabel}>Quantity<input required type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label className={styles.configLabel}>Status<select value={status} onChange={(event) => setStatus(event.target.value as ProductionOrder["status"])}><option>Queued</option><option>In progress</option><option>On hold</option><option>Complete</option></select></label></div>
    <div className={styles.formRow}><label className={styles.configLabel}>Planned start<input required type="date" value={plannedStart} onChange={(event) => setPlannedStart(event.target.value)} /></label><label className={styles.configLabel}>Planned due<input required type="date" value={plannedDue} onChange={(event) => setPlannedDue(event.target.value)} /></label></div>
    <label className={styles.configLabel}>Workflow description<input required value={workflow} onChange={(event) => setWorkflow(event.target.value)} /></label>
    <label className={styles.configLabel}>Sample customer<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">No linked customer</option>{demoCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>{error && <p className={styles.formError} role="alert">{error}</p>}
    <label className={styles.configLabel}>Linked material lot<select value={materialLotId} onChange={(event) => setMaterialLotId(event.target.value)}><option value="">No lot linked</option>{materialLots.map((lot) => <option key={lot.id} value={lot.id}>{lot.code} · {lot.lotNumber}</option>)}</select></label>
  </RecordDialog>;
}

export function SupplierEditor({ initial, onClose, onSave }: { initial?: DemoSupplier; onClose: () => void; onSave: (supplier: DemoSupplier) => void }) {
  const { suppliers } = useDemoBusinessRecords();
  const [name, setName] = useState(initial?.name ?? "");
  const [categories, setCategories] = useState(initial?.categories.join(", ") ?? "");
  const [contact, setContact] = useState(initial?.contact ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [status, setStatus] = useState<DemoSupplier["status"]>(initial?.status ?? "Active");
  const [note, setNote] = useState(initial?.note ?? "Fictional supplier record; no qualification evidence is represented.");
  const [error, setError] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (suppliers.some((item) => item.id !== initial?.id && item.name.toLowerCase() === name.trim().toLowerCase())) { setError("That supplier name is already in use."); return; } setError(""); onSave({ id: initial?.id ?? `sup-${uid()}`, name: name.trim(), categories: categories.split(",").map((item) => item.trim()).filter(Boolean), contact: contact.trim(), email: email.trim(), status, note: note.trim() }); };
  return <RecordDialog title={initial ? "Edit supplier" : "Add supplier"} onClose={onClose} onSubmit={submit}>
    <label className={styles.configLabel}>Supplier name<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label className={styles.configLabel}>Categories<input value={categories} onChange={(event) => setCategories(event.target.value)} placeholder="Aluminium bar, Plate stock" /><small>Separate categories with commas.</small></label>
    <div className={styles.formRow}><label className={styles.configLabel}>Contact<input required value={contact} onChange={(event) => setContact(event.target.value)} /></label><label className={styles.configLabel}>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label></div>
    <label className={styles.configLabel}>Status<select value={status} onChange={(event) => setStatus(event.target.value as DemoSupplier["status"])}><option>Active</option><option>Inactive</option></select></label>
    <label className={styles.configLabel}>Demo note<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>{error && <p className={styles.formError} role="alert">{error}</p>}
  </RecordDialog>;
}

export function MaterialLotEditor({ initial, onClose, onSave }: { initial?: MaterialLot; onClose: () => void; onSave: (lot: MaterialLot) => void }) {
  const { suppliers, parts, productionOrders, materialLots } = useDemoBusinessRecords();
  const { documents } = useDemoConfiguration();
  const [code, setCode] = useState(initial?.code ?? nextMaterialCode(materialLots));
  const [name, setName] = useState(initial?.name ?? "");
  const [specification, setSpecification] = useState(initial?.specification ?? "");
  const [grade, setGrade] = useState(initial?.grade ?? "");
  const [lotNumber, setLotNumber] = useState(initial?.lotNumber ?? `LOT-DEMO-${new Date().getFullYear()}-${String(materialLots.length + 1).padStart(3, "0")}`);
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? suppliers[0]?.id ?? "");
  const [available, setAvailable] = useState(String(initial?.available ?? 0));
  const [reserved, setReserved] = useState(String(initial?.reserved ?? 0));
  const [receivedOn, setReceivedOn] = useState(dateInput(initial?.receivedOn));
  const [traceability, setTraceability] = useState<MaterialLot["traceability"]>(initial?.traceability ?? "Review required");
  const [partId, setPartId] = useState(initial?.partIds[0] ?? "");
  const [orderId, setOrderId] = useState(initial?.orderIds[0] ?? "");
  const availableOrders = productionOrders.filter((order) => !partId || order.partId === partId);
  const [certificateDocumentId, setCertificateDocumentId] = useState(initial?.certificateDocumentId ?? "");
  const [error, setError] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (materialLots.some((item) => item.id !== initial?.id && (item.code.toLowerCase() === code.trim().toLowerCase() || item.lotNumber.toLowerCase() === lotNumber.trim().toLowerCase()))) { setError("That material code or supplier lot number is already in use."); return; } setError(""); onSave({ id: initial?.id ?? `lot-demo-${uid()}`, code: code.trim(), name: name.trim(), specification: specification.trim(), grade: grade.trim(), unit: "kg", available: Number(available), reserved: Number(reserved), lotNumber: lotNumber.trim(), supplierId, certificateDocumentId, receivedOn, traceability, partIds: partId ? [partId] : [], orderIds: orderId ? [orderId] : [] }); };
  return <RecordDialog title={initial ? "Edit material lot" : "Add raw-material lot"} onClose={onClose} onSubmit={submit}>
    <div className={styles.formRow}><label className={styles.configLabel}>Record code<input autoFocus required value={code} onChange={(event) => setCode(event.target.value)} /></label><label className={styles.configLabel}>Supplier lot number<input required value={lotNumber} onChange={(event) => setLotNumber(event.target.value)} /></label></div>
    <label className={styles.configLabel}>Material description<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
    <div className={styles.formRow}><label className={styles.configLabel}>Specification<input required value={specification} onChange={(event) => setSpecification(event.target.value)} /></label><label className={styles.configLabel}>Grade<input required value={grade} onChange={(event) => setGrade(event.target.value)} /></label></div>
    <label className={styles.configLabel}>Supplier<select required value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
    <div className={styles.formRow}><label className={styles.configLabel}>Available (kg)<input required type="number" min="0" step="0.1" value={available} onChange={(event) => setAvailable(event.target.value)} /></label><label className={styles.configLabel}>Reserved (kg)<input required type="number" min="0" step="0.1" value={reserved} onChange={(event) => setReserved(event.target.value)} /></label></div>
    <div className={styles.formRow}><label className={styles.configLabel}>Received on<input required type="date" value={receivedOn} onChange={(event) => setReceivedOn(event.target.value)} /></label><label className={styles.configLabel}>Traceability<select value={traceability} onChange={(event) => setTraceability(event.target.value as MaterialLot["traceability"])}><option>Review required</option><option>Reference linked</option></select></label></div>
    <label className={styles.configLabel}>Linked part<select value={partId} onChange={(event) => { const nextPartId = event.target.value; setPartId(nextPartId); if (orderId && !productionOrders.some((order) => order.id === orderId && (!nextPartId || order.partId === nextPartId))) setOrderId(""); }}><option value="">No linked part</option>{parts.map((part) => <option key={part.id} value={part.id}>{part.number} · {part.name}</option>)}</select></label>
    <label className={styles.configLabel}>Linked production order<select value={orderId} onChange={(event) => setOrderId(event.target.value)}><option value="">No linked order</option>{availableOrders.map((order) => <option key={order.id} value={order.id}>{order.number}</option>)}</select></label>
    <label className={styles.configLabel}>Certificate reference metadata<select value={certificateDocumentId} onChange={(event) => setCertificateDocumentId(event.target.value)}><option value="">No reference linked</option>{documents.map((document) => <option key={document.id} value={document.id}>{document.number} · {document.title}</option>)}</select><small>Reference only; this does not upload or verify a certificate.</small></label>{error && <p className={styles.formError} role="alert">{error}</p>}
  </RecordDialog>;
}

export function FinanceEntryEditor({ initial, onClose, onSave }: { initial?: FinanceEntry; onClose: () => void; onSave: (entry: FinanceEntry) => void }) {
  const { financeEntries, suppliers } = useDemoBusinessRecords();
  const [description, setDescription] = useState(initial?.description ?? "");
  const [direction, setDirection] = useState<FinanceEntry["direction"]>(initial?.direction ?? "Payable");
  const [date, setDate] = useState(dateInput(initial?.date));
  const [amount, setAmount] = useState(initial ? (initial.amountCents / 100).toFixed(2) : "");
  const [status, setStatus] = useState<FinanceEntry["status"]>(initial?.status ?? "Open");
  const [accountId, setAccountId] = useState(initial?.companyId ?? initial?.supplierId ?? (direction === "Receivable" ? demoCompanies[0]?.id : suppliers[0]?.id) ?? "");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return;
    const reference = initial?.invoice ?? nextTransactionReference(financeEntries);
    onSave({ id: initial?.id ?? `fin-${uid()}`, invoice: reference, date, description: description.trim(), direction, amountCents: cents, status, companyId: direction === "Receivable" ? accountId || undefined : undefined, supplierId: direction === "Payable" ? accountId || undefined : undefined, invoiceGenerated: initial?.invoiceGenerated, billAttachment: initial?.billAttachment });
  };
  return <RecordDialog title={initial ? "Edit finance record" : "New payment record"} onClose={onClose} onSubmit={submit}>
    <label className={styles.configLabel}>Description<input autoFocus required value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    <div className={styles.formRow}><label className={styles.configLabel}>Transaction type<select value={direction} onChange={(event) => { setDirection(event.target.value as FinanceEntry["direction"]); setAccountId(""); }}><option>Receivable</option><option>Payable</option></select></label><label className={styles.configLabel}>Amount (EUR)<input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label></div>
    <label className={styles.configLabel}>{direction === "Receivable" ? "Sample customer" : "Sample supplier"}{direction === "Receivable" ? <select required value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Choose a customer</option>{demoCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select> : <select required value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Choose a supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>}</label>
    <div className={styles.formRow}><label className={styles.configLabel}>Transaction date<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label className={styles.configLabel}>Status<select value={status} onChange={(event) => setStatus(event.target.value as FinanceEntry["status"])}><option>Open</option><option>Paid</option><option>Overdue</option></select></label></div>
    {!initial && <small>Reference will be assigned as a synthetic transaction ID. Use the invoice action after saving to create a demo invoice preview.</small>}
  </RecordDialog>;
}
