"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowLeft, FileText, Printer, RotateCcw, Sparkles, X } from "lucide-react";
import { GuideLink } from "@/components/erp/guide-link";
import { OutputDialog, type OutputKind } from "@/components/erp/outputs";
import { commit, resetDemo, useErp, useHydrated } from "@/components/erp/store";
import { Badge, EmptyState, Field, PageHead, ProjectLink, ReadinessBadge, Rule } from "@/components/erp/ui";
import {
  CURRENCIES, RULES, formatDate, formatMoney, isActiveOrder, lineEngineeringReady, lineMaterialReady, orderOperationalState,
  partNumber, projectStage, readiness, revisionLabel, updateSettings,
  type Currency, type ErpState, type Project,
} from "@/lib/erp/model";

/* ---------------- Shared helpers ---------------- */

function useProjectFilter(state: ErpState) {
  const params = useSearchParams();
  const id = params.get("project");
  const project = id ? state.projects.find((item) => item.id === id) ?? null : null;
  return project;
}

function FilterBar({ project, base }: { project: Project | null; base: string }) {
  if (!project) return null;
  return <div className="erp-hint" style={{ alignItems: "center" }}>
    <span>Showing records for <b>{project.code} · {project.name}</b></span>
    <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
      <Link className="erp-btn erp-btn-sm" href={`/demo/projects/${project.id}`}><ArrowLeft size={14} /> Back to project</Link>
      <Link className="erp-btn erp-btn-ghost erp-btn-sm" href={base}><X size={14} /> Show all</Link>
    </span>
  </div>;
}

function NoProjects({ what }: { what: string }) {
  return <div className="erp-card"><EmptyState title={`No ${what} yet`} text={`${what[0].toUpperCase()}${what.slice(1)} appear here automatically when you create a project in the guided demo. Nothing needs to be entered twice.`}>
    <Link className="erp-btn erp-btn-primary" href="/demo"><Sparkles size={15} /> Start the guided demo</Link>
  </EmptyState></div>;
}

function Loading() { return <p className="erp-muted" role="status">Loading…</p>; }

/** Department views are read-only; every change is made in the guided demo. */
function ViewOnly() {
  return <p className="erp-viewonly"><Sparkles size={14} /> View only. Records here come from your project. Make changes in the <GuideLink>guided demo</GuideLink></p>;
}

function Rows({ columns, head, children }: { columns: string; head: string[]; children: ReactNode }) {
  return <div className="erp-rows" role="table">
    <div className="erp-row erp-row-head" role="row" style={{ gridTemplateColumns: columns }}>{head.map((label, index) => <span key={index} role="columnheader">{label}</span>)}</div>
    {children}
  </div>;
}

const projectOf = (state: ErpState, id: string) => state.projects.find((project) => project.id === id);

type OutputState = { projectId: string; kind: OutputKind; productionOrderId?: string } | null;

/* ---------------- Projects ---------------- */

export function ProjectsModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const head = <PageHead eyebrow="Workspace" title="Projects" description="The single record every module links to. Open a project to see all of its connected information." actions={<Link className="erp-btn erp-btn-primary" href="/demo"><Sparkles size={15} /> Open guided demo</Link>} />;
  if (!hydrated) return <>{head}<Loading /></>;
  if (!state.projects.length) return <>{head}<NoProjects what="projects" /></>;
  return <>{head}<section className="erp-card"><Rows columns="minmax(0,2fr) minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr) 150px" head={["Project", "Customer", "Purchase order", "Delivery", "Status"]}>
    {[...state.projects].reverse().map((project) => {
      const customer = state.customers.find((item) => item.id === project.customerId);
      const po = state.purchaseOrders.find((item) => item.projectId === project.id);
      return <Link key={project.id} href={`/demo/projects/${project.id}`} role="row" className="erp-row erp-row-click" style={{ gridTemplateColumns: "minmax(0,2fr) minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr) 150px" }}>
        <span><strong>{project.name}</strong><small>{project.code}{project.isSample ? " · sample" : ""}</small></span>
        <span>{customer?.name}</span><span>{po?.number}</span><span>{po ? formatDate(po.deliveryDate) : "—"}</span>
        <span><Badge>{projectStage(state, project.id)}</Badge></span>
      </Link>;
    })}
  </Rows></section></>;
}

/* ---------------- CRM ---------------- */

export function CrmModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const filter = useProjectFilter(state);
  const [selected, setSelected] = useState<string | null>(null);
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
          <p className="erp-label" style={{ marginBottom: 8 }}>Linked projects and purchase orders</p>
          <ul className="erp-reasons">{orders.map((order) => { const project = projectOf(state, order.projectId); return <li key={order.id}><span><b style={{ color: "var(--e-text)" }}>{order.number}</b> · {project ? <ProjectLink id={project.id} code={project.code} /> : null} {project?.name} · due {formatDate(order.deliveryDate)} · {orderOperationalState(state, order)}</span></li>; })}</ul>
        </div>}
      </div>;
    })}
  </Rows></section></>;
}

/* ---------------- Sales ---------------- */

export function SalesModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const filter = useProjectFilter(state);
  const [tab, setTab] = useState<"all" | "active">("all");
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
          <span><strong>{order.number}</strong><small>Received {formatDate(order.poDate)}</small></span>
          <span>{customer?.name}</span>
          <span>{project && <ProjectLink id={project.id} code={project.code} />}<small>{project?.name}</small></span>
          <span className="erp-num">{order.value !== null ? formatMoney(order.value, order.currency) : "—"}</span>
          <span>{formatDate(order.deliveryDate)}</span>
          <span><Badge tone={active ? "info" : orderOperationalState(state, order).startsWith("Dispatched") ? "ok" : "warn"}>{orderOperationalState(state, order)}</Badge></span>
        </div>;
      })}
    </Rows> : <EmptyState title="No active orders" text="An order becomes active when production starts, and stops being active once it is dispatched." />}</section>
    <div style={{ marginTop: 14 }}><Rule>One project can carry several purchase orders over time. In this demo each project starts with one.</Rule></div>
  </>;
}

/* ---------------- Parts ---------------- */

export function PartsModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const filter = useProjectFilter(state);
  const [open, setOpen] = useState<string | null>(null);
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
        if (order) return order.status === "Complete" ? "Complete" : "In production";
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
        {isOpen && <div className="erp-detail">{lines.map((line) => {
          const project = projectOf(state, line.projectId);
          const docs = state.documents.filter((doc) => doc.partId === part.id && doc.projectIds.includes(line.projectId));
          const checks = state.inspectionRequirements.filter((req) => req.projectId === line.projectId && (req.partId === part.id || req.partId === null));
          return <div key={line.id} style={{ marginBottom: 12 }}>
            <p className="erp-label">{project && <ProjectLink id={project.id} code={project.code} />} · rev {revisionLabel(state, line.revisionId)} · {line.quantity} {line.unit}</p>
            <div className="erp-kv" style={{ marginTop: 8 }}>
              <div><small>Required documents</small><b>{docs.length ? docs.map((doc) => `${doc.number} (${doc.status})`).join(", ") : "No drawing yet"}</b></div>
              <div><small>Inspection requirements</small><b>{checks.length ? checks.map((req) => req.name).join(", ") : "None"}</b></div>
              <div><small>Drawing approved</small><b>{lineEngineeringReady(state, line.projectId, line) ? "Yes" : "No"}</b></div>
              <div><small>Material received</small><b>{lineMaterialReady(state, line) ? "Yes" : "No"}</b></div>
            </div>
          </div>;
        })}</div>}
      </div>;
    })}
  </Rows></section></>;
}

/* ---------------- Documents ---------------- */

export function DocumentsModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const filter = useProjectFilter(state);
  const [open, setOpen] = useState<string | null>(null);
  const head = <PageHead eyebrow="Engineering" title="Documents" description="Drawings, specifications, bills of materials and inspection plans, with revision and approval status. Metadata only: no files are stored in this demo." />;
  if (!hydrated) return <>{head}<Loading /></>;
  if (!state.documents.length) return <>{head}<NoProjects what="documents" /></>;
  const docs = filter ? state.documents.filter((doc) => doc.projectIds.includes(filter.id)) : state.documents;
  const columns = "minmax(0,1.1fr) minmax(0,1.8fr) minmax(0,1fr) 60px minmax(0,1fr) 120px";
  return <>{head}<FilterBar project={filter} base="/demo/documents" /><ViewOnly /><section className="erp-card"><Rows columns={columns} head={["Number", "Name", "Type", "Rev", "Linked to", "Approval"]}>
    {docs.map((doc) => {
      const isOpen = open === doc.id;
      return <div key={doc.id}>
        <button type="button" className={`erp-row erp-row-click${isOpen ? " erp-row-active" : ""}`} style={{ gridTemplateColumns: columns, width: "100%", background: "transparent", border: 0, textAlign: "left", color: "inherit" }} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : doc.id)}>
          <strong>{doc.number}</strong><span>{doc.name}</span><span className="erp-muted">{doc.type}</span><span>{doc.revision}</span>
          <span>{doc.projectIds.map((id) => projectOf(state, id)?.code).join(", ")}{doc.partId ? <small>{partNumber(state, doc.partId)}</small> : <small>Whole project</small>}</span>
          <span><Badge>{doc.status}</Badge></span>
        </button>
        {isOpen && <div className="erp-detail">
          <div className="erp-kv">
            <div><small>Source</small><b>{doc.source === "sample" ? "Sample metadata" : "Manual metadata"} · no file</b></div>
            <div><small>Part</small><b>{doc.partId ? partNumber(state, doc.partId) : "Whole project"}</b></div>
            <div><small>Projects</small><b>{doc.projectIds.map((id) => projectOf(state, id)?.code).join(", ")}</b></div>
            <div><small>Last change</small><b>{formatDate(doc.updatedAt)}</b></div>
          </div>
          {doc.status !== "Approved" && doc.type === "Drawing" && <div style={{ marginTop: 14 }}><GuideLink to="approve">Approve in guided demo</GuideLink></div>}
          {doc.type === "Drawing" && <p className="erp-faint" style={{ marginTop: 10 }}>{RULES.engineering}</p>}
        </div>}
      </div>;
    })}
  </Rows></section></>;
}

/* ---------------- Materials & procurement ---------------- */

export function MaterialsModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const filter = useProjectFilter(state);
  const head = <PageHead eyebrow="Operations" title="Purchasing" description="Material requirements come from the project. Each has a procurement record; production waits until the material is received." />;
  if (!hydrated) return <>{head}<Loading /></>;
  if (!state.materialRequirements.length) return <>{head}<NoProjects what="material requirements" /></>;
  const reqs = filter ? state.materialRequirements.filter((req) => req.projectId === filter.id) : state.materialRequirements;
  const columns = "minmax(0,2fr) 100px minmax(0,1.2fr) minmax(0,1.3fr) minmax(0,1fr) 150px";
  return <>{head}<FilterBar project={filter} base="/demo/materials" /><ViewOnly /><section className="erp-card"><Rows columns={columns} head={["Material", "Quantity", "For", "Supplier · PO", "Status", ""]}>
    {reqs.map((req) => {
      const record = state.procurement.find((item) => item.requirementId === req.id);
      const project = projectOf(state, req.projectId);
      const line = req.lineItemId ? state.lineItems.find((item) => item.id === req.lineItemId) : null;
      return <div key={req.id} role="row" className="erp-row" style={{ gridTemplateColumns: columns }}>
        <strong>{req.material}</strong><span className="erp-num" style={{ textAlign: "left" }}>{req.quantity} {req.unit}</span>
        <span>{project && <ProjectLink id={project.id} code={project.code} />}<small>{line ? `${partNumber(state, line.partId)} rev ${revisionLabel(state, line.revisionId)}` : "Whole project"}</small></span>
        <span>{record?.supplier || "Not chosen"}<small>{record?.number}</small></span>
        <span>{record && <Badge>{record.status}</Badge>}</span>
        <span>{record && record.status !== "Received" && <GuideLink to={record.status === "Not ordered" ? "order-material" : "receive-material"}>{record.status === "Not ordered" ? "Place order" : "Mark received"}</GuideLink>}</span>
      </div>;
    })}
  </Rows></section><div style={{ marginTop: 14 }}><Rule>{RULES.materials}</Rule></div></>;
}

/* ---------------- Production ---------------- */

export function ProductionModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const filter = useProjectFilter(state);
  const [output, setOutput] = useState<OutputState>(null);
  const head = <PageHead eyebrow="Operations" title="Production" description="Production orders are created per line item, only when the drawing is approved and the material is received." />;
  if (!hydrated) return <>{head}<Loading /></>;
  if (!state.lineItems.length) return <>{head}<NoProjects what="production orders" /></>;
  const lines = state.lineItems.filter((line) => !filter || line.projectId === filter.id);
  const orders = state.productionOrders.filter((order) => !filter || order.projectId === filter.id);
  const waiting = lines.filter((line) => !state.productionOrders.some((order) => order.lineItemId === line.id));
  const columns = "minmax(0,1fr) minmax(0,1fr) minmax(0,1.3fr) 90px 120px minmax(0,1.4fr)";
  return <>{head}<FilterBar project={filter} base="/demo/production" /><ViewOnly />
    <section className="erp-card"><div className="erp-card-head"><div><h2>Production orders</h2><p>Each references its project, part, revision and required documents.</p></div></div>
      {orders.length ? <Rows columns={columns} head={["Order", "Project", "Part · revision", "Qty", "Status", ""]}>
        {orders.map((order) => {
          const project = projectOf(state, order.projectId);
          return <div key={order.id} role="row" className="erp-row" style={{ gridTemplateColumns: columns }}>
            <strong>{order.number}</strong><span>{project && <ProjectLink id={project.id} code={project.code} />}</span>
            <span>{partNumber(state, order.partId)} rev {revisionLabel(state, order.revisionId)}</span><span>{order.quantity}</span><span><Badge>{order.status}</Badge></span>
            <span className="erp-head-actions">
              {order.status !== "Complete" && <GuideLink to={order.status === "Planned" ? "start" : "complete"}>{order.status === "Planned" ? "Start" : "Complete"}</GuideLink>}
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
            <span><Badge tone={eng ? "ok" : "warn"}>{eng ? "Drawing approved" : "Drawing not approved"}</Badge> <Badge tone={mat ? "ok" : "warn"}>{mat ? "Material received" : "Material not received"}</Badge></span>
            <span><GuideLink to={!eng ? "approve" : !mat ? "order-material" : "release"}>{eng && mat ? "Release to production" : "Fix in guided demo"}</GuideLink></span>
          </div>;
        })}
      </Rows>
    </section>}
    {output && <OutputDialog state={state} projectId={output.projectId} kind={output.kind} productionOrderId={output.productionOrderId} onClose={() => setOutput(null)} />}
  </>;
}

/* ---------------- Quality ---------------- */

export function QualityModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const filter = useProjectFilter(state);
  const [output, setOutput] = useState<OutputState>(null);
  const head = <PageHead eyebrow="Operations" title="Quality and inspection" description="Inspection requirements come from the project. Generate an illustrative inspection report once production is complete." />;
  if (!hydrated) return <>{head}<Loading /></>;
  if (!state.projects.length) return <>{head}<NoProjects what="inspection requirements" /></>;
  const projects = filter ? [filter] : state.projects;
  return <>{head}<FilterBar project={filter} base="/demo/quality" /><ViewOnly /><div className="erp-stack">
    {projects.map((project) => {
      const ready = readiness(state, project.id);
      const reqs = state.inspectionRequirements.filter((req) => req.projectId === project.id);
      const report = state.inspectionReports.find((item) => item.projectId === project.id);
      const canGenerate = ready.quality.reasons.some((reason) => reason.action?.kind === "generate-inspection-report");
      return <section key={project.id} className="erp-card">
        <div className="erp-card-head"><div><h2><ProjectLink id={project.id} code={project.code} /> {project.name}</h2><p>{ready.quality.summary}</p></div><ReadinessBadge state={ready.quality.state} /></div>
        {reqs.length ? <Rows columns="minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.2fr) minmax(0,1.6fr)" head={["Parameter", "Applies to", "Specification", "Acceptance"]}>
          {reqs.map((req) => <div key={req.id} role="row" className="erp-row" style={{ gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.2fr) minmax(0,1.6fr)" }}><strong>{req.name}</strong><span>{req.partId ? partNumber(state, req.partId) : "Whole project"}</span><span>{req.spec} {req.unit}</span><span className="erp-muted">{req.acceptance || "—"}</span></div>)}
        </Rows> : <EmptyState title="No inspection requirements" text="Quality planning adds at least one requirement in the guided demo." />}
        <div className="erp-card-pad" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", borderTop: "1px solid var(--e-border)" }}>
          {!reqs.length && <GuideLink to="inspection">Add requirement</GuideLink>}
          {report ? <button type="button" className="erp-btn erp-btn-sm" onClick={() => setOutput({ projectId: project.id, kind: "inspection" })}><FileText size={14} /> View {report.number}</button>
            : canGenerate && <GuideLink to="inspect" primary>Run final inspection</GuideLink>}
          {!report && !canGenerate && <span className="erp-faint">{ready.quality.reasons[0]?.text}</span>}
        </div>
      </section>;
    })}
    <Rule>{RULES.quality} Generated results are illustrative, not real measurements.</Rule>
  </div>
    {output && <OutputDialog state={state} projectId={output.projectId} kind={output.kind} onClose={() => setOutput(null)} />}
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
  return <>{head}<FilterBar project={filter} base="/demo/dispatch" /><ViewOnly /><div className="erp-stack">
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
              : canDispatch ? <GuideLink to="dispatch" primary>Dispatch in guided demo</GuideLink> : null}
            {!dispatched && !canDispatch && project && <Link className="erp-btn erp-btn-ghost erp-btn-sm" href={`/demo/projects/${project.id}`}>See what’s missing</Link>}
          </div>
        </div>
      </section>;
    })}
  </div>{output && <OutputDialog state={state} projectId={output.projectId} kind={output.kind} onClose={() => setOutput(null)} />}</>;
}

/* ---------------- Finance ---------------- */

export function FinanceModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const filter = useProjectFilter(state);
  const [output, setOutput] = useState<OutputState>(null);
  const head = <PageHead eyebrow="Finance" title="Invoices" description="An illustrative invoice is generated from the dispatched order: customer, project, line items and prices come from the same records. Not an accounting system." />;
  if (!hydrated) return <>{head}<Loading /></>;
  if (!state.projects.length) return <>{head}<NoProjects what="invoices" /></>;
  const projects = state.projects.filter((project) => !filter || project.id === filter.id);
  const columns = "minmax(0,1fr) minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 200px";
  return <>{head}<FilterBar project={filter} base="/demo/finance" /><ViewOnly /><section className="erp-card"><Rows columns={columns} head={["Project", "Customer", "Order", "Invoice", "Total", ""]}>
    {projects.map((project) => {
      const order = state.purchaseOrders.find((item) => item.projectId === project.id);
      const invoice = state.invoices.find((item) => item.projectId === project.id);
      const customer = state.customers.find((item) => item.id === project.customerId);
      const ready = readiness(state, project.id);
      const canInvoice = ready.invoice.reasons.some((reason) => reason.action?.kind === "generate-invoice");
      return <div key={project.id}>
        <div role="row" className="erp-row" style={{ gridTemplateColumns: columns }}>
          <span><ProjectLink id={project.id} code={project.code} /></span><span>{customer?.name}</span><span>{order?.number}</span>
          <span>{invoice ? <><strong>{invoice.number}</strong><small>Due {formatDate(invoice.dueAt)}</small></> : <Badge tone={canInvoice ? "info" : "neutral"}>{ready.invoice.summary}</Badge>}</span>
          <span className="erp-num" style={{ textAlign: "left" }}>{invoice ? formatMoney(invoice.total, invoice.currency) : "—"}</span>
          <span className="erp-head-actions">{invoice ? <button type="button" className="erp-btn erp-btn-sm" onClick={() => setOutput({ projectId: project.id, kind: "invoice" })}><Printer size={13} /> View invoice</button>
            : canInvoice ? <GuideLink to="invoice" primary>Invoice in guided demo</GuideLink> : null}</span>
        </div>
      </div>;
    })}
  </Rows></section><div style={{ marginTop: 14 }}><Rule>{RULES.invoice} Tax uses the rate in Configuration ({state.settings.taxRate}%).</Rule></div>
    {output && <OutputDialog state={state} projectId={output.projectId} kind={output.kind} onClose={() => setOutput(null)} />}
  </>;
}

/* ---------------- Configuration ---------------- */

export function ConfigurationModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const head = <PageHead eyebrow="Settings" title="Configuration" description="A few demo settings, and the transparent rules every readiness status is calculated from." />;
  if (!hydrated) return <>{head}<Loading /></>;
  const set = (patch: Parameters<typeof updateSettings>[1]) => { commit((current) => updateSettings(current, patch)); setSaved(true); };
  return <>{head}<div className="erp-grid-2">
    <section className="erp-card erp-card-pad erp-stack">
      <h2 style={{ fontSize: 16 }}>Demo settings</h2>
      <Field id="cfg-tax" label="Tax rate for invoices (%)" help="Illustrative only. Applied to new invoices."><input className="erp-input" id="cfg-tax" type="number" min={0} max={30} step={0.5} value={state.settings.taxRate} onChange={(event) => set({ taxRate: Math.min(30, Math.max(0, Number(event.target.value) || 0)) })} /></Field>
      <Field id="cfg-cur" label="Default currency for new projects"><select className="erp-select" id="cfg-cur" value={state.settings.defaultCurrency} onChange={(event) => set({ defaultCurrency: event.target.value as Currency })}>{CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}</select></Field>
      <Field id="cfg-terms" label="Payment terms (days)"><input className="erp-input" id="cfg-terms" type="number" min={0} max={120} value={state.settings.paymentTermsDays} onChange={(event) => set({ paymentTermsDays: Math.min(120, Math.max(0, Math.round(Number(event.target.value) || 0))) })} /></Field>
      {saved && <p className="erp-ok-text" role="status">Saved in this browser.</p>}
      <div style={{ paddingTop: 10, borderTop: "1px solid var(--e-border)" }}>
        <p className="erp-faint" style={{ marginBottom: 10 }}>Demo data is stored only in this browser’s local storage. It is not a shared or secure database.</p>
        <button type="button" className="erp-btn erp-btn-danger erp-btn-sm" onClick={() => { resetDemo(); router.push("/demo"); }}><RotateCcw size={14} /> Reset demo to empty</button>
      </div>
    </section>
    <section className="erp-card"><div className="erp-card-head"><div><h2>Workflow rules</h2><p>Every status in the demo comes from these.</p></div></div>
      <ul className="erp-reasons" style={{ padding: 16 }}>{Object.entries(RULES).map(([key, text]) => <li key={key}><span><b style={{ color: "var(--e-text)", textTransform: "capitalize", minWidth: 96 }}>{key}</b> {text}</span></li>)}</ul>
    </section>
  </div></>;
}
