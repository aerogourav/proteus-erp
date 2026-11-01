"use client";

import { customerName } from "@/lib/erp/pack-records";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useErp } from "@/components/erp/store";
import type { ErpState } from "@/lib/erp/model";

type Hit = { kind: string; label: string; detail: string; href: string };

/** Everything findable by number or name, across modules. */
export function searchAll(state: ErpState, query: string): Hit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const has = (...values: (string | undefined)[]) => values.some((value) => value?.toLowerCase().includes(q));
  const hits: Hit[] = [];
  for (const project of state.projects) if (has(project.code, project.name)) hits.push({ kind: "Project", label: `${project.code} · ${project.name}`, detail: state.customers.find((item) => item.id === project.customerId)?.name ?? "", href: `/demo/projects/${project.id}` });
  for (const order of state.purchaseOrders) if (has(order.number)) hits.push({ kind: "Sales order", label: order.number, detail: state.projects.find((item) => item.id === order.projectId)?.code ?? "", href: `/demo/sales?project=${order.projectId}` });
  for (const customer of state.customers) if (has(customer.name, customer.contact)) hits.push({ kind: "Customer", label: customer.name, detail: customer.contact, href: "/demo/crm" });
  for (const part of state.parts) if (has(part.number, part.description)) hits.push({ kind: "Part", label: part.number, detail: part.description, href: "/demo/parts" });
  for (const doc of state.documents) if (has(doc.number, doc.name, doc.file?.name)) hits.push({ kind: "Document", label: `${doc.number} rev ${doc.revision}`, detail: doc.name, href: "/demo/documents" });
  for (const order of state.productionOrders) if (has(order.number)) hits.push({ kind: "Production order", label: order.number, detail: order.status, href: "/demo/shop-floor" });
  for (const order of state.supplierOrders) if (has(order.number, order.supplier)) hits.push({ kind: "Supplier order", label: order.number, detail: `${order.supplier} · ${order.status}`, href: "/demo/materials" });
  for (const supplier of state.suppliers) if (has(supplier.name, supplier.email)) hits.push({ kind: "Supplier", label: supplier.name, detail: supplier.email, href: "/demo/suppliers" });
  for (const material of state.rawMaterials) if (has(material.name)) hits.push({ kind: "Raw material", label: material.name, detail: `${material.stock} ${material.unit} in stock`, href: "/demo/raw-materials" });
  for (const product of state.products ?? []) if (has(product.sku, product.name, product.variant)) hits.push({ kind: "Product", label: `${product.name}${product.variant ? ` · ${product.variant}` : ""}`, detail: product.sku, href: "/demo/products" });
  for (const order of state.shopOrders ?? []) if (has(order.number, customerName(state, order.customerId))) hits.push({ kind: "Order", label: order.number, detail: `${customerName(state, order.customerId)} · ${order.status}`, href: "/demo/fulfilment" });
  for (const sub of state.subscriptions ?? []) if (has(customerName(state, sub.customerId))) hits.push({ kind: "Subscription", label: customerName(state, sub.customerId), detail: `${state.plans.find((plan) => plan.id === sub.planId)?.name ?? ""} × ${sub.seats} · ${sub.status}`, href: "/demo/subscriptions" });
  for (const ticket of state.tickets ?? []) if (has(ticket.number, ticket.subject)) hits.push({ kind: "Ticket", label: `${ticket.number} · ${ticket.subject}`, detail: `${customerName(state, ticket.customerId)} · ${ticket.status}`, href: "/demo/support" });
  for (const quote of state.quotations) if (has(quote.number, quote.customerName)) hits.push({ kind: "Quotation", label: quote.number, detail: `${quote.customerName} · ${quote.status}`, href: `/demo/quotations?id=${quote.id}` });
  for (const invoice of state.invoices) if (has(invoice.number)) hits.push({ kind: "Invoice", label: invoice.number, detail: invoice.paidAt ? "Paid" : "Open", href: "/demo/finance?view=invoices" });
  for (const bill of state.bills) if (has(bill.number, bill.supplier)) hits.push({ kind: "Bill", label: `${bill.supplier} ${bill.number}`, detail: bill.paidAt ? "Paid" : "Open", href: "/demo/finance?view=bills" });
  for (const employee of state.employees) if (has(employee.name, employee.code)) hits.push({ kind: "Person", label: `${employee.name} (${employee.code})`, detail: employee.role, href: "/demo/people" });
  for (const mail of state.emails) if (has(mail.subject, mail.fromName, mail.from)) hits.push({ kind: "Email", label: mail.subject, detail: mail.fromName || mail.from, href: `/demo/inbox?mail=${mail.id}${mail.folder === "sent" ? "&folder=sent" : ""}` });
  return hits.slice(0, 12);
}

export function GlobalSearch() {
  const state = useErp();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const hits = searchAll(state, query);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); input.current?.focus(); setOpen(true); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const go = (hit: Hit) => { setOpen(false); setQuery(""); router.push(hit.href); };
  return <div className="erp-global-search">
    <label className="erp-search"><Search size={15} /><input ref={input} aria-label="Search everything" placeholder="Search projects, parts, orders, emails…  Ctrl K" value={query}
      onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(0); }} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setActive(Math.min(active + 1, hits.length - 1)); } if (event.key === "ArrowUp") { event.preventDefault(); setActive(Math.max(active - 1, 0)); } if (event.key === "Enter" && hits[active]) go(hits[active]); if (event.key === "Escape") setOpen(false); }} /></label>
    {open && query.trim().length >= 2 && <ul className="erp-search-results" role="listbox" aria-label="Search results">
      {hits.length ? hits.map((hit, index) => <li key={`${hit.kind}-${hit.href}-${hit.label}`} role="option" aria-selected={index === active}><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => go(hit)}><small>{hit.kind}</small><b>{hit.label}</b><span>{hit.detail}</span></button></li>)
        : <li className="erp-faint" style={{ padding: 12 }}>Nothing found for “{query}”.</li>}
    </ul>}
  </div>;
}
