"use client";

import { ClipboardList, FileClock, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { getRecordHref, type Part, type ProductionOrder } from "@/lib/demo-data";
import { DocumentRows, OrderRows, PartRows } from "@/components/demo/demo-ui";
import { useDemoConfiguration } from "@/components/demo/configuration-context";
import { useDemoBusinessRecords } from "@/components/demo/business-records-context";
import { PartEditor, ProductionOrderEditor } from "@/components/demo/business-record-forms";
import { DocumentCreateDialog } from "@/components/demo/document-create-dialog";
import styles from "./demo.module.css";

export function DocumentBrowser() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { documents: allDocuments, documentTypes } = useDemoConfiguration();
  const query = searchParams.get("q") ?? "";
  const requestedStatus = searchParams.get("status") ?? "All statuses";
  const status = ["Approved", "In review", "Draft", "Outdated"].includes(requestedStatus) ? requestedStatus : "All statuses";
  const [type, setType] = useState("All types");
  const [createOpen, setCreateOpen] = useState(false);
  const updateParams = (key: "q" | "status", value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "All statuses") params.set(key, value);
    else params.delete(key);
    const queryString = params.toString();
    router.replace(`/demo/classic/documents${queryString ? `?${queryString}` : ""}`, { scroll: false });
  };
  const filtered = useMemo(() => allDocuments.filter((document) => {
    const match = `${document.number} ${document.title} ${document.partId}`.toLowerCase().includes(query.toLowerCase());
    const documentType = documentTypes.find((item) => item.id === ("typeId" in document ? document.typeId : undefined)) ?? documentTypes.find((item) => item.name === document.type);
    return match && (type === "All types" || documentType?.id === type || (!documentType && document.type === type)) && (status === "All statuses" || document.status === status);
  }), [allDocuments, documentTypes, query, type, status]);
  return <><div className={styles.card}><div className={styles.toolbar}><label className={styles.searchField}><Search size={14} /><input value={query} onChange={(event) => updateParams("q", event.target.value)} placeholder="Search document number, title, or part" aria-label="Search documents" /></label><select className={styles.select} value={type} onChange={(event) => setType(event.target.value)} aria-label="Filter by document type"><option value="All types">All types</option>{documentTypes.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select className={styles.select} value={status} onChange={(event) => updateParams("status", event.target.value)} aria-label="Filter by document status"><option>All statuses</option>{[...new Set(allDocuments.map((item) => item.status))].map((item) => <option key={item}>{item}</option>)}</select><button type="button" className={styles.smallAction} onClick={() => setCreateOpen(true)}>Create document</button><span className={styles.count}>{filtered.length} of {allDocuments.length} records</span></div><DocumentRows rows={filtered} /></div>{createOpen && <DocumentCreateDialog onClose={() => setCreateOpen(false)} />}</>;
}

export function PartBrowser() {
  const { parts, setParts, addActivity } = useDemoBusinessRecords();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All lifecycle states");
  const [partForm, setPartForm] = useState<Part | null | undefined>(undefined);
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => parts.filter((part) => `${part.number} ${part.name} ${part.material}`.toLowerCase().includes(query.toLowerCase()) && (status === "All lifecycle states" || part.status === status)), [parts, query, status]);
  const savePart = (part: Part) => {
    const duplicate = parts.some((item) => item.id !== part.id && item.number.toLowerCase() === part.number.toLowerCase());
    if (duplicate) { setNotice("That part number is already in use."); return; }
    const exists = parts.some((item) => item.id === part.id);
    setParts(exists ? parts.map((item) => item.id === part.id ? part : item) : [part, ...parts]);
    addActivity({ title: exists ? "Part record updated" : "Part record created", subject: part.number, recordId: part.id, kind: "Part" });
    setPartForm(undefined); setNotice(`${part.number} saved in this browser.`);
  };
  return <><div className={styles.card}><div className={styles.toolbar}><label className={styles.searchField}><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search part number, name, or material" aria-label="Search parts" /></label><select className={styles.select} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by lifecycle state"><option>All lifecycle states</option>{[...new Set(parts.map((part) => part.status))].map((item) => <option key={item}>{item}</option>)}</select><span className={styles.count}>{filtered.length} of {parts.length} parts</span><button type="button" className={styles.primaryButton} onClick={() => { setNotice(""); setPartForm(null); }}><Plus size={14} /> Add part</button></div><PartRows rows={filtered} /></div>{notice && <p role="status" className={styles.notice}>{notice}</p>}{partForm !== undefined && <PartEditor initial={partForm ?? undefined} onClose={() => setPartForm(undefined)} onSave={savePart} />}</>;
}

export function OrderBrowser() {
  const { parts, productionOrders, materialLots, setProductionOrders, setMaterialLots, addActivity } = useDemoBusinessRecords();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All order statuses");
  const [orderForm, setOrderForm] = useState<ProductionOrder | null | undefined>(undefined);
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => productionOrders.filter((order) => {
    const part = parts.find((item) => item.id === order.partId);
    return `${order.number} ${part?.number} ${part?.name}`.toLowerCase().includes(query.toLowerCase()) && (status === "All order statuses" || order.status === status);
  }), [productionOrders, parts, query, status]);
  const saveOrder = (order: ProductionOrder) => {
    const duplicate = productionOrders.some((item) => item.id !== order.id && item.number.toLowerCase() === order.number.toLowerCase());
    if (duplicate) { setNotice("That production order number is already in use."); return; }
    const exists = productionOrders.some((item) => item.id === order.id);
    setProductionOrders(exists ? productionOrders.map((item) => item.id === order.id ? order : item) : [order, ...productionOrders]);
    setMaterialLots(materialLots.map((lot) => ({ ...lot, orderIds: order.materialLotIds?.includes(lot.id) ? [...new Set([...lot.orderIds, order.id])] : lot.orderIds.filter((id) => id !== order.id), partIds: order.materialLotIds?.includes(lot.id) ? [...new Set([...lot.partIds, order.partId])] : lot.partIds })));
    addActivity({ title: exists ? "Production order updated" : "Production order created", subject: order.number, recordId: order.id, kind: "Production order" });
    setOrderForm(undefined); setNotice(`${order.number} saved in this browser.`);
  };
  return <><div className={styles.card}><div className={styles.toolbar}><label className={styles.searchField}><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order or part" aria-label="Search production orders" /></label><select className={styles.select} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter orders by status"><option>All order statuses</option>{[...new Set(productionOrders.map((order) => order.status))].map((item) => <option key={item}>{item}</option>)}</select><span className={styles.count}>{filtered.length} of {productionOrders.length} orders</span><button type="button" className={styles.primaryButton} onClick={() => { setNotice(""); setOrderForm(null); }}><Plus size={14} /> New production order</button></div><OrderRows rows={filtered} /></div>{notice && <p role="status" className={styles.notice}>{notice}</p>}{orderForm !== undefined && <ProductionOrderEditor initial={orderForm ?? undefined} onClose={() => setOrderForm(undefined)} onSave={saveOrder} />}</>;
}

export function ActivityBrowser() {
  const { activity } = useDemoBusinessRecords();
  const [filter, setFilter] = useState("All activity");
  const filtered = activity.filter((item) => filter === "All activity" || item.kind === filter);
  const documentEvents = filtered.filter((item) => item.kind === "Document").length;
  const orderEvents = filtered.filter((item) => item.kind === "Production order").length;
  const otherEvents = filtered.length - documentEvents - orderEvents;
  const documentShare = filtered.length ? documentEvents / filtered.length * 100 : 0;
  const orderShare = filtered.length ? orderEvents / filtered.length * 100 : 0;
  return <div className={styles.activityWorkspace}>
    <section className={`${styles.card} ${styles.activitySummary}`} aria-label="Activity summary">
      <div className={styles.activitySummaryLead}><span className={styles.activitySummaryIcon}><FileClock size={17} /></span><div><span className={styles.visualEyebrow}>SYNTHETIC EVENT STREAM</span><h2>Activity timeline</h2><p>Recent events connected to sample records.</p></div></div>
      <div className={styles.activitySummaryStats}><span>Events shown<strong>{filtered.length}</strong></span><span>Documents<strong>{documentEvents}</strong></span><span>Production orders<strong>{orderEvents}</strong></span><span>Business records<strong>{otherEvents}</strong></span></div>
      <div className={styles.activityMix} role="img" aria-label={`${documentEvents} document events, ${orderEvents} production order events, and ${otherEvents} business record events`}><i style={{ width: `${documentShare}%` }} /><i style={{ width: `${orderShare}%` }} /><i style={{ width: `${100 - documentShare - orderShare}%` }} /></div>
      <div className={styles.activityMixLegend}><span><i className={styles.activityDocDot} />Document records</span><span><i className={styles.activityOrderDot} />Production orders</span><span><i className={styles.activityBusinessDot} />Business records</span></div>
    </section>
    <section className={`${styles.card} ${styles.activityTimelinePanel}`}>
      <div className={styles.activityToolbar}><div><h2>Record history</h2><p>Events link back to the referenced synthetic record.</p></div><div className={styles.activityFilter}><label htmlFor="activity-kind-filter">Filter events</label><select id="activity-kind-filter" className={styles.select} value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter activity type"><option>All activity</option>{[...new Set(activity.map((item) => item.kind))].map((kind) => <option key={kind}>{kind}</option>)}</select></div></div>
      <div className={styles.activityTimeline}>
        {filtered.map((item) => {
          const [day, time] = item.date.split(" · ");
          const Icon = item.kind === "Production order" ? ClipboardList : FileClock;
          return <article className={styles.activityTimelineItem} key={item.id}>
            <time className={styles.activityTimelineTime}><strong>{day}</strong><small>{time}</small></time>
            <span className={styles.activityTimelineRail}><i><Icon size={13} /></i></span>
            <div className={styles.activityTimelineCard}>
              <div className={styles.activityTimelineMeta}><span className={item.kind === "Production order" ? styles.activityOrderTag : styles.activityDocTag}>{item.kind}</span><span>{item.actor}</span></div>
              <strong>{item.title}</strong>
              <Link href={getRecordHref(item.recordId)}>{item.subject} <span aria-hidden="true">↗</span></Link>
            </div>
          </article>;
        })}
        {filtered.length === 0 && <div className={styles.empty}>No events match this filter.</div>}
      </div>
    </section>
  </div>;
}
