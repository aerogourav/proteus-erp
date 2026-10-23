"use client";
import { notFound } from "next/navigation";
import { useState } from "react";
import { evaluatePartCompleteness } from "@/lib/configuration-rules";
import { useDemoConfiguration } from "@/components/demo/configuration-context";
import { useDemoBusinessRecords } from "@/components/demo/business-records-context";
import { PartEditor } from "@/components/demo/business-record-forms";
import { ActivityRows, CompletenessPanel, DetailFields, PageHeader, Panel, ReadinessNote, RevisionHistory, StatusPill } from "@/components/demo/demo-ui";
import { PartRelationshipMap, RevisionImpactPanel } from "@/components/demo/record-visualizations";
import { TechnicalIllustration } from "@/components/demo/technical-illustration";
import Link from "next/link";
import styles from "@/components/demo/demo.module.css";

export function PartDetail({ partId }: { partId: string }) {
  const { state, documents } = useDemoConfiguration();
  const { ready, parts, productionOrders, materialLots, activity: recordActivity, setParts, addActivity } = useDemoBusinessRecords();
  const [editing, setEditing] = useState(false);
  const part = parts.find((item) => item.id === partId);
  if (!part && !ready) return <div className={styles.empty} role="status">Loading sample part record…</div>;
  if (!part) notFound();
  const partDocuments = documents.filter((doc) => doc.partId === part.id);
  const orders = productionOrders.filter((order) => order.partId === part.id);
  const lots = materialLots.filter((lot) => lot.partIds.includes(part.id));
  const events = recordActivity.filter((event) => event.recordId === part.id || partDocuments.some((doc) => doc.id === event.recordId) || orders.some((order) => order.id === event.recordId));
  const issues = evaluatePartCompleteness(part, state, documents);
  const savePart = (nextPart: typeof part) => {
    if (parts.some((item) => item.id !== nextPart.id && item.number.toLowerCase() === nextPart.number.toLowerCase())) return;
    setParts(parts.map((item) => item.id === nextPart.id ? nextPart : item));
    addActivity({ title: "Part record updated", subject: nextPart.number, recordId: nextPart.id, kind: "Part" });
    setEditing(false);
  };
  return <><PageHeader eyebrow={`Parts & revisions / ${part.number}`} title={part.name} description={`${part.number} · ${part.material}`} meta={<StatusPill status={part.status} />} /><div className={styles.configToolbar}><p>Update the synthetic part details and current revision.</p><button type="button" className={styles.primaryButton} onClick={() => setEditing(true)}>Edit part</button></div>
    <div className={styles.detailGrid}><div className={styles.detailMain}>
      <Panel title="Illustrative geometry" description="Synthetic illustration associated with the current part record"><TechnicalIllustration number={part.number} revision={part.currentRevision} name={part.name} /></Panel>
      <Panel title="Part record" description="Current controlled revision"><div className={styles.detailBody}><DetailFields fields={[{ label: "Part number", value: part.number }, { label: "Part name", value: part.name }, { label: "Material", value: part.material }, { label: "Current drawing revision", value: `Rev ${part.currentRevision}` }, { label: "Lifecycle status", value: <StatusPill status={part.status} /> }, { label: "Linked records", value: `${partDocuments.length} documents · ${orders.length} production orders` }]} /><p className={styles.detailDescription}>{part.description}</p></div></Panel>
      <Panel title="Document requirements" description="Current record status against active rules"><CompletenessPanel issues={issues} compact /></Panel>
      <PartRelationshipMap part={part} /><RevisionImpactPanel part={part} />
      {lots.length > 0 && <Panel title="Material traceability"><div className={styles.detailBody}>{lots.map((lot) => <p key={lot.id}><Link href={`/demo/materials#${lot.id}`}>{lot.code} · {lot.lotNumber}</Link> · <Link href={`/demo/documents/${lot.certificateDocumentId}`}>reference record</Link></p>)}</div></Panel>}
      <Panel title="Revision history"><RevisionHistory rows={part.revisionHistory} /></Panel>
    </div><aside className={styles.detailSide}><Panel title="Recent activity"><ActivityRows rows={events} /></Panel><ReadinessNote /></aside></div>
    {editing && <PartEditor initial={part} onClose={() => setEditing(false)} onSave={savePart} />}
  </>;
}
