"use client";

import { Badge, EmptyState } from "@/components/erp/ui";
import { isOpen, orderValue } from "@/lib/erp/commerce";
import { formatDate, formatMoney, type ErpState } from "@/lib/erp/model";
import { industryOf } from "@/lib/erp/packs";
import { mrrOf, planOf } from "@/lib/erp/saas";

/** The customer list for e-commerce and SaaS: one row per customer with what they buy and what they are worth. */
export function PackCustomers({ state }: { state: ErpState }) {
  const industry = industryOf(state);
  const money = (value: number) => formatMoney(value, state.settings.defaultCurrency);
  const rows = state.customers.map((customer) => {
    if (industry === "commerce") {
      const orders = state.shopOrders.filter((order) => order.customerId === customer.id);
      const value = orders.filter((order) => order.status !== "Returned" && order.status !== "Cancelled").reduce((sum, order) => sum + orderValue(order), 0);
      const last = orders.map((order) => order.createdAt).sort().at(-1);
      const channel = orders.at(-1)?.channel ?? "—";
      return { customer, sort: value, cells: [orders.length ? String(orders.length) : "—", money(value), last ? formatDate(last) : "—"], badge: channel, open: orders.filter(isOpen).length };
    }
    const sub = state.subscriptions.find((item) => item.customerId === customer.id);
    const tickets = state.tickets.filter((ticket) => ticket.customerId === customer.id && ticket.status !== "Solved").length;
    const mrr = sub ? mrrOf(state, sub) : 0;
    return { customer, sort: mrr, cells: [sub ? `${planOf(state, sub.planId)?.name ?? ""} × ${sub.seats}` : "—", money(mrr), tickets ? String(tickets) : "—"], badge: sub?.status ?? "No subscription", open: 0 };
  }).sort((a, b) => b.sort - a.sort);
  const head = industry === "commerce" ? ["Customer", "Orders", "Revenue", "Last order", "Last channel"] : ["Customer", "Plan", "MRR", "Open tickets", "Status"];
  const columns = "minmax(0,2fr) minmax(0,1fr) 120px 120px 150px";
  return <section className="erp-card">
    {rows.length ? <div className="erp-rows" role="table">
      <div className="erp-row erp-row-head" role="row" style={{ gridTemplateColumns: columns }}>{head.map((label) => <span key={label} role="columnheader">{label}</span>)}</div>
      {rows.map((row) => <div key={row.customer.id} role="row" className="erp-row" style={{ gridTemplateColumns: columns }}>
        <span><strong>{row.customer.name}</strong><small>{row.customer.contact || `Customer since ${formatDate(row.customer.createdAt)}`}{row.open ? ` · ${row.open} open order${row.open === 1 ? "" : "s"}` : ""}</small></span>
        {row.cells.map((cell, index) => <span key={index} className={index === 1 ? "erp-num" : undefined} style={index === 1 ? { textAlign: "left" } : undefined}>{cell}</span>)}
        <span><Badge tone={row.badge === "Active" ? "ok" : row.badge === "Past due" ? "bad" : row.badge === "Trial" ? "info" : row.badge === "Wholesale" ? "warn" : "neutral"}>{row.badge}</Badge></span>
      </div>)}
    </div> : <EmptyState title="No customers yet" text="Customers appear when orders or subscriptions are added." />}
  </section>;
}
