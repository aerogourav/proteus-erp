"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, Boxes, CheckCircle2, CircleDashed, ClipboardList, Factory, FileText, PackageCheck, Receipt, RotateCcw,
  ShieldCheck, ShoppingCart, Sparkles, Truck, Users,
} from "lucide-react";
import { BohMark } from "@/components/brand/boh-logo";
import { OUTPUT_LABELS, OutputDialog, type OutputKind } from "@/components/erp/outputs";
import { commit, getState, nowIso, resetDemo, todayIso, useErp, useHydrated } from "@/components/erp/store";
import { Field } from "@/components/erp/ui";
import { PHASES, STEPS, WORK_STEPS, type StepId } from "@/components/erp/guide-steps";
import {
  UNITS, addDocumentToProject, addInspectionRequirement, addMaterialRequirement, advanceProcurement, advanceProduction, approveDocument,
  createProductionOrder, createProjectFromDraft, dispatchProject, formatDate, formatMoney, generateInspectionReport, generateInvoice, newDraft,
  parseAmount, projectRecords, revisionLabel, validateStep, type ErpState, type ProjectDraft,
} from "@/lib/erp/model";

type Dept = "crm" | "sales" | "project" | "parts" | "engineering" | "quality" | "purchasing" | "production" | "dispatch" | "finance";

const STEP_DEPT: Partial<Record<StepId, Dept>> = {
  customer: "crm", project: "project", order: "sales", part: "parts", quantity: "sales", drawing: "engineering", approve: "engineering",
  inspection: "quality", material: "purchasing", "order-material": "purchasing", "receive-material": "purchasing", release: "production",
  start: "production", complete: "production", inspect: "quality", dispatch: "dispatch", invoice: "finance",
};

const DEPT_LABEL: Record<Dept, { label: string; icon: typeof Users }> = {
  crm: { label: "CRM", icon: Users }, project: { label: "Projects", icon: Sparkles }, sales: { label: "Sales", icon: ShoppingCart },
  parts: { label: "Parts", icon: Boxes }, engineering: { label: "Engineering", icon: FileText }, quality: { label: "Quality", icon: ShieldCheck },
  purchasing: { label: "Purchasing", icon: PackageCheck }, production: { label: "Production", icon: Factory }, dispatch: { label: "Dispatch", icon: Truck },
  finance: { label: "Finance", icon: Receipt },
};

function setStep(step: number) {
  commit((state) => ({ ...state, guide: { ...state.guide, step, furthest: Math.max(step, state.guide.furthest ?? 0) } }));
  if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
}

function ensureDraft(state: ErpState): ErpState {
  if (state.draft) return state;
  const draft = newDraft(state, todayIso());
  return { ...state, draft: { ...draft, lines: [{ key: "line-1", partNumber: "", description: "", quantity: "", unit: "pcs", unitPrice: "", revision: "A" }] } };
}

/** Collects everything the visitor's project holds right now, for the side panel and the final summary. */
function projectSnapshot(state: ErpState) {
  const projectId = state.guide.projectId;
  const draft = state.draft;
  const records = projectId ? projectRecords(state, projectId) : null;
  const line = records?.lineItems[0];
  const part = line ? state.parts.find((item) => item.id === line.partId) : null;
  const drawing = records?.documents.find((doc) => doc.type === "Drawing") ?? null;
  const requirement = records?.inspectionRequirements[0] ?? null;
  const material = records?.materialRequirements[0] ?? null;
  const procurement = records?.procurement[0] ?? null;
  const productionOrder = records?.productionOrders[0] ?? null;
  const report = records?.inspectionReports[0] ?? null;
  const dispatch = records?.dispatches[0] ?? null;
  const invoice = records?.invoices[0] ?? null;
  const po = records?.purchaseOrders[0] ?? null;
  const d = draft?.lines[0];
  return {
    projectId, records, line, part, drawing, requirement, material, procurement, productionOrder, report, dispatch, invoice, po,
    customer: records?.customer?.name ?? draft?.customerName.trim() ?? "",
    projectName: records?.project?.name ?? draft?.projectName.trim() ?? "",
    projectCode: records?.project?.code ?? draft?.projectCode.trim() ?? "",
    poNumber: po?.number ?? draft?.poNumber.trim() ?? "",
    delivery: po?.deliveryDate ?? draft?.deliveryDate ?? "",
    partLabel: part && line ? `${part.number} rev ${revisionLabel(state, line.revisionId)}` : d && d.partNumber.trim() ? `${d.partNumber.toUpperCase()} rev ${d.revision.toUpperCase() || "A"}` : "",
    partDescription: part?.description ?? d?.description ?? "",
    quantity: line ? `${line.quantity} ${line.unit}` : d?.quantity ? `${d.quantity} ${d.unit}` : "",
    currency: po?.currency ?? draft?.currency ?? "EUR",
  };
}

export function GuidedDemo() {
  const state = useErp();
  const hydrated = useHydrated();
  const [output, setOutput] = useState<OutputKind | null>(null);
  if (!hydrated) return <p className="erp-muted" role="status">Loading the demo…</p>;

  const step = Math.min(state.guide.step, STEPS.length - 1);
  const id = STEPS[step].id;
  const snap = projectSnapshot(state);
  const dept = STEP_DEPT[id];

  if (id === "welcome") return <Welcome />;
  if (id === "done" && snap.projectId) return <Finished state={state} snap={snap} output={output} setOutput={setOutput} />;

  return <div className="erp-guide">
    <div>
      <details className="erp-card erp-panel-mobile">
        <summary>Your project so far <span className="erp-chip">Step {step} of {WORK_STEPS}</span></summary>
        <ProjectPanel state={state} active={dept} />
      </details>
      <section className="erp-card erp-step" aria-labelledby="step-title">
        <StepScreen key={id} id={id} step={step} state={state} openOutput={setOutput} />
      </section>
    </div>
    <aside className="erp-card erp-panel" aria-label="Your project so far"><ProjectPanel state={state} active={dept} /></aside>
    {output && snap.projectId && <OutputDialog state={state} projectId={snap.projectId} kind={output} onClose={() => setOutput(null)} />}
  </div>;
}

/* ---------------- Welcome & finish ---------------- */

function Welcome() {
  const start = () => { commit((state) => ensureDraft({ ...state, guide: { ...state.guide, step: 1, furthest: Math.max(1, state.guide.furthest ?? 0) } })); window.scrollTo({ top: 0 }); };
  return <section className="erp-card erp-step erp-welcome" aria-labelledby="welcome-title">
    <div><span className="erp-eyebrow">Interactive demo · about 5 minutes</span>
      <h1 id="welcome-title">Follow one project from order to invoice.</h1>
      <p className="erp-step-lead">You enter your project once. Then you move it through every department, one small step at a time, and see how BOH ERP keeps everything connected.</p></div>
    <ol aria-label="What happens">
      <li><b>1 · Sales</b><span>Customer, order and part</span></li>
      <li><b>2 · Engineering</b><span>Drawing and approval</span></li>
      <li><b>3 · Operations</b><span>Material, production, inspection</span></li>
      <li><b>4 · Delivery</b><span>Dispatch and invoice</span></li>
    </ol>
    <div className="erp-head-actions"><button type="button" className="erp-btn erp-btn-primary erp-btn-lg" onClick={start}>Start the demo <ArrowRight size={18} /></button><span className="erp-faint">No account needed. Everything stays in your browser.</span></div>
  </section>;
}

function Finished({ state, snap, output, setOutput }: { state: ErpState; snap: ReturnType<typeof projectSnapshot>; output: OutputKind | null; setOutput: (kind: OutputKind | null) => void }) {
  const restart = () => { resetDemo(); window.scrollTo({ top: 0 }); };
  const departments = ["CRM", "Sales", "Engineering", "Quality", "Purchasing", "Production", "Dispatch", "Finance"];
  const outputs: OutputKind[] = ["po", "production", "inspection", "dispatch", "invoice"];
  return <div className="erp-stack">
    <section className="erp-card erp-step" aria-labelledby="finished-title">
      <div className="erp-step-top"><span className="erp-step-dept"><CheckCircle2 size={15} /> Finished</span><BohMark size={44} smile /></div>
      <h1 id="finished-title">{snap.projectName} is delivered and invoiced.</h1>
      <p className="erp-step-lead">You entered the project once. {departments.length} departments worked on the same record, and every document below was created from it, without typing anything twice.</p>
      <ul className="erp-checks" style={{ marginTop: 24, maxWidth: 620 }}>
        <li><CheckCircle2 size={18} color="#0E7A52" /> {snap.customer} · purchase order {snap.poNumber}</li>
        <li><CheckCircle2 size={18} color="#0E7A52" /> {snap.quantity} × {snap.partLabel} · {snap.partDescription}</li>
        <li><CheckCircle2 size={18} color="#0E7A52" /> Drawing approved, material received, production complete, inspection passed</li>
        <li><CheckCircle2 size={18} color="#0E7A52" /> Dispatched with {snap.dispatch?.number} · invoice {snap.invoice?.number}{snap.invoice ? ` · ${formatMoney(snap.invoice.total, snap.invoice.currency)}` : ""}</li>
      </ul>
    </section>
    <section className="erp-card" aria-labelledby="docs-title">
      <div className="erp-card-head"><div><h2 id="docs-title">Documents created from your project</h2><p>Illustrative demo documents. Open, print or save as PDF.</p></div></div>
      <div className="erp-outputs">{outputs.map((kind) => <button key={kind} type="button" className="erp-output" onClick={() => setOutput(kind)}><FileText size={18} /><strong>{OUTPUT_LABELS[kind]}</strong><span>Preview &amp; print</span></button>)}</div>
    </section>
    <div className="erp-head-actions">
      {snap.projectId && <Link className="erp-btn erp-btn-dark" href={`/demo/projects/${snap.projectId}`}>See the full project record <ArrowRight size={16} /></Link>}
      <button type="button" className="erp-btn" onClick={restart}><RotateCcw size={15} /> Start again with a new project</button>
      <Link className="erp-btn erp-btn-ghost" href="/contact">Talk to us about your workflow</Link>
    </div>
    {output && snap.projectId && <OutputDialog state={state} projectId={snap.projectId} kind={output} onClose={() => setOutput(null)} />}
  </div>;
}

/* ---------------- Side panel ---------------- */

function ProjectPanel({ state, active }: { state: ErpState; active?: Dept }) {
  const snap = projectSnapshot(state);
  const rows: { dept: Dept; value: string; detail: string }[] = [
    { dept: "crm", value: snap.customer, detail: snap.customer ? "Customer record" : "" },
    { dept: "project", value: snap.projectCode && snap.projectName ? `${snap.projectCode}` : "", detail: snap.projectName },
    { dept: "sales", value: snap.poNumber, detail: snap.poNumber ? `Due ${formatDate(snap.delivery)}${snap.po?.value ? ` · ${formatMoney(snap.po.value, snap.po.currency)}` : ""}` : "" },
    { dept: "parts", value: snap.partLabel, detail: snap.partLabel ? `${snap.partDescription}${snap.quantity ? ` · ${snap.quantity}` : ""}` : "" },
    { dept: "engineering", value: snap.drawing ? `${snap.drawing.number} rev ${snap.drawing.revision}` : "", detail: snap.drawing?.status ?? "" },
    { dept: "quality", value: snap.requirement?.name ?? "", detail: snap.report ? `${snap.report.number} passed` : snap.requirement ? `${snap.requirement.spec} ${snap.requirement.unit}` : "" },
    { dept: "purchasing", value: snap.material?.material ?? "", detail: snap.procurement ? `${snap.material?.quantity} ${snap.material?.unit} · ${snap.procurement.status}` : "" },
    { dept: "production", value: snap.productionOrder?.number ?? "", detail: snap.productionOrder?.status ?? "" },
    { dept: "dispatch", value: snap.dispatch?.number ?? "", detail: snap.dispatch ? `Shipped ${formatDate(snap.dispatch.dispatchedAt)}` : "" },
    { dept: "finance", value: snap.invoice?.number ?? "", detail: snap.invoice ? formatMoney(snap.invoice.total, snap.invoice.currency) : "" },
  ];
  return <>
    <header><h3>Your project so far</h3><p>One record. Each department adds to it.</p></header>
    <ul>{rows.map(({ dept, value, detail }) => {
      const { label } = DEPT_LABEL[dept];
      return <li key={dept} className={`${value ? "has-data" : ""}${active === dept ? " is-active" : ""}`}>
        <strong>{label}</strong>
        <span>{value || "—"}</span>
        {detail && <em>{detail}</em>}
      </li>;
    })}</ul>
  </>;
}

/* ---------------- Steps ---------------- */

type StepCopy = { title: (snap: ReturnType<typeof projectSnapshot>) => string; lead: (snap: ReturnType<typeof projectSnapshot>) => string };

const COPY: Record<Exclude<StepId, "welcome" | "done">, StepCopy> = {
  customer: { title: () => "Who is the customer?", lead: () => "Every project starts with a customer. BOH ERP saves it once in CRM, so nobody types it again." },
  project: { title: () => "Name the project", lead: () => "The project ID ties together every record that follows." },
  order: { title: () => "Register the purchase order", lead: (s) => `The customer’s order is the commercial commitment${s.customer ? ` from ${s.customer}` : ""}.` },
  part: { title: () => "What did the customer order?", lead: () => "Enter the part. BOH ERP creates the part and its revision." },
  quantity: { title: () => "How many, and at what price?", lead: () => "When you continue, the project is created. From now on every department works on this same record." },
  drawing: { title: () => "Add the drawing", lead: (s) => `Engineering adds the drawing for ${s.partLabel}. New drawings start “in review”.` },
  approve: { title: () => "Approve the drawing", lead: () => "Production may only use an approved drawing. This is a rule BOH ERP checks for you." },
  inspection: { title: () => "What must quality check?", lead: (s) => `Define one inspection requirement for ${s.partLabel}. It will appear on the inspection report later.` },
  material: { title: () => "Which material is needed?", lead: () => "Purchasing records the raw material for this part." },
  "order-material": { title: () => "Order the material", lead: (s) => `${s.material?.material ?? "The material"} is not ordered yet. Place the purchase order with the supplier.` },
  "receive-material": { title: () => "Receive the material", lead: () => "The supplier delivered. Book the goods in so production can use them." },
  release: { title: () => "Release to production", lead: () => "BOH ERP only creates the production order when the checks below are met." },
  start: { title: () => "Start production", lead: (s) => `${s.productionOrder?.number ?? "The production order"} is planned. Start it on the shop floor.` },
  complete: { title: () => "Finish production", lead: (s) => `${s.quantity} × ${s.partLabel} are being made. Mark production complete when they are done.` },
  inspect: { title: () => "Run the final inspection", lead: (s) => `Quality checks the finished parts against “${s.requirement?.name ?? "the requirement"}”. The report is created from the project data.` },
  dispatch: { title: () => "Ship the order", lead: () => "Dispatch is only possible when production is complete and inspection has passed." },
  invoice: { title: () => "Send the invoice", lead: (s) => `The invoice uses the quantity and price from ${s.poNumber}. Nothing is typed again.` },
};

function StepScreen({ id, step, state, openOutput }: { id: StepId; step: number; state: ErpState; openOutput: (kind: OutputKind) => void }) {
  const snap = projectSnapshot(state);
  if (id === "welcome" || id === "done") return null;
  const copy = COPY[id];
  const dept = STEP_DEPT[id];
  const Icon = dept ? DEPT_LABEL[dept].icon : Sparkles;
  const progress = Math.round((step / WORK_STEPS) * 100);
  return <>
    <div className="erp-step-top">
      <span className="erp-step-dept"><Icon size={15} /> {dept ? DEPT_LABEL[dept].label : ""}</span>
      <div className="erp-progress" style={{ minWidth: 200 }}><span>Step {step} of {WORK_STEPS}</span><span className="erp-progress-bar"><span style={{ width: `${progress}%` }} /></span></div>
    </div>
    <h1 id="step-title">{copy.title(snap)}</h1>
    <p className="erp-step-lead">{copy.lead(snap)}</p>
    {step <= 5 ? <SalesStep id={id} step={step} state={state} /> : <WorkStep id={id} step={step} state={state} openOutput={openOutput} />}
  </>;
}

/* Steps 1–5: entered once, saved as the project at the end of step 5. */
function SalesStep({ id, step, state }: { id: StepId; step: number; state: ErpState }) {
  const [shown, setShown] = useState(false);
  const created = Boolean(state.guide.projectId);
  const draft = state.draft;
  if (created || !draft) {
    const snap = projectSnapshot(state);
    const saved: Record<string, string> = {
      customer: snap.customer, project: `${snap.projectCode} · ${snap.projectName}`, order: `${snap.poNumber} · due ${formatDate(snap.delivery)}`,
      part: `${snap.partLabel} · ${snap.partDescription}`, quantity: `${snap.quantity}${snap.line?.unitPrice ? ` at ${formatMoney(snap.line.unitPrice, snap.currency)}` : ""}`,
    };
    return <><div className="erp-step-body"><p className="erp-done"><CheckCircle2 size={18} /> Saved: {saved[id] ?? ""}</p></div><Foot step={step} canContinue /></>;
  }
  const line = draft.lines[0];
  const update = (patch: Partial<ProjectDraft>) => commit((current) => current.draft ? { ...current, draft: { ...current.draft, ...patch } } : current);
  const updateLine = (patch: Partial<ProjectDraft["lines"][number]>) => update({ lines: [{ ...line, ...patch }] });
  const lineKey = (field: string) => `lines.${line.key}.${field}`;
  const fieldsFor: Record<string, string[]> = {
    customer: ["customerName", "contact"], project: ["projectName", "projectCode"], order: ["poNumber", "deliveryDate"],
    part: [lineKey("partNumber"), lineKey("description"), lineKey("revision")], quantity: [lineKey("quantity"), lineKey("unitPrice")],
  };
  const all = { ...validateStep(state, draft, 0), ...validateStep(state, draft, 1), ...validateStep(state, draft, 2) };
  const errors: Record<string, string> = Object.fromEntries(Object.entries(all).filter(([key]) => fieldsFor[id]?.includes(key)));
  // The guided demo ends with an invoice, so the price is required here.
  if (id === "quantity" && !errors[lineKey("unitPrice")] && !line.unitPrice.trim()) errors[lineKey("unitPrice")] = "Enter the price per unit.";
  const err = (key: string) => (shown ? errors[key] : undefined);
  const aria = (key: string, fieldId: string) => ({ id: fieldId, "aria-invalid": err(key) ? true : undefined, "aria-describedby": `${fieldId}-${err(key) ? "error" : "help"}` }) as const;

  const next = () => {
    if (Object.keys(errors).length) { setShown(true); window.setTimeout(() => (document.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus(), 0); return; }
    if (id === "quantity") {
      const current = getState();
      if (!current.draft) return;
      const result = createProjectFromDraft(current, current.draft, nowIso());
      commit(() => ({ ...result.state, guide: { step: step + 1, projectId: result.projectId, furthest: step + 1 } }));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setStep(step + 1);
  };

  let body: ReactNode = null;
  if (id === "customer") body = <>
    <Field id="g-customer" label="Customer name" error={err("customerName")} help="For example: Apex Aerospace GmbH"><input className="erp-input" {...aria("customerName", "g-customer")} value={draft.customerName} autoComplete="organization" onChange={(event) => update({ customerName: event.target.value })} /></Field>
    <Field id="g-contact" label="Contact email (optional)" error={err("contact")} help="Who should receive documents?"><input className="erp-input" {...aria("contact", "g-contact")} value={draft.contact} onChange={(event) => update({ contact: event.target.value })} /></Field>
  </>;
  if (id === "project") body = <>
    <Field id="g-name" label="Project name" error={err("projectName")} help="For example: Hydraulic Actuator Assembly"><input className="erp-input" {...aria("projectName", "g-name")} value={draft.projectName} onChange={(event) => update({ projectName: event.target.value })} /></Field>
    <Field id="g-code" label="Project ID" error={err("projectCode")} help="Suggested by BOH ERP. You can change it."><input className="erp-input" {...aria("projectCode", "g-code")} value={draft.projectCode} onChange={(event) => update({ projectCode: event.target.value.toUpperCase() })} /></Field>
  </>;
  if (id === "order") body = <>
    <Field id="g-po" label="Customer’s PO number" error={err("poNumber")} help="For example: PO-2026-1042"><input className="erp-input" {...aria("poNumber", "g-po")} value={draft.poNumber} onChange={(event) => update({ poNumber: event.target.value.toUpperCase() })} /></Field>
    <Field id="g-due" label="Required delivery date" error={err("deliveryDate")} help={`Order date: ${formatDate(draft.poDate)}`}><input className="erp-input" type="date" {...aria("deliveryDate", "g-due")} min={draft.poDate} value={draft.deliveryDate} onChange={(event) => update({ deliveryDate: event.target.value })} /></Field>
  </>;
  if (id === "part") body = <>
    <Field id="g-pn" label="Part number" error={err(lineKey("partNumber"))} help="For example: ACT-204"><input className="erp-input" {...aria(lineKey("partNumber"), "g-pn")} value={line.partNumber} onChange={(event) => updateLine({ partNumber: event.target.value.toUpperCase() })} /></Field>
    <Field id="g-desc" label="Description" error={err(lineKey("description"))} help="For example: Hydraulic Actuator Housing"><input className="erp-input" {...aria(lineKey("description"), "g-desc")} value={line.description} onChange={(event) => updateLine({ description: event.target.value })} /></Field>
    <Field id="g-rev" label="Revision" error={err(lineKey("revision"))} help="Usually A for a new part."><input className="erp-input" {...aria(lineKey("revision"), "g-rev")} maxLength={3} value={line.revision} onChange={(event) => updateLine({ revision: event.target.value.toUpperCase() })} /></Field>
  </>;
  if (id === "quantity") body = <>
    <div className="erp-form-grid">
      <Field id="g-qty" label="Quantity" error={err(lineKey("quantity"))} help="For example: 50"><input className="erp-input" inputMode="numeric" {...aria(lineKey("quantity"), "g-qty")} value={line.quantity} onChange={(event) => updateLine({ quantity: event.target.value.replace(/[^0-9]/g, "") })} /></Field>
      <Field id="g-unit" label="Unit"><select className="erp-select" id="g-unit" value={line.unit} onChange={(event) => updateLine({ unit: event.target.value })}>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></Field>
    </div>
    <Field id="g-price" label={`Price per unit, ${draft.currency}`} error={err(lineKey("unitPrice"))} help="For example: 184.00. Used for the invoice."><input className="erp-input" inputMode="decimal" {...aria(lineKey("unitPrice"), "g-price")} value={line.unitPrice} onChange={(event) => updateLine({ unitPrice: event.target.value })} /></Field>
  </>;
  const price = parseAmount(line.unitPrice);
  return <>
    <div className="erp-step-body">{body}</div>
    {id === "quantity" && price !== null && !Number.isNaN(price) && Number(line.quantity) > 0 && <p className="erp-faint" style={{ marginTop: 12 }}>Order value: {formatMoney(price * Number(line.quantity), draft.currency)}</p>}
    <Foot step={step} canContinue onContinue={next} label={id === "quantity" ? "Create project" : "Continue"} />
  </>;
}

/* Steps 6–17: one action each, on the real project record. */
function WorkStep({ id, step, state, openOutput }: { id: StepId; step: number; state: ErpState; openOutput: (kind: OutputKind) => void }) {
  const snap = projectSnapshot(state);
  const projectId = snap.projectId;
  const [values, setValues] = useState({ drawing: "", name: "", spec: "", unit: "", material: "", qty: "", matUnit: "kg", supplier: "" });
  const [error, setError] = useState("");
  if (!projectId || !snap.line) return <><div className="erp-step-body"><p className="erp-muted">Create the project first.</p></div><Foot step={step} canContinue={false} /></>;
  const line = snap.line;
  const now = nowIso();
  const run = (update: (current: ErpState) => ErpState) => commit(update);
  const v = (key: keyof typeof values) => ({ value: values[key], onChange: (event: { target: { value: string } }) => { setValues({ ...values, [key]: event.target.value }); setError(""); } });

  const done: Record<string, boolean> = {
    drawing: Boolean(snap.drawing), approve: snap.drawing?.status === "Approved", inspection: Boolean(snap.requirement), material: Boolean(snap.material),
    "order-material": snap.procurement?.status === "Ordered" || snap.procurement?.status === "Received", "receive-material": snap.procurement?.status === "Received",
    release: Boolean(snap.productionOrder), start: snap.productionOrder?.status === "In progress" || snap.productionOrder?.status === "Complete",
    complete: snap.productionOrder?.status === "Complete", inspect: Boolean(snap.report), dispatch: Boolean(snap.dispatch), invoice: Boolean(snap.invoice),
  };
  const isDone = done[id];

  let body: ReactNode = null;
  if (id === "drawing") body = isDone
    ? <p className="erp-done"><CheckCircle2 size={18} /> Drawing {snap.drawing?.number} rev {snap.drawing?.revision} added to {snap.partLabel}. Status: {snap.drawing?.status}.</p>
    : <>
      <Field id="g-drw" label="Drawing number" error={error} help={`For example: DRW-${snap.part?.number ?? "ACT-204"}. Revision ${revisionLabel(state, line.revisionId)} is taken from the part.`}><input className="erp-input" id="g-drw" aria-invalid={error ? true : undefined} {...v("drawing")} /></Field>
      <button type="button" className="erp-btn erp-btn-dark" onClick={() => {
        if (!values.drawing.trim()) { setError("Enter the drawing number."); return; }
        run((current) => addDocumentToProject(current, projectId, { name: `${snap.partDescription} drawing`, type: "Drawing", number: values.drawing, revision: revisionLabel(current, line.revisionId), partId: line.partId, status: "In review" }, now));
      }}>Add drawing</button>
      <p className="erp-faint">Metadata only. No file is uploaded in this demo.</p>
    </>;
  if (id === "approve") body = isDone
    ? <p className="erp-done"><CheckCircle2 size={18} /> {snap.drawing?.number} is approved. Engineering is ready.</p>
    : <><Checks items={[[`${snap.drawing?.number ?? "Drawing"} rev ${snap.drawing?.revision ?? ""}`, false, snap.drawing?.status ?? "Missing"]]} /><button type="button" className="erp-btn erp-btn-dark" disabled={!snap.drawing} onClick={() => snap.drawing && run((current) => approveDocument(current, snap.drawing!.id, now))}>Approve drawing</button></>;
  if (id === "inspection") body = isDone
    ? <p className="erp-done"><CheckCircle2 size={18} /> {snap.requirement?.name}: {snap.requirement?.spec} {snap.requirement?.unit}. It will appear on the inspection report.</p>
    : <>
      <Field id="g-param" label="What to check" help="For example: Outer diameter"><input className="erp-input" id="g-param" {...v("name")} /></Field>
      <div className="erp-form-grid">
        <Field id="g-spec" label="Requirement" help="For example: 63.50 ± 0.05"><input className="erp-input" id="g-spec" {...v("spec")} /></Field>
        <Field id="g-iunit" label="Unit (optional)" help="For example: mm"><input className="erp-input" id="g-iunit" {...v("unit")} /></Field>
      </div>
      {error && <p className="erp-error" role="alert">{error}</p>}
      <button type="button" className="erp-btn erp-btn-dark" onClick={() => {
        if (!values.name.trim() || !values.spec.trim()) { setError("Enter what to check and the requirement."); return; }
        run((current) => addInspectionRequirement(current, projectId, { partId: line.partId, name: values.name, spec: values.spec, unit: values.unit, acceptance: "Within requirement" }, now));
      }}>Save requirement</button>
      <p className="erp-faint">Use fictional values. They are not real engineering specifications.</p>
    </>;
  if (id === "material") body = isDone
    ? <p className="erp-done"><CheckCircle2 size={18} /> {snap.material?.quantity} {snap.material?.unit} {snap.material?.material} needed for {snap.partLabel}. Purchase record {snap.procurement?.number} created.</p>
    : <>
      <Field id="g-mat" label="Material" help="For example: Aluminium round bar Ø70 mm"><input className="erp-input" id="g-mat" {...v("material")} /></Field>
      <div className="erp-form-grid">
        <Field id="g-mqty" label="Quantity" help="For example: 42"><input className="erp-input" id="g-mqty" inputMode="decimal" {...v("qty")} /></Field>
        <Field id="g-munit" label="Unit"><select className="erp-select" id="g-munit" value={values.matUnit} onChange={(event) => setValues({ ...values, matUnit: event.target.value })}>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></Field>
      </div>
      <Field id="g-sup" label="Supplier (optional)" help="For example: Northline Metals"><input className="erp-input" id="g-sup" {...v("supplier")} /></Field>
      {error && <p className="erp-error" role="alert">{error}</p>}
      <button type="button" className="erp-btn erp-btn-dark" onClick={() => {
        const qty = Number(values.qty.replace(",", "."));
        if (!values.material.trim() || !(qty > 0)) { setError("Enter the material and a quantity above 0."); return; }
        run((current) => addMaterialRequirement(current, projectId, { lineItemId: line.id, material: values.material, quantity: qty, unit: values.matUnit, supplier: values.supplier }, now));
      }}>Save material</button>
    </>;
  if (id === "order-material") body = isDone
    ? <p className="erp-done"><CheckCircle2 size={18} /> {snap.procurement?.number} placed{snap.procurement?.supplier ? ` with ${snap.procurement.supplier}` : ""}.</p>
    : <button type="button" className="erp-btn erp-btn-dark" disabled={!snap.procurement} onClick={() => snap.procurement && run((current) => advanceProcurement(current, snap.procurement!.id, now))}>Place purchase order</button>;
  if (id === "receive-material") body = isDone
    ? <p className="erp-done"><CheckCircle2 size={18} /> Material received. Purchasing is complete.</p>
    : <button type="button" className="erp-btn erp-btn-dark" disabled={snap.procurement?.status !== "Ordered"} onClick={() => snap.procurement && run((current) => advanceProcurement(current, snap.procurement!.id, now))}>Mark as received</button>;
  if (id === "release") body = <>
    <Checks items={[["Drawing approved", snap.drawing?.status === "Approved", snap.drawing?.status ?? "Missing"], ["Material received", snap.procurement?.status === "Received", snap.procurement?.status ?? "Missing"]]} />
    {isDone ? <p className="erp-done"><CheckCircle2 size={18} /> Production order {snap.productionOrder?.number} created for {snap.quantity} × {snap.partLabel}.</p>
      : <button type="button" className="erp-btn erp-btn-dark" onClick={() => run((current) => createProductionOrder(current, line.id, now))}>Create production order</button>}
  </>;
  if (id === "start") body = isDone
    ? <p className="erp-done"><CheckCircle2 size={18} /> {snap.productionOrder?.number} is in production.</p>
    : <button type="button" className="erp-btn erp-btn-dark" disabled={!snap.productionOrder} onClick={() => snap.productionOrder && run((current) => advanceProduction(current, snap.productionOrder!.id, now))}>Start production</button>;
  if (id === "complete") body = isDone
    ? <p className="erp-done"><CheckCircle2 size={18} /> Production complete: {snap.quantity} × {snap.partLabel}.</p>
    : <button type="button" className="erp-btn erp-btn-dark" disabled={snap.productionOrder?.status !== "In progress"} onClick={() => snap.productionOrder && run((current) => advanceProduction(current, snap.productionOrder!.id, now))}>Complete production</button>;
  if (id === "inspect") body = isDone
    ? <><p className="erp-done"><CheckCircle2 size={18} /> Inspection report {snap.report?.number} created. Result: passed (illustrative).</p><button type="button" className="erp-btn" onClick={() => openOutput("inspection")}><FileText size={15} /> View inspection report</button></>
    : <button type="button" className="erp-btn erp-btn-dark" onClick={() => run((current) => generateInspectionReport(current, projectId, now))}>Generate inspection report</button>;
  if (id === "dispatch") body = <>
    <Checks items={[["Production complete", snap.productionOrder?.status === "Complete", snap.productionOrder?.status ?? "Missing"], ["Inspection passed", Boolean(snap.report?.passed), snap.report ? "Passed" : "Missing"]]} />
    {isDone ? <><p className="erp-done"><CheckCircle2 size={18} /> Shipped with delivery note {snap.dispatch?.number}.</p><button type="button" className="erp-btn" onClick={() => openOutput("dispatch")}><FileText size={15} /> View dispatch note</button></>
      : <button type="button" className="erp-btn erp-btn-dark" onClick={() => run((current) => dispatchProject(current, projectId, now))}>Dispatch order</button>}
  </>;
  if (id === "invoice") body = isDone
    ? <><p className="erp-done"><CheckCircle2 size={18} /> Invoice {snap.invoice?.number} created: {snap.invoice ? formatMoney(snap.invoice.total, snap.invoice.currency) : ""} including {snap.invoice?.taxRate}% tax.</p><button type="button" className="erp-btn" onClick={() => openOutput("invoice")}><FileText size={15} /> View invoice</button></>
    : <button type="button" className="erp-btn erp-btn-dark" onClick={() => run((current) => generateInvoice(current, projectId, now))}>Generate invoice</button>;

  return <>
    <div className="erp-step-body">{body}</div>
    <Foot step={step} canContinue={isDone} label={id === "invoice" ? "Finish" : "Continue"} />
  </>;
}

function Checks({ items }: { items: [string, boolean, string][] }) {
  return <ul className="erp-checks">{items.map(([label, ok, status]) => <li key={label}>{ok ? <CheckCircle2 size={18} color="#0E7A52" /> : <CircleDashed size={18} color="#8A5A00" />}<span style={{ flex: 1 }}>{label}</span><span className={`erp-badge ${ok ? "erp-badge-ok" : "erp-badge-warn"}`}>{status}</span></li>)}</ul>;
}

function Foot({ step, canContinue, onContinue, label = "Continue" }: { step: number; canContinue: boolean; onContinue?: () => void; label?: string }) {
  return <div className="erp-step-foot">
    <button type="button" className="erp-btn erp-btn-ghost" onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Back</button>
    <button type="button" className="erp-btn erp-btn-primary" disabled={!canContinue} onClick={onContinue ?? (() => setStep(step + 1))}>{label} <ArrowRight size={16} /></button>
  </div>;
}

export { PHASES };
