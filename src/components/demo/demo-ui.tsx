"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Check, CircleDot, ClipboardList, FileClock, FileStack, GitBranch, Info, Layers3 } from "lucide-react";
import { getOrderDocuments, getRecordHref, type ActivityEvent, type EngineeringDocument, type Part, type ProductionOrder } from "@/lib/demo-data";
import { evaluateOrderCompleteness, evaluatePartCompleteness, type CompletenessIssue } from "@/lib/configuration-rules";
import { useDemoConfiguration } from "@/components/demo/configuration-context";
import { useDemoBusinessRecords } from "@/components/demo/business-records-context";
import styles from "./demo.module.css";

export function PageHeader({ eyebrow, title, description, meta }: { eyebrow: string; title: string; description: string; meta?: React.ReactNode }) {
  return <div className={styles.pageHead}><div><span className={styles.eyebrow}>{eyebrow}</span><h1 className={styles.pageTitle}>{title}</h1><p className={styles.pageDescription}>{description}</p></div>{meta && <span className={styles.headMeta}>{meta}</span>}</div>;
}
export function Panel({ title, description, href, linkLabel, children }: { title: string; description?: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return <section className={`${styles.card} ${styles.panel}`}><div className={styles.panelHead}><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{href && <Link className={styles.panelLink} href={href}>{linkLabel ?? "View all"}<ArrowRight size={13} /></Link>}</div>{children}</section>;
}

export function StatusPill({ status }: { status: string }) {
  const className = status === "Approved" || status === "Released" || status === "Complete" ? styles.pillApproved : status === "In review" || status === "In progress" ? styles.pillReview : status === "Outdated" || status === "On hold" || status === "Blocked" ? styles.pillIssue : styles.pillDraft;
  return <span className={`${styles.pill} ${className}`}>{status}</span>;
}

export function CompletenessPanel({ issues, compact = false }: { issues: CompletenessIssue[]; compact?: boolean }) {
  return <div className={compact ? styles.checkList : styles.warningStack}>
    {issues.length === 0 ? <div className={compact ? styles.checkItem : styles.notice}><Check size={15} /><span>{compact ? "All configured document records are approved and current." : "All required document records are present, approved, and current."}</span></div> : issues.map((issue, index) => {
      const description = issue.reason === "Missing" ? "No linked record is present for this requirement." : issue.reason === "Outdated" ? `${issue.document?.number} · Rev ${issue.document?.revision} does not match the configured revision requirement.` : `${issue.document?.number} · Rev ${issue.document?.revision} is ${issue.document?.status.toLowerCase()}; an acceptable status is required.`;
      return compact ? <div className={styles.checkItem} key={`${issue.ruleId}-${index}`}><span className={`${styles.checkIcon} ${styles.checkIconIssue}`}><AlertTriangle size={11} /></span><span>{issue.label}<small>{description}</small></span><span className={styles.checkState}>{issue.reason}</span></div> : <div className={styles.warning} key={`${issue.ruleId}-${index}`}><AlertTriangle size={15} /><div><strong>{issue.reason}: {issue.label}</strong><p>{description}</p>{issue.document && <Link href={`/demo/documents/${issue.document.id}`}>Open linked record <ArrowRight size={11} /></Link>}</div></div>;
    })}
  </div>;
}

export function DocumentRows({ rows }: { rows: EngineeringDocument[] }) {
  const { documentTypeFor } = useDemoConfiguration();
  const { parts } = useDemoBusinessRecords();
  return <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Document</th><th>Type</th><th>Part</th><th>Revision</th><th>Status</th><th>Updated</th></tr></thead><tbody>{rows.map((document) => {
    const part = parts.find((item) => item.id === document.partId);
    return <tr key={document.id}><td><Link className={styles.recordLink} href={`/demo/documents/${document.id}`}>{document.number}<span className={styles.subText}>{document.title}</span></Link></td><td>{documentTypeFor(document)?.name ?? document.type}</td><td>{part && <Link className={styles.recordLink} href={`/demo/parts/${part.id}`}>{part.number}<span className={styles.subText}>{part.name}</span></Link>}</td><td>Rev {document.revision}</td><td><StatusPill status={document.status} /></td><td>{document.updated}</td></tr>;
  })}</tbody></table>{rows.length === 0 && <div className={styles.empty}>No documents match these filters.</div>}</div>;
}

export function PartRows({ rows }: { rows: Part[] }) {
  const { state, documents: allDocuments } = useDemoConfiguration();
  const { productionOrders } = useDemoBusinessRecords();
  return <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Part</th><th>Material</th><th>Drawing revision</th><th>Lifecycle</th><th>Documents</th><th>Orders</th></tr></thead><tbody>{rows.map((part) => {
    const partDocs = allDocuments.filter((document) => document.partId === part.id);
    const orders = productionOrders.filter((order) => order.partId === part.id);
    const issues = evaluatePartCompleteness(part, state, allDocuments);
    return <tr key={part.id}><td><Link className={styles.recordLink} href={`/demo/parts/${part.id}`}>{part.number}<span className={styles.subText}>{part.name}</span></Link></td><td>{part.material}</td><td>Rev {part.currentRevision}</td><td><StatusPill status={part.status} /></td><td>{partDocs.length} linked <span className={styles.subText}>{issues.length ? `${issues.length} requirement issue${issues.length === 1 ? "" : "s"}` : "Configured records ready"}</span></td><td>{orders.length} orders</td></tr>;
  })}</tbody></table>{rows.length === 0 && <div className={styles.empty}>No parts match this search.</div>}</div>;
}

export function OrderRows({ rows }: { rows: ProductionOrder[] }) {
  const { state, documents: allDocuments } = useDemoConfiguration();
  const { parts } = useDemoBusinessRecords();
  return <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Production order</th><th>Part / revision</th><th>Quantity</th><th>Planned dates</th><th>Document readiness</th><th>Status</th></tr></thead><tbody>{rows.map((order) => {
    const part = parts.find((item) => item.id === order.partId)!;
    const issues = evaluateOrderCompleteness(order, state, allDocuments, parts);
    return <tr key={order.id}><td><Link className={styles.recordLink} href={`/demo/production/${order.id}`}>{order.number}<span className={styles.subText}>{order.workflow}</span></Link></td><td><Link className={styles.recordLink} href={`/demo/parts/${part.id}`}>{part.number} · Rev {order.partRevision}<span className={styles.subText}>{part.name}</span></Link></td><td>{order.quantity} pcs</td><td>{order.plannedStart}<span className={styles.subText}>Due {order.plannedDue}</span></td><td>{issues.length ? <><StatusPill status="Needs attention" /><span className={styles.subText}>{issues.length} configured record issue{issues.length === 1 ? "" : "s"}</span></> : <StatusPill status="Complete" />}</td><td><StatusPill status={order.status} /></td></tr>;
  })}</tbody></table>{rows.length === 0 && <div className={styles.empty}>No orders match this search.</div>}</div>;
}

export function ActivityRows({ rows }: { rows?: ActivityEvent[] }) {
  const records = useDemoBusinessRecords();
  const entries = rows ?? records.activity;
  return <div className={styles.activityList}>{entries.map((item) => <div className={styles.activityItem} key={item.id}><span className={styles.activityIcon}>{item.kind === "Production order" ? <ClipboardList size={13} /> : <FileClock size={13} />}</span><div className={styles.activityCopy}>{item.title}<small>{item.actor} · <Link href={getRecordHref(item.recordId)}>{item.subject}</Link></small></div><span className={styles.activityDate}>{item.date}</span></div>)}</div>;
}

export function Metric({ label, value, note, href, icon }: { label: string; value: number; note: string; href: string; icon: "documents" | "review" | "parts" | "orders" }) {
  const Icon = icon === "documents" ? FileStack : icon === "review" ? FileClock : icon === "parts" ? Layers3 : ClipboardList;
  return <Link href={href} className={`${styles.card} ${styles.metric}`}><span className={styles.metricTop}>{label}<span className={styles.metricIcon}><Icon size={16} /></span></span><strong className={styles.metricValue}>{String(value).padStart(2, "0")}</strong><small className={styles.metricNote}>{note}</small></Link>;
}

export function DetailFields({ fields }: { fields: { label: string; value: React.ReactNode }[] }) {
  return <div className={styles.detailFields}>{fields.map(({ label, value }) => <div key={label}><span className={styles.fieldLabel}>{label}</span><div className={styles.fieldValue}>{value}</div></div>)}</div>;
}

export function RevisionHistory({ rows }: { rows: { revision: string; date: string; note: string; status: string }[] }) {
  return <div className={styles.history}>{rows.map((row, index) => <div className={styles.historyRow} key={`${row.revision}-${row.date}`}><span className={styles.historyDot}>{index === 0 ? <CircleDot size={11} /> : <GitBranch size={11} />}</span><div><strong>Revision {row.revision} <StatusPill status={row.status} /></strong><small>{row.note}</small></div><span className={styles.historyDate}>{row.date}</span></div>)}</div>;
}

export function DocumentOrderLinks({ document }: { document: EngineeringDocument }) {
  const { documents: allDocuments } = useDemoConfiguration();
  const { productionOrders, parts } = useDemoBusinessRecords();
  const linkedOrders = productionOrders.filter((order) => getOrderDocuments(order, allDocuments).some((item) => item.id === document.id) || document.orderIds.includes(order.id));
  const part = parts.find((item) => item.id === document.partId);
  return <div className={styles.linkList}><div className={styles.linkRow}><Link href={`/demo/parts/${document.partId}`}>{part?.number} · {part?.name}<small>Linked part · current drawing Rev {part?.currentRevision}</small></Link></div>{linkedOrders.map((order) => <div className={styles.linkRow} key={order.id}><Link href={`/demo/production/${order.id}`}>{order.number}<small>{order.quantity} pcs · {order.status}</small></Link><ArrowRight size={13} /></div>)}</div>;
}

export function PartLinkedRecords({ part }: { part: Part }) {
  const { documents: allDocuments, documentTypeFor } = useDemoConfiguration();
  const { productionOrders } = useDemoBusinessRecords();
  const partDocs = allDocuments.filter((document) => document.partId === part.id);
  const orders = productionOrders.filter((order) => order.partId === part.id);
  return <div className={styles.linkList}>{partDocs.map((document) => <div className={styles.linkRow} key={document.id}><Link href={`/demo/documents/${document.id}`}>{document.number}<small>{documentTypeFor(document)?.name ?? document.type} · Rev {document.revision} · {document.status}</small></Link><ArrowRight size={13} />{document.status !== "Approved" && <StatusPill status={document.status} />}</div>)}{orders.map((order) => <div className={styles.linkRow} key={order.id}><Link href={`/demo/production/${order.id}`}>{order.number}<small>{order.quantity} pcs · {order.status}</small></Link><ArrowRight size={13} /></div>)}{partDocs.length + orders.length === 0 && <div className={styles.empty}>No linked records.</div>}</div>;
}

export function OrderDocuments({ order }: { order: ProductionOrder }) {
  const { documents: allDocuments, documentTypeFor } = useDemoConfiguration();
  const linked = getOrderDocuments(order, allDocuments);
  return <div className={styles.linkList}>{linked.map((document) => <div className={styles.linkRow} key={document.id}><Link href={`/demo/documents/${document.id}`}>{document.number}<small>{documentTypeFor(document)?.name ?? document.type} · Rev {document.revision}</small></Link><StatusPill status={document.status} /></div>)}</div>;
}

export function ReadinessNote() {
  return <div className={styles.notice}><Info size={14} /><span>Record completeness checks compare linked synthetic records with this part’s configured document types and statuses. They do not inspect file contents or validate manufacturing readiness or compliance.</span></div>;
}

