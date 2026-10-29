"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowLeft, FileText, Mail, Plus, Printer, Sparkles, Trash2, X } from "lucide-react";
import { LineItemsEditor } from "@/components/erp/line-items";
import { CustomValuesView, EditButton, NOT_SAVED, StatusSelect, customEditFields, customInitial, pickCustom, useEditor } from "@/components/erp/edit";
import { BillDialog, ReorderPanel, SupplierOrderDialog, SupplierOrdersSection, type OrderPrefill } from "@/components/erp/purchasing-ui";
import type { BillInput } from "@/lib/erp/finance";
import { InspectionForm } from "@/components/erp/inspection-form";
import { focusProject } from "@/components/erp/guide-link";
import { startAnotherProject } from "@/components/erp/guided";
import { OutputDialog, type OutputKind } from "@/components/erp/outputs";
import { commit, nowIso, useErp, useHydrated } from "@/components/erp/store";
import { Badge, EmptyState, Modal, PageHead, ProjectLink, ReadinessBadge, Rule } from "@/components/erp/ui";
import {
  RULES, UNITS, advanceProcurement, createProductionOrder, deleteProject, dispatchProject, formatDate, rawMaterialFor,
  addInspectionRequirement, removeInspectionRequirement, setProductionStatus, updateCustomer, updateInspectionRequirement, updateMaterial,
  updatePart, updateProductionOrder, updateProject, updatePurchaseOrder, isProductionComplete, setCustomValues, formatMoney, isActiveOrder, lineEngineeringReady, lineMaterialReady, orderOperationalState,
  partNumber, projectStage, readiness, revisionLabel,
  type ErpState, type Project,
} from "@/lib/erp/model";
import { addDemoProjects, hasDemoProjects } from "@/lib/erp/seed";
import { toast } from "@/components/erp/toast";
import { DocPreview } from "@/components/erp/doc-preview";
import { DocIcon } from "@/components/erp/documents";
import { RoutingDialog } from "@/components/erp/shopfloor";
import { routingFor } from "@/lib/erp/shopfloor";

/* ---------------- Shared helpers ---------------- */

export function useProjectFilter(state: ErpState) {
  const params = useSearchParams();
  const id = params.get("project");
  const project = id ? state.projects.find((item) => item.id === id) ?? null : null;
  return project;
}

export function FilterBar({ project, base }: { project: Project | null; base: string }) {
  if (!project) return null;
  return <div className="erp-hint" style={{ alignItems: "center" }}>
    <span>Showing records for <b>{project.code} · {project.name}</b></span>
    <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
      <Link className="erp-btn erp-btn-sm" href={`/demo/projects/${project.id}`}><ArrowLeft size={14} /> Back to project</Link>
      <Link className="erp-btn erp-btn-ghost erp-btn-sm" href={base}><X size={14} /> Show all</Link>
    </span>
  </div>;
}

export function NoProjects({ what }: { what: string }) {
  return <div className="erp-card"><EmptyState title={`No ${what} yet`} text={`${what[0].toUpperCase()}${what.slice(1)} appear here automatically when you create a project in the guided demo. Nothing needs to be entered twice.`}>
    <Link className="erp-btn erp-btn-primary" href="/demo"><Sparkles size={15} /> Start the guided demo</Link>
  </EmptyState></div>;
}

export function Loading() { return <p className="erp-muted" role="status">Loading…</p>; }


export function Rows({ columns, head, children }: { columns: string; head: string[]; children: ReactNode }) {
  return <div className="erp-rows" role="table">
    <div className="erp-row erp-row-head" role="row" style={{ gridTemplateColumns: columns }}>{head.map((label, index) => <span key={index} role="columnheader">{label}</span>)}</div>
    {children}
  </div>;
}

export const projectOf = (state: ErpState, id: string) => state.projects.find((project) => project.id === id);


export const save = (update: (state: ErpState) => ErpState) => (commit(update) ? null : NOT_SAVED);
export const num = (value: string) => Number(value.replace(",", "."));

export type OutputState = { projectId: string; kind: OutputKind; productionOrderId?: string } | null;

/* ---------------- Projects ---------------- */

export function ProjectsModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const router = useRouter();
  const editor = useEditor();
  const [deleting, setDeleting] = useState<Project | null>(null);
  const loadDemo = () => { commit((value) => addDemoProjects(value, nowIso())); toast("The 2 demo projects were added, with people, suppliers, emails and shop-floor history.", { tone: "ok" }); };
  const head = <PageHead eyebrow="Workspace" title="Projects" description="Every project with its stage. Open one to see all of its connected records, or continue it in the guided demo." actions={<>
    {hydrated && !hasDemoProjects(state) && <button type="button" className="erp-btn" onClick={loadDemo}><Sparkles size={15} /> Add the 2 demo projects</button>}
    <button type="button" className="erp-btn erp-btn-primary" onClick={() => { startAnotherProject(); router.push("/demo"); }}><Plus size={15} /> New project</button></>} />;
  if (!hydrated) return <>{head}<Loading /></>;
  if (!state.projects.length) return <>{head}<NoProjects what="projects" /></>;
  const columns = "minmax(0,2fr) minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr) 140px 290px";
  return <>{head}<section className="erp-card"><Rows columns={columns} head={["Project", "Customer", "Purchase order", "Delivery", "Status", ""]}>
    {[...state.projects].reverse().map((project) => {
      const customer = state.customers.find((item) => item.id === project.customerId);
      const po = state.purchaseOrders.find((item) => item.projectId === project.id);
      return <div key={project.id} role="row" className="erp-row" style={{ gridTemplateColumns: columns }}>
        <span><Link href={`/demo/projects/${project.id}`}><strong>{project.name}</strong></Link><small>{project.code}{project.isSample ? " · demo project" : ""}{state.guide.projectId === project.id ? " · current" : ""}</small><CustomValuesView state={state} entity="project" custom={project.custom} /></span>
        <span>{customer?.name}</span><span>{po?.number}</span><span>{po ? formatDate(po.deliveryDate) : "—"}</span>
        <span><Badge>{projectStage(state, project.id)}</Badge></span>
        <span className="erp-head-actions">
          <button type="button" className="erp-btn erp-btn-sm" onClick={() => { commit((value) => focusProject(value, project.id)); router.push("/demo"); }}>Guided demo</button>
          <EditButton onClick={() => editor.open({ title: `Edit ${project.code}`, fields: [{ key: "name", label: "Project name", required: true }, { key: "description", label: "Description (optional)" }, ...customEditFields(state, "project")], initial: { name: project.name, description: project.description, ...customInitial(state, "project", project.custom) }, onSave: (v) => save((value) => setCustomValues(updateProject(value, project.id, { name: v.name, description: v.description }, nowIso()), "project", project.id, pickCustom(v))) })} />
          <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" aria-label={`Delete ${project.code}`} onClick={() => setDeleting(project)}><Trash2 size={13} /></button>
        </span>
      </div>;
    })}
  </Rows></section>{editor.dialog}
    {deleting && <Modal label="Delete project" onClose={() => setDeleting(null)}>
      <h2>Delete {deleting.code}?</h2>
      <p style={{ marginTop: 8 }}>This removes the project, its purchase order, line items, material requirements, production orders, inspection report, dispatch note and invoice from this browser. Customers, parts, shared documents and the shop-floor log stay. It cannot be undone.</p>
      <div className="erp-head-actions" style={{ marginTop: 18, justifyContent: "flex-end" }}>
        <button type="button" className="erp-btn erp-btn-ghost" onClick={() => setDeleting(null)}>Cancel</button>
        <button type="button" className="erp-btn erp-btn-danger" onClick={() => { commit((value) => deleteProject(value, deleting.id, nowIso())); toast(`${deleting.code} deleted.`, { tone: "info" }); setDeleting(null); }}><Trash2 size={14} /> Delete project</button>
      </div>
    </Modal>}
  </>;
}

/* ---------------- CRM ---------------- */

export function CrmModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const filter = useProjectFilter(state);
  const [selected, setSelected] = useState<string | null>(null);
  const editor = useEditor();
  const head = <PageHead eyebrow="Commercial" title="Customers" description="Customer records come from the projects you create. An existing customer is linked, never duplicated." />;
  if (!hydrated) return <>{head}<Loading /></>;
  if (!state.customers.length) return <>{head}<NoProjects what="customers" /></>;
  const customers = filter ? state.customers.filter((customer) => customer.id === filter.customerId) : state.customers;
  const active = selected ?? (filter ? filter.customerId : null);
  const columns = "minmax(0,2fr) minmax(0,1.5fr) 110px 130px";
  return <>{head}<FilterBar project={filter} base="/demo/crm" /><section className="erp-card"><Rows columns={columns} head={["Customer", "Contact", "Projects", "Purchase orders"]}>
    {customers.map((customer) => {
      const projects = state.projects.filter((project) => project.customerId === customer.id);
      const orders = state.purchaseOrders.filter((order) => order.customerId === customer.id);
      const open = active === customer.id;
      return <div key={customer.id}>
        <button type="button" className={`erp-row erp-row-click${open ? " erp-row-active" : ""}`} style={{ gridTemplateColumns: columns, width: "100%", background: "transparent", border: 0, textAlign: "left", color: "inherit" }} aria-expanded={open} onClick={() => setSelected(open ? "" : customer.id)}>
          <span><strong>{customer.name}</strong><small>Customer since {formatDate(customer.createdAt)}</small></span><span className="erp-muted">{customer.contact || "—"}</span><span>{projects.length}</span><span>{orders.length}</span>
        </button>
        {open && <div className="erp-detail">
          <div className="erp-param-head" style={{ marginBottom: 8 }}><p className="erp-label">Linked projects and purchase orders</p>
            <EditButton label="Edit customer" onClick={() => editor.open({ title: `Edit ${customer.name}`, fields: [{ key: "name", label: "Customer name", required: true }, { key: "contact", label: "Contact email (optional)" }, ...customEditFields(state, "customer")], initial: { name: customer.name, contact: customer.contact, ...customInitial(state, "customer", customer.custom) }, onSave: (v) => save((value) => setCustomValues(updateCustomer(value, customer.id, { name: v.name, contact: v.contact }, nowIso()), "customer", customer.id, pickCustom(v))) })} /></div>
          <CustomValuesView state={state} entity="customer" custom={customer.custom} />
          <ul className="erp-reasons">{orders.map((order) => { const project = projectOf(state, order.projectId); return <li key={order.id}><span><b style={{ color: "var(--e-text)" }}>{order.number}</b> · {project ? <ProjectLink id={project.id} code={project.code} /> : null} {project?.name} · due {formatDate(order.deliveryDate)} · {orderOperationalState(state, order)}</span></li>; })}</ul>
        </div>}
      </div>;
    })}
  </Rows></section>{editor.dialog}</>;
}

/* ---------------- Sales ---------------- */

export function SalesModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const filter = useProjectFilter(state);
  const [tab, setTab] = useState<"all" | "active">("all");
  const [output, setOutput] = useState<OutputState>(null);
  const editor = useEditor();
  const head = <PageHead eyebrow="Commercial" title="Sales orders" description="Purchase orders are commercial commitments from customers. Active orders are the subset currently moving through production and quality." />;
  if (!hydrated) return <>{head}<Loading /></>;
  if (!state.purchaseOrders.length) return <>{head}<NoProjects what="purchase orders" /></>;
  const base = filter ? state.purchaseOrders.filter((order) => order.projectId === filter.id) : state.purchaseOrders;
  const orders = tab === "active" ? base.filter((order) => isActiveOrder(state, order)) : base;
  const activeCount = base.filter((order) => isActiveOrder(state, order)).length;
  const columns = "minmax(0,1.1fr) minmax(0,1.4fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.6fr)";
  return <>{head}<FilterBar project={filter} base="/demo/sales" />
    <div className="erp-tabs" role="group" aria-label="Order view" style={{ marginBottom: 14 }}>
      <button type="button" aria-pressed={tab === "all"} onClick={() => setTab("all")}>Purchase orders ({base.length})</button>
      <button type="button" aria-pressed={tab === "active"} onClick={() => setTab("active")}>Active orders ({activeCount})</button>
    </div>
    <section className="erp-card">{orders.length ? <Rows columns={columns} head={["PO number", "Customer", "Project", "Value", "Delivery", "Order status"]}>
      {orders.map((order) => {
        const project = projectOf(state, order.projectId);
        const customer = state.customers.find((item) => item.id === order.customerId);
        const active = isActiveOrder(state, order);
        return <div key={order.id} role="row" className="erp-row" style={{ gridTemplateColumns: columns }}>
          <span><strong>{order.number}</strong><small>Received {formatDate(order.poDate)}</small><CustomValuesView state={state} entity="purchaseOrder" custom={order.custom} /></span>
          <span>{customer?.name}</span>
          <span>{project && <ProjectLink id={project.id} code={project.code} />}<small>{project?.name}</small></span>
          <span className="erp-num">{order.value !== null ? formatMoney(order.value, order.currency) : "—"}</span>
          <span>{formatDate(order.deliveryDate)}</span>
          <span><Badge tone={active ? "info" : orderOperationalState(state, order).startsWith("Dispatched") ? "ok" : "warn"}>{orderOperationalState(state, order)}</Badge></span>
        </div>;
      })}
    </Rows> : <EmptyState title="No active orders" text="An order becomes active when production starts, and stops being active once it is dispatched." />}</section>
    {orders.map((order) => <section key={`lines-${order.id}`} className="erp-card" style={{ marginTop: 16 }}>
      <div className="erp-card-head"><div><h2>{order.number} · parts, quantity and price</h2><p>{projectOf(state, order.projectId)?.name}</p></div>
        <span className="erp-head-actions"><EditButton label="Edit order" onClick={() => editor.open({ title: `Edit ${order.number}`, fields: [{ key: "number", label: "Customer’s PO number", required: true }, { key: "deliveryDate", label: "Required delivery date", type: "date", required: true }, ...customEditFields(state, "purchaseOrder")], initial: { number: order.number, deliveryDate: order.deliveryDate, ...customInitial(state, "purchaseOrder", order.custom) }, onSave: (v) => save((value) => setCustomValues(updatePurchaseOrder(value, order.id, { number: v.number, deliveryDate: v.deliveryDate }, nowIso()), "purchaseOrder", order.id, pickCustom(v))) })} />
        <button type="button" className="erp-btn erp-btn-sm" onClick={() => setOutput({ projectId: order.projectId, kind: "po" })}><Printer size={13} /> PO summary</button></span></div>
      <div className="erp-card-pad"><LineItemsEditor projectId={order.projectId} /></div>
    </section>)}
    <div style={{ marginTop: 14 }}><Rule>One project can carry several purchase orders over time. In this demo each project starts with one.</Rule></div>
    {output && <OutputDialog state={state} projectId={output.projectId} kind={output.kind} onClose={() => setOutput(null)} />}
    {editor.dialog}
  </>;
}

/* ---------------- Parts ---------------- */

export function PartsModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const filter = useProjectFilter(state);
  const [open, setOpen] = useState<string | null>(null);
  const [routing, setRouting] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const editor = useEditor();
  const head = <PageHead eyebrow="Engineering" title="Parts and revisions" description="Parts are created from project line items. Each revision is its own record, separate from the part identity." />;
  if (!hydrated) return <>{head}<Loading /></>;
  if (!state.parts.length) return <>{head}<NoProjects what="parts" /></>;
  const parts = filter ? state.parts.filter((part) => state.lineItems.some((line) => line.partId === part.id && line.projectId === filter.id)) : state.parts;
  const columns = "minmax(0,1fr) minmax(0,1.8fr) minmax(0,1fr) minmax(0,1.2fr) minmax(0,1.4fr)";
  return <>{head}<FilterBar project={filter} base="/demo/parts" /><section className="erp-card"><Rows columns={columns} head={["Part", "Description", "Revisions", "Projects", "Production readiness"]}>
    {parts.map((part) => {
      const revisions = state.revisions.filter((rev) => rev.partId === part.id);
      const lines = state.lineItems.filter((line) => line.partId === part.id && (!filter || line.projectId === filter.id));
      const statuses = lines.map((line) => {
        const order = state.productionOrders.find((item) => item.lineItemId === line.id);
        if (order) return isProductionComplete(order.status) ? "Complete" : "In production";
        const eng = lineEngineeringReady(state, line.projectId, line);
        const mat = lineMaterialReady(state, line);
        return eng && mat ? "Ready" : !eng ? "Needs drawing approval" : "Waiting for material";
      });
      const isOpen = open === part.id;
      return <div key={part.id}>
        <button type="button" className={`erp-row erp-row-click${isOpen ? " erp-row-active" : ""}`} style={{ gridTemplateColumns: columns, width: "100%", background: "transparent", border: 0, textAlign: "left", color: "inherit" }} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : part.id)}>
          <strong>{part.number}</strong><span>{part.description}</span>
          <span>{revisions.map((rev) => <span key={rev.id} className="erp-chip" style={{ marginRight: 4 }}>rev {rev.revision}</span>)}</span>
          <span>{[...new Set(lines.map((line) => projectOf(state, line.projectId)?.code))].join(", ")}</span>
          <span>{statuses.map((status, index) => <Badge key={index} tone={status === "Complete" ? "ok" : status === "Ready" || status === "In production" ? "info" : "warn"}>{status}</Badge>)}</span>
        </button>
        {isOpen && <div className="erp-detail"><div style={{ marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}><button type="button" className="erp-btn erp-btn-sm" onClick={() => setRouting(part.id)}>Routing: {routingFor(state, part.id).length} operations</button><EditButton label="Edit part" onClick={() => editor.open({ title: `Edit ${part.number}`, fields: [{ key: "description", label: "Description", required: true }, ...customEditFields(state, "part")], initial: { description: part.description, ...customInitial(state, "part", part.custom) }, onSave: (v) => save((value) => setCustomValues(updatePart(value, part.id, { description: v.description }, nowIso()), "part", part.id, pickCustom(v))) })} /><CustomValuesView state={state} entity="part" custom={part.custom} /></div>{lines.map((line) => {
          const project = projectOf(state, line.projectId);
          const docs = state.documents.filter((doc) => doc.partId === part.id && doc.projectIds.includes(line.projectId));
          const checks = state.inspectionRequirements.filter((req) => req.projectId === line.projectId && (req.partId === part.id || req.partId === null));
          return <div key={line.id} style={{ marginBottom: 12 }}>
            <p className="erp-label">{project && <ProjectLink id={project.id} code={project.code} />} · rev {revisionLabel(state, line.revisionId)} · {line.quantity} {line.unit}</p>
            <div className="erp-kv" style={{ marginTop: 8 }}>
              <div><small>Documents</small><b>{docs.length ? docs.map((doc) => <button key={doc.id} type="button" className="erp-linkbtn erp-doclink" onClick={() => setPreviewDoc(doc.id)}><DocIcon doc={doc} size={13} /> {doc.number} ({doc.status})</button>) : "No drawing yet"}</b></div>
              <div><small>Inspection requirements</small><b>{checks.length ? checks.map((req) => req.name).join(", ") : "None"}</b></div>
              <div><small>Drawing approved</small><b>{lineEngineeringReady(state, line.projectId, line) ? "Yes" : "No"}</b></div>
              <div><small>Material received</small><b>{lineMaterialReady(state, line) ? "Yes" : "No"}</b></div>
            </div>
          </div>;
        })}</div>}
      </div>;
    })}
  </Rows></section>{editor.dialog}
    {routing && <RoutingDialog state={state} partId={routing} onClose={() => setRouting(null)} />}
    {previewDoc && (() => { const doc = state.documents.find((item) => item.id === previewDoc); return doc ? <Modal label={`Preview ${doc.number}`} wide onClose={() => setPreviewDoc(null)}><div className="erp-card-pad"><DocPreview state={state} doc={doc} onClose={() => setPreviewDoc(null)} /></div></Modal> : null; })()}
  </>;
}

/* ---------------- Materials & procurement ---------------- */

export function MaterialsModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const filter = useProjectFilter(state);
  const editor = useEditor();
  const [ordering, setOrdering] = useState<OrderPrefill | null>(null);
  const [billing, setBilling] = useState<Partial<BillInput> | null>(null);
  const head = <PageHead eyebrow="Operations" title="Purchasing" description="What to buy, from whom, and where each order stands. Orders go to the supplier by email from here; confirmations, goods receipt and the bill follow." actions={<button type="button" className="erp-btn erp-btn-primary" onClick={() => setOrdering({})}><Mail size={15} /> Order by email</button>} />;
  if (!hydrated) return <>{head}<Loading /></>;
  const reqs = filter ? state.materialRequirements.filter((req) => req.projectId === filter.id) : state.materialRequirements;
  const columns = "minmax(0,2fr) 100px minmax(0,1.2fr) minmax(0,1.3fr) minmax(0,1fr) 230px";
  const orderFor = (req: (typeof reqs)[number]) => {
    const record = state.procurement.find((item) => item.requirementId === req.id);
    const raw = rawMaterialFor(state, req.material);
    const supplierName = record?.supplier || (raw?.supplierId ? state.suppliers.find((item) => item.id === raw.supplierId)?.name ?? "" : "");
    const supplier = state.suppliers.find((item) => item.name.toLowerCase() === supplierName.toLowerCase());
    setOrdering({ supplier: supplierName, email: supplier?.email ?? "", lines: [{ material: req.material, quantity: req.quantity, unit: req.unit, unitPrice: raw?.unitCost ?? null, requirementIds: [req.id] }] });
  };
  return <>{head}<FilterBar project={filter} base="/demo/materials" />
    {!filter && <ReorderPanel onOrder={setOrdering} />}
    {!filter && <SupplierOrdersSection onBill={setBilling} />}
    <section className="erp-card"><div className="erp-card-head"><div><h2>Material per project</h2><p>Purchase recommendations from the material of every part.</p></div></div>
    {reqs.length ? <Rows columns={columns} head={["Material", "Quantity", "For", "Supplier · purchase", "Status", ""]}>
    {reqs.map((req) => {
      const record = state.procurement.find((item) => item.requirementId === req.id);
      const project = projectOf(state, req.projectId);
      const line = req.lineItemId ? state.lineItems.find((item) => item.id === req.lineItemId) : null;
      const order = state.supplierOrders.find((item) => item.status !== "Cancelled" && item.lines.some((orderLine) => orderLine.requirementIds.includes(req.id)));
      return <div key={req.id} role="row" className="erp-row" style={{ gridTemplateColumns: columns }}>
        <strong>{req.material}</strong><span className="erp-num" style={{ textAlign: "left" }}>{req.quantity} {req.unit}</span>
        <span>{project && <ProjectLink id={project.id} code={project.code} />}<small>{line ? `${partNumber(state, line.partId)} rev ${revisionLabel(state, line.revisionId)}` : "Whole project"}</small></span>
        <span>{record?.supplier || "Not chosen"}<small>{order ? order.number : record?.number}</small></span>
        <span>{record && <Badge>{record.status}</Badge>}</span>
        <span className="erp-head-actions">
          {record?.status === "Not ordered" && <button type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={() => orderFor(req)}><Mail size={13} /> Order by email</button>}
          {record?.status === "Ordered" && !order && <button type="button" className="erp-btn erp-btn-sm" onClick={() => commit((current) => advanceProcurement(current, record.id, nowIso()))}>Mark received</button>}
          <EditButton onClick={() => editor.open({ title: `Edit ${req.material}`, fields: [{ key: "material", label: "Material", required: true }, { key: "quantity", label: "Quantity", type: "number", required: true }, { key: "unit", label: "Unit", type: "select", options: [...UNITS] }, { key: "supplier", label: "Supplier (optional)" }], initial: { material: req.material, quantity: String(req.quantity), unit: req.unit, supplier: record?.supplier ?? "" }, onSave: (v) => save((value) => updateMaterial(value, req.id, { material: v.material, quantity: num(v.quantity), unit: v.unit, supplier: v.supplier }, nowIso())) })} /></span>
      </div>;
    })}
  </Rows> : <EmptyState title="No material requirements" text="They come from the material of each part in a project." />}</section>
    <div style={{ marginTop: 14 }}><Rule>{RULES.materials} Receiving a supplier order adds the delivered quantity to stock; starting production takes the material out again.</Rule></div>
    {ordering && <SupplierOrderDialog prefill={ordering} onClose={() => setOrdering(null)} />}
    {billing && <BillDialog prefill={billing} onClose={() => setBilling(null)} />}
    {editor.dialog}</>;
}

/* ---------------- Production ---------------- */

export function ProductionModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const filter = useProjectFilter(state);
  const [output, setOutput] = useState<OutputState>(null);
  const editor = useEditor();
  const head = <PageHead eyebrow="Operations" title="Production" description="Production orders per part, with quantity, planned start and shop-floor details. Unapproved drawings or missing material show as warnings." />;
  if (!hydrated) return <>{head}<Loading /></>;
  if (!state.lineItems.length) return <>{head}<NoProjects what="production orders" /></>;
  const lines = state.lineItems.filter((line) => !filter || line.projectId === filter.id);
  const orders = state.productionOrders.filter((order) => !filter || order.projectId === filter.id);
  const waiting = lines.filter((line) => !state.productionOrders.some((order) => order.lineItemId === line.id));
  const columns = "minmax(0,1fr) minmax(0,1fr) minmax(0,1.3fr) 70px 170px minmax(0,1.2fr)";
  return <>{head}<FilterBar project={filter} base="/demo/production" />
    <section className="erp-card"><div className="erp-card-head"><div><h2>Production orders</h2><p>Each references its project, part, revision and required documents.</p></div></div>
      {orders.length ? <Rows columns={columns} head={["Order", "Project", "Part · revision", "Qty", "Status", ""]}>
        {orders.map((order) => {
          const project = projectOf(state, order.projectId);
          return <div key={order.id} role="row" className="erp-row" style={{ gridTemplateColumns: columns }}>
            <strong>{order.number}</strong><span>{project && <ProjectLink id={project.id} code={project.code} />}</span>
            <span>{partNumber(state, order.partId)} rev {revisionLabel(state, order.revisionId)}<CustomValuesView state={state} entity="productionOrder" custom={order.custom} />{(order.startDate || order.notes) && <small>{[order.startDate ? `Start ${formatDate(order.startDate)}` : "", order.notes ?? ""].filter(Boolean).join(" · ")}</small>}</span><span>{order.quantity}</span><span><StatusSelect key={order.status} id={`st-${order.id}`} label={`Status of ${order.number}`} value={order.status} onChange={(status) => commit((current) => setProductionStatus(current, order.id, status, nowIso()))} /></span>
            <span className="erp-head-actions">
              <EditButton onClick={() => editor.open({ title: `Edit ${order.number}`, fields: [{ key: "quantity", label: "Quantity to produce", type: "number", required: true }, { key: "startDate", label: "Planned start", type: "date" }, { key: "notes", label: "Details for the shop floor" }, ...customEditFields(state, "productionOrder")], initial: { quantity: String(order.quantity), startDate: order.startDate ?? "", notes: order.notes ?? "", ...customInitial(state, "productionOrder", order.custom) }, onSave: (v) => save((value) => setCustomValues(updateProductionOrder(value, order.id, { quantity: num(v.quantity), startDate: v.startDate, notes: v.notes, status: order.status }, nowIso()), "productionOrder", order.id, pickCustom(v))) })} />
              <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => setOutput({ projectId: order.projectId, kind: "production", productionOrderId: order.id })}><Printer size={13} /> Order</button>
            </span>
          </div>;
        })}
      </Rows> : <EmptyState title="No production orders yet" text="Production orders appear here once the project is released to production." />}
    </section>
    {waiting.length > 0 && <section className="erp-card" style={{ marginTop: 16 }}><div className="erp-card-head"><div><h2>Line items without a production order</h2><p>{RULES.production}</p></div></div>
      <Rows columns="minmax(0,1fr) minmax(0,1.3fr) minmax(0,2fr) 200px" head={["Project", "Part", "Readiness", ""]}>
        {waiting.map((line) => {
          const project = projectOf(state, line.projectId);
          const eng = lineEngineeringReady(state, line.projectId, line);
          const mat = lineMaterialReady(state, line);
          return <div key={line.id} role="row" className="erp-row" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr) minmax(0,2fr) 200px" }}>
            <span>{project && <ProjectLink id={project.id} code={project.code} />}</span><span>{partNumber(state, line.partId)} rev {revisionLabel(state, line.revisionId)} · {line.quantity}</span>
            <span><Badge tone={eng ? "ok" : "warn"}>{eng ? "Drawing approved" : "Drawing not approved (warning)"}</Badge> <Badge tone={mat ? "ok" : "warn"}>{mat ? "Material received" : "Material not received (warning)"}</Badge></span>
            <span><button type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={() => editor.open({ title: `Production order for ${partNumber(state, line.partId)}`, fields: [{ key: "quantity", label: "Quantity to produce", type: "number", required: true, help: `Customer ordered ${line.quantity} ${line.unit}` }, { key: "startDate", label: "Planned start", type: "date" }, { key: "notes", label: "Details for the shop floor (optional)" }], initial: { quantity: String(line.quantity), startDate: new Date().toISOString().slice(0, 10), notes: "" }, onSave: (v) => save((value) => createProductionOrder(value, line.id, nowIso(), { quantity: num(v.quantity), startDate: v.startDate, notes: v.notes })) })}>Create production order</button></span>
          </div>;
        })}
      </Rows>
    </section>}
    {output && <OutputDialog state={state} projectId={output.projectId} kind={output.kind} productionOrderId={output.productionOrderId} onClose={() => setOutput(null)} />}
    {editor.dialog}
  </>;
}

/* ---------------- Quality ---------------- */

export function QualityModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const filter = useProjectFilter(state);
  const [output, setOutput] = useState<OutputState>(null);
  const [inspecting, setInspecting] = useState<string | null>(null);
  const editor = useEditor();
  const head = <PageHead eyebrow="Operations" title="Quality and inspection" description="Inspection parameters per part. Add, edit or remove them, record the final inspection, and print the inspection report." />;
  if (!hydrated) return <>{head}<Loading /></>;
  if (!state.projects.length) return <>{head}<NoProjects what="inspection requirements" /></>;
  const projects = filter ? [filter] : state.projects;
  return <>{head}<FilterBar project={filter} base="/demo/quality" /><div className="erp-stack">
    {projects.map((project) => {
      const ready = readiness(state, project.id);
      const reqs = state.inspectionRequirements.filter((req) => req.projectId === project.id);
      const report = state.inspectionReports.find((item) => item.projectId === project.id);
      const canGenerate = ready.quality.reasons.some((reason) => reason.action?.kind === "generate-inspection-report");
      return <section key={project.id} className="erp-card">
        <div className="erp-card-head"><div><h2><ProjectLink id={project.id} code={project.code} /> {project.name}</h2><p>{ready.quality.summary}</p></div><ReadinessBadge state={ready.quality.state} /></div>
        {reqs.length ? <Rows columns="minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.2fr) minmax(0,1.2fr) 170px" head={["Parameter", "Applies to", "Specification", "Last result", ""]}>
          {reqs.map((req) => { const result = report?.results.find((item) => item.requirementId === req.id); return <div key={req.id} role="row" className="erp-row" style={{ gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.2fr) minmax(0,1.2fr) 170px" }}><strong>{req.name}</strong><span>{req.partId ? partNumber(state, req.partId) : "Whole project"}</span><span>{req.spec} {req.unit}</span><span className="erp-muted">{result ? `${result.observed} · ${result.pass ? "pass" : "fail"}` : "—"}</span>
            <span className="erp-head-actions"><EditButton onClick={() => editor.open({ title: `Edit ${req.name}`, fields: [{ key: "name", label: "What to check", required: true }, { key: "spec", label: "Requirement", required: true }, { key: "unit", label: "Unit (optional)" }], initial: { name: req.name, spec: req.spec, unit: req.unit }, onSave: (v) => save((value) => updateInspectionRequirement(value, req.id, { name: v.name, spec: v.spec, unit: v.unit }, nowIso())) })} />
              <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" aria-label={`Remove ${req.name}`} onClick={() => commit((value) => removeInspectionRequirement(value, req.id, nowIso()))}><Trash2 size={13} /></button></span></div>; })}
        </Rows> : <EmptyState title="No inspection requirements" text="Quality planning adds at least one requirement in the guided demo." />}
        <div className="erp-card-pad" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", borderTop: "1px solid var(--e-border)" }}>
          <button type="button" className="erp-btn erp-btn-sm" onClick={() => editor.open({ title: `Add parameter · ${project.code}`, fields: [{ key: "part", label: "Part", type: "select", options: state.lineItems.filter((line) => line.projectId === project.id).map((line) => partNumber(state, line.partId)) }, { key: "name", label: "What to check", required: true }, { key: "spec", label: "Requirement", required: true }, { key: "unit", label: "Unit (optional)" }], initial: { part: partNumber(state, state.lineItems.find((line) => line.projectId === project.id)?.partId ?? null), name: "", spec: "", unit: "" }, onSave: (v) => save((value) => addInspectionRequirement(value, project.id, { partId: value.parts.find((part) => part.number === v.part)?.id ?? null, name: v.name, spec: v.spec, unit: v.unit, acceptance: "Within requirement" }, nowIso())) })}><Plus size={14} /> Add parameter</button>
          {report ? <button type="button" className="erp-btn erp-btn-sm" onClick={() => setOutput({ projectId: project.id, kind: "inspection" })}><FileText size={14} /> View {report.number}</button>
            : null}
          {(!report || !report.passed) && <button type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={() => setInspecting(project.id)}>Record final inspection</button>}
          {!report && !canGenerate && <span className="erp-faint">{ready.quality.reasons[0]?.text}</span>}
          {report && <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => setInspecting(project.id)}>Inspect again</button>}
        </div>
      </section>;
    })}
    <Rule>{RULES.quality} Generated results are illustrative, not real measurements.</Rule>
  </div>
    {output && <OutputDialog state={state} projectId={output.projectId} kind={output.kind} onClose={() => setOutput(null)} />}
    {inspecting && <Modal label="Final inspection" wide onClose={() => setInspecting(null)}><div className="erp-card-pad erp-stack"><h2>Final inspection · {projectOf(state, inspecting)?.code}</h2><InspectionForm projectId={inspecting} onSaved={() => setInspecting(null)} /></div></Modal>}
    {editor.dialog}
  </>;
}

/* ---------------- Dispatch ---------------- */

export function DispatchModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const filter = useProjectFilter(state);
  const [output, setOutput] = useState<OutputState>(null);
  const head = <PageHead eyebrow="Operations" title="Dispatch" description="Delivery readiness for each order. An order cannot be dispatched until production is complete and inspection has passed." />;
  if (!hydrated) return <>{head}<Loading /></>;
  if (!state.purchaseOrders.length) return <>{head}<NoProjects what="orders to dispatch" /></>;
  const orders = state.purchaseOrders.filter((order) => !filter || order.projectId === filter.id);
  return <>{head}<FilterBar project={filter} base="/demo/dispatch" /><div className="erp-stack">
    {orders.map((order) => {
      const project = projectOf(state, order.projectId);
      const ready = readiness(state, order.projectId);
      const dispatched = state.dispatches.find((item) => item.purchaseOrderId === order.id);
      const lines = state.lineItems.filter((line) => line.purchaseOrderId === order.id);
      const canDispatch = ready.dispatch.reasons.some((reason) => reason.action?.kind === "dispatch");
      return <section key={order.id} className="erp-card">
        <div className="erp-card-head"><div><h2>{project && <ProjectLink id={project.id} code={project.code} />} {order.number}</h2><p>{project?.name} · due {formatDate(order.deliveryDate)}</p></div>{dispatched ? <Badge tone="ok">Dispatched</Badge> : <ReadinessBadge state={ready.dispatch.state} label={canDispatch ? "Ready" : "Not ready"} />}</div>
        <div className="erp-card-pad erp-stack" style={{ gap: 10 }}>
          <p>{lines.map((line) => `${line.quantity} ${line.unit} × ${partNumber(state, line.partId)} rev ${revisionLabel(state, line.revisionId)}`).join(" · ")}</p>
          {!dispatched && ready.dispatch.reasons.filter((reason) => !reason.action).map((reason) => <p key={reason.text} className="erp-faint">• {reason.text}</p>)}
          <div className="erp-head-actions">
            {dispatched ? <button type="button" className="erp-btn erp-btn-sm" onClick={() => setOutput({ projectId: order.projectId, kind: "dispatch" })}><Printer size={14} /> Dispatch note {dispatched.number}</button>
              : canDispatch ? <button type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={() => commit((current) => dispatchProject(current, order.projectId, nowIso()))}>Dispatch order</button> : null}
            {!dispatched && !canDispatch && project && <Link className="erp-btn erp-btn-ghost erp-btn-sm" href={`/demo/projects/${project.id}`}>See what’s missing</Link>}
          </div>
        </div>
      </section>;
    })}
  </div>{output && <OutputDialog state={state} projectId={output.projectId} kind={output.kind} onClose={() => setOutput(null)} />}</>;
}
