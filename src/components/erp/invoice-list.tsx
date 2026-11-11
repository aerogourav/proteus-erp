"use client";

import { useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { Stat } from "@/components/erp/charts";
import { commit, nowIso, todayIso } from "@/components/erp/store";
import { Badge, EmptyState, Rule } from "@/components/erp/ui";
import { DataTable, type Column } from "@/components/erp/data-table";
import { customerName } from "@/lib/erp/pack-records";
import { formatDate, formatMoney, markInvoicePaid, type ErpState } from "@/lib/erp/model";

type Filter = "open" | "overdue" | "paid" | "all";

/** Customer invoices for industries that invoice orders or subscriptions rather than projects. */
export function InvoiceList({ state }: { state: ErpState }) {
  const [filter, setFilter] = useState<Filter>("open");
  const today = todayIso();
  const money = (value: number, currency = state.settings.defaultCurrency) => formatMoney(value, currency);
  const open = state.invoices.filter((invoice) => !invoice.paidAt);
  const overdue = open.filter((invoice) => invoice.dueAt < today);
  const list = (filter === "open" ? open : filter === "overdue" ? overdue : filter === "paid" ? state.invoices.filter((invoice) => invoice.paidAt) : state.invoices)
    .slice().sort((a, b) => b.issuedAt.localeCompare(a.issuedAt) || b.number.localeCompare(a.number));
  type Invoice = ErpState["invoices"][number];
  const isLate = (invoice: Invoice) => !invoice.paidAt && invoice.dueAt < today;
  const statusRank = (invoice: Invoice) => invoice.paidAt ? 2 : isLate(invoice) ? 0 : 1;
  const columns: Column<Invoice>[] = [
    { key: "number", header: "Invoice", sort: (a, b) => a.issuedAt.localeCompare(b.issuedAt) || a.number.localeCompare(b.number), render: (invoice) => <><strong>{invoice.number}</strong><small className="erp-faint" style={{ display: "block", fontSize: 12 }}>{formatDate(invoice.issuedAt)}</small></> },
    { key: "customer", header: "Customer", sort: (a, b) => customerName(state, a.customerId).localeCompare(customerName(state, b.customerId)), render: (invoice) => customerName(state, invoice.customerId) },
    { key: "for", header: "For", render: (invoice) => <span className="erp-muted">{invoice.lines[0]?.description ?? "—"}{invoice.lines.length > 1 ? ` +${invoice.lines.length - 1}` : ""}</span> },
    { key: "total", header: "Total", align: "right", width: "130px", sort: (a, b) => a.total - b.total, render: (invoice) => <b>{money(invoice.total, invoice.currency)}</b> },
    { key: "status", header: "Status", width: "150px", sort: (a, b) => statusRank(a) - statusRank(b) || a.dueAt.localeCompare(b.dueAt), render: (invoice) => <span className="erp-status-cell"><Badge tone={invoice.paidAt ? "ok" : isLate(invoice) ? "bad" : "warn"}>{invoice.paidAt ? "Paid" : isLate(invoice) ? "Overdue" : "Open"}</Badge><small className="erp-faint">{invoice.paidAt ? `Paid ${formatDate(invoice.paidAt)}` : `Due ${formatDate(invoice.dueAt)}`}</small></span> },
    { key: "actions", header: "", width: "120px", render: (invoice) => <span className="erp-head-actions" style={{ justifyContent: "flex-end" }}>{invoice.paidAt
      ? <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => commit((value) => markInvoicePaid(value, invoice.id, false, nowIso()))}><RotateCcw size={13} /> Unpaid</button>
      : <button type="button" className="erp-btn erp-btn-sm" onClick={() => commit((value) => markInvoicePaid(value, invoice.id, true, nowIso()))}><CheckCircle2 size={13} /> Mark paid</button>}</span> },
  ];
  const markPaid = (selected: Invoice[], clear: () => void) => {
    const ids = selected.filter((invoice) => !invoice.paidAt).map((invoice) => invoice.id);
    commit((value) => ids.reduce((next, id) => markInvoicePaid(next, id, true, nowIso()), value));
    clear();
  };
  return <>
    <section className="erp-kpis" aria-label="Invoice figures">
      <Stat label="Open" value={money(open.reduce((sum, invoice) => sum + invoice.total, 0))} note={`${open.length} invoice${open.length === 1 ? "" : "s"}, incl. tax`} />
      <Stat label="Overdue" value={money(overdue.reduce((sum, invoice) => sum + invoice.total, 0))} note={`${overdue.length} invoice${overdue.length === 1 ? "" : "s"}`} tone={overdue.length ? "bad" : undefined} />
      <Stat label="Invoiced this month" value={money(state.invoices.filter((invoice) => invoice.issuedAt.slice(0, 7) === today.slice(0, 7)).reduce((sum, invoice) => sum + invoice.subtotal, 0))} note="Net" />
      <Stat label="Paid, all time" value={money(state.invoices.filter((invoice) => invoice.paidAt).reduce((sum, invoice) => sum + invoice.total, 0))} />
    </section>
    <div style={{ marginTop: 20 }}>
      <DataTable label="Customer invoices" rows={list} rowKey={(invoice) => invoice.id} columns={columns}
        search={(invoice, q) => `${invoice.number} ${customerName(state, invoice.customerId)} ${invoice.lines.map((line) => line.description).join(" ")}`.toLowerCase().includes(q)}
        searchPlaceholder="Search invoice, customer or item…"
        toolbar={<div className="erp-tabs" role="group" aria-label="Invoice filter">
          {([["open", `Open (${open.length})`], ["overdue", `Overdue (${overdue.length})`], ["paid", "Paid"], ["all", "All"]] as [Filter, string][]).map(([key, label]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}
        </div>}
        bulkActions={(selected, clear) => selected.some((invoice) => !invoice.paidAt) && <button type="button" className="erp-btn erp-btn-sm" onClick={() => markPaid(selected, clear)}><CheckCircle2 size={13} /> Mark {selected.filter((invoice) => !invoice.paidAt).length} paid</button>}
        empty={<EmptyState title="No invoices here" text="Invoices are issued automatically when orders ship or subscriptions are billed." />} />
    </div>
    <div style={{ marginTop: 14 }}><Rule>Invoices come from shipped orders and subscription billing runs. This is management information for the demo, not bookkeeping: there is no ledger or VAT return.</Rule></div>
  </>;
}
