"use client";

import { IndustryCards } from "@/components/erp/industry-switch";
import { InvoiceList } from "@/components/erp/invoice-list";
import { industryOf } from "@/lib/erp/packs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Download, Eye, EyeOff, Mail, Plus, Printer, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { SupplierOrderDialog, type OrderPrefill } from "@/components/erp/purchasing-ui";
import { BarList, CHART_COLORS, Columns, StackedBar, Stat } from "@/components/erp/charts";
import { CustomValuesView, EditButton, customEditFields, customInitial, pickCustom, useEditor } from "@/components/erp/edit";
import { FilterBar, Loading, NoProjects, OutputState, Rows, num, projectOf, save, useProjectFilter } from "@/components/erp/modules";
import { OutputDialog } from "@/components/erp/outputs";
import { BillsSection, CostingSection, FinanceOverview, PayrollSection } from "@/components/erp/finance-ui";
import { commit, nowIso, replaceState, resetDemo, todayIso, useErp, useHydrated } from "@/components/erp/store";
import { clearStoredFiles, downloadBlob } from "@/components/erp/file-store";
import { Badge, EmptyState, Field, PageHead, ProjectLink, Rule } from "@/components/erp/ui";
import {
  CURRENCIES, CUSTOM_ENTITIES, DOC_TYPES, RULES, UNITS, WIDGET_LABELS, addCustomField, addDocType, customFieldsFor, docTypes, financeSummary, formatDate,
  formatMoney, generateInvoice, markInvoicePaid, cancelInvoice, moveTab, moveWidget, parseStoredState, rawMaterialRows, rawMaterialStats, readiness, removeCustomField, removeDocType,
  resetLayout, saveRawMaterial, saveSupplier, supplierRows, supplierStats, updateSettings, updateTab, updateUi, updateWidget, upsertSupplier,
  type Currency, type CustomEntity, type CustomFieldType, type ErpState, type RawMaterial, type Supplier, type UiSettings,
} from "@/lib/erp/model";

const money = (state: ErpState, value: number, currency?: Currency) => formatMoney(value, currency ?? state.settings.defaultCurrency);

/* ============================== Raw materials ============================== */

export function RawMaterialsModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const editor = useEditor();
  const [ordering, setOrdering] = useState<OrderPrefill | null>(null);
  const add = <button type="button" className="erp-btn erp-btn-primary" onClick={() => openMaterial(state, editor.open, null)}><Plus size={15} /> Add raw material</button>;
  const head = <PageHead eyebrow="Operations" title="Raw materials" description="Stock, reorder levels, unit costs and preferred suppliers. Demand comes from the material of every part; received purchases add to stock." actions={add} />;
  if (!hydrated) return <>{head}<Loading /></>;
  const rows = rawMaterialRows(state);
  if (!rows.length) return <>{head}<div className="erp-card"><EmptyState title="No raw materials yet" text="They appear automatically when a part needs material, or add one yourself." /></div>{editor.dialog}</>;
  const stats = rows.map((material) => ({ material, ...rawMaterialStats(state, material) }));
  const low = stats.filter((item) => item.lowStock).length;
  const stockValue = stats.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const columns = "minmax(0,1.6fr) minmax(0,1fr) minmax(0,.9fr) minmax(0,1.1fr) minmax(0,1.6fr) 170px";
  return <>{head}
    <section className="erp-kpis" aria-label="Raw material figures">
      <Stat label="Materials" value={rows.length} note={`${state.rawMaterials.length} with saved details`} />
      <Stat label="Below reorder level" value={low} note={low ? "Order soon" : "All above reorder level"} tone={low ? "warn" : undefined} />
      <Stat label="Stock value" value={money(state, stockValue)} note="Stock × unit cost" />
      <Stat label="To buy" value={stats.filter((item) => item.toBuy > 0).length} note="Materials with unordered demand" />
    </section>
    <div className="erp-grid-2" style={{ marginTop: 16 }}>
      <section className="erp-card erp-card-pad erp-stack"><h2 className="erp-chart-title">Open demand by material</h2><p className="erp-faint">To buy plus on order, in each material’s unit.</p>
        <BarList label="Open demand by material" data={stats.filter((item) => item.toBuy + item.onOrder > 0).map((item) => ({ label: item.material.name, value: item.toBuy + item.onOrder, display: `${item.toBuy + item.onOrder} ${item.material.unit}`, note: `${item.toBuy} to buy · ${item.onOrder} on order`, color: CHART_COLORS[1] }))} empty="No open demand." /></section>
      <section className="erp-card erp-card-pad erp-stack"><h2 className="erp-chart-title">Stock on hand</h2><p className="erp-faint">Orange bars are below their reorder level.</p>
        <BarList label="Stock on hand" data={stats.filter((item) => item.material.stock > 0).map((item) => ({ label: item.material.name, value: item.material.stock, display: `${item.material.stock} ${item.material.unit}`, note: item.lowStock ? `below reorder level ${item.material.reorderLevel}` : undefined, color: item.lowStock ? CHART_COLORS[3] : CHART_COLORS[2] }))} empty="No stock booked yet. Receiving a purchase adds stock." /></section>
    </div>
    <section className="erp-card" style={{ marginTop: 16 }}><Rows columns={columns} head={["Material", "Stock", "Unit cost", "Supplier", "Demand", ""]}>
      {stats.map(({ material, toBuy, onOrder, received, projects, supplier, lowStock }) => <div key={material.id} role="row" className="erp-row" style={{ gridTemplateColumns: columns }}>
        <span><strong>{material.name}</strong><small>{projects.length} project{projects.length === 1 ? "" : "s"}</small><CustomValuesView state={state} entity="rawMaterial" custom={material.custom} /></span>
        <span>{material.stock} {material.unit}{lowStock ? <Badge tone="warn">{`Below ${material.reorderLevel}`}</Badge> : material.reorderLevel ? <small>Reorder at {material.reorderLevel}</small> : null}</span>
        <span>{material.unitCost !== null ? `${money(state, material.unitCost)} / ${material.unit}` : <small>Not set</small>}</span>
        <span>{supplier ?? <small>Not set</small>}</span>
        <span><small>To buy {toBuy} · On order {onOrder} · Received {received}</small></span>
        <span className="erp-head-actions">{(lowStock || toBuy > 0) && <button type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={() => { const supplierRecord = material.supplierId ? state.suppliers.find((item) => item.id === material.supplierId) : null; const reqs = state.materialRequirements.filter((req) => req.material.toLowerCase() === material.name.toLowerCase() && state.procurement.find((record) => record.requirementId === req.id)?.status === "Not ordered"); setOrdering({ supplier: supplierRecord?.name ?? supplier ?? "", email: supplierRecord?.email ?? "", lines: [{ material: material.name, quantity: Math.max(toBuy + (lowStock ? Math.max(0, material.reorderLevel * 2 - material.stock - onOrder) : 0), 1), unit: material.unit, unitPrice: material.unitCost, requirementIds: reqs.map((req) => req.id) }] }); }}><Mail size={13} /> Order</button>}<EditButton onClick={() => openMaterial(state, editor.open, material)} /></span>
      </div>)}
    </Rows></section>
    <div style={{ marginTop: 14 }}><Rule>Unit costs feed the material cost and margin in Finance. Receiving a supplier order adds stock; starting production issues the material and lowers stock.</Rule></div>
    {ordering && <SupplierOrderDialog prefill={ordering} onClose={() => setOrdering(null)} />}
    {editor.dialog}
  </>;
}

function openMaterial(state: ErpState, open: ReturnType<typeof useEditor>["open"], material: RawMaterial | null) {
  const suppliers = supplierRows(state);
  open({
    title: material ? `Edit ${material.name}` : "Add raw material",
    fields: [
      { key: "name", label: "Material", required: true }, { key: "unit", label: "Unit", type: "select", options: [...UNITS] },
      { key: "stock", label: "Stock on hand", type: "number", required: true }, { key: "reorderLevel", label: "Reorder level", type: "number", help: "A warning shows when stock falls below this." },
      { key: "unitCost", label: `Unit cost (${state.settings.defaultCurrency}, optional)`, type: "number" },
      { key: "supplier", label: "Preferred supplier (optional)", list: suppliers.map((item) => item.name), help: "Pick or type a supplier; a new name creates the supplier." },
      ...customEditFields(state, "rawMaterial"),
    ],
    initial: { name: material?.name ?? "", unit: material?.unit ?? "kg", stock: String(material?.stock ?? 0), reorderLevel: String(material?.reorderLevel ?? 0), unitCost: material?.unitCost === null || material?.unitCost === undefined ? "" : String(material.unitCost), supplier: material?.supplierId ? state.suppliers.find((item) => item.id === material.supplierId)?.name ?? "" : "", ...customInitial(state, "rawMaterial", material?.custom) },
    onSave: (v) => save((value) => {
      let next = v.supplier.trim() ? upsertSupplier(value, v.supplier) : value;
      const supplierId = v.supplier.trim() ? next.suppliers.find((item) => item.name.toLowerCase() === v.supplier.trim().toLowerCase())?.id ?? null : null;
      next = saveRawMaterial(next, material?.id ?? null, { name: v.name, unit: v.unit, stock: num(v.stock || "0"), reorderLevel: num(v.reorderLevel || "0"), unitCost: v.unitCost.trim() ? num(v.unitCost) : null, supplierId, custom: pickCustom(v) }, nowIso());
      return next.rawMaterials === value.rawMaterials && next.materialRequirements === value.materialRequirements ? value : next;
    }),
  });
}

/* ============================== Suppliers ============================== */

export function SuppliersModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const editor = useEditor();
  const [ordering, setOrdering] = useState<OrderPrefill | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const head = <PageHead eyebrow="Operations" title="Suppliers" description="Who supplies which material, lead times, purchases and spend. Suppliers named on purchases appear here automatically." actions={<button type="button" className="erp-btn erp-btn-primary" onClick={() => openSupplier(state, editor.open, null)}><Plus size={15} /> Add supplier</button>} />;
  if (!hydrated) return <>{head}<Loading /></>;
  const rows = supplierRows(state).map((supplier) => ({ supplier, ...supplierStats(state, supplier) }));
  if (!rows.length) return <>{head}<div className="erp-card"><EmptyState title="No suppliers yet" text="Name a supplier for a material in the guided demo or the Purchasing tab, or add one here." /></div>{editor.dialog}</>;
  const totalSpend = rows.reduce((sum, row) => sum + row.spend, 0);
  const columns = "minmax(0,1.5fr) 90px minmax(0,1.4fr) 110px minmax(0,1fr) 130px";
  return <>{head}
    <section className="erp-kpis" aria-label="Supplier figures">
      <Stat label="Suppliers" value={rows.length} />
      <Stat label="Open purchases" value={rows.reduce((sum, row) => sum + row.open, 0)} note="Not yet received" />
      <Stat label="Purchase spend" value={money(state, totalSpend)} note="Ordered or received × unit cost" />
      <Stat label="Average lead time" value={(() => { const known = rows.filter((row) => row.supplier.leadTimeDays !== null); return known.length ? `${Math.round(known.reduce((sum, row) => sum + (row.supplier.leadTimeDays ?? 0), 0) / known.length)} days` : "—"; })()} />
    </section>
    <section className="erp-card erp-card-pad erp-stack" style={{ marginTop: 16 }}><h2 className="erp-chart-title">Spend by supplier</h2>
      <BarList label="Spend by supplier" data={rows.filter((row) => row.spend > 0).sort((a, b) => b.spend - a.spend).map((row) => ({ label: row.supplier.name, value: row.spend, display: money(state, row.spend), color: CHART_COLORS[1] }))} empty="No spend yet. Add unit costs in Raw materials and place purchases." /></section>
    <section className="erp-card" style={{ marginTop: 16 }}><Rows columns={columns} head={["Supplier", "Lead time", "Materials", "Purchases", "Spend", ""]}>
      {rows.map(({ supplier, purchases, open: openCount, spend, materials, projects }) => {
        const isOpen = open === supplier.id;
        return <div key={supplier.id}>
          <div role="row" className={`erp-row${isOpen ? " erp-row-active" : ""}`} style={{ gridTemplateColumns: columns }}>
            <span><button type="button" className="erp-linkbtn" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : supplier.id)}><strong>{supplier.name}</strong></button><small>{[supplier.contact, supplier.email].filter(Boolean).join(" · ") || (supplier.id.startsWith("virtual:") ? "Named on a purchase · add details" : "No contact yet")}</small><CustomValuesView state={state} entity="supplier" custom={supplier.custom} /></span>
            <span>{supplier.leadTimeDays !== null ? `${supplier.leadTimeDays} days` : "—"}</span>
            <span>{materials.join(", ") || "—"}</span>
            <span>{purchases.length}{openCount ? <small>{openCount} open</small> : null}</span>
            <span className="erp-num" style={{ textAlign: "left" }}>{money(state, spend)}<small>{projects.length} project{projects.length === 1 ? "" : "s"}</small></span>
            <span className="erp-head-actions"><button type="button" className="erp-btn erp-btn-sm" aria-label={`Order from ${supplier.name}`} onClick={() => setOrdering({ supplier: supplier.name, email: supplier.email, lines: materials.length ? materials.slice(0, 1).map((name) => { const raw = state.rawMaterials.find((item) => item.name === name); return { material: name, quantity: 0, unit: raw?.unit ?? "kg", unitPrice: raw?.unitCost ?? null }; }) : undefined })}><Mail size={13} /></button><EditButton onClick={() => openSupplier(state, editor.open, supplier)} /></span>
          </div>
          {isOpen && <div className="erp-detail">{purchases.length ? <ul className="erp-reasons">{purchases.map(({ record, req }) => { const project = projectOf(state, req.projectId); return <li key={record.id}><span><b style={{ color: "var(--e-text)" }}>{record.number}</b> · {req.quantity} {req.unit} {req.material} · {project ? <ProjectLink id={project.id} code={project.code} /> : null} · <Badge>{record.status}</Badge></span></li>; })}</ul> : <p className="erp-faint">No purchases yet.</p>}</div>}
        </div>;
      })}
    </Rows></section>
    {ordering && <SupplierOrderDialog prefill={ordering} onClose={() => setOrdering(null)} />}
    {editor.dialog}
  </>;
}

function openSupplier(state: ErpState, open: ReturnType<typeof useEditor>["open"], supplier: Supplier | null) {
  open({
    title: supplier ? `Edit ${supplier.name}` : "Add supplier",
    fields: [{ key: "name", label: "Supplier name", required: true }, { key: "contact", label: "Contact person (optional)" }, { key: "email", label: "Email (optional)" }, { key: "leadTimeDays", label: "Lead time in days (optional)", type: "number" }, ...customEditFields(state, "supplier")],
    initial: { name: supplier?.name ?? "", contact: supplier?.contact ?? "", email: supplier?.email ?? "", leadTimeDays: supplier?.leadTimeDays === null || supplier?.leadTimeDays === undefined ? "" : String(supplier.leadTimeDays), ...customInitial(state, "supplier", supplier?.custom) },
    onSave: (v) => save((value) => saveSupplier(value, supplier?.id ?? null, { name: v.name, contact: v.contact, email: v.email, leadTimeDays: v.leadTimeDays.trim() ? Math.round(num(v.leadTimeDays)) : null, custom: pickCustom(v) }, nowIso())),
  });
}

/* ============================== Finance ============================== */

type FinanceView = "overview" | "invoices" | "bills" | "payroll" | "costing";
const FINANCE_VIEWS: [FinanceView, string][] = [["overview", "Overview"], ["invoices", "Customer invoices"], ["bills", "Supplier bills"], ["payroll", "Payroll"], ["costing", "Project costing"]];

export function FinanceModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const filter = useProjectFilter(state);
  const params = useSearchParams();
  const [view, setView] = useState<FinanceView>(() => (FINANCE_VIEWS.some(([key]) => key === params.get("view")) ? params.get("view") as FinanceView : filter ? "invoices" : "overview"));
  const [output, setOutput] = useState<OutputState>(null);
  const editor = useEditor();
  const head = <PageHead eyebrow="Finance" title="Finance" description="Quotations to cash: customer invoices, supplier and raw material bills, payroll with salary slips, project costing and the company overview, all from the same records. Management figures, not bookkeeping." />;
  if (!hydrated) return <>{head}<Loading /></>;
  const manufacturing = industryOf(state) === "manufacturing";
  const views = FINANCE_VIEWS.filter(([key]) => manufacturing || key !== "costing");
  const tabs = <div className="erp-tabs" role="group" aria-label="Finance view" style={{ marginBottom: 16 }}>{views.map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>)}</div>;
  if (view === "overview") return <>{head}{tabs}<FinanceOverview state={state} /></>;
  if (view === "bills") return <>{head}{tabs}<BillsSection state={state} /></>;
  if (view === "payroll") return <>{head}{tabs}<PayrollSection state={state} /></>;
  if (view === "costing" && manufacturing) return <>{head}{tabs}<CostingSection state={state} /></>;
  if (!manufacturing) return <>{head}{tabs}<InvoiceList state={state} /></>;
  if (!state.projects.length) return <>{head}{tabs}<NoProjects what="financial records" /></>;
  const today = todayIso();
  const summary = financeSummary(state, today);
  const rows = summary.projects.filter((row) => !filter || row.project.id === filter.id);
  const unpaid = state.invoices.filter((item) => !item.paidAt);
  const overdue = unpaid.filter((item) => item.dueAt < today);
  const customers = state.customers.map((customer) => ({ customer, value: summary.projects.filter((row) => row.customerId === customer.id).reduce((sum, row) => sum + row.orderValue, 0) })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const anyMissingCost = summary.projects.some((row) => !row.costKnown);
  const columns = "minmax(0,1.2fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 130px";
  return <>{head}{tabs}<FilterBar project={filter} base="/demo/finance" />
    <section className="erp-kpis erp-kpis-6" aria-label="Finance figures">
      <Stat label="Order book" value={money(state, summary.orderBook)} note="Not yet invoiced" />
      <Stat label="Invoiced" value={money(state, summary.invoiced)} note={`${state.invoices.length} invoice${state.invoices.length === 1 ? "" : "s"}, incl. tax`} />
      <Stat label="Paid" value={money(state, summary.paid)} />
      <Stat label="Receivable" value={money(state, summary.receivable)} note={overdue.length ? `${money(state, summary.overdue)} overdue` : "Nothing overdue"} tone={overdue.length ? "bad" : undefined} />
      <Stat label="Material cost" value={money(state, summary.materialCost)} note={anyMissingCost ? "Some unit costs missing" : "From raw material costs"} />
      <Stat label="Material margin" value={money(state, summary.projects.reduce((sum, row) => sum + row.margin, 0))} note="Order value − material cost. Full costing in Project costing." />
    </section>
    <div className="erp-grid-2" style={{ marginTop: 16 }}>
      <section className="erp-card erp-card-pad erp-stack"><h2 className="erp-chart-title">Order value and material cost by project</h2>
        <Columns label="Order value and material cost by project" categories={summary.projects.map((row) => row.project.code.replace(/^BOH-PRJ-/, ""))} series={[{ name: "Order value", color: CHART_COLORS[0], values: summary.projects.map((row) => row.orderValue) }, { name: "Material cost", color: CHART_COLORS[1], values: summary.projects.map((row) => row.materialCost) }]} format={(value) => money(state, value)} /></section>
      <div className="erp-stack">
        <section className="erp-card erp-card-pad erp-stack"><h2 className="erp-chart-title">Invoices: paid and open</h2>
          <StackedBar label="Invoice amounts by payment status" data={[{ label: "Paid", value: summary.paid, display: money(state, summary.paid), color: CHART_COLORS[2] }, { label: "Open", value: summary.receivable - summary.overdue, display: money(state, summary.receivable - summary.overdue), color: CHART_COLORS[1] }, { label: "Overdue", value: summary.overdue, display: money(state, summary.overdue), color: CHART_COLORS[3] }]} empty="No invoices yet." /></section>
        <section className="erp-card erp-card-pad erp-stack"><h2 className="erp-chart-title">Order value by customer</h2>
          <BarList label="Order value by customer" data={customers.map((item) => ({ label: item.customer.name, value: item.value, display: money(state, item.value), color: CHART_COLORS[0] }))} /></section>
      </div>
    </div>
    <section className="erp-card" style={{ marginTop: 16 }}><div className="erp-card-head"><div><h2>Invoices and receivables</h2><p>Mark invoices paid when the money arrives.</p></div></div>
      {rows.length ? <Rows columns={columns} head={["Project", "Customer", "Invoice", "Total", "Status", ""]}>
        {rows.map((row) => {
          const customer = state.customers.find((item) => item.id === row.customerId);
          const ready = readiness(state, row.project.id);
          const canInvoice = ready.invoice.reasons.some((reason) => reason.action?.kind === "generate-invoice");
          const invoice = row.invoice;
          return <div key={row.project.id} role="row" className="erp-row" style={{ gridTemplateColumns: columns }}>
            <span><ProjectLink id={row.project.id} code={row.project.code} /><small>{row.project.name}</small></span>
            <span>{customer?.name}</span>
            <span>{invoice ? <><strong>{invoice.number}</strong><small>Issued {formatDate(invoice.issuedAt)} · due {formatDate(invoice.dueAt)}</small></> : <small>{ready.invoice.summary}</small>}{row.cancelled.map((item) => <small key={item.id}>{item.number} cancelled · credit note {state.creditNotes.find((note) => note.id === item.creditNoteId)?.number ?? "—"}</small>)}</span>
            <span className="erp-num" style={{ textAlign: "left" }}>{invoice ? money(state, invoice.total, invoice.currency) : money(state, row.orderValue, row.currency)}{!invoice && <small>order value</small>}</span>
            <span><Badge tone={row.status === "Paid" ? "ok" : row.status === "Overdue" ? "bad" : row.status === "Unpaid" || row.status === "To invoice" ? "warn" : "neutral"}>{row.status}</Badge>{invoice?.paidAt && <small>Paid {formatDate(invoice.paidAt)}</small>}</span>
            <span className="erp-head-actions">
              {invoice ? <>
                <button type="button" className="erp-btn erp-btn-sm" onClick={() => setOutput({ projectId: row.project.id, kind: "invoice" })} aria-label={`Print ${invoice.number}`}><Printer size={13} /></button>
                <button type="button" className="erp-btn erp-btn-sm" onClick={() => commit((value) => markInvoicePaid(value, invoice.id, !invoice.paidAt, nowIso()))}>{invoice.paidAt ? "Unpaid" : "Mark paid"}</button>
                {!invoice.paidAt && <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => editor.open({ title: `Cancel ${invoice.number}`, fields: [{ key: "reason", label: "Reason (required)", required: true, help: "The invoice is kept and a credit note with negative amounts is issued. Invoice numbers are never deleted or reused." }], initial: { reason: "" }, onSave: (v) => save((value) => cancelInvoice(value, invoice.id, v.reason, nowIso())) })}>Cancel…</button>}
              </> : canInvoice ? <button type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={() => commit((value) => generateInvoice(value, row.project.id, nowIso()))}>Create invoice</button> : null}
            </span>
          </div>;
        })}
      </Rows> : <EmptyState title="Nothing here" text="No project matches the filter." />}
    </section>
    <section className="erp-card" style={{ marginTop: 16 }}><div className="erp-card-head"><div><h2>Material margin</h2><p>Order value minus material cost. Labour from the shop floor and external bills are in Project costing.</p></div></div>
      <Rows columns="minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr)" head={["Project", "Order value", "Material cost", "Margin", "Cost basis"]}>
        {rows.map((row) => <div key={row.project.id} role="row" className="erp-row" style={{ gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr)" }}>
          <span><ProjectLink id={row.project.id} code={row.project.code} /><small>{row.project.name}</small></span>
          <span className="erp-num" style={{ textAlign: "left" }}>{money(state, row.orderValue, row.currency)}</span>
          <span className="erp-num" style={{ textAlign: "left" }}>{money(state, row.materialCost, row.currency)}</span>
          <span className="erp-num" style={{ textAlign: "left" }}><b>{money(state, row.margin, row.currency)}</b>{row.orderValue > 0 && <small>{Math.round((row.margin / row.orderValue) * 100)}%</small>}</span>
          <span>{row.costKnown ? <small>All unit costs known</small> : <Link className="erp-link" href="/demo/raw-materials">Add unit costs</Link>}</span>
        </div>)}
      </Rows>
    </section>
    <section className="erp-card erp-card-pad" style={{ marginTop: 16 }}><h2 className="erp-chart-title">How the numbers connect</h2>
      <ol className="erp-connect">
        <li><b>Sales order</b><span>quantity × price per part</span></li>
        <li><b>Invoice</b><span>created from the dispatched order, plus {state.settings.taxRate}% tax</span></li>
        <li><b>Raw materials</b><span>unit cost × material per part = material cost</span></li>
        <li><b>Suppliers</b><span>ordered and received purchases = spend</span></li>
        <li><b>Margin</b><span>order value − material cost</span></li>
      </ol>
      <div style={{ marginTop: 12 }}><Rule>{RULES.invoice} Tax rate and payment terms are set in Configuration.</Rule></div>
    </section>
    {output && <OutputDialog state={state} projectId={output.projectId} kind={output.kind} onClose={() => setOutput(null)} />}
    {editor.dialog}
  </>;
}

/* ============================== Configuration ============================== */

const ACCENTS: { key: UiSettings["accent"]; label: string; color: string }[] = [
  { key: "lavender", label: "Lavender", color: "#7B66DC" }, { key: "coral", label: "Coral", color: "#F2566F" }, { key: "orange", label: "Peach", color: "#FFB27E" }, { key: "green", label: "Green", color: "#2E9E62" },
  { key: "blue", label: "Blue", color: "#2F6FB0" }, { key: "plum", label: "Plum", color: "#6B3A5E" },
];

function Choice<T extends string>({ name, value, options, onChange }: { name: string; value: T; options: { key: T; label: string; hint?: string }[]; onChange: (value: T) => void }) {
  return <div className="erp-choice" role="radiogroup" aria-label={name}>{options.map((option) => <button key={option.key} type="button" role="radio" aria-checked={value === option.key} onClick={() => onChange(option.key)}><b>{option.label}</b>{option.hint && <small>{option.hint}</small>}</button>)}</div>;
}

function ConfigSection({ id, title, text, children }: { id: string; title: string; text: string; children: ReactNode }) {
  return <section className="erp-card" aria-labelledby={id}><div className="erp-card-head"><div><h2 id={id}>{title}</h2><p>{text}</p></div></div><div className="erp-card-pad erp-stack">{children}</div></section>;
}

export function ConfigurationModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const router = useRouter();
  const [field, setField] = useState<{ entity: CustomEntity; label: string; type: CustomFieldType; options: string }>({ entity: "project", label: "", type: "text", options: "" });
  const [fieldError, setFieldError] = useState("");
  const [docType, setDocType] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const head = <PageHead eyebrow="Settings" title="Configuration" description="Shape the demo ERP around how you work: look and layout, tabs, dashboard, custom fields, document types and business settings. Changes apply immediately and stay in this browser." />;
  if (!hydrated) return <>{head}<Loading /></>;
  const ui = state.settings.ui;
  const setUi = (patch: Partial<UiSettings>) => commit((value) => updateUi(value, patch));
  const setNumber = (patch: Parameters<typeof updateSettings>[1]) => commit((value) => updateSettings(value, patch));
  const addField = () => {
    const ok = commit((value) => addCustomField(value, { entity: field.entity, label: field.label, type: field.type, options: field.options.split(",") }));
    if (!ok) { setFieldError(field.type === "select" && !field.options.trim() ? "Add at least one option, separated by commas." : "Enter a new, unique field name."); return; }
    setField({ ...field, label: "", options: "" }); setFieldError("");
  };
  return <>{head}<div className="erp-config">
    <div className="erp-span-2" style={{ gridColumn: "1 / -1" }}><ConfigSection id="cfg-industry" title="Industry" text="Which kind of business the demo runs. Each industry has its own tabs and sample company; switching replaces the demo data in this browser.">
      <IndustryCards />
    </ConfigSection></div>
    <ConfigSection id="cfg-style" title="Style" text="Colours, spacing and shapes of the demo workspace.">
      <div className="erp-field"><span className="erp-label">Theme</span><Choice name="Theme" value={ui.theme} onChange={(theme) => setUi(theme === "classic" ? { theme, accent: "coral", sidebar: "dark" } : { theme, accent: "lavender", sidebar: "lavender" })} options={[{ key: "studio", label: "Studio", hint: "Soft lavender, pastel cards" }, { key: "classic", label: "Classic", hint: "Plum and coral" }]} /></div>
      <div className="erp-field"><span className="erp-label">Accent colour</span>
        <div className="erp-swatches" role="radiogroup" aria-label="Accent colour">{ACCENTS.map((accent) => <button key={accent.key} type="button" role="radio" aria-checked={ui.accent === accent.key} onClick={() => setUi({ accent: accent.key })}><i style={{ background: accent.color }} />{accent.label}</button>)}</div></div>
      <div className="erp-field"><span className="erp-label">Density</span><Choice name="Density" value={ui.density} onChange={(density) => setUi({ density })} options={[{ key: "comfortable", label: "Comfortable" }, { key: "compact", label: "Compact", hint: "More rows on screen" }]} /></div>
      <div className="erp-field"><span className="erp-label">Corners</span><Choice name="Corners" value={ui.corners} onChange={(corners) => setUi({ corners })} options={[{ key: "rounded", label: "Rounded" }, { key: "soft", label: "Soft" }, { key: "sharp", label: "Sharp" }]} /></div>
      <div className="erp-field"><span className="erp-label">Menu colour</span><Choice name="Menu colour" value={ui.sidebar} onChange={(sidebar) => setUi({ sidebar })} options={[{ key: "lavender", label: "Lavender" }, { key: "dark", label: "Dark plum" }, { key: "light", label: "Light" }]} /></div>
      <div className="erp-field"><span className="erp-label">Font</span><Choice name="Font" value={ui.font} onChange={(font) => setUi({ font })} options={[{ key: "brand", label: "Brand", hint: ui.theme === "studio" ? "Nunito" : "Space Grotesk + Manrope" }, { key: "system", label: "System", hint: "Your device’s font" }]} /></div>
    </ConfigSection>

    <ConfigSection id="cfg-layout" title="Orientation" text="Where the menu sits.">
      <Choice name="Menu position" value={ui.nav} onChange={(nav) => setUi({ nav })} options={[{ key: "left", label: "Left", hint: "Classic sidebar" }, { key: "right", label: "Right", hint: "Sidebar on the right" }, { key: "top", label: "Top", hint: "Horizontal menu bar" }]} />
    </ConfigSection>

    <ConfigSection id="cfg-tabs" title="Tabs" text="Rename, hide or reorder the tabs in the menu. Guided demo and Configuration always stay visible.">
      <ul className="erp-config-list">{state.settings.tabs.map((tab, index) => <li key={tab.key}>
        <input className="erp-input" aria-label={`Name of ${tab.key} tab`} defaultValue={tab.label} maxLength={30} onBlur={(event) => { if (event.target.value.trim() && event.target.value !== tab.label) commit((value) => updateTab(value, tab.key, { label: event.target.value })); }} />
        <button type="button" className="erp-btn erp-btn-sm" aria-pressed={tab.visible} disabled={tab.key === "guided" || tab.key === "configuration"} onClick={() => commit((value) => updateTab(value, tab.key, { visible: !tab.visible }))}>{tab.visible ? <><Eye size={13} /> Shown</> : <><EyeOff size={13} /> Hidden</>}</button>
        <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" aria-label={`Move ${tab.label} up`} disabled={index === 0} onClick={() => commit((value) => moveTab(value, tab.key, -1))}><ArrowUp size={13} /></button>
        <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" aria-label={`Move ${tab.label} down`} disabled={index === state.settings.tabs.length - 1} onClick={() => commit((value) => moveTab(value, tab.key, 1))}><ArrowDown size={13} /></button>
      </li>)}</ul>
    </ConfigSection>

    <ConfigSection id="cfg-dash" title="Dashboard" text="Choose and order the widgets on the Overview.">
      <ul className="erp-config-list">{state.settings.widgets.map((widget, index) => <li key={widget.key}>
        <label className="erp-check"><input type="checkbox" checked={widget.visible} onChange={(event) => commit((value) => updateWidget(value, widget.key, event.target.checked))} /> {WIDGET_LABELS[widget.key]}</label>
        <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" aria-label={`Move ${WIDGET_LABELS[widget.key]} up`} disabled={index === 0} onClick={() => commit((value) => moveWidget(value, widget.key, -1))}><ArrowUp size={13} /></button>
        <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" aria-label={`Move ${WIDGET_LABELS[widget.key]} down`} disabled={index === state.settings.widgets.length - 1} onClick={() => commit((value) => moveWidget(value, widget.key, 1))}><ArrowDown size={13} /></button>
      </li>)}</ul>
      <div><Link className="erp-btn erp-btn-sm" href="/demo/overview">Open the Overview</Link></div>
    </ConfigSection>

    <ConfigSection id="cfg-fields" title="Custom fields" text="Add your own fields to records. They appear in the edit dialogs and next to the record in its tab.">
      {CUSTOM_ENTITIES.map((entity) => { const fields = customFieldsFor(state, entity.key); return fields.length ? <div key={entity.key}><p className="erp-label">{entity.label}</p><ul className="erp-chips">{fields.map((item) => <li key={item.id}>{item.label}<small>{item.type}{item.options.length ? `: ${item.options.join(", ")}` : ""}</small><button type="button" aria-label={`Remove ${item.label}`} onClick={() => commit((value) => removeCustomField(value, item.id))}><X size={12} /></button></li>)}</ul></div> : null; })}
      {!state.settings.customFields.length && <p className="erp-faint">No custom fields yet. Try “Heat number” for raw materials or “Sales person” for projects.</p>}
      <div className="erp-form-grid">
        <Field id="cf-entity" label="Record"><select className="erp-select" id="cf-entity" value={field.entity} onChange={(event) => setField({ ...field, entity: event.target.value as CustomEntity })}>{CUSTOM_ENTITIES.map((entity) => <option key={entity.key} value={entity.key}>{entity.label}</option>)}</select></Field>
        <Field id="cf-type" label="Type"><select className="erp-select" id="cf-type" value={field.type} onChange={(event) => setField({ ...field, type: event.target.value as CustomFieldType })}><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="select">Dropdown</option></select></Field>
      </div>
      <Field id="cf-label" label="Field name" error={fieldError || undefined}><input className="erp-input" id="cf-label" value={field.label} onChange={(event) => setField({ ...field, label: event.target.value })} placeholder="e.g. Heat number" /></Field>
      {field.type === "select" && <Field id="cf-options" label="Options, separated by commas"><input className="erp-input" id="cf-options" value={field.options} onChange={(event) => setField({ ...field, options: event.target.value })} placeholder="e.g. Low, Medium, High" /></Field>}
      <div><button type="button" className="erp-btn erp-btn-primary" onClick={addField}><Plus size={14} /> Add field</button></div>
    </ConfigSection>

    <ConfigSection id="cfg-docs" title="Document types" text="Types offered when you add a document. Built-in types cannot be removed; a type in use cannot be removed.">
      <ul className="erp-chips">{docTypes(state).map((type) => { const builtIn = DOC_TYPES.includes(type); const used = state.documents.some((doc) => doc.type === type); return <li key={type}>{type}{builtIn ? <small>built-in</small> : used ? <small>in use</small> : <button type="button" aria-label={`Remove ${type}`} onClick={() => commit((value) => removeDocType(value, type))}><X size={12} /></button>}</li>; })}</ul>
      <form className="erp-inline" onSubmit={(event) => { event.preventDefault(); if (commit((value) => addDocType(value, docType))) setDocType(""); }}>
        <input className="erp-input" aria-label="New document type" value={docType} onChange={(event) => setDocType(event.target.value)} placeholder="e.g. Material certificate" />
        <button type="submit" className="erp-btn"><Plus size={14} /> Add type</button>
      </form>
    </ConfigSection>

    <ConfigSection id="cfg-business" title="Business settings" text="Used for new invoices and new projects.">
      <div className="erp-form-grid">
        <Field id="cfg-tax" label="Tax rate (%)" help="Illustrative only."><input className="erp-input" id="cfg-tax" type="number" min={0} max={30} step={0.5} value={state.settings.taxRate} onChange={(event) => setNumber({ taxRate: Math.min(30, Math.max(0, Number(event.target.value) || 0)) })} /></Field>
        <Field id="cfg-terms" label="Payment terms (days)"><input className="erp-input" id="cfg-terms" type="number" min={0} max={120} value={state.settings.paymentTermsDays} onChange={(event) => setNumber({ paymentTermsDays: Math.min(120, Math.max(0, Math.round(Number(event.target.value) || 0))) })} /></Field>
      </div>
      <Field id="cfg-cur" label="Currency for new projects"><select className="erp-select" id="cfg-cur" value={state.settings.defaultCurrency} onChange={(event) => setNumber({ defaultCurrency: event.target.value as Currency })}>{CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}</select></Field>
    </ConfigSection>

    <ConfigSection id="cfg-company" title="Company, currencies and payroll" text="Used on documents, emails, finance totals and salary slips.">
      <Field id="cfg-company-name" label="Company name"><input className="erp-input" id="cfg-company-name" defaultValue={state.settings.companyName} onBlur={(event) => { const name = event.target.value.trim(); if (name && name !== state.settings.companyName) setNumber({ companyName: name.slice(0, 80) }); }} /></Field>
      <div className="erp-form-grid">
        {CURRENCIES.filter((currency) => currency !== state.settings.defaultCurrency).map((currency) => <Field key={currency} id={`cfg-fx-${currency}`} label={`1 ${currency} in EUR`} help="For totals across currencies."><input className="erp-input" id={`cfg-fx-${currency}`} type="number" min={0.01} step={0.01} value={state.settings.fx[currency]} onChange={(event) => { const rate = Number(event.target.value); if (rate > 0) setNumber({ fx: { ...state.settings.fx, [currency]: rate } }); }} /></Field>)}
        <Field id="cfg-overhead" label={`Overhead per labour hour (${state.settings.defaultCurrency})`} help="Added to each person’s cost rate in project costing."><input className="erp-input" id="cfg-overhead" type="number" min={0} step={1} value={state.settings.overheadPerHour} onChange={(event) => setNumber({ overheadPerHour: Math.max(0, Number(event.target.value) || 0) })} /></Field>
      </div>
      <div className="erp-form-grid">
        <Field id="cfg-pay-tax" label="Income tax (%)" help="Illustrative flat rate."><input className="erp-input" id="cfg-pay-tax" type="number" min={0} max={60} value={state.settings.payroll.incomeTaxPct} onChange={(event) => setNumber({ payroll: { ...state.settings.payroll, incomeTaxPct: Math.min(60, Math.max(0, Number(event.target.value) || 0)) } })} /></Field>
        <Field id="cfg-pay-social" label="Social insurance, employee (%)"><input className="erp-input" id="cfg-pay-social" type="number" min={0} max={40} value={state.settings.payroll.socialPct} onChange={(event) => setNumber({ payroll: { ...state.settings.payroll, socialPct: Math.min(40, Math.max(0, Number(event.target.value) || 0)) } })} /></Field>
        <Field id="cfg-pay-employer" label="Employer on-cost (%)"><input className="erp-input" id="cfg-pay-employer" type="number" min={0} max={60} value={state.settings.payroll.employerPct} onChange={(event) => setNumber({ payroll: { ...state.settings.payroll, employerPct: Math.min(60, Math.max(0, Number(event.target.value) || 0)) } })} /></Field>
      </div>
    </ConfigSection>

    <ConfigSection id="cfg-data" title="Backup and data" text="Everything lives in this browser. Export a backup file before clearing site data or switching computers.">
      <div className="erp-head-actions">
        <button type="button" className="erp-btn" onClick={() => downloadBlob(JSON.stringify({ app: "boh-erp-demo", exportedAt: nowIso(), state }, null, 1), `boh-erp-backup-${todayIso()}.json`, "application/json")}><Download size={14} /> Export backup (JSON)</button>
        <label className="erp-btn"><Upload size={14} /> Import backup<input type="file" accept="application/json,.json" hidden onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          try {
            const parsed = JSON.parse(await file.text());
            const restored = parseStoredState(JSON.stringify(parsed?.state ?? parsed));
            if (!restored.projects.length && !restored.employees.length && !restored.emails.length) { setImportMessage("That file has no BOH ERP data."); return; }
            replaceState(restored);
            setImportMessage(`Backup restored: ${restored.projects.length} projects, ${restored.opLogs.length} log entries, ${restored.emails.length} emails.`);
          } catch { setImportMessage("That file could not be read as a BOH ERP backup."); }
        }} /></label>
      </div>
      {importMessage && <p className="erp-faint" role="status">{importMessage}</p>}
      <p className="erp-faint">Files you attached (drawings, STEP models) stay in this browser’s file store and are not part of the backup file. Storage used: about {Math.round(JSON.stringify(state).length / 1024)} KB of records.</p>
    </ConfigSection>

    <ConfigSection id="cfg-rules" title="Workflow rules" text="Every status in the demo comes from these.">
      <ul className="erp-reasons">{Object.entries(RULES).map(([key, text]) => <li key={key}><span><b style={{ color: "var(--e-text)", textTransform: "capitalize", minWidth: 96 }}>{key}</b> {text}</span></li>)}</ul>
    </ConfigSection>

    <ConfigSection id="cfg-reset" title="Reset" text="Restore the demo projects, or start with an empty ERP to enter your own (fictional) data.">
      <div className="erp-head-actions">
        <button type="button" className="erp-btn" onClick={() => commit(resetLayout)}><RotateCcw size={14} /> Reset style, tabs and dashboard</button>
        <button type="button" className="erp-btn" onClick={() => { resetDemo("demo"); router.push("/demo/overview"); }}><RotateCcw size={14} /> Restore the 2 demo projects</button>
        <button type="button" className="erp-btn erp-btn-danger" onClick={() => { void clearStoredFiles(); resetDemo("empty"); router.push("/demo"); }}><Trash2 size={14} /> Start empty</button>
      </div>
    </ConfigSection>
  </div></>;
}
