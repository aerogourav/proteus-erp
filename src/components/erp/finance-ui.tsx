"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Download, Plus, Printer, Trash2, X } from "lucide-react";
import { BohMark } from "@/components/brand/boh-logo";
import { BarList, CHART_COLORS, Columns, Stat, StackedBar } from "@/components/erp/charts";
import { downloadBlob } from "@/components/erp/file-store";
import { BillDialog } from "@/components/erp/purchasing-ui";
import { commit, nowIso, todayIso } from "@/components/erp/store";
import { toast } from "@/components/erp/toast";
import { Badge, EmptyState, Modal, ProjectLink, Rule } from "@/components/erp/ui";
import { billOrderMismatch, companyFinance, deleteBill, lastMonths, markBillPaid, markPayslipPaid, payslipFigures, projectCosting, runPayroll, type BillInput } from "@/lib/erp/finance";
import { formatDate, formatMoney, type ErpState, type Payslip } from "@/lib/erp/model";

const monthLabel = (period: string) => new Date(`${period}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

/* ============================== Overview ============================== */

export function FinanceOverview({ state }: { state: ErpState }) {
  const today = todayIso();
  const [period, setPeriod] = useState(today.slice(0, 7));
  const fin = companyFinance(state, today, period);
  const money = (value: number) => formatMoney(value, state.settings.defaultCurrency);
  return <div className="erp-stack">
    <div className="erp-toolbar"><label className="erp-faint" htmlFor="fin-period">Profit and loss for</label>
      <select className="erp-select" id="fin-period" value={period} onChange={(event) => setPeriod(event.target.value)}>{lastMonths(today, 12).reverse().map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}<option value="all">All time</option></select>
    </div>
    <section className="erp-kpis erp-kpis-4" aria-label="Company figures">
      <Stat label="Revenue (invoiced, net)" value={money(fin.revenue)} note={period === "all" ? "All invoices" : monthLabel(period)} />
      <Stat label="Costs" value={money(fin.costs)} note={`Bills ${money(fin.costs - fin.payroll)} · payroll ${money(fin.payroll)}`} />
      <Stat label="Operating result" value={money(fin.result)} tone={fin.result < 0 ? "bad" : undefined} note="Revenue − bills − payroll" />
      <Stat label="Quotation pipeline" value={money(fin.pipeline)} note={`${fin.quotesOpen} open quotation${fin.quotesOpen === 1 ? "" : "s"}`} />
      <Stat label="Receivables" value={money(fin.receivable)} note={fin.overdueReceivable ? `${money(fin.overdueReceivable)} overdue` : "Nothing overdue"} tone={fin.overdueReceivable ? "bad" : undefined} />
      <Stat label="Payables" value={money(fin.payable)} note={fin.overduePayable ? `${money(fin.overduePayable)} overdue` : "Nothing overdue"} tone={fin.overduePayable ? "warn" : undefined} />
      <Stat label="Cash in / out" value={`${money(fin.cashIn)} / ${money(fin.cashOut)}`} note="Recorded payments, all time" />
      <Stat label="Labour logged" value={money(fin.labourLogged)} note="Shop floor time × cost rate" />
    </section>
    <div className="erp-grid-2">
      <section className="erp-card erp-card-pad erp-stack"><h2 className="erp-chart-title">Revenue and costs by month</h2>
        <Columns label="Revenue and costs by month" categories={fin.months.map((item) => monthLabel(item.month).slice(0, 3))} series={[{ name: "Revenue", color: CHART_COLORS[2], values: fin.months.map((item) => item.revenue) }, { name: "Costs", color: CHART_COLORS[0], values: fin.months.map((item) => item.costs) }]} format={money} /></section>
      <section className="erp-card erp-card-pad erp-stack"><h2 className="erp-chart-title">Costs by category</h2><p className="erp-faint">{period === "all" ? "All time" : monthLabel(period)}, net.</p>
        <BarList label="Costs by category" data={[...fin.costsByCategory.map((item) => ({ label: item.category, value: item.amount, display: money(item.amount), color: CHART_COLORS[1] })), ...(fin.payroll ? [{ label: "Payroll (employer cost)", value: fin.payroll, display: money(fin.payroll), color: CHART_COLORS[3] }] : [])].sort((a, b) => b.value - a.value)} empty="No costs in this period." />
        <StackedBar label="Open receivables and payables" data={[{ label: "Receivable", value: fin.receivable, display: money(fin.receivable), color: CHART_COLORS[2] }, { label: "Payable", value: fin.payable, display: money(fin.payable), color: CHART_COLORS[0] }]} empty="Nothing open." /></section>
    </div>
    <Rule>Amounts in other currencies are converted with the rates in Configuration. This is management information for the demo, not bookkeeping: there is no ledger, VAT return or bank reconciliation.</Rule>
  </div>;
}

/* ============================== Supplier bills ============================== */

export function BillsSection({ state }: { state: ErpState }) {
  const today = todayIso();
  const [editing, setEditing] = useState<{ id?: string; prefill: Partial<BillInput> } | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const bills = [...state.bills].filter((bill) => filter === "all" || !bill.paidAt).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const money = (value: number, currency = state.settings.defaultCurrency) => formatMoney(value, currency);
  const columns = "minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.6fr) minmax(0,.9fr) minmax(0,1fr) 230px";
  return <div className="erp-stack">
    <div className="erp-toolbar">
      <div className="erp-tabs" role="group" aria-label="Bills shown"><button type="button" aria-pressed={filter === "open"} onClick={() => setFilter("open")}>Open ({state.bills.filter((bill) => !bill.paidAt).length})</button><button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All ({state.bills.length})</button></div>
      <button type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={() => setEditing({ prefill: {} })}><Plus size={13} /> Record bill</button>
      <span className="erp-faint">Raw material bills come from supplier orders; invoices emailed by suppliers can be recorded from the Inbox.</span>
    </div>
    <section className="erp-card">{bills.length ? <div className="erp-rows" role="table">
      <div className="erp-row erp-row-head" role="row" style={{ gridTemplateColumns: columns }}>{["Supplier · invoice", "Category", "Description", "Total", "Due", ""].map((label) => <span key={label} role="columnheader">{label}</span>)}</div>
      {bills.map((bill) => {
        const overdue = !bill.paidAt && bill.dueDate < today;
        const project = bill.projectId ? state.projects.find((item) => item.id === bill.projectId) : null;
        const order = bill.supplierOrderId ? state.supplierOrders.find((item) => item.id === bill.supplierOrderId) : null;
        return <div key={bill.id} role="row" className="erp-row" style={{ gridTemplateColumns: columns }}>
          <span><strong>{bill.supplier}</strong><small>{bill.number} · {formatDate(bill.date)}</small></span>
          <span>{bill.category}{project && <ProjectLink id={project.id} code={project.code} />}</span>
          <span>{bill.description || "—"}{order && <small>{order.number}</small>}{billOrderMismatch(state, bill).map((warning) => <small key={warning} className="erp-error">{warning}</small>)}</span>
          <span className="erp-num" style={{ textAlign: "left" }}>{money(bill.total, bill.currency)}<small>net {money(bill.net, bill.currency)}</small></span>
          <span><Badge tone={bill.paidAt ? "ok" : overdue ? "bad" : "warn"}>{bill.paidAt ? "Paid" : overdue ? "Overdue" : "Open"}</Badge><small>{bill.paidAt ? `Paid ${formatDate(bill.paidAt)}` : `Due ${formatDate(bill.dueDate)}`}</small></span>
          <span className="erp-head-actions">
            <button type="button" className={`erp-btn erp-btn-sm${bill.paidAt ? "" : " erp-btn-primary"}`} onClick={() => commit((value) => markBillPaid(value, bill.id, !bill.paidAt, nowIso()))}>{bill.paidAt ? "Unpaid" : <><CheckCircle2 size={13} /> Paid</>}</button>
            {!bill.paidAt && <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => setEditing({ id: bill.id, prefill: {} })}>Edit</button>}
            {!bill.paidAt && <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" aria-label={`Remove bill ${bill.number}`} onClick={() => commit((value) => deleteBill(value, bill.id, nowIso()))}><Trash2 size={13} /></button>}
          </span>
        </div>;
      })}
    </div> : <EmptyState title={filter === "open" ? "No open bills" : "No bills yet"} text="Record raw material bills, subcontracting, tooling, rent and other costs here." />}</section>
    {editing && <BillDialog prefill={editing.prefill} billId={editing.id} onClose={() => setEditing(null)} />}
  </div>;
}

/* ============================== Payroll ============================== */

export function PayrollSection({ state }: { state: ErpState }) {
  const today = todayIso();
  const months = lastMonths(today, 6).reverse();
  const [period, setPeriod] = useState(months[0]);
  const [printing, setPrinting] = useState<Payslip | null>(null);
  const slips = state.payslips.filter((slip) => slip.period === period);
  const money = (value: number) => formatMoney(value, state.settings.defaultCurrency);
  const pending = state.employees.filter((employee) => employee.active && !slips.some((slip) => slip.employeeId === employee.id));
  const { incomeTaxPct, socialPct, employerPct } = state.settings.payroll;
  const columns = "minmax(0,1.6fr) minmax(0,.7fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 190px";
  const exportCsv = () => {
    const rows = [["Slip", "Employee ID", "Name", "Period", "Hours", "Gross", "Income tax", "Social", "Net", "Employer cost", "Paid"], ...slips.map((slip) => { const employee = state.employees.find((item) => item.id === slip.employeeId); return [slip.number, employee?.code ?? "", employee?.name ?? "", slip.period, String(slip.hours), String(slip.gross), String(slip.incomeTax), String(slip.social), String(slip.net), String(slip.employerCost), slip.paidAt ?? ""]; })];
    downloadBlob(rows.map((row) => row.map((cell) => (/[",]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(",")).join("\r\n"), `payroll-${period}.csv`, "text/csv;charset=utf-8");
  };
  return <div className="erp-stack">
    <div className="erp-toolbar">
      <select className="erp-select" aria-label="Month" value={period} onChange={(event) => setPeriod(event.target.value)}>{months.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}</select>
      <button type="button" className="erp-btn erp-btn-primary erp-btn-sm" disabled={!pending.length} onClick={() => { const ok = commit((value) => runPayroll(value, period, nowIso())); toast(ok ? `Salary slips for ${monthLabel(period)} issued.` : "No slips to issue: salaried staff are done and hourly staff have no logged hours.", { tone: ok ? "ok" : "info" }); }}>Run payroll for {monthLabel(period)}{pending.length ? ` (${pending.length})` : ""}</button>
      {slips.some((slip) => !slip.paidAt) && <button type="button" className="erp-btn erp-btn-sm" onClick={() => commit((value) => slips.filter((slip) => !slip.paidAt).reduce((next, slip) => markPayslipPaid(next, slip.id, true, nowIso()), value))}><CheckCircle2 size={13} /> Mark all paid</button>}
      <button type="button" className="erp-btn erp-btn-sm" disabled={!slips.length} onClick={exportCsv}><Download size={13} /> Export CSV</button>
    </div>
    <section className="erp-kpis erp-kpis-4" aria-label="Payroll figures">
      <Stat label="Gross" value={money(slips.reduce((sum, slip) => sum + slip.gross, 0))} note={`${slips.length} slip${slips.length === 1 ? "" : "s"}`} />
      <Stat label="Net paid out" value={money(slips.reduce((sum, slip) => sum + slip.net, 0))} />
      <Stat label="Tax and social" value={money(slips.reduce((sum, slip) => sum + slip.incomeTax + slip.social, 0))} note={`${incomeTaxPct}% + ${socialPct}% (illustrative)`} />
      <Stat label="Employer cost" value={money(slips.reduce((sum, slip) => sum + slip.employerCost, 0))} note={`Gross + ${employerPct}%`} />
    </section>
    <section className="erp-card">{slips.length ? <div className="erp-rows" role="table">
      <div className="erp-row erp-row-head" role="row" style={{ gridTemplateColumns: columns }}>{["Employee", "Hours", "Gross", "Deductions", "Net", "Status", ""].map((label) => <span key={label} role="columnheader">{label}</span>)}</div>
      {slips.map((slip) => { const employee = state.employees.find((item) => item.id === slip.employeeId); return <div key={slip.id} role="row" className="erp-row" style={{ gridTemplateColumns: columns }}>
        <span><strong>{employee?.name}</strong><small>{employee?.code} · {slip.number}</small></span>
        <span>{slip.hours ? slip.hours.toFixed(1) : "—"}</span>
        <span className="erp-num" style={{ textAlign: "left" }}>{money(slip.gross)}</span>
        <span className="erp-num" style={{ textAlign: "left" }}>{money(slip.incomeTax + slip.social)}</span>
        <span className="erp-num" style={{ textAlign: "left" }}><b>{money(slip.net)}</b></span>
        <span><Badge tone={slip.paidAt ? "ok" : "warn"}>{slip.paidAt ? "Paid" : "To pay"}</Badge></span>
        <span className="erp-head-actions"><button type="button" className="erp-btn erp-btn-sm" onClick={() => setPrinting(slip)}><Printer size={13} /> Slip</button><button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => commit((value) => markPayslipPaid(value, slip.id, !slip.paidAt, nowIso()))}>{slip.paidAt ? "Unpaid" : "Paid"}</button></span>
      </div>; })}
    </div> : <EmptyState title={`No salary slips for ${monthLabel(period)}`} text="Run payroll: salaried staff get their monthly salary, hourly staff their logged shop-floor hours × rate." />}</section>
    <Rule>Payroll here is illustrative: flat percentages from Configuration, no tax classes, allowances or statutory reporting. Real payroll in Germany needs a certified payroll system or tax adviser.</Rule>
    {printing && <PayslipPrint state={state} slip={printing} onClose={() => setPrinting(null)} />}
  </div>;
}

function PayslipPrint({ state, slip, onClose }: { state: ErpState; slip: Payslip; onClose: () => void }) {
  const employee = state.employees.find((item) => item.id === slip.employeeId);
  const money = (value: number) => formatMoney(value, state.settings.defaultCurrency);
  const { incomeTaxPct, socialPct, employerPct } = state.settings.payroll;
  const check = payslipFigures(state, slip.gross);
  return <Modal label={`Salary slip ${slip.number}`} wide onClose={onClose}>
    <div className="erp-dialog-bar"><h2>Salary slip</h2><div className="erp-head-actions"><button type="button" className="erp-btn erp-btn-sm" onClick={() => window.print()}><Printer size={14} /> Print / save as PDF</button><button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={onClose}><X size={14} /> Close</button></div></div>
    <article className="erp-doc erp-print">
      <div className="erp-doc-top"><div className="erp-doc-brand"><BohMark size={30} /><span>{state.settings.companyName}</span></div><div className="erp-doc-title"><h1>Salary slip</h1><span>{slip.number}</span></div></div>
      <span className="erp-doc-stamp">ILLUSTRATIVE DEMO DOCUMENT · FICTIONAL DATA · NOT A LEGAL PAYSLIP</span>
      <div className="erp-doc-meta">{([["Employee", employee?.name ?? ""], ["Employee ID", employee?.code ?? ""], ["Role", employee?.role ?? ""], ["Period", monthLabel(slip.period)], ["Pay basis", employee?.pay === "hourly" ? `${slip.hours.toFixed(1)} h × ${money(employee.hourlyRate)}` : "Monthly salary"], ["Issued", formatDate(slip.issuedAt)]] as [string, string][]).map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</div>
      <table><thead><tr><th>Item</th><th className="r">Rate</th><th className="r">Amount</th></tr></thead><tbody>
        <tr><td>Gross pay</td><td className="r">—</td><td className="r">{money(slip.gross)}</td></tr>
        <tr><td>Income tax (illustrative)</td><td className="r">{incomeTaxPct}%</td><td className="r">− {money(slip.incomeTax)}</td></tr>
        <tr><td>Social insurance, employee share (illustrative)</td><td className="r">{socialPct}%</td><td className="r">− {money(slip.social)}</td></tr>
      </tbody><tfoot><tr><td colSpan={2}>Net pay</td><td className="r">{money(slip.net)}</td></tr><tr><td colSpan={2}>Employer cost (gross + {employerPct}%)</td><td className="r">{money(slip.employerCost)}</td></tr></tfoot></table>
      {check.net !== slip.net && <p style={{ marginTop: 10, color: "#6B7280" }}>Rates changed since this slip was issued; amounts shown as issued.</p>}
      <p className="erp-doc-foot">{slip.paidAt ? `Paid on ${formatDate(slip.paidAt)}.` : "Not yet paid."} Generated by the BOH ERP demo.</p>
    </article>
  </Modal>;
}

/* ============================== Project costing ============================== */

export function CostingSection({ state }: { state: ErpState }) {
  const money = (value: number) => formatMoney(value, state.settings.defaultCurrency);
  const rows = state.projects.map((project) => ({ project, ...projectCosting(state, project.id) }));
  const columns = "minmax(0,1.6fr) repeat(5,minmax(0,1fr)) minmax(0,1fr)";
  return <div className="erp-stack">
    <section className="erp-card"><div className="erp-card-head"><div><h2>Project costing</h2><p>Order value against material (unit costs), labour (shop-floor log × cost rate) and external bills booked to the project.</p></div></div>
      {rows.length ? <div className="erp-rows" role="table">
        <div className="erp-row erp-row-head" role="row" style={{ gridTemplateColumns: columns }}>{["Project", "Order value", "Material", "Labour", "External", "Total cost", "Margin"].map((label) => <span key={label} role="columnheader">{label}</span>)}</div>
        {rows.map((row) => <div key={row.project.id} role="row" className="erp-row" style={{ gridTemplateColumns: columns }}>
          <span><ProjectLink id={row.project.id} code={row.project.code} /><small>{row.project.name}</small></span>
          <span className="erp-num" style={{ textAlign: "left" }}>{money(row.orderValue)}</span>
          <span className="erp-num" style={{ textAlign: "left" }}>{money(row.material)}</span>
          <span className="erp-num" style={{ textAlign: "left" }}>{money(row.labour)}</span>
          <span className="erp-num" style={{ textAlign: "left" }}>{money(row.external)}</span>
          <span className="erp-num" style={{ textAlign: "left" }}>{money(row.cost)}</span>
          <span className="erp-num" style={{ textAlign: "left" }}><b>{money(row.margin)}</b>{row.marginPct !== null && <small>{row.marginPct}%</small>}</span>
        </div>)}
      </div> : <EmptyState title="No projects" text="Projects appear here with their costs." />}
    </section>
    <div className="erp-grid-2">
      <section className="erp-card erp-card-pad erp-stack"><h2 className="erp-chart-title">Cost breakdown by project</h2>
        <Columns label="Cost breakdown by project" categories={rows.map((row) => row.project.code.replace(/^BOH-PRJ-/, ""))} series={[{ name: "Material", color: CHART_COLORS[1], values: rows.map((row) => row.material) }, { name: "Labour", color: CHART_COLORS[0], values: rows.map((row) => row.labour) }, { name: "External", color: CHART_COLORS[3], values: rows.map((row) => row.external) }]} format={money} /></section>
      <section className="erp-card erp-card-pad erp-stack"><h2 className="erp-chart-title">Margin by project</h2>
        <BarList label="Margin by project" data={rows.filter((row) => row.margin > 0).map((row) => ({ label: row.project.code, value: row.margin, display: money(row.margin), note: `${row.marginPct ?? 0}% of order value`, color: CHART_COLORS[2] }))} /></section>
    </div>
    <Rule>Overheads per hour can be added in Configuration so labour is priced at full cost. <Link className="erp-link" href="/demo/shop-floor?view=kpi">Shop floor KPIs</Link> show where time goes.</Rule>
  </div>;
}
