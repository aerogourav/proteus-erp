"use client";

import { useState } from "react";
import { Plus, UserCheck } from "lucide-react";
import { Stat } from "@/components/erp/charts";
import { EditButton, NOT_SAVED, useEditor } from "@/components/erp/edit";
import { Loading } from "@/components/erp/modules";
import { duration } from "@/components/erp/shopfloor";
import { commit, nowIso, todayIso, useErp, useHydrated } from "@/components/erp/store";
import { Badge, EmptyState, PageHead, Rule } from "@/components/erp/ui";
import { formatDate, formatMoney, type Employee, type ErpState } from "@/lib/erp/model";
import { kpiSummary, nextEmployeeCode, saveEmployee, setCurrentUser } from "@/lib/erp/shopfloor";

export function PeopleModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const editor = useEditor();
  const [showInactive, setShowInactive] = useState(false);
  const head = <PageHead eyebrow="Team" title="People" description="Employees with employee ID, role, pay and cost rate. The shop floor log, the audit trail, payroll and labour cost all use these records." actions={<button type="button" className="erp-btn erp-btn-primary" onClick={() => openEmployee(state, editor.open, null)}><Plus size={15} /> Add employee</button>} />;
  if (!hydrated) return <>{head}<Loading /></>;
  const today = todayIso();
  const month = today.slice(0, 7);
  const people = state.employees.filter((item) => showInactive || item.active);
  const kpi = kpiSummary(state, { from: `${month}-01` }, today);
  const columns = "minmax(0,1.6fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr) 190px";
  return <>{head}
    <section className="erp-kpis" aria-label="Team figures">
      <Stat label="Active employees" value={state.employees.filter((item) => item.active).length} />
      <Stat label="Monthly salaries" value={formatMoney(state.employees.filter((item) => item.active && item.pay === "salary").reduce((sum, item) => sum + item.monthlySalary, 0), state.settings.defaultCurrency)} note="Gross, salaried staff" />
      <Stat label="Hours logged this month" value={(kpi.minutes / 60).toFixed(1)} note="From the shop floor log" />
      <Stat label="Signed in as" value={state.employees.find((item) => item.id === state.currentUserId)?.name ?? "Nobody"} note="Change it in the menu" />
    </section>
    <section className="erp-card" style={{ marginTop: 16 }}>
      <div className="erp-card-head"><div><h2>Employees</h2><p>Use “Sign in as” to act as someone: approvals and log entries carry their name and ID.</p></div><label className="erp-check"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} /> Show inactive</label></div>
      {people.length ? <div className="erp-rows" role="table">
        <div className="erp-row erp-row-head" role="row" style={{ gridTemplateColumns: columns }}>{["Employee", "Role", "Pay", "Cost rate", "This month", ""].map((label) => <span key={label} role="columnheader">{label}</span>)}</div>
        {people.map((employee) => {
          const row = kpi.byEmployee.find((item) => item.key === employee.id);
          const current = state.currentUserId === employee.id;
          return <div key={employee.id} role="row" className="erp-row" style={{ gridTemplateColumns: columns }}>
            <span><strong>{employee.name}</strong><small>{employee.code}{employee.email ? ` · ${employee.email}` : ""}</small></span>
            <span>{employee.role}<small>{employee.department} · since {formatDate(employee.joinedAt)}</small></span>
            <span>{employee.pay === "salary" ? `${formatMoney(employee.monthlySalary, state.settings.defaultCurrency)} / month` : "Hourly"}</span>
            <span>{formatMoney(employee.hourlyRate, state.settings.defaultCurrency)} / h</span>
            <span>{row ? `${duration(row.minutes)} · ${row.operations} ops` : "—"}{!employee.active && <Badge tone="bad">Inactive</Badge>}</span>
            <span className="erp-head-actions">
              {current ? <Badge tone="ok">Signed in</Badge> : <button type="button" className="erp-btn erp-btn-sm" disabled={!employee.active} onClick={() => commit((value) => setCurrentUser(value, employee.id))}><UserCheck size={13} /> Sign in as</button>}
              <EditButton onClick={() => openEmployee(state, editor.open, employee)} />
            </span>
          </div>;
        })}
      </div> : <EmptyState title="No employees yet" text="Add your team to log shop-floor operations and run payroll." />}
    </section>
    <div style={{ marginTop: 14 }}><Rule>The cost rate (per hour) prices logged shop-floor time in project costing. Salary or hourly pay drives the salary slips in Finance → Payroll.</Rule></div>
    {editor.dialog}
  </>;
}

function openEmployee(state: ErpState, open: ReturnType<typeof useEditor>["open"], employee: Employee | null) {
  open({
    title: employee ? `Edit ${employee.name}` : "Add employee",
    fields: [
      { key: "name", label: "Name", required: true }, { key: "code", label: "Employee ID", required: true, help: "Letters, digits and hyphens, e.g. E-1008." },
      { key: "role", label: "Role" }, { key: "department", label: "Department", type: "select", options: ["Production", "Quality", "Purchasing", "Sales", "Engineering", "Finance", "Management", "Logistics"] },
      { key: "email", label: "Email (optional)" }, { key: "pay", label: "Pay", type: "select", options: ["Monthly salary", "Hourly"] },
      { key: "monthlySalary", label: `Monthly gross salary (${state.settings.defaultCurrency})`, type: "number", help: "Used when pay is a monthly salary." },
      { key: "hourlyRate", label: `Cost rate per hour (${state.settings.defaultCurrency})`, type: "number", help: "Prices logged time; also the hourly wage for hourly staff." },
      { key: "active", label: "Status", type: "select", options: ["Active", "Inactive"] },
    ],
    initial: { name: employee?.name ?? "", code: employee?.code ?? nextEmployeeCode(state), role: employee?.role ?? "", department: employee?.department ?? "Production", email: employee?.email ?? "", pay: employee?.pay === "hourly" ? "Hourly" : "Monthly salary", monthlySalary: String(employee?.monthlySalary ?? 0), hourlyRate: String(employee?.hourlyRate ?? 30), active: employee && !employee.active ? "Inactive" : "Active" },
    onSave: (v) => commit((value) => saveEmployee(value, employee?.id ?? null, { name: v.name, code: v.code, role: v.role, department: v.department, email: v.email, pay: v.pay === "Hourly" ? "hourly" : "salary", monthlySalary: Number(v.monthlySalary.replace(",", ".")) || 0, hourlyRate: Number(v.hourlyRate.replace(",", ".")) || 0, active: v.active === "Active" }, nowIso())) ? null : `${NOT_SAVED} Employee IDs must be unique.`,
  });
}
