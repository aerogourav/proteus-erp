"use client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useDemoBusinessRecords } from "@/components/demo/business-records-context";
import { useDemoConfiguration } from "@/components/demo/configuration-context";
import { ActivityRows, DetailFields, DocumentOrderLinks, PageHeader, Panel, ReadinessNote, RevisionHistory, StatusPill } from "@/components/demo/demo-ui";
import { TechnicalIllustration } from "@/components/demo/technical-illustration";
import styles from "@/components/demo/demo.module.css";

export function DocumentDetail({ documentId }: { documentId: string }) {
  const { ready, documents, documentTypeFor } = useDemoConfiguration();
  const { parts, productionOrders, materialLots, suppliers, activity } = useDemoBusinessRecords();
  const document = documents.find((item) => item.id === documentId);
  if (!document && !ready) return <div className={styles.empty} role="status">Loading sample document record…</div>;
  if (!document) notFound();
  const part = parts.find((item) => item.id === document.partId);
  const orderLinks = productionOrders.filter((order) => order.documentIds.includes(document.id) || document.orderIds.includes(order.id));
  const events = activity.filter((event) => event.recordId === document.id);
  const type = documentTypeFor(document);
  const customFields = type?.fields.filter((field) => document.customFieldValues?.[field.key] !== undefined) || [];
  const lot = materialLots.find((item) => item.id === document.materialLotId);
  const supplier = suppliers.find((item) => item.id === document.supplierId);
  return <><PageHeader eyebrow={`Documents / ${document.number}`} title={document.title} description={`${document.number} · synthetic document record · no file is stored in this demo.`} meta={<StatusPill status={document.status} />} />
    <div className={styles.detailGrid}><div className={styles.detailMain}>
      {document.type === "Engineering drawing" && part && <Panel title="Illustrative drawing preview" description={`Matches the sample part ${part.number} and revision ${document.revision}`}><TechnicalIllustration number={part.number} revision={document.revision} name={part.name} /></Panel>}
      <Panel title="Document metadata" description="Record information"><div className={styles.detailBody}><DetailFields fields={[{ label: "Document number", value: document.number }, { label: "Document type", value: type?.name ?? document.type }, { label: "Revision", value: `Rev ${document.revision}` }, { label: "Status", value: <StatusPill status={document.status} /> }, { label: "Owner", value: document.owner }, { label: "Last updated", value: document.updated }, { label: "Related part", value: part ? <Link href={`/demo/parts/${part.id}`}>{part.number} · {part.name}</Link> : "—" }, { label: "Related production orders", value: orderLinks.length ? orderLinks.map((order) => <Link key={order.id} href={`/demo/production/${order.id}`}>{order.number} </Link>) : "None linked" }]} /><p className={styles.detailDescription}>{document.summary}</p>{customFields.length > 0 && <div className={styles.customValues}>{customFields.map((field) => <div key={field.id}><span className={styles.fieldLabel}>{field.label}</span><div className={styles.fieldValue}>{String(document.customFieldValues?.[field.key])}</div></div>)}</div>}{lot && <p>Material lot: <Link href={`/demo/materials#${lot.id}`}>{lot.code} · {lot.lotNumber}</Link></p>}{supplier && <p>Supplier: <Link href={`/demo/suppliers#${supplier.id}`}>{supplier.name}</Link></p>}</div></Panel>
      <Panel title="Revision history" description="Synthetic revision entries"><RevisionHistory rows={document.history} /></Panel>
      <Panel title="Linked records" description="Parts and orders that reference this record"><DocumentOrderLinks document={document} /></Panel>
    </div><aside className={styles.detailSide}><Panel title="Record status"><div className={styles.detailBody}><StatusPill status={document.status} /><p className={styles.detailDescription}>Status describes the record entry only. This demo does not open, validate, or store a document file.</p></div></Panel><Panel title="Recent activity"><ActivityRows rows={events} /></Panel><ReadinessNote /></aside></div>
  </>;
}
