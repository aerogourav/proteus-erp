"use client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { activity, parts, productionOrders } from "@/lib/demo-data";
import { demoCompanies, demoMaterialLots } from "@/lib/business-data";
import { evaluateOrderCompleteness } from "@/lib/configuration-rules";
import { useDemoConfiguration } from "@/components/demo/configuration-context";
import { ActivityRows, CompletenessPanel, DetailFields, OrderDocuments, PageHeader, Panel, ReadinessNote, StatusPill } from "@/components/demo/demo-ui";
import { TechnicalIllustration } from "@/components/demo/technical-illustration";
import styles from "@/components/demo/demo.module.css";

export function ProductionOrderDetail({ orderId }: { orderId: string }) {
  const { state, documents } = useDemoConfiguration();
  const order = productionOrders.find((item) => item.id === orderId);
  if (!order) notFound();
  const part = parts.find((item) => item.id === order.partId)!;
  const issues = evaluateOrderCompleteness(order, state, documents, parts);
  const currentEvaluation = issues.length ? issues.map((issue) => `${issue.label} is ${issue.reason.toLowerCase()}`).join("; ") : "No configured document requirement issues";
  const events = activity.filter((event) => event.recordId === order.id);
  const customer = demoCompanies.find((company) => company.id === order.customerCompanyId);
  const lots = demoMaterialLots.filter((lot) => order.materialLotIds?.includes(lot.id));
  return <><PageHeader eyebrow={`Production orders / ${order.number}`} title={order.number} description={`${part.number} · ${part.name} · ${order.quantity} pieces`} meta={<StatusPill status={order.status} />} />
    <div className={styles.detailGrid}><div className={styles.detailMain}>
      <Panel title="Part illustration" description="Illustrative geometry for this order’s part and revision"><TechnicalIllustration number={part.number} revision={order.partRevision} name={part.name} /></Panel>
      <Panel title="Order details" description="Synthetic production order record"><div className={styles.detailBody}><DetailFields fields={[{ label: "Order number", value: order.number }, { label: "Part / revision", value: `${part.number} · Rev ${order.partRevision}` }, { label: "Quantity", value: `${order.quantity} pcs` }, { label: "Order status", value: <StatusPill status={order.status} /> }, { label: "Planned start", value: order.plannedStart }, { label: "Planned due", value: order.plannedDue }, { label: "Workflow", value: order.workflow }, { label: "Current document evaluation", value: currentEvaluation }]} /></div></Panel>
      <Panel title="Document completeness" description={`${issues.length ? `${issues.length} configured requirement issue${issues.length === 1 ? "" : "s"}` : "All configured record requirements are met"}`}><CompletenessPanel issues={issues} compact /></Panel>
      <Panel title="Linked engineering records" description="Records attached to this synthetic order"><OrderDocuments order={order} /></Panel>
      <Panel title="Connected records"><div className={styles.detailBody}>{customer ? <p>Customer: <Link href={`/demo/crm#${customer.id}`}>{customer.name}</Link></p> : <p>No sample customer is linked.</p>}{lots.map((lot) => <p key={lot.id}>Material: <Link href={`/demo/materials#${lot.id}`}>{lot.code} · {lot.lotNumber}</Link> · <Link href={`/demo/suppliers#${lot.supplierId}`}>supplier</Link> · <Link href={`/demo/documents/${lot.certificateDocumentId}`}>reference</Link></p>)}</div></Panel>
    </div><aside className={styles.detailSide}><Panel title="Order activity"><ActivityRows rows={events} /></Panel><ReadinessNote /></aside></div>
  </>;
}
