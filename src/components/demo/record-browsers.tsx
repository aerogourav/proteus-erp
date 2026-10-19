"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { activity, parts, productionOrders } from "@/lib/demo-data";
import { ActivityRows, DocumentRows, OrderRows, PartRows } from "@/components/demo/demo-ui";
import { useDemoConfiguration } from "@/components/demo/configuration-context";
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
    router.replace(`/demo/documents${queryString ? `?${queryString}` : ""}`, { scroll: false });
  };
  const filtered = useMemo(() => allDocuments.filter((document) => {
    const match = `${document.number} ${document.title} ${document.partId}`.toLowerCase().includes(query.toLowerCase());
    const documentType = documentTypes.find((item) => item.id === ("typeId" in document ? document.typeId : undefined)) ?? documentTypes.find((item) => item.name === document.type);
    return match && (type === "All types" || documentType?.id === type || (!documentType && document.type === type)) && (status === "All statuses" || document.status === status);
  }), [allDocuments, documentTypes, query, type, status]);
  return <><div className={styles.card}><div className={styles.toolbar}><label className={styles.searchField}><Search size={14} /><input value={query} onChange={(event) => updateParams("q", event.target.value)} placeholder="Search document number, title, or part" aria-label="Search documents" /></label><select className={styles.select} value={type} onChange={(event) => setType(event.target.value)} aria-label="Filter by document type"><option value="All types">All types</option>{documentTypes.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select className={styles.select} value={status} onChange={(event) => updateParams("status", event.target.value)} aria-label="Filter by document status"><option>All statuses</option>{[...new Set(allDocuments.map((item) => item.status))].map((item) => <option key={item}>{item}</option>)}</select><button type="button" className={styles.smallAction} onClick={() => setCreateOpen(true)}>Create document</button><span className={styles.count}>{filtered.length} of {allDocuments.length} records</span></div><DocumentRows rows={filtered} /></div>{createOpen && <DocumentCreateDialog onClose={() => setCreateOpen(false)} />}</>;
}

export function PartBrowser() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All lifecycle states");
  const filtered = useMemo(() => parts.filter((part) => `${part.number} ${part.name} ${part.material}`.toLowerCase().includes(query.toLowerCase()) && (status === "All lifecycle states" || part.status === status)), [query, status]);
  return <div className={styles.card}><div className={styles.toolbar}><label className={styles.searchField}><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search part number, name, or material" aria-label="Search parts" /></label><select className={styles.select} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by lifecycle state"><option>All lifecycle states</option>{[...new Set(parts.map((part) => part.status))].map((item) => <option key={item}>{item}</option>)}</select><span className={styles.count}>{filtered.length} of {parts.length} parts</span></div><PartRows rows={filtered} /></div>;
}

export function OrderBrowser() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All order statuses");
  const filtered = useMemo(() => productionOrders.filter((order) => {
    const part = parts.find((item) => item.id === order.partId);
    return `${order.number} ${part?.number} ${part?.name}`.toLowerCase().includes(query.toLowerCase()) && (status === "All order statuses" || order.status === status);
  }), [query, status]);
  return <div className={styles.card}><div className={styles.toolbar}><label className={styles.searchField}><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order or part" aria-label="Search production orders" /></label><select className={styles.select} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter orders by status"><option>All order statuses</option>{[...new Set(productionOrders.map((order) => order.status))].map((item) => <option key={item}>{item}</option>)}</select><span className={styles.count}>{filtered.length} of {productionOrders.length} orders</span></div><OrderRows rows={filtered} /></div>;
}

export function ActivityBrowser() {
  const [filter, setFilter] = useState("All activity");
  const filtered = activity.filter((item) => filter === "All activity" || item.kind === filter);
  return <div className={styles.card}><div className={styles.toolbar}><select className={styles.select} value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter activity type"><option>All activity</option><option>Document</option><option>Production order</option></select><span className={styles.count}>{filtered.length} events · synthetic activity</span></div><ActivityRows rows={filtered} /></div>;
}
