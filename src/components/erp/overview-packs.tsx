"use client";

import Link from "next/link";
import { Columns, CHART_COLORS } from "@/components/erp/charts";
import { CommerceFigures } from "@/components/erp/commerce-ui";
import { SaasFigures } from "@/components/erp/saas-ui";
import { todayIso } from "@/components/erp/store";
import { PageHead } from "@/components/erp/ui";
import { IndustrySwitch } from "@/components/erp/industry-switch";
import { alerts } from "@/lib/erp/alerts";
import { companyFinance } from "@/lib/erp/finance";
import { formatDate, formatMoney, recentActivity, type ErpState } from "@/lib/erp/model";
import { packOf } from "@/lib/erp/packs";

const monthLabel = (month: string) => new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));

/** Overview for the e-commerce and SaaS packs: what needs attention, the figures of that industry, money in and out. */
export function PackOverview({ state }: { state: ErpState }) {
  const today = todayIso();
  const pack = packOf(state);
  const alertList = alerts(state, today);
  const fin = companyFinance(state, today);
  const money = (value: number) => formatMoney(value, state.settings.defaultCurrency);
  return <>
    <PageHead eyebrow={pack.label} title="Overview" description={`What needs attention today at ${state.settings.companyName.replace(/ \(demo\)$/, "")}, and the figures behind it.`} actions={<IndustrySwitch compact />} />
    <section className="erp-card" aria-labelledby="ov-alerts">
      <div className="erp-card-head"><div><h2 id="ov-alerts">Needs attention</h2><p>{alertList.length ? `${alertList.length} item${alertList.length === 1 ? "" : "s"}, most urgent first.` : "Nothing urgent."}</p></div></div>
      {alertList.length ? <ul className="erp-alerts">{alertList.slice(0, 8).map((item) => <li key={item.id} className={`is-${item.tone}`}><span className="erp-alert-area">{item.area}</span><span>{item.text}</span><Link className="erp-btn erp-btn-sm" href={item.href}>{item.action}</Link></li>)}</ul> : <p className="erp-card-pad erp-ok-text">All clear.</p>}
    </section>
    <div style={{ marginTop: 16 }}>{pack.key === "commerce" ? <CommerceFigures state={state} /> : <SaasFigures state={state} />}</div>
    <div className="erp-grid-2" style={{ marginTop: 16 }}>
      <section className="erp-card erp-card-pad erp-stack"><h2 className="erp-chart-title">Revenue and costs by month</h2>
        <Columns label="Revenue and costs by month" categories={fin.months.map((row) => monthLabel(row.month))} series={[{ name: "Revenue (invoiced, net)", color: CHART_COLORS[2], values: fin.months.map((row) => row.revenue) }, { name: "Costs (bills + payroll)", color: CHART_COLORS[0], values: fin.months.map((row) => row.costs) }]} format={money} />
        <p className="erp-faint">To be paid to you {money(fin.receivable)}{fin.overdueReceivable ? ` (${money(fin.overdueReceivable)} overdue)` : ""} · to pay {money(fin.payable)}. <Link className="erp-link" href="/demo/finance">Finance</Link></p>
      </section>
      <section className="erp-card" aria-labelledby="ov-activity">
        <div className="erp-card-head"><div><h2 id="ov-activity">Recent activity</h2><p>Every change, newest first, with who made it.</p></div></div>
        <ol className="erp-activity">{recentActivity(state, null, 8).map((event) => <li key={event.id}><time dateTime={event.at}>{formatDate(event.at)}</time><span>{event.text}{event.user ? <small> · {event.user}</small> : null}</span></li>)}</ol>
      </section>
    </div>
  </>;
}
