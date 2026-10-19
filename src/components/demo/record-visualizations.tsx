"use client";

import Link from "next/link";
import { ArrowRight, GitBranch, Link2, PackageCheck } from "lucide-react";
import { getOrderDocuments, productionOrders, type EngineeringDocument, type Part } from "@/lib/demo-data";
import { useDemoConfiguration } from "@/components/demo/configuration-context";
import { Panel, StatusPill } from "@/components/demo/demo-ui";
import styles from "@/components/demo/demo.module.css";

export function PartRelationshipMap({ part }: { part: Part }) {
  const { documents, documentTypeFor } = useDemoConfiguration();
  const partDocuments = documents.filter((document) => document.partId === part.id);
  const partOrders = productionOrders.filter((order) => order.partId === part.id);

  return <Panel title="Connected record map" description={`${part.number} · confirmed links in this synthetic dataset`}>
    <div className={styles.mapHub}><PackageCheck size={16} /><span><strong>{part.number} · {part.name}</strong><small>Current part revision · Rev {part.currentRevision}</small></span><StatusPill status={part.status} /></div>
    <div className={styles.mapGroups}>
      <section><h3>Engineering records <span>{partDocuments.length}</span></h3><div className={styles.mapNodes}>{partDocuments.map((document) => <RecordNode key={document.id} document={document} type={documentTypeFor(document)?.name ?? document.type} />)}{partDocuments.length === 0 && <p className={styles.empty}>No linked records.</p>}</div></section>
      <section><h3>Production orders <span>{partOrders.length}</span></h3><div className={styles.mapNodes}>{partOrders.map((order) => <Link className={styles.mapNode} key={order.id} href={`/demo/production/${order.id}`}><span className={styles.mapNodeIcon}><GitBranch size={13} /></span><span><strong>{order.number}</strong><small>{order.quantity} pcs · Rev {order.partRevision} · {order.status}</small></span><ArrowRight size={13} /></Link>)}{partOrders.length === 0 && <p className={styles.empty}>No linked orders.</p>}</div></section>
    </div>
    <p className={styles.mapNote}><Link2 size={12} /> Connections use the part, order, and document IDs in the sample records. A link does not mean a dependent record has been reviewed or updated.</p>
  </Panel>;
}

function RecordNode({ document, type }: { document: EngineeringDocument; type: string }) {
  return <Link className={styles.mapNode} href={`/demo/documents/${document.id}`}><span className={styles.mapNodeIcon}><Link2 size={13} /></span><span><strong>{document.number} · Rev {document.revision}</strong><small>{type} · {document.title}</small></span><StatusPill status={document.status} /></Link>;
}

export function RevisionImpactPanel({ part }: { part: Part }) {
  const { documents } = useDemoConfiguration();
  const currentDrawing = documents.find((document) => document.partId === part.id && document.revision === part.currentRevision && /drawing/i.test(document.type));
  const linkedOrders = currentDrawing ? productionOrders.filter((order) => order.partId === part.id && getOrderDocuments(order, documents).some((document) => document.id === currentDrawing.id)) : [];
  const linkedRecords = currentDrawing ? documents.filter((document) => document.partId === part.id && document.id !== currentDrawing.id && (document.orderIds.some((orderId) => linkedOrders.some((order) => order.id === orderId)) || linkedOrders.some((order) => order.documentIds.includes(document.id)))) : [];

  return <Panel title="Revision review scope" description="Potential records to inspect based on confirmed links">
    {currentDrawing ? <>
      <div className={styles.impactSource}><span><GitBranch size={15} /> Current synthetic drawing</span><Link href={`/demo/documents/${currentDrawing.id}`}>{currentDrawing.number} · Rev {currentDrawing.revision}<small>{part.number} · {currentDrawing.status}</small></Link></div>
      <div className={styles.impactGroups}>
        <section><h3>Linked production orders <span>{linkedOrders.length}</span></h3>{linkedOrders.length ? linkedOrders.map((order) => <Link className={styles.impactRow} key={order.id} href={`/demo/production/${order.id}`}><span>{order.number}<small>{order.quantity} pcs · part Rev {order.partRevision}</small></span><ArrowRight size={13} /></Link>) : <p className={styles.empty}>No linked orders in the sample.</p>}</section>
        <section><h3>Other related records <span>{linkedRecords.length}</span></h3>{linkedRecords.length ? linkedRecords.map((record) => <Link className={styles.impactRow} key={record.id} href={`/demo/documents/${record.id}`}><span>{record.number} · Rev {record.revision}<small>{record.title}</small></span><StatusPill status={record.status} /></Link>) : <p className={styles.empty}>No other linked records in this review scope.</p>}</section>
      </div>
      <p className={styles.mapNote}>These are possible review targets from the sample links. The demo does not infer technical impact, confirm safety, or record completed review actions.</p>
    </> : <p className={styles.empty}>No current drawing record is linked to this part in the sample.</p>}
  </Panel>;
}
