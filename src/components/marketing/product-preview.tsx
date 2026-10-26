"use client";

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  Bell,
  Boxes,
  ChevronDown,
  ClipboardList,
  FileClock,
  FileText,
  GitBranch,
  LayoutDashboard,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { documents, parts, productionOrders, DEMO_COMPANY } from "@/lib/demo-data";
import { evaluateOrderCompleteness } from "@/lib/configuration-rules";
import { createSeedConfiguration } from "@/lib/configuration-model";

type View = "Overview" | "Documents" | "Parts" | "Production orders" | "Workflows";

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Documents", icon: FileText },
  { label: "Parts", icon: Boxes },
  { label: "Production orders", icon: ClipboardList },
  { label: "Workflows", icon: GitBranch },
];

const seedConfiguration = createSeedConfiguration();
const documentRows = documents.slice(0, 3).map((document) => ({
  name: document.title,
  id: document.number,
  rev: document.revision,
  status: document.status,
  date: document.updated,
  tone: document.status === "Approved" ? "green" : document.status === "In review" ? "blue" : "amber",
  href: `/demo/documents/${document.id}`,
}));
const orderRows = productionOrders.slice(0, 3).map((order) => {
  const part = parts.find((item) => item.id === order.partId)!;
  const issueCount = evaluateOrderCompleteness(order, seedConfiguration, documents, parts).length;
  return {
    id: order.number,
    href: `/demo/production/${order.id}`,
    part: `${part.number} · ${part.name}`,
    qty: `${order.quantity} pcs`,
    step: order.workflow,
    state: issueCount ? `${issueCount} record issue${issueCount === 1 ? "" : "s"}` : order.status,
    tone: issueCount ? "amber" : order.status === "Complete" ? "green" : "blue",
  };
});

function Status({ label, tone }: { label: string; tone: string }) {
  return <span className={`status-pill status-${tone}`}><i />{label}</span>;
}

function OverviewPanel() {
  const reviewCount = documents.filter((document) => document.status === "In review").length;
  return (
    <>
      <div className="preview-heading-row">
        <div><span className="preview-kicker">MONDAY, 19 OCTOBER</span><h3>Good morning, team</h3><p>Here’s what needs your attention today.</p></div>
        <Link className="quiet-button" href="/demo/documents"><Plus size={14} /> Browse records</Link>
      </div>
      <div className="summary-grid">
        <article className="summary-card"><div className="summary-top"><span>Engineering records</span><FileText size={15} /></div><strong>{documents.length}</strong><small><span className="summary-dot dot-blue" /> Across {parts.length} synthetic parts</small></article>
        <article className="summary-card"><div className="summary-top"><span>In review</span><FileClock size={15} /></div><strong>{reviewCount}</strong><small><span className="summary-dot dot-amber" /> Sample records awaiting review</small></article>
        <article className="summary-card"><div className="summary-top"><span>Open orders</span><ClipboardList size={15} /></div><strong>{productionOrders.filter((order) => order.status !== "Complete").length}</strong><small><span className="summary-dot dot-green" /> Synthetic order records</small></article>
      </div>
      <div className="preview-lower-grid">
        <section className="preview-panel document-panel">
          <div className="panel-title-row"><div><h4>Recently updated</h4><p>Latest engineering records</p></div><Link className="text-button" href="/demo/documents">View all <ArrowRight size={13} /></Link></div>
          <div className="document-list">
            {documentRows.slice(0, 2).map((row) => <Link href={row.href} className="document-row" key={row.id}>
              <span className="file-icon"><FileText size={15} /></span>
              <div className="document-name"><strong>{row.name}</strong><small>{row.id} <span>·</span> Rev {row.rev}</small></div>
              <Status label={row.status} tone={row.tone} />
            </Link>)}
          </div>
        </section>
        <section className="attention-card">
          <div className="attention-icon"><AlertTriangle size={16} /></div>
          <div><span className="attention-label">CONFIGURED RECORD CHECK</span><h4>{orderRows.find((order) => order.tone === "amber")?.id ?? "Sample order"} needs review</h4><p>Open the linked order to see the exact record requirement and status.</p><Link className="attention-link" href={orderRows.find((order) => order.tone === "amber")?.href ?? "/demo/production"}>Review order <ArrowRight size={13} /></Link></div>
        </section>
      </div>
      <div className="preview-footnote"><span><span className="live-dot" /> Sample workspace</span><span>All records shown are synthetic</span></div>
    </>
  );
}

function DocumentsPanel() {
  return (
    <>
      <div className="preview-heading-row">
        <div><span className="preview-kicker">ENGINEERING RECORDS</span><h3>Documents</h3><p>Find the current, approved record for every part.</p></div>
        <Link className="quiet-button" href="/demo/documents"><Plus size={14} /> Browse documents</Link>
      </div>
      <div className="table-toolbar"><div className="search-field"><Search size={14} /><span>Search documents or part numbers</span></div><Link className="filter-button" href="/demo/documents"><SlidersHorizontal size={14} /> Browse records <ChevronDown size={13} /></Link></div>
      <div className="records-table">
        <div className="records-head"><span>DOCUMENT / PART</span><span>REVISION</span><span>STATUS</span><span>UPDATED</span></div>
        {documentRows.map((row) => <Link href={row.href} className="records-row" key={row.id}>
          <div className="record-cell-main"><span className="file-icon"><FileText size={15} /></span><span><strong>{row.name}</strong><small>{row.id}</small></span></div>
          <span className="revision-badge">{row.rev}</span><Status label={row.status} tone={row.tone} /><span className="record-date">{row.date}</span>
        </Link>)}
      </div>
      <div className="preview-footnote"><span><span className="live-dot" /> Sample workspace</span><span>Revision history · Approval status · Linked parts</span></div>
    </>
  );
}

function PartsPanel() {
  const sampleParts = parts.slice(0, 3).map((part) => ({
    ...part,
    docs: `${documents.filter((document) => document.partId === part.id).length} linked records`,
    orders: `${productionOrders.filter((order) => order.partId === part.id).length} orders`,
  }));
  return (
    <>
      <div className="preview-heading-row">
        <div><span className="preview-kicker">ENGINEERING CATALOG</span><h3>Parts</h3><p>Engineering context, connected to the work.</p></div>
        <Link className="quiet-button" href="/demo/parts"><Plus size={14} /> Browse parts</Link>
      </div>
      <div className="records-table part-table">
        <div className="records-head"><span>PART</span><span>MATERIAL</span><span>DOCUMENTS</span><span>ORDERS</span></div>
        {sampleParts.map((part) => <Link href={`/demo/parts/${part.id}`} className="records-row" key={part.id}>
          <div className="record-cell-main"><span className="file-icon part-icon"><Boxes size={15} /></span><span><strong>{part.name}</strong><small>{part.number}</small></span></div>
          <span className="record-date material-cell">{part.material}</span><span className="record-date">{part.docs}</span><span className="record-date">{part.orders}</span>
        </Link>)}
      </div>
      <div className="preview-footnote"><span><span className="live-dot" /> Synthetic workspace records</span><span>Links use the sample record relationships</span></div>
    </>
  );
}

function WorkflowsPanel() {
  const stages = seedConfiguration.workflows[0]?.stages ?? [];
  return (
    <>
      <div className="preview-heading-row">
        <div><span className="preview-kicker">CONFIGURABLE PROCESS</span><h3>Workflows</h3><p>A sample route for a precision part order.</p></div>
        <Link className="quiet-button" href="/demo/workflows"><GitBranch size={14} /> View configured workflow</Link>
      </div>
      <div className="workflow-preview-heading"><span><strong>{seedConfiguration.workflows[0]?.name ?? "Sample workflow"}</strong><small>Configured stage order · no approvals are executed</small></span><span className="workflow-version">SAMPLE</span></div>
      <div className="workflow-steps">
        {stages.map((stage, index) => <div className="workflow-step" key={stage.id}>
          <span className="workflow-step-icon">{index + 1}</span><span className="workflow-step-copy"><strong>{stage.name}</strong><small>{stage.role} · {stage.description}</small></span><span className="workflow-state">Configured</span>{index < stages.length - 1 && <i className="workflow-connector" />}
        </div>)}
      </div>
      <div className="preview-footnote"><span><span className="live-dot" /> Synthetic workflow definition</span><span>Stages are configured, not executed</span></div>
    </>
  );
}

function OrdersPanel() {
  return (
    <>
      <div className="preview-heading-row">
        <div><span className="preview-kicker">SHOP FLOOR</span><h3>Production orders</h3><p>Keep requirements and work status connected.</p></div>
        <Link className="quiet-button" href="/demo/production"><Plus size={14} /> Browse orders</Link>
      </div>
      <div className="order-list">
        {orderRows.map((order) => <Link href={order.href} className="order-row" key={order.id}>
          <div className="order-main"><div className="order-icon"><ClipboardList size={15} /></div><div><span className="order-id">{order.id}</span><strong>{order.part}</strong><small>{order.qty} <span>·</span> {order.step}</small></div></div>
          <Status label={order.state} tone={order.tone} />
        </Link>)}
      </div>
      <div className="preview-footnote"><span><span className="live-dot" /> Synthetic workspace records</span><span>Open an order to inspect configured requirements</span></div>
    </>
  );
}

export function ProductPreview() {
  const [view, setView] = useState<View>("Overview");

  return (
    <section className="product-preview-wrap" id="product-preview" aria-label="Interactive BOH ERP interface preview">
      <div className="preview-window">
        <div className="window-topbar">
          <div className="window-brand"><span className="mini-mark"><i /></span><strong>BOH ERP</strong><span className="workspace-label">{DEMO_COMPANY.name.toUpperCase()}</span></div>
          <div className="window-actions"><span className="preview-mode-label">SYNTHETIC DEMO</span><Link className="round-action" href="/demo/activity" aria-label="Open demo activity"><Bell size={15} /><i /></Link><span className="avatar" aria-label="Fictional sample workspace">AP</span></div>
        </div>
        <div className="window-body">
          <aside className="preview-sidebar">
            <div className="workspace-switch"><span className="workspace-glyph">AP</span><span><strong>{DEMO_COMPANY.name}</strong><small>{DEMO_COMPANY.label}</small></span><ChevronDown size={13} /></div>
            <div className="sidebar-label">WORKSPACE</div>
            <nav aria-label="Preview workspace navigation">
              {navigation.map(({ label, icon: Icon }) => <button key={label} className={`sidebar-link${view === label ? " selected" : ""}`} type="button" aria-pressed={view === label} onClick={() => setView(label as View)}>
                <Icon size={15} /><span>{label}</span>{label === "Documents" && <span className="sidebar-count">{documents.length}</span>}
              </button>)}
            </nav>
            <div className="sidebar-bottom"><Link className="sidebar-link" href="/demo/configuration"><Settings2 size={15} /><span>Configuration</span></Link><Link className="sidebar-link" href="/privacy"><span aria-hidden="true">i</span><span>Data handling</span></Link></div>
          </aside>
          <div className="preview-main" role="region" aria-label="Sample workspace content">
            <div className="preview-topline"><span>Workspace <b>/</b> {view}</span><div className="preview-top-actions"><Link href="/demo/documents" aria-label="Open demo records"><Search size={15} /></Link><Link href="/demo/configuration" aria-label="Open demo configuration"><Settings2 size={15} /></Link></div></div>
            {view === "Overview" ? <OverviewPanel /> : view === "Documents" ? <DocumentsPanel /> : view === "Parts" ? <PartsPanel /> : view === "Workflows" ? <WorkflowsPanel /> : <OrdersPanel />}
          </div>
        </div>
      </div>
      <div className="preview-caption"><span><span className="caption-line" /> A clearer view of the work.</span><span>INTERACTIVE PRODUCT PREVIEW <ArrowDownRight size={14} /></span></div>
    </section>
  );
}
