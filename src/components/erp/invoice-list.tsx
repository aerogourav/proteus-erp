"use client";

import { useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { Stat } from "@/components/erp/charts";
import { commit, nowIso, todayIso } from "@/components/erp/store";
import { Badge, EmptyState, Rule } from "@/components/erp/ui";
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
  const columns = "minmax(0,1fr) minmax(0,1.6fr) minmax(0,1.8fr) 120px 130px 130px";
  return <>
    <section className="erp-kpis" aria-label="Invoice figures">
      <Stat label="Open" value={money(open.reduce((sum, invoice) => sum + invoice.total, 0))} note={`${open.length} invoice${open.length === 1 ? "" : "s"}, incl. tax`} />
      <Stat label="Overdue" value={money(overdue.reduce((sum, invoice) => sum + invoice.total, 0))} note={`${overdue.length} invoice${overdue.length === 1 ? "" : "s"}`} tone={overdue.length ? "bad" : undefined} />
      <Stat label="Invoiced this month" value={money(state.invoices.filter((invoice) => invoice.issuedAt.slice(0, 7) === today.slice(0, 7)).reduce((sum, invoice) => sum + invoice.subtotal, 0))} note="Net" />
      <Stat label="Paid, all time" value={money(state.invoices.filter((invoice) => invoice.paidAt).reduce((sum, invoice) => sum + invoice.total, 0))} />
    </section>
    <div className="erp-tabs" role="group" aria-label="Invoice filter" style={{ margin: "18px 0 16px" }}>
      {([["open", `Open (${open.length})`], ["overdue", `Overdue (${overdue.length})`], ["paid", "Paid"], ["all", "All"]] as [Filter, string][]).map(([key, label]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}
    </div>
    <section className="erp-card">
      {list.length ? <div className="erp-rows" role="table">
        <div className="erp-row erp-row-head" role="row" style={{ gridTemplateColumns: columns }}>{["Invoice", "Customer", "For", "Total", "Status", ""].map((label) => <span key={label} role="columnheader">{label}</span>)}</div>
        {list.slice(0, 100).map((invoice) => {
          const late = !invoice.paidAt && invoice.dueAt < today;
          return <div key={invoice.id} role="row" className="erp-row" style={{ gridTemplateColumns: columns }}>
            <span><strong>{invoice.number}</strong><small>{formatDate(invoice.issuedAt)}</small></span>
            <span>{customerName(state, invoice.customerId)}</span>
            <span className="erp-muted">{invoice.lines[0]?.description ?? "—"}{invoice.lines.length > 1 ? ` +${invoice.lines.length - 1}` : ""}</span>
            <span className="erp-num" style={{ textAlign: "left" }}><b>{money(invoice.total, invoice.currency)}</b></span>
            <span><Badge tone={invoice.paidAt ? "ok" : late ? "bad" : "warn"}>{invoice.paidAt ? "Paid" : late ? "Overdue" : "Open"}</Badge><small>{invoice.paidAt ? `Paid ${formatDate(invoice.paidAt)}` : `Due ${formatDate(invoice.dueAt)}`}</small></span>
            <span className="erp-head-actions">{invoice.paidAt
              ? <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => commit((value) => markInvoicePaid(value, invoice.id, false, nowIso()))}><RotateCcw size={13} /> Unpaid</button>
              : <button type="button" className="erp-btn erp-btn-sm" onClick={() => commit((value) => markInvoicePaid(value, invoice.id, true, nowIso()))}><CheckCircle2 size={13} /> Mark paid</button>}</span>
          </div>;
        })}
        {list.length > 100 && <p className="erp-faint" style={{ padding: "12px 20px" }}>Showing the latest 100 of {list.length}.</p>}
      </div> : <EmptyState title="No invoices here" text="Invoices are issued automatically when orders ship or subscriptions are billed." />}
    </section>
    <div style={{ marginTop: 14 }}><Rule>Invoices come from shipped orders and subscription billing runs. This is management information for the demo, not bookkeeping: there is no ledger or VAT return.</Rule></div>
  </>;
}
