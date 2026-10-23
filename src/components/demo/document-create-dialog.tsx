"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useDemoConfiguration } from "@/components/demo/configuration-context";
import { useDemoBusinessRecords } from "@/components/demo/business-records-context";
import type { RecordStatus } from "@/lib/demo-data";
import type { ConfiguredField } from "@/lib/configuration-model";
import styles from "./demo.module.css";

function FieldControl({ field, value, onChange }: { field: ConfiguredField; value: string | number | boolean; onChange: (value: string | number | boolean) => void }) {
  const { parts, productionOrders } = useDemoBusinessRecords();
  const common = { id: field.id, required: field.required, "aria-describedby": field.helpText ? `${field.id}-help` : undefined };
  let control: ReactNode;
  if (field.type === "dropdown") {
    control = <select className={styles.formControl} value={String(value)} onChange={(event) => onChange(event.target.value)} {...common}><option value="">Choose an option</option>{field.options.map((option) => <option key={option}>{option}</option>)}</select>;
  } else if (field.type === "checkbox") {
    control = <label className={styles.checkboxField}><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} required={field.required} /><span>{field.label}</span></label>;
  } else if (field.type === "reference") {
    control = <select className={styles.formControl} value={String(value)} onChange={(event) => onChange(event.target.value)} {...common}><option value="">Choose a record</option>{parts.map((part) => <option key={part.id} value={`part:${part.id}`}>Part · {part.number} · {part.name}</option>)}{productionOrders.map((order) => <option key={order.id} value={`order:${order.id}`}>Order · {order.number}</option>)}</select>;
  } else {
    control = <input className={styles.formControl} type={field.type === "short-text" ? "text" : field.type} value={String(value)} onChange={(event) => onChange(event.target.value)} {...common} />;
  }
  return <div className={styles.formField}><label htmlFor={field.id}>{field.label}{field.required && <span className={styles.requiredMark}> *</span>}</label>{control}{field.helpText && <small id={`${field.id}-help`}>{field.helpText}</small>}</div>;
}

export function DocumentCreateDialog({ onClose }: { onClose: () => void }) {
  const { documentTypes, documents: allDocuments, addDocument } = useDemoConfiguration();
  const { parts, productionOrders, addActivity } = useDemoBusinessRecords();
  const activeTypes = documentTypes.filter((type) => type.active);
  const [typeId, setTypeId] = useState(activeTypes[0]?.id ?? "");
  const selectedType = activeTypes.find((type) => type.id === typeId);
  const [partId, setPartId] = useState(parts[0]?.id ?? "");
  const [orderId, setOrderId] = useState("");
  const [title, setTitle] = useState("");
  const [revision, setRevision] = useState("A");
  const [status, setStatus] = useState<RecordStatus>("Draft");
  const [fieldValues, setFieldValues] = useState<Record<string, string | number | boolean>>({});
  const [error, setError] = useState("");
  const availableOrders = productionOrders.filter((order) => order.partId === partId);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedType) { setError("Choose an active document type before saving."); return; }
    if (!title.trim()) { setError("Enter a document title."); return; }
    for (const field of selectedType.fields) {
      const value = fieldValues[field.key] ?? field.defaultValue;
      if (field.required && (value === "" || value === false || value === undefined)) { setError(`${field.label} is required.`); return; }
      if (field.type === "dropdown" && field.options.length === 0) { setError(`${field.label} needs at least one dropdown option. Update the type configuration first.`); return; }
    }
    const part = parts.find((item) => item.id === partId)!;
    const docId = `demo-${crypto.randomUUID()}`;
    const today = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Berlin" }).format(new Date());
    let sequence = allDocuments.length + 1;
    const existingNumbers = new Set(allDocuments.map((document) => document.number));
    while (existingNumbers.has(`DEMO-${selectedType.identifier.toUpperCase().slice(0, 10)}-${String(sequence).padStart(3, "0")}`)) sequence += 1;
    const values = Object.fromEntries(selectedType.fields.map((field) => {
      const value = fieldValues[field.key] ?? field.defaultValue;
      return [field.key, field.type === "number" && value !== "" ? Number(value) : value];
    }));
    addDocument({
      id: docId,
      number: `DEMO-${selectedType.identifier.toUpperCase().slice(0, 10)}-${String(sequence).padStart(3, "0")}`,
      title: title.trim(), type: selectedType.name, typeId: selectedType.id, partId: part.id,
      revision: revision.trim() || "A", status, owner: "Demo user", updated: today,
      summary: `Synthetic record created in this browser for ${part.number} · ${part.name}. No file is attached.`,
      orderIds: orderId ? [orderId] : [], customFieldValues: values,
      history: [{ revision: revision.trim() || "A", status, date: today, note: "Synthetic record created in the local demo." }],
    });
    addActivity({ title: "Synthetic document record created", subject: `DEMO-${selectedType.identifier.toUpperCase().slice(0, 10)}-${String(sequence).padStart(3, "0")}`, recordId: docId, kind: "Document" });
    onClose();
  }

  return <div className={styles.dialogOverlay} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="create-document-title"><div className={styles.dialogHead}><div><span className={styles.eyebrow}>Synthetic record</span><h2 id="create-document-title">Create document</h2><p>Creates a local demo record only. No document file is uploaded.</p></div><button type="button" className={styles.dialogClose} onClick={onClose} aria-label="Close">×</button></div>
    {activeTypes.length === 0 ? <div className={styles.empty}>There are no active document types. Activate or create a type in Configuration first.</div> : <form className={styles.dialogForm} onSubmit={save}>
      <div className={styles.formGrid}><div className={styles.formField}><label htmlFor="new-doc-type">Document type <span className={styles.requiredMark}>*</span></label><select id="new-doc-type" className={styles.formControl} value={typeId} required onChange={(event) => { setTypeId(event.target.value); setFieldValues({}); }} aria-label="Document type">{activeTypes.map((type) => <option value={type.id} key={type.id}>{type.name}</option>)}</select></div>
      <div className={styles.formField}><label htmlFor="new-doc-number">Title <span className={styles.requiredMark}>*</span></label><input id="new-doc-number" className={styles.formControl} value={title} required onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Bracket first-article inspection" /></div>
      <div className={styles.formField}><label htmlFor="new-doc-part">Related part</label><select id="new-doc-part" className={styles.formControl} value={partId} onChange={(event) => { setPartId(event.target.value); setOrderId(""); }}>{parts.map((part) => <option value={part.id} key={part.id}>{part.number} · {part.name}</option>)}</select></div>
      <div className={styles.formField}><label htmlFor="new-doc-revision">Revision</label><input id="new-doc-revision" className={styles.formControl} value={revision} onChange={(event) => setRevision(event.target.value)} /></div>
      <div className={styles.formField}><label htmlFor="new-doc-status">Record status</label><select id="new-doc-status" className={styles.formControl} value={status} onChange={(event) => setStatus(event.target.value as RecordStatus)}>{(["Draft", "In review", "Approved", "Outdated"] as const).map((value) => <option key={value}>{value}</option>)}</select></div>
      <div className={styles.formField}><label htmlFor="new-doc-order">Related production order</label><select id="new-doc-order" className={styles.formControl} value={orderId} onChange={(event) => setOrderId(event.target.value)}><option value="">No order linked</option>{availableOrders.map((order) => <option key={order.id} value={order.id}>{order.number}</option>)}</select></div></div>
      {selectedType?.fields.map((field) => <FieldControl key={field.id} field={field} value={fieldValues[field.key] ?? field.defaultValue ?? ""} onChange={(value) => setFieldValues((current) => ({ ...current, [field.key]: value }))} />)}
      {error && <p className={styles.formError} role="alert">{error}</p>}
      <div className={styles.dialogActions}><button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button><button type="submit" className={styles.primaryButton}>Save synthetic record</button></div>
    </form>}</section></div>;
}
