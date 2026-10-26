"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, Boxes, CheckCircle2, CircleDashed, Factory, FileText, Minus, PackageCheck, Paperclip, Plus, Receipt, RotateCcw,
  ShieldCheck, ShoppingCart, Sparkles, Trash2, Truck, Users,
} from "lucide-react";
import { BohMark } from "@/components/brand/boh-logo";
import { commit, getState, nowIso, resetDemo, todayIso, useErp, useHydrated } from "@/components/erp/store";
import { Badge, Field } from "@/components/erp/ui";
import { StatusSelect } from "@/components/erp/edit";
import { InspectionForm } from "@/components/erp/inspection-form";
import { MAX_PARTS, guideSteps, workStepCount, type GuideStep, type StepKind } from "@/components/erp/guide-steps";
import {
  UNITS, advanceProcurement, createProductionOrder, createProjectFromDraft, dispatchProject, firstInvalidStep, formatDate,
  formatMoney, generateInspectionReport, generateInvoice, isProductionComplete, lineEngineeringReady, setProductionStatus, lineMaterialReady, newDraft, parseAmount, partNumber,
  projectRecords, readiness, reuseCatalog, revisionLabel, validateStep,
  type DraftLine, type ErpState, type ProjectDraft, type StoredFile,
} from "@/lib/erp/model";

type Dept = "crm" | "sales" | "project" | "parts" | "engineering" | "quality" | "purchasing" | "production" | "dispatch" | "finance";

const STEP_DEPT: Partial<Record<StepKind, Dept>> = {
  customer: "crm", project: "project", order: "sales", "part-count": "sales", part: "parts", drawing: "engineering", inspection: "quality",
  quantity: "sales", material: "purchasing", review: "project", purchase: "purchasing", "production-order": "production", "run-production": "production",
  inspect: "quality", dispatch: "dispatch", invoice: "finance",
};

const DEPT_LABEL: Record<Dept, { label: string; icon: typeof Users }> = {
  crm: { label: "CRM", icon: Users }, project: { label: "Projects", icon: Sparkles }, sales: { label: "Sales", icon: ShoppingCart },
  parts: { label: "Parts", icon: Boxes }, engineering: { label: "Engineering", icon: FileText }, quality: { label: "Quality", icon: ShieldCheck },
  purchasing: { label: "Purchasing", icon: PackageCheck }, production: { label: "Production", icon: Factory }, dispatch: { label: "Dispatch", icon: Truck },
  finance: { label: "Finance", icon: Receipt },
};

const FILE_DATA_LIMIT = 1024 * 1024;
const TOTAL_FILE_DATA_LIMIT = 3 * 1024 * 1024;

function setStep(step: number) {
  commit((state) => ({ ...state, guide: { ...state.guide, step, furthest: Math.max(step, state.guide.furthest ?? 0) } }));
  if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
}

const emptyLine = (index: number): DraftLine => ({ key: `line-${index + 1}`, partNumber: "", description: "", quantity: "", unit: "pcs", unitPrice: "", revision: "A" });

function ensureDraft(state: ErpState): ErpState {
  if (state.draft) return state;
  return { ...state, draft: { ...newDraft(state, todayIso()), lines: [emptyLine(0)] } };
}

/** Starts a new project in the guided demo. Existing projects stay. */
export function startAnotherProject() {
  commit((state) => ensureDraft({ ...state, draft: null, guide: { step: 1, projectId: null, furthest: 1, v: 2 } }));
  if (typeof window !== "undefined") window.scrollTo({ top: 0 });
}

function updateDraft(change: (draft: ProjectDraft) => ProjectDraft) {
  commit((state) => (state.draft ? { ...state, draft: change(state.draft) } : state));
}

/** Changes the number of parts on the order, keeping what was already entered. */
function resizeParts(draft: ProjectDraft, count: number): ProjectDraft {
  const lines = Array.from({ length: count }, (_, index) => draft.lines[index] ?? emptyLine(index));
  const keys = new Set(lines.map((line) => line.key));
  return {
    ...draft, lines,
    documents: draft.documents.filter((doc) => !doc.partKey || keys.has(doc.partKey)),
    inspections: draft.inspections.filter((item) => !item.partKey || keys.has(item.partKey)),
    materials: draft.materials.filter((item) => !item.lineKey || keys.has(item.lineKey)),
  };
}

function storedFileBytes(state: ErpState) {
  const docs = [...state.documents, ...(state.draft?.documents ?? [])];
  return docs.reduce((sum, doc) => sum + (doc.file?.data?.length ?? 0), 0);
}

/* ============================== Main ============================== */

export function GuidedDemo() {
  const state = useErp();
  const hydrated = useHydrated();
  if (!hydrated) return <p className="erp-muted" role="status">Loading the demo…</p>;

  const steps = guideSteps(state);
  const step = Math.min(state.guide.step, steps.length - 1);
  const current = steps[step];
  const dept = STEP_DEPT[current.kind];

  if (current.kind === "welcome") return <Welcome />;
  if (current.kind === "done" && state.guide.projectId) return <Finished state={state} />;

  return <div className="erp-guide">
    <div>
      <details className="erp-card erp-panel-mobile">
        <summary>Your project so far <span className="erp-chip">Step {step} of {workStepCount(steps)}</span></summary>
        <ProjectPanel state={state} active={dept} />
      </details>
      <section className="erp-card erp-step" aria-labelledby="step-title">
        <StepScreen key={`${current.kind}-${current.part ?? ""}`} current={current} step={step} steps={steps} state={state} />
      </section>
    </div>
    <aside className="erp-card erp-panel" aria-label="Your project so far"><ProjectPanel state={state} active={dept} /></aside>
  </div>;
}

/* ============================== Welcome & finish ============================== */

function Welcome() {
  const hasProjects = useErp().projects.length > 0;
  const start = () => { commit((state) => ensureDraft({ ...state, guide: { ...state.guide, step: 1, furthest: Math.max(1, state.guide.furthest ?? 0) } })); window.scrollTo({ top: 0 }); };
  return <section className="erp-card erp-step erp-welcome" aria-labelledby="welcome-title">
    <div><span className="erp-eyebrow">Interactive demo · about 5–8 minutes</span>
      <h1 id="welcome-title">Follow one project from order to invoice.</h1>
      <p className="erp-step-lead">{hasProjects ? "Create another project. Customers, parts, drawings and materials from your earlier projects can be reused. " : ""}Enter a customer order with one or more parts. Then move it through purchasing, production, inspection, dispatch and invoicing, one small step at a time. Every department works on the same record.</p></div>
    <ol aria-label="What happens">
      <li><b>1 · Sales</b><span>Customer, order and number of parts</span></li>
      <li><b>2 · Parts</b><span>Details, drawing, inspection, price, material</span></li>
      <li><b>3 · Operations</b><span>Purchasing, production, final inspection</span></li>
      <li><b>4 · Delivery</b><span>Dispatch and invoice</span></li>
    </ol>
    <div className="erp-head-actions"><button type="button" className="erp-btn erp-btn-primary erp-btn-lg" onClick={start}>Start the demo <ArrowRight size={18} /></button><span className="erp-faint">No account needed. Everything stays in your browser.</span></div>
  </section>;
}

function Finished({ state }: { state: ErpState }) {
  const projectId = state.guide.projectId!;
  const r = projectRecords(state, projectId);
  const invoice = r.invoices[0];
  const restart = () => { resetDemo(); window.scrollTo({ top: 0 }); };
  const dispatched = Boolean(r.dispatches[0]);
  const openProduction = r.productionOrders.filter((order) => !isProductionComplete(order.status)).length;
  const inspected = Boolean(r.inspectionReports[0]?.passed);
  const docs = [
    { label: "PO summary", href: `/demo/sales?project=${projectId}`, tab: "Sales orders" },
    { label: "Production orders", href: `/demo/production?project=${projectId}`, tab: "Production" },
    { label: "Inspection report", href: `/demo/quality?project=${projectId}`, tab: "Quality" },
    { label: "Delivery note", href: `/demo/dispatch?project=${projectId}`, tab: "Dispatch" },
    { label: "Invoice", href: `/demo/finance?project=${projectId}`, tab: "Invoices" },
  ];
  const unapproved = r.documents.filter((doc) => doc.status !== "Approved").length;
  const openPurchases = r.procurement.filter((item) => item.status !== "Received").length;
  return <div className="erp-stack">
    <section className="erp-card erp-step" aria-labelledby="finished-title">
      <div className="erp-step-top"><span className="erp-step-dept"><CheckCircle2 size={15} /> Finished</span><BohMark size={44} /></div>
      <h1 id="finished-title">{invoice ? `${r.project?.name} is delivered and invoiced.` : `${r.project?.name} is set up.`}</h1>
      <p className="erp-step-lead">{invoice ? "You entered the order once. Sales, engineering, quality, purchasing, production, dispatch and finance all worked on the same record." : "The open steps below can be done later in their tabs. Everything stays connected to this one project."}</p>
      <ul className="erp-checks" style={{ marginTop: 24, maxWidth: 680 }}>
        <li><CheckCircle2 size={18} color="#1E7F4E" /> {r.customer?.name} · purchase order {r.purchaseOrders[0]?.number}</li>
        {r.lineItems.map((line) => <li key={line.id}><CheckCircle2 size={18} color="#1E7F4E" /> {line.quantity} {line.unit} × {partNumber(state, line.partId)} rev {revisionLabel(state, line.revisionId)}</li>)}
        {dispatched && <li><CheckCircle2 size={18} color="#1E7F4E" /> Dispatched with {r.dispatches[0]?.number}{invoice ? ` · invoice ${invoice.number} · ${formatMoney(invoice.total, invoice.currency)}` : ""}</li>}
      </ul>
      {(() => {
        const open = [
          openProduction ? { text: `${openProduction} production order${openProduction === 1 ? "" : "s"} not completed`, href: `/demo/production?project=${projectId}` } : null,
          !inspected ? { text: "Final inspection", href: `/demo/quality?project=${projectId}` } : null,
          !dispatched ? { text: "Dispatch", href: `/demo/dispatch?project=${projectId}` } : null,
          !invoice ? { text: "Invoice", href: `/demo/finance?project=${projectId}` } : null,
          unapproved ? { text: `${unapproved} document${unapproved === 1 ? "" : "s"} to approve`, href: `/demo/documents?project=${projectId}` } : null,
          openPurchases ? { text: `${openPurchases} purchase${openPurchases === 1 ? "" : "s"} to order or receive`, href: `/demo/materials?project=${projectId}` } : null,
        ].filter((item): item is { text: string; href: string } => Boolean(item));
        return open.length > 0 && <div style={{ marginTop: 18 }}><p className="erp-label">Open for later</p><ul className="erp-checks" style={{ maxWidth: 680 }}>{open.map((item) => <li key={item.text}><CircleDashed size={18} color="#8A5A00" /><span style={{ flex: 1 }}>{item.text}</span><Link className="erp-btn erp-btn-sm" href={item.href}>Open tab <ArrowRight size={13} /></Link></li>)}</ul></div>;
      })()}
    </section>
    <section className="erp-card" aria-labelledby="docs-title">
      <div className="erp-card-head"><div><h2 id="docs-title">Documents are in the tabs</h2><p>Each document is generated from the same project data. Open the tab to preview, print or save as PDF.</p></div></div>
      <div className="erp-outputs">{docs.map((doc) => <Link key={doc.label} href={doc.href} className="erp-output"><FileText size={18} /><strong>{doc.label}</strong><span>{doc.tab} tab</span></Link>)}</div>
    </section>
    <div className="erp-head-actions">
      <Link className="erp-btn erp-btn-dark" href="/demo/overview">Open the Overview <ArrowRight size={16} /></Link>
      <Link className="erp-btn" href={`/demo/projects/${projectId}`}>Project record</Link>
      <button type="button" className="erp-btn erp-btn-primary" onClick={startAnotherProject}><Plus size={15} /> Create another project</button>
      <button type="button" className="erp-btn" onClick={restart}><RotateCcw size={15} /> Clear all and start over</button>
      <Link className="erp-btn erp-btn-ghost" href="/contact">Talk to us about your workflow</Link>
    </div>
  </div>;
}

/* ============================== Side panel ============================== */

function ProjectPanel({ state, active }: { state: ErpState; active?: Dept }) {
  const projectId = state.guide.projectId;
  const draft = state.draft;
  const r = projectId ? projectRecords(state, projectId) : null;
  const po = r?.purchaseOrders[0];
  const parts = r ? r.lineItems.map((line) => `${partNumber(state, line.partId)} ×${line.quantity}`) : (draft?.lines ?? []).filter((line) => line.partNumber.trim()).map((line) => `${line.partNumber.toUpperCase()}${line.quantity ? ` ×${line.quantity}` : ""}`);
  const drawings = r ? r.documents.filter((doc) => doc.type === "Drawing") : [];
  const draftDrawings = draft?.documents.filter((doc) => doc.type === "Drawing" && doc.number.trim()) ?? [];
  const params = r ? r.inspectionRequirements.length : draft?.inspections.filter((item) => item.name.trim()).length ?? 0;
  const materials = r ? r.materialRequirements.map((req) => req.material) : draft?.materials.filter((item) => item.material.trim()).map((item) => item.material.trim()) ?? [];
  const report = r?.inspectionReports[0];
  const orders = r?.productionOrders ?? [];
  const received = r ? r.procurement.filter((item) => item.status === "Received").length : 0;
  const rows: { dept: Dept; value: string; detail: string }[] = [
    { dept: "crm", value: r?.customer?.name ?? draft?.customerName.trim() ?? "", detail: "Customer record" },
    { dept: "project", value: r?.project?.code ?? (draft?.projectName.trim() ? draft.projectCode : ""), detail: r?.project?.name ?? draft?.projectName.trim() ?? "" },
    { dept: "sales", value: po?.number ?? draft?.poNumber.trim() ?? "", detail: po ? `Due ${formatDate(po.deliveryDate)}${po.value !== null ? ` · ${formatMoney(po.value, po.currency)}` : ""}` : draft?.poNumber.trim() ? `${draft.lines.length} part${draft.lines.length === 1 ? "" : "s"} on the order` : "" },
    { dept: "parts", value: parts.length ? `${parts.length} part${parts.length === 1 ? "" : "s"}` : "", detail: parts.join(" · ") },
    { dept: "engineering", value: (r ? drawings.length : draftDrawings.length) ? `${r ? drawings.length : draftDrawings.length} drawing${(r ? drawings.length : draftDrawings.length) === 1 ? "" : "s"}` : "", detail: r ? `${drawings.filter((doc) => doc.status === "Approved").length} approved · approval later` : draftDrawings.map((doc) => doc.file ? `${doc.number} 📎` : doc.number).join(" · ") },
    { dept: "quality", value: params ? `${params} parameter${params === 1 ? "" : "s"}` : "", detail: report ? `${report.number} ${report.passed ? "passed" : "failed"}` : "" },
    { dept: "purchasing", value: materials.length ? materials.join(", ") : "", detail: r && materials.length ? `${received} of ${r.procurement.length} received · recommendation` : "" },
    { dept: "production", value: orders.length ? orders.map((order) => order.number).join(", ") : "", detail: orders.length ? orders.map((order) => order.status).join(" · ") : "" },
    { dept: "dispatch", value: r?.dispatches[0]?.number ?? "", detail: r?.dispatches[0] ? `Shipped ${formatDate(r.dispatches[0].dispatchedAt)}` : "" },
    { dept: "finance", value: r?.invoices[0]?.number ?? "", detail: r?.invoices[0] ? formatMoney(r.invoices[0].total, r.invoices[0].currency) : "" },
  ];
  return <>
    <header><h3>Your project so far</h3><p>One record. Each department adds to it.</p></header>
    <ul>{rows.map(({ dept, value, detail }) => <li key={dept} className={`${value ? "has-data" : ""}${active === dept ? " is-active" : ""}`}>
      <strong>{DEPT_LABEL[dept].label}</strong>
      <span>{value || "—"}</span>
      {value && detail && <em>{detail}</em>}
    </li>)}</ul>
  </>;
}

/* ============================== Step frame ============================== */

const TITLES: Record<Exclude<StepKind, "welcome" | "done">, { title: string; lead: string }> = {
  customer: { title: "Who is the customer?", lead: "Every project starts with a customer. BOH ERP saves it once in CRM, so nobody types it again." },
  project: { title: "Name the project", lead: "The project ID ties together every record that follows." },
  order: { title: "Register the purchase order", lead: "The customer’s order is the commercial commitment." },
  "part-count": { title: "How many parts are on this order?", lead: "Count the different part numbers on the customer’s PO. You will enter each part in a few small steps." },
  part: { title: "Part details", lead: "Enter the part, or pick one that was used before. BOH ERP creates the part and its revision." },
  drawing: { title: "Technical drawing", lead: "Upload the drawing for this part, or reuse one that already exists. Approval happens later, outside this flow." },
  inspection: { title: "What must quality check?", lead: "Add the inspection parameters for this part. They appear on the final inspection later." },
  quantity: { title: "Quantity and price", lead: "How many does the customer want, and at what price? You can change both later in Sales or the project record." },
  material: { title: "Which material is needed?", lead: "Purchasing uses this to recommend what to order." },
  review: { title: "Check and create the project", lead: "Everything below becomes one project record. Nothing is saved until you create it." },
  purchase: { title: "Purchase recommendations", lead: "Based on the material for each part, BOH ERP recommends what to buy. Ordering is optional here; you can order and receive later in the Purchasing tab." },
  "production-order": { title: "Create production orders", lead: "Choose a part, confirm the quantity and add the details for the shop floor. Repeat for every part." },
  "run-production": { title: "Run production", lead: "Start each production order and mark it complete when the parts are made." },
  inspect: { title: "Final inspection", lead: "Record the result for each parameter. The inspection report is generated from it in the Quality tab." },
  dispatch: { title: "Ship the order", lead: "Dispatch is possible when production is complete and the final inspection has passed." },
  invoice: { title: "Create the invoice", lead: "The invoice uses the quantities and prices on the order. Nothing is typed again." },
};

function StepScreen({ current, step, steps, state }: { current: GuideStep; step: number; steps: GuideStep[]; state: ErpState }) {
  if (current.kind === "welcome" || current.kind === "done") return null;
  const copy = TITLES[current.kind];
  const dept = STEP_DEPT[current.kind];
  const Icon = dept ? DEPT_LABEL[dept].icon : Sparkles;
  const total = workStepCount(steps);
  const progress = Math.round((step / total) * 100);
  const partCount = steps.filter((item) => item.kind === "part").length;
  return <>
    <div className="erp-step-top">
      <span style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <span className="erp-step-dept"><Icon size={15} /> {dept ? DEPT_LABEL[dept].label : ""}</span>
        {current.part !== undefined && <span className="erp-step-dept erp-step-part">Part {current.part + 1} of {partCount}</span>}
      </span>
      <div className="erp-progress" style={{ minWidth: 200 }}><span>Step {step} of {total}</span><span className="erp-progress-bar"><span style={{ width: `${progress}%` }} /></span></div>
    </div>
    <h1 id="step-title">{copy.title}</h1>
    <p className="erp-step-lead">{copy.lead}</p>
    {state.guide.projectId && isDraftStep(current.kind) ? <SavedStep current={current} step={step} state={state} />
      : isDraftStep(current.kind) ? <DraftStep current={current} step={step} state={state} />
      : <WorkStep current={current} step={step} state={state} />}
  </>;
}

const DRAFT_STEPS: StepKind[] = ["customer", "project", "order", "part-count", "part", "drawing", "inspection", "quantity", "material", "review"];
const isDraftStep = (kind: StepKind) => DRAFT_STEPS.includes(kind);

function Foot({ step, canContinue = true, onContinue, label = "Continue" }: { step: number; canContinue?: boolean; onContinue?: () => void; label?: string }) {
  return <div className="erp-step-foot">
    <button type="button" className="erp-btn erp-btn-ghost" onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Back</button>
    <button type="button" className="erp-btn erp-btn-primary" disabled={!canContinue} onClick={onContinue ?? (() => setStep(step + 1))}>{label} <ArrowRight size={16} /></button>
  </div>;
}

/* After the project exists, the entry steps show what was saved. */
function SavedStep({ current, step, state }: { current: GuideStep; step: number; state: ErpState }) {
  const r = projectRecords(state, state.guide.projectId!);
  const po = r.purchaseOrders[0];
  const line = current.part !== undefined ? r.lineItems[current.part] : undefined;
  let text = "";
  if (current.kind === "customer") text = r.customer?.name ?? "";
  if (current.kind === "project") text = `${r.project?.code} · ${r.project?.name}`;
  if (current.kind === "order") text = `${po?.number} · due ${po ? formatDate(po.deliveryDate) : ""}`;
  if (current.kind === "part-count") text = `${r.lineItems.length} part${r.lineItems.length === 1 ? "" : "s"} on ${po?.number}`;
  if (current.kind === "review") text = `Project ${r.project?.code} created`;
  if (line) {
    const label = `${partNumber(state, line.partId)} rev ${revisionLabel(state, line.revisionId)}`;
    if (current.kind === "part") text = `${label} · ${state.parts.find((part) => part.id === line.partId)?.description ?? ""}`;
    if (current.kind === "drawing") { const doc = r.documents.find((item) => item.type === "Drawing" && item.partId === line.partId); text = doc ? `${doc.number} rev ${doc.revision}${doc.file ? ` · ${doc.file.name}` : ""} · ${doc.status}` : "No drawing"; }
    if (current.kind === "inspection") text = r.inspectionRequirements.filter((req) => req.partId === line.partId).map((req) => `${req.name} ${req.spec}${req.unit ? ` ${req.unit}` : ""}`).join(" · ");
    if (current.kind === "quantity") text = `${line.quantity} ${line.unit}${line.unitPrice !== null && po ? ` at ${formatMoney(line.unitPrice, po.currency)}` : ""}`;
    if (current.kind === "material") text = r.materialRequirements.filter((req) => req.lineItemId === line.id).map((req) => `${req.quantity} ${req.unit} ${req.material}`).join(" · ");
  }
  return <><div className="erp-step-body">
    <p className="erp-done"><CheckCircle2 size={18} /> Saved: {text}</p>
    {current.kind === "quantity" && <p className="erp-faint">Change quantity or price in the <Link className="erp-link" href={`/demo/sales?project=${state.guide.projectId}`}>Sales orders</Link> tab or the project record.</p>}
  </div><Foot step={step} /></>;
}

/* ============================== Entry steps (draft) ============================== */

function DraftStep({ current, step, state }: { current: GuideStep; step: number; state: ErpState }) {
  const [shown, setShown] = useState(false);
  const [note, setNote] = useState("");
  const draft = state.draft;
  if (!draft) return <><div className="erp-step-body"><p className="erp-muted">Start the demo first.</p></div><Foot step={step} canContinue={false} /></>;
  const line = current.part !== undefined ? draft.lines[current.part] : undefined;
  const catalog = reuseCatalog(state, draft);
  const update = (patch: Partial<ProjectDraft>) => updateDraft((d) => ({ ...d, ...patch }));
  const updateLine = (patch: Partial<DraftLine>) => line && updateDraft((d) => ({ ...d, lines: d.lines.map((item) => item.key === line.key ? { ...item, ...patch } : item) }));

  // Errors for the fields on this step only.
  const errors: Record<string, string> = {};
  const pick = (all: Record<string, string>, keys: string[]) => { for (const key of keys) if (all[key]) errors[key] = all[key]; };
  const lk = (field: string) => (line ? `lines.${line.key}.${field}` : field);
  const v0 = validateStep(state, draft, 0); const v1 = validateStep(state, draft, 1); const v2 = validateStep(state, draft, 2);
  if (current.kind === "customer") { pick(v0, ["customerName"]); pick(v1, ["contact"]); }
  if (current.kind === "project") pick(v0, ["projectName", "projectCode"]);
  if (current.kind === "order") { pick(v0, ["poNumber"]); pick(v1, ["deliveryDate"]); }
  if (current.kind === "part") pick(v2, [lk("partNumber"), lk("description"), lk("revision")]);
  if (current.kind === "quantity") { pick(v2, [lk("quantity"), lk("unitPrice")]); if (line && !line.unitPrice.trim() && !errors[lk("unitPrice")]) errors[lk("unitPrice")] = "Enter the price per unit."; }
  const doc = line ? draft.documents.find((item) => item.partKey === line.key && item.type === "Drawing") : undefined;
  const params = line ? draft.inspections.filter((item) => item.partKey === line.key) : [];
  const material = line ? draft.materials.find((item) => item.lineKey === line.key) : undefined;
  if (current.kind === "drawing") {
    if (!doc?.number.trim()) errors.drawingNumber = "Enter the drawing number, or pick an existing drawing.";
    if (doc && !/^[A-Z0-9]{1,3}$/.test(doc.revision.trim().toUpperCase())) errors.drawingRevision = "Use 1–3 letters or digits, e.g. A.";
  }
  if (current.kind === "inspection") {
    const filled = params.filter((item) => item.name.trim() || item.spec.trim());
    if (!filled.length) errors.params = "Add at least one parameter with its requirement.";
    for (const item of filled) { if (!item.name.trim()) errors[`p-${item.key}-name`] = "Name the parameter."; if (!item.spec.trim()) errors[`p-${item.key}-spec`] = "Enter the requirement."; }
  }
  if (current.kind === "material") {
    if (!material?.material.trim()) errors.material = "Enter the material.";
    if (!(Number((material?.quantity ?? "").replace(",", ".")) > 0)) errors.materialQty = "Enter a quantity above 0.";
  }
  const err = (key: string) => (shown ? errors[key] : undefined);
  const aria = (key: string, id: string) => ({ id, "aria-invalid": err(key) ? true : undefined, "aria-describedby": `${id}-${err(key) ? "error" : "help"}` }) as const;

  const next = () => {
    if (Object.keys(errors).length) { setShown(true); window.setTimeout(() => (document.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus(), 0); return; }
    if (current.kind === "inspection" && line) updateDraft((d) => ({ ...d, inspections: d.inspections.filter((item) => item.partKey !== line.key || item.name.trim() || item.spec.trim()) }));
    setStep(step + 1);
  };

  let body: ReactNode = null;
  let footLabel = "Continue";
  let onContinue = next;

  if (current.kind === "customer") body = <>
    <Field id="g-customer" label="Customer name" error={err("customerName")} help="For example: Apex Aerospace GmbH"><input className="erp-input" {...aria("customerName", "g-customer")} list="g-customers" value={draft.customerName} autoComplete="organization" onChange={(event) => update({ customerName: event.target.value })} /></Field>
    <datalist id="g-customers">{state.customers.map((item) => <option key={item.id} value={item.name} />)}</datalist>
    <Field id="g-contact" label="Contact email (optional)" error={err("contact")} help="Who should receive documents?"><input className="erp-input" {...aria("contact", "g-contact")} value={draft.contact} onChange={(event) => update({ contact: event.target.value })} /></Field>
  </>;

  if (current.kind === "project") body = <>
    <Field id="g-name" label="Project name" error={err("projectName")} help="For example: Hydraulic Actuator Assembly"><input className="erp-input" {...aria("projectName", "g-name")} value={draft.projectName} onChange={(event) => update({ projectName: event.target.value })} /></Field>
    <Field id="g-code" label="Project ID" error={err("projectCode")} help="Suggested by BOH ERP. You can change it."><input className="erp-input" {...aria("projectCode", "g-code")} value={draft.projectCode} onChange={(event) => update({ projectCode: event.target.value.toUpperCase() })} /></Field>
  </>;

  if (current.kind === "order") body = <>
    <Field id="g-po" label="Customer’s PO number" error={err("poNumber")} help="For example: PO-2026-1042"><input className="erp-input" {...aria("poNumber", "g-po")} value={draft.poNumber} onChange={(event) => update({ poNumber: event.target.value.toUpperCase() })} /></Field>
    <Field id="g-due" label="Required delivery date" error={err("deliveryDate")} help={`Order date: ${formatDate(draft.poDate)}`}><input className="erp-input" type="date" {...aria("deliveryDate", "g-due")} min={draft.poDate} value={draft.deliveryDate} onChange={(event) => update({ deliveryDate: event.target.value })} /></Field>
  </>;

  if (current.kind === "part-count") {
    const count = draft.lines.length;
    const setCount = (value: number) => updateDraft((d) => resizeParts(d, Math.min(MAX_PARTS, Math.max(1, value))));
    body = <>
      <div className="erp-counter" role="group" aria-label="Number of parts">
        <button type="button" className="erp-btn" aria-label="One part less" disabled={count <= 1} onClick={() => setCount(count - 1)}><Minus size={18} /></button>
        <output aria-live="polite"><strong>{count}</strong><span>part{count === 1 ? "" : "s"}</span></output>
        <button type="button" className="erp-btn" aria-label="One part more" disabled={count >= MAX_PARTS} onClick={() => setCount(count + 1)}><Plus size={18} /></button>
      </div>
      <p className="erp-faint">Up to {MAX_PARTS} parts in this demo. Each part takes five short steps.</p>
    </>;
  }

  if (current.kind === "part" && line) {
    const others = new Set(draft.lines.filter((item) => item.key !== line.key).map((item) => item.partNumber.trim().toUpperCase()));
    const reusable = catalog.parts.filter((item) => !others.has(item.number));
    body = <>
      {reusable.length > 0 && <Field id="g-reuse-part" label="Use a part from before (optional)" help="Fills in the number, description and revision.">
        <select className="erp-select" id="g-reuse-part" value="" onChange={(event) => { const item = reusable.find((part) => part.number === event.target.value); if (item) { updateLine({ partNumber: item.number, description: item.description, revision: item.revision }); setNote(`Using existing part ${item.number}.`); } }}>
          <option value="">Choose a part…</option>{reusable.map((item) => <option key={item.number} value={item.number}>{item.number} · {item.description} (rev {item.revision})</option>)}
        </select></Field>}
      {note && <p className="erp-faint" role="status">{note}</p>}
      <Field id="g-pn" label="Part number" error={err(lk("partNumber"))} help="For example: ACT-204"><input className="erp-input" {...aria(lk("partNumber"), "g-pn")} value={line.partNumber} onChange={(event) => updateLine({ partNumber: event.target.value.toUpperCase() })} /></Field>
      <Field id="g-desc" label="Description" error={err(lk("description"))} help="For example: Hydraulic Actuator Housing"><input className="erp-input" {...aria(lk("description"), "g-desc")} value={line.description} onChange={(event) => updateLine({ description: event.target.value })} /></Field>
      <Field id="g-rev" label="Revision" error={err(lk("revision"))} help="Usually A for a new part."><input className="erp-input" {...aria(lk("revision"), "g-rev")} maxLength={3} value={line.revision} onChange={(event) => updateLine({ revision: event.target.value.toUpperCase() })} /></Field>
    </>;
  }

  if (current.kind === "drawing" && line) {
    const key = `doc-${line.key}`;
    const setDoc = (patch: Partial<NonNullable<typeof doc>>) => updateDraft((d) => {
      const existing = d.documents.find((item) => item.key === key);
      const base = existing ?? { key, name: `${line.description.trim() || line.partNumber} drawing`, type: "Drawing" as const, number: "", revision: line.revision || "A", partKey: line.key, status: "In review" as const, source: "metadata" as const };
      const updated = { ...base, ...patch };
      return { ...d, documents: existing ? d.documents.map((item) => item.key === key ? updated : item) : [...d.documents, updated] };
    });
    const onFile = (file: File | undefined) => {
      if (!file) return;
      const meta: StoredFile = { name: file.name, size: file.size, type: file.type || "application/octet-stream" };
      const fits = file.size <= FILE_DATA_LIMIT && storedFileBytes(getState()) + file.size * 1.4 <= TOTAL_FILE_DATA_LIMIT;
      const apply = (data?: string) => { setDoc({ file: data ? { ...meta, data } : meta, source: "upload", ...(doc?.number.trim() ? {} : { number: `DRW-${line.partNumber.trim().toUpperCase()}` }) }); setNote(data ? `${file.name} attached. It is kept in this browser only.` : `${file.name} noted (${Math.round(file.size / 1024)} KB). Large files keep only the name and size in this demo.`); };
      if (!fits) { apply(); return; }
      const reader = new FileReader();
      reader.onload = () => apply(typeof reader.result === "string" ? reader.result : undefined);
      reader.onerror = () => apply();
      reader.readAsDataURL(file);
    };
    const reusable = catalog.drawings.filter((item) => !(doc && item.number === doc.number.trim().toUpperCase() && item.revision === doc.revision.trim().toUpperCase()));
    body = <>
      {reusable.length > 0 && <Field id="g-reuse-drw" label="Reuse an existing drawing (optional)" help="Links the same drawing to this part instead of uploading it again.">
        <select className="erp-select" id="g-reuse-drw" value="" onChange={(event) => { const item = reusable.find((drawing) => `${drawing.number}|${drawing.revision}` === event.target.value); if (item) { setDoc({ number: item.number, revision: item.revision, name: item.name, file: undefined, source: "metadata" }); setNote(`Linked to existing drawing ${item.number} rev ${item.revision}${item.file ? ` (${item.file})` : ""}.`); } }}>
          <option value="">Choose a drawing…</option>{reusable.map((item) => <option key={`${item.number}|${item.revision}`} value={`${item.number}|${item.revision}`}>{item.number} rev {item.revision} · {item.name}{item.file ? ` · ${item.file}` : ""}</option>)}
        </select></Field>}
      <div className="erp-field">
        <label htmlFor="g-file">Upload drawing (optional)</label>
        <label className="erp-upload">
          <Paperclip size={18} />
          <span>{doc?.file ? <><b>{doc.file.name}</b> · {Math.round(doc.file.size / 1024)} KB{doc.file.data ? "" : " · name only"}</> : <>Choose a PDF, image, DXF or STEP file</>}</span>
          <input id="g-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.svg,.dxf,.dwg,.step,.stp,.igs,.iges" onChange={(event) => onFile(event.target.files?.[0])} />
        </label>
        <span className="erp-help">Files up to 1 MB are kept in this browser so you can open them later. Please use fictional drawings.</span>
      </div>
      {note && <p className="erp-faint" role="status">{note}</p>}
      <div className="erp-form-grid">
        <Field id="g-drw" label="Drawing number" error={err("drawingNumber")} help={`For example: DRW-${line.partNumber.trim().toUpperCase() || "ACT-204"}`}><input className="erp-input" {...aria("drawingNumber", "g-drw")} value={doc?.number ?? ""} onChange={(event) => setDoc({ number: event.target.value.toUpperCase() })} /></Field>
        <Field id="g-drw-rev" label="Drawing revision" error={err("drawingRevision")} help={`Part revision: ${line.revision || "A"}`}><input className="erp-input" {...aria("drawingRevision", "g-drw-rev")} maxLength={3} value={doc?.revision ?? line.revision} onChange={(event) => setDoc({ revision: event.target.value.toUpperCase() })} /></Field>
      </div>
    </>;
  }

  if (current.kind === "inspection" && line) {
    const addRow = (preset?: { name: string; spec: string; unit: string }) => updateDraft((d) => ({ ...d, inspections: [...d.inspections, { key: `insp-${line.key}-${Date.now().toString(36)}`, name: preset?.name ?? "", spec: preset?.spec ?? "", unit: preset?.unit ?? "", acceptance: "Within requirement", partKey: line.key }] }));
    const setRow = (key: string, patch: Partial<ProjectDraft["inspections"][number]>) => updateDraft((d) => ({ ...d, inspections: d.inspections.map((item) => item.key === key ? { ...item, ...patch } : item) }));
    const removeRow = (key: string) => updateDraft((d) => ({ ...d, inspections: d.inspections.filter((item) => item.key !== key) }));
    const rows = params.length ? params : null;
    if (!rows) window.setTimeout(() => { if (!getState().draft?.inspections.some((item) => item.partKey === line.key)) addRow(); }, 0);
    const suggestions = catalog.parameters;
    body = <>
      <datalist id="g-params">{suggestions.map((item) => <option key={`${item.name}|${item.spec}`} value={item.name}>{item.spec} {item.unit}</option>)}</datalist>
      {(rows ?? []).map((item, index) => <div key={item.key} className="erp-param">
        <div className="erp-param-head"><b>Parameter {index + 1}</b>{params.length > 1 && <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => removeRow(item.key)} aria-label={`Remove parameter ${index + 1}`}><Trash2 size={14} /> Remove</button>}</div>
        <Field id={`g-pn-${item.key}`} label="What to check" error={err(`p-${item.key}-name`)} help="For example: Outer diameter. Pick a suggestion to reuse it.">
          <input className="erp-input" id={`g-pn-${item.key}`} list="g-params" aria-invalid={err(`p-${item.key}-name`) ? true : undefined} value={item.name} onChange={(event) => { const found = suggestions.find((s) => s.name === event.target.value); setRow(item.key, found && !item.spec ? { name: found.name, spec: found.spec, unit: found.unit } : { name: event.target.value }); }} /></Field>
        <div className="erp-form-grid">
          <Field id={`g-ps-${item.key}`} label="Requirement" error={err(`p-${item.key}-spec`)} help="For example: 63.50 ± 0.05"><input className="erp-input" id={`g-ps-${item.key}`} aria-invalid={err(`p-${item.key}-spec`) ? true : undefined} value={item.spec} onChange={(event) => setRow(item.key, { spec: event.target.value })} /></Field>
          <Field id={`g-pu-${item.key}`} label="Unit (optional)" help="For example: mm"><input className="erp-input" id={`g-pu-${item.key}`} value={item.unit} onChange={(event) => setRow(item.key, { unit: event.target.value })} /></Field>
        </div>
      </div>)}
      {err("params") && <p className="erp-error" role="alert">{err("params")}</p>}
      <div><button type="button" className="erp-btn" onClick={() => addRow()}><Plus size={15} /> Add parameter</button></div>
      <p className="erp-faint">Use fictional values. They are not real engineering specifications.</p>
    </>;
  }

  if (current.kind === "quantity" && line) {
    const price = parseAmount(line.unitPrice);
    body = <>
      <div className="erp-form-grid">
        <Field id="g-qty" label="Quantity" error={err(lk("quantity"))} help="For example: 50"><input className="erp-input" inputMode="numeric" {...aria(lk("quantity"), "g-qty")} value={line.quantity} onChange={(event) => updateLine({ quantity: event.target.value.replace(/[^0-9]/g, "") })} /></Field>
        <Field id="g-unit" label="Unit"><select className="erp-select" id="g-unit" value={line.unit} onChange={(event) => updateLine({ unit: event.target.value })}>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></Field>
      </div>
      <Field id="g-price" label={`Price per unit, ${draft.currency}`} error={err(lk("unitPrice"))} help="For example: 184.00. Used for the invoice."><input className="erp-input" inputMode="decimal" {...aria(lk("unitPrice"), "g-price")} value={line.unitPrice} onChange={(event) => updateLine({ unitPrice: event.target.value })} /></Field>
      {price !== null && !Number.isNaN(price) && Number(line.quantity) > 0 && <p className="erp-faint">Line value: {formatMoney(price * Number(line.quantity), draft.currency)}</p>}
    </>;
  }

  if (current.kind === "material" && line) {
    const key = `mat-${line.key}`;
    const setMat = (patch: Partial<ProjectDraft["materials"][number]>) => updateDraft((d) => {
      const existing = d.materials.find((item) => item.key === key);
      const base = existing ?? { key, material: "", quantity: "", unit: "kg", supplier: "", status: "Not ordered" as const, lineKey: line.key };
      const updated = { ...base, ...patch };
      return { ...d, materials: existing ? d.materials.map((item) => item.key === key ? updated : item) : [...d.materials, updated] };
    });
    const others = catalog.materials;
    body = <>
      <datalist id="g-materials">{others.map((item) => <option key={item.material} value={item.material}>{item.unit}{item.supplier ? ` · ${item.supplier}` : ""}</option>)}</datalist>
      <datalist id="g-suppliers">{catalog.suppliers.map((name) => <option key={name} value={name} />)}</datalist>
      <Field id="g-mat" label="Material" error={err("material")} help={others.length ? "Type or pick a material used before." : "For example: Aluminium round bar Ø70 mm"}>
        <input className="erp-input" {...aria("material", "g-mat")} list="g-materials" value={material?.material ?? ""} onChange={(event) => { const found = others.find((item) => item.material === event.target.value); setMat(found ? { material: found.material, unit: found.unit, supplier: material?.supplier || found.supplier } : { material: event.target.value }); }} /></Field>
      <div className="erp-form-grid">
        <Field id="g-mqty" label={`Quantity for ${line.quantity || "all"} ${line.unit}`} error={err("materialQty")} help="For example: 42"><input className="erp-input" inputMode="decimal" {...aria("materialQty", "g-mqty")} value={material?.quantity ?? ""} onChange={(event) => setMat({ quantity: event.target.value })} /></Field>
        <Field id="g-munit" label="Unit"><select className="erp-select" id="g-munit" value={material?.unit ?? "kg"} onChange={(event) => setMat({ unit: event.target.value })}>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></Field>
      </div>
      <Field id="g-sup" label="Preferred supplier (optional)" help="For example: Northline Metals"><input className="erp-input" id="g-sup" list="g-suppliers" value={material?.supplier ?? ""} onChange={(event) => setMat({ supplier: event.target.value })} /></Field>
    </>;
  }

  if (current.kind === "review") {
    const invalid = firstInvalidStep(state, draft);
    const missing: string[] = [];
    draft.lines.forEach((item, index) => {
      if (!draft.documents.some((d) => d.partKey === item.key && d.number.trim())) missing.push(`Part ${index + 1}: drawing number`);
      if (!draft.inspections.some((d) => d.partKey === item.key && d.name.trim() && d.spec.trim())) missing.push(`Part ${index + 1}: inspection parameter`);
      if (!draft.materials.some((d) => d.lineKey === item.key && d.material.trim())) missing.push(`Part ${index + 1}: material`);
      if (!item.unitPrice.trim()) missing.push(`Part ${index + 1}: price`);
    });
    const total = draft.lines.reduce((sum, item) => sum + (parseAmount(item.unitPrice) ?? 0) * (Number(item.quantity) || 0), 0);
    body = <>
      <div className="erp-kv">
        <div><small>Customer</small><b>{draft.customerName}</b></div>
        <div><small>Project</small><b>{draft.projectCode} · {draft.projectName}</b></div>
        <div><small>Purchase order</small><b>{draft.poNumber} · due {formatDate(draft.deliveryDate)}</b></div>
        <div><small>Order value</small><b>{formatMoney(total, draft.currency)}</b></div>
      </div>
      <div className="erp-review">
        {draft.lines.map((item, index) => {
          const d = draft.documents.find((x) => x.partKey === item.key);
          const m = draft.materials.find((x) => x.lineKey === item.key);
          const p = draft.inspections.filter((x) => x.partKey === item.key && x.name.trim());
          return <article key={item.key}>
            <header><b>Part {index + 1} · {item.partNumber || "—"} rev {item.revision}</b><span>{item.description}</span></header>
            <ul>
              <li><FileText size={14} /> {d?.number ? `${d.number} rev ${d.revision}${d.file ? ` · ${d.file.name}` : ""}` : "No drawing"}</li>
              <li><ShieldCheck size={14} /> {p.length ? p.map((x) => x.name).join(", ") : "No parameters"}</li>
              <li><ShoppingCart size={14} /> {item.quantity || 0} {item.unit} × {item.unitPrice ? formatMoney(parseAmount(item.unitPrice) ?? 0, draft.currency) : "no price"}</li>
              <li><PackageCheck size={14} /> {m?.material ? `${m.quantity} ${m.unit} ${m.material}` : "No material"}</li>
            </ul>
          </article>;
        })}
      </div>
      {(invalid !== -1 || missing.length > 0) && <p className="erp-error" role="alert">Something is missing{missing.length ? `: ${missing.join(", ")}` : ""}. Use Back to complete it.</p>}
    </>;
    footLabel = "Create project";
    onContinue = () => {
      const latest = getState();
      if (!latest.draft || firstInvalidStep(latest, latest.draft) !== -1 || missing.length) { setShown(true); return; }
      const result = createProjectFromDraft(latest, latest.draft, nowIso());
      commit(() => ({ ...result.state, guide: { step: step + 1, projectId: result.projectId, furthest: step + 1, v: 2 } }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  }

  return <>
    <div className="erp-step-body">{body}</div>
    <Foot step={step} onContinue={onContinue} label={footLabel} />
  </>;
}

/* ============================== Operational steps ============================== */

function WorkStep({ current, step, state }: { current: GuideStep; step: number; state: ErpState }) {
  const projectId = state.guide.projectId;
  const [form, setForm] = useState<{ lineId: string; quantity: string; startDate: string; notes: string }>({ lineId: "", quantity: "", startDate: todayIso(), notes: "" });
  const [error, setError] = useState("");
  if (!projectId) return <><div className="erp-step-body"><p className="erp-muted">Create the project first.</p></div><Foot step={step} canContinue={false} /></>;
  const r = projectRecords(state, projectId);
  const ready = readiness(state, projectId);
  const now = nowIso();
  const run = (update: (value: ErpState) => ErpState) => commit(update);
  const lineLabel = (lineId: string) => { const line = r.lineItems.find((item) => item.id === lineId); return line ? `${partNumber(state, line.partId)} rev ${revisionLabel(state, line.revisionId)}` : ""; };
  let body: ReactNode = null;
  let canContinue = true;
  let label = "Continue";

  if (current.kind === "purchase") {
    body = <>
      <ul className="erp-recs">
        {r.materialRequirements.map((req) => {
          const record = r.procurement.find((item) => item.requirementId === req.id);
          return <li key={req.id}>
            <PackageCheck size={18} />
            <span><b>Order {req.quantity} {req.unit} {req.material}</b><small>For {lineLabel(req.lineItemId ?? "") || "the project"}{record?.supplier ? ` · supplier ${record.supplier}` : " · supplier to be chosen"} · {record?.number}</small></span>
            {record && record.status === "Not ordered" ? <button type="button" className="erp-btn erp-btn-sm" onClick={() => run((value) => advanceProcurement(value, record.id, now))}>Place order now</button> : <Badge>{record?.status ?? "—"}</Badge>}
          </li>;
        })}
      </ul>
      <p className="erp-faint">Optional. Production can start without it; missing material is shown as a warning. Receive material later in the <Link className="erp-link" href={`/demo/materials?project=${projectId}`}>Purchasing</Link> tab.</p>
    </>;
  }

  if (current.kind === "production-order") {
    const open = r.lineItems.filter((line) => !r.productionOrders.some((order) => order.lineItemId === line.id));
    const selected = r.lineItems.find((line) => line.id === (form.lineId || open[0]?.id));
    const qty = form.quantity || (selected ? String(selected.quantity) : "");
    const create = () => {
      if (!selected) return;
      const quantity = Number(qty);
      if (!Number.isInteger(quantity) || quantity <= 0) { setError("Enter a whole number above 0."); return; }
      run((value) => createProductionOrder(value, selected.id, now, { quantity, startDate: form.startDate, notes: form.notes }));
      setForm({ lineId: "", quantity: "", startDate: todayIso(), notes: "" });
      setError("");
    };
    body = <>
      {r.productionOrders.length > 0 && <ul className="erp-checks">{r.productionOrders.map((order) => <li key={order.id}><CheckCircle2 size={18} color="#1E7F4E" /><span style={{ flex: 1 }}><b>{order.number}</b> · {order.quantity} × {lineLabel(order.lineItemId)}{order.startDate ? ` · start ${formatDate(order.startDate)}` : ""}{order.notes ? ` · ${order.notes}` : ""}</span><Badge>{order.status}</Badge></li>)}</ul>}
      {selected ? <div className="erp-param">
        <div className="erp-param-head"><b>New production order</b><span className="erp-faint">{open.length} part{open.length === 1 ? "" : "s"} still without an order</span></div>
        <Field id="g-mo-part" label="Part"><select className="erp-select" id="g-mo-part" value={selected.id} onChange={(event) => setForm({ ...form, lineId: event.target.value, quantity: "" })}>{open.map((line) => <option key={line.id} value={line.id}>{lineLabel(line.id)} · ordered {line.quantity} {line.unit}</option>)}</select></Field>
        <div className="erp-form-grid">
          <Field id="g-mo-qty" label="Quantity to produce" error={error || undefined} help={`Customer ordered ${selected.quantity} ${selected.unit}`}><input className="erp-input" id="g-mo-qty" inputMode="numeric" value={qty} onChange={(event) => setForm({ ...form, quantity: event.target.value.replace(/[^0-9]/g, "") })} /></Field>
          <Field id="g-mo-start" label="Planned start"><input className="erp-input" id="g-mo-start" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></Field>
        </div>
        <Field id="g-mo-notes" label="Details for the shop floor (optional)" help="For example: CNC cell 2, first-off inspection after setup"><input className="erp-input" id="g-mo-notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
        <Checks items={[["Drawing", lineEngineeringReady(state, projectId, selected), lineEngineeringReady(state, projectId, selected) ? "Approved" : "Not approved yet"], ["Material", lineMaterialReady(state, selected), lineMaterialReady(state, selected) ? "Received" : "Not received yet"]]} />
        <p className="erp-faint">Warnings only. Approvals and goods receipt can happen later in their tabs.</p>
        <div><button type="button" className="erp-btn erp-btn-dark" onClick={create}>Create production order</button></div>
      </div> : <p className="erp-done"><CheckCircle2 size={18} /> Every part has a production order.</p>}
    </>;
    canContinue = open.length === 0;
  }

  if (current.kind === "run-production") {
    body = <>
      <ul className="erp-recs">{r.productionOrders.map((order) => <li key={order.id}>
        <Factory size={18} />
        <span><b>{order.number}</b><small>{order.quantity} × {lineLabel(order.lineItemId)}</small></span>
        <StatusSelect key={order.status} id={`g-st-${order.id}`} label={`Status of ${order.number}`} value={order.status} onChange={(status) => run((value) => setProductionStatus(value, order.id, status, now))} />
      </li>)}</ul>
      <p className="erp-faint">Choose any status, or type your own. Update it any time in the Production tab. Final inspection and dispatch need every order on “Completed”.</p>
    </>;
  }

  if (current.kind === "inspect") {
    const report = r.inspectionReports[0];
    const passed = Boolean(report?.passed) && ready.quality.state === "complete";
    body = passed ? <p className="erp-done"><CheckCircle2 size={18} /> Final inspection passed ({report.number}). The report can be printed in the Quality tab.</p> : <>
      {report && !report.passed && <p className="erp-error" role="alert">The last inspection ({report.number}) failed. After rework, record the result again.</p>}
      <InspectionForm projectId={projectId} />
    </>;
    if (!passed) label = "Do final inspection later";
  }

  if (current.kind === "dispatch") {
    const done = Boolean(r.dispatches[0]);
    body = <>
      <Checks items={[["Production complete", ready.production.state === "complete", ready.production.state === "complete" ? "Complete" : "Open"], ["Final inspection passed", ready.quality.state === "complete", ready.quality.state === "complete" ? "Passed" : "Open"]]} />
      {done ? <p className="erp-done"><CheckCircle2 size={18} /> Shipped with delivery note {r.dispatches[0].number}. Print it in the Dispatch tab.</p>
        : ready.dispatch.reasons.some((reason) => reason.action?.kind === "dispatch") ? <div><button type="button" className="erp-btn erp-btn-dark" onClick={() => run((value) => dispatchProject(value, projectId, now))}>Dispatch order</button></div>
        : <p className="erp-faint">Not possible yet. Dispatch from the Dispatch tab once production is completed and the final inspection has passed.</p>}
    </>;
    if (!done) label = "Do it later";
  }

  if (current.kind === "invoice") {
    const invoice = r.invoices[0];
    body = invoice ? <p className="erp-done"><CheckCircle2 size={18} /> Invoice {invoice.number} created: {formatMoney(invoice.total, invoice.currency)} including {invoice.taxRate}% tax. Print it in the Invoices tab.</p>
      : <><ul className="erp-checks">{r.lineItems.map((line) => <li key={line.id}><span style={{ flex: 1 }}>{line.quantity} {line.unit} × {lineLabel(line.id)}</span><b>{line.unitPrice !== null && r.purchaseOrders[0] ? formatMoney(line.unitPrice * line.quantity, r.purchaseOrders[0].currency) : "—"}</b></li>)}</ul>
        {ready.invoice.state === "incomplete" ? <div><button type="button" className="erp-btn erp-btn-dark" onClick={() => run((value) => generateInvoice(value, projectId, now))}>Create invoice</button></div>
          : <p className="erp-faint">The invoice is created after dispatch. Do it later from the Invoices tab.</p>}</>;
    label = invoice ? "Finish" : "Finish for now";
  }

  return <>
    <div className="erp-step-body">{body}</div>
    <Foot step={step} canContinue={canContinue} label={label} />
  </>;
}

function Checks({ items }: { items: [string, boolean, string][] }) {
  return <ul className="erp-checks">{items.map(([text, ok, status]) => <li key={text}>{ok ? <CheckCircle2 size={18} color="#1E7F4E" /> : <CircleDashed size={18} color="#8A5A00" />}<span style={{ flex: 1 }}>{text}</span><span className={`erp-badge ${ok ? "erp-badge-ok" : "erp-badge-warn"}`}>{status}</span></li>)}</ul>;
}
