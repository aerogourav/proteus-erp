"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Link2, Pencil, Plus, Save, Sparkles, Trash2, Wand2 } from "lucide-react";
import { commit, getState, newKey, nowIso, todayIso, useErp, useHydrated } from "@/components/erp/store";
import { Field } from "@/components/erp/ui";
import {
  CURRENCIES, DOC_STATUSES, DOC_TYPES, PROCUREMENT_STATUSES, UNITS, WIZARD_STEPS, createProjectFromDraft, draftFlow, existingCustomer, existingPart,
  firstInvalidStep, formatDate, formatMoney, newDraft, parseAmount, projectRecords, suggestPartNumber, suggestProjectCode, validateStep,
  type Currency, type DocStatus, type DocType, type DraftDocument, type DraftInspection, type DraftLine, type DraftMaterial, type ErpState, type FieldErrors,
  type ProcurementStatus, type ProjectDraft,
} from "@/lib/erp/model";

const STEP_INTRO: { title: string; text: string }[] = [
  { title: "Project identity", text: "Name the project and connect it to the customer’s purchase order. The project ID uniquely identifies it everywhere in BOH ERP." },
  { title: "Customer and commercial details", text: "Only the essentials. A new customer becomes a CRM record; an existing customer is linked instead of duplicated." },
  { title: "Line items", text: "What the customer ordered. Each line becomes a part and revision linked to this project." },
  { title: "Engineering documents", text: "Add representative documents. In this demo you add metadata only; no files are uploaded." },
  { title: "Inspection requirements", text: "Define what quality must check. These feed the inspection report later." },
  { title: "Material and procurement", text: "What material each line needs and whether it has been ordered." },
  { title: "Review and create", text: "Check everything once. Edit any section, then create the project." },
];

function uniquePo(state: ErpState, base = 1042) {
  let n = base;
  while (state.purchaseOrders.some((order) => order.number === `PO-2026-${n}`)) n += 1;
  return `PO-2026-${n}`;
}

export function ProjectWizard() {
  const router = useRouter();
  const state = useErp();
  const hydrated = useHydrated();
  const [shown, setShown] = useState<Record<number, boolean>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [created, setCreated] = useState<string | null>(null);
  const [lastChange, setLastChange] = useState("");

  useEffect(() => {
    if (hydrated && !created && !getState().draft) commit((current) => current.draft ? current : { ...current, draft: newDraft(current, todayIso()) });
  }, [hydrated, created]);

  if (!hydrated) return <p className="erp-muted" role="status">Loading your draft…</p>;
  if (created) return <CreatedState projectId={created} onAnother={() => { setCreated(null); setShown({}); setTouched({}); setLastChange(""); }} />;
  const draft = state.draft;
  if (!draft) return <p className="erp-muted" role="status">Preparing a new project…</p>;

  const step = draft.step;
  const errors = validateStep(state, draft, step);
  const err = (key: string) => (shown[step] || touched[key] ? errors[key] : undefined);
  const touch = (key: string) => setTouched((current) => current[key] ? current : { ...current, [key]: true });
  const update = (patch: Partial<ProjectDraft>) => commit((current) => current.draft ? { ...current, draft: { ...current.draft, ...patch } } : current);
  const goTo = (target: number) => { update({ step: target }); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const next = () => {
    if (Object.keys(errors).length) {
      setShown((current) => ({ ...current, [step]: true }));
      window.setTimeout(() => (document.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus(), 0);
      return;
    }
    goTo(step + 1);
  };

  const create = () => {
    const invalid = firstInvalidStep(getState(), draft);
    if (invalid !== -1) { setShown((current) => ({ ...current, [invalid]: true })); goTo(invalid); return; }
    const result = createProjectFromDraft(getState(), draft, nowIso());
    setCreated(result.projectId);
    commit(() => result.state);
    window.scrollTo({ top: 0 });
  };

  const startOver = () => { commit((current) => ({ ...current, draft: newDraft(current, todayIso()) })); setShown({}); setTouched({}); setLastChange(""); };
  const stepValid = (index: number) => Object.keys(validateStep(state, draft, index)).length === 0;
  const canJump = (index: number) => index <= step || Array.from({ length: index }, (_, i) => i).every(stepValid);
  const flow = draftFlow(state, draft);
  const recordCount = flow.reduce((sum, group) => sum + group.records.length, 0);

  return <div>
    <header className="erp-head">
      <div><span className="erp-eyebrow">Create a project · step {step + 1} of {WIZARD_STEPS.length}</span><h1>{STEP_INTRO[step].title}</h1><p>{STEP_INTRO[step].text}</p></div>
      <div className="erp-head-actions">
        <span className="erp-saved"><Save size={13} /> Progress saved in this browser</span>
        <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={startOver}>Start over</button>
        <button type="button" className="erp-btn erp-btn-sm" onClick={() => router.push("/demo")}>Save &amp; exit</button>
      </div>
    </header>

    <ol className="erp-steps" aria-label="Wizard steps">
      {WIZARD_STEPS.map((label, index) => {
        const done = index < step && stepValid(index);
        return <li key={label}><button type="button" className={index === step ? "is-current" : done ? "is-done" : ""} disabled={!canJump(index)} aria-current={index === step ? "step" : undefined} onClick={() => goTo(index)}>
          <span>{done ? <Check size={13} /> : index + 1}</span>{label}
        </button></li>;
      })}
    </ol>

    <details className="erp-card erp-flow-mobile">
      <summary>Where your information goes <span className="erp-chip">{recordCount} records</span></summary>
      <FlowPanel state={state} draft={draft} lastChange={lastChange} />
    </details>

    <div className="erp-wizard">
      <section className="erp-card erp-step-card" aria-labelledby="step-title">
        <header><h2 id="step-title">{STEP_INTRO[step].title}</h2><p>{step === 0 ? "Fields marked with * are required." : "You can return to any previous step."}</p></header>
        {step === 0 && <StepProject state={state} draft={draft} update={update} err={err} touch={touch} />}
        {step === 1 && <StepCommercial state={state} draft={draft} update={update} err={err} touch={touch} />}
        {step === 2 && <StepLines state={state} draft={draft} update={update} err={err} touch={touch} errors={errors} shown={Boolean(shown[step])} setLastChange={setLastChange} />}
        {step === 3 && <StepDocuments draft={draft} update={update} err={err} touch={touch} setLastChange={setLastChange} />}
        {step === 4 && <StepInspection draft={draft} update={update} err={err} touch={touch} setLastChange={setLastChange} />}
        {step === 5 && <StepMaterials draft={draft} update={update} err={err} touch={touch} setLastChange={setLastChange} />}
        {step === 6 && <StepReview state={state} draft={draft} goTo={goTo} />}
        <footer className="erp-step-foot">
          {step > 0 ? <button type="button" className="erp-btn" onClick={() => goTo(step - 1)}><ArrowLeft size={16} /> Back</button> : <Link className="erp-btn erp-btn-ghost" href="/demo"><ArrowLeft size={16} /> Demo home</Link>}
          {step < 6 ? <button type="button" className="erp-btn erp-btn-primary" onClick={next}>Continue <ArrowRight size={16} /></button>
            : <button type="button" className="erp-btn erp-btn-primary" onClick={create}><CheckCircle2 size={16} /> Create Project</button>}
        </footer>
      </section>
      <aside className="erp-card erp-flow" aria-label="Where your information goes"><FlowPanel state={state} draft={draft} lastChange={lastChange} /></aside>
    </div>
  </div>;
}

/* ---------------- Live data flow panel ---------------- */

function FlowPanel({ state, draft, lastChange }: { state: ErpState; draft: ProjectDraft; lastChange: string }) {
  const groups = draftFlow(state, draft);
  return <>
    <header><h3><Link2 size={16} /> Where your information goes</h3><p>Updates as you type. Nothing is saved to the modules until you create the project.</p></header>
    <div className="erp-flow-source"><Sparkles size={15} /> {draft.projectCode.trim().toUpperCase() || "Your project"}</div>
    {lastChange && <p className="erp-hint" style={{ margin: "12px 0 0", fontSize: 13 }}>{lastChange}</p>}
    {groups.length ? <ul className="erp-flow-list">
      {groups.map((group) => <li key={group.module} className="erp-flow-group">
        <strong>{group.title}</strong>
        {group.records.map((record) => <div className="erp-flow-rec" key={`${record.key}|${record.label}|${record.detail}`}>
          <b>{record.label}</b>{record.detail && <span>{record.detail}</span>}<i>{record.status === "linked" ? "Linked to existing record" : "New record"}</i>
        </div>)}
      </li>)}
    </ul> : <p className="erp-flow-empty">Start typing. Each value appears in the module where BOH ERP will store it.</p>}
  </>;
}

/* ---------------- Steps ---------------- */

type StepProps = { draft: ProjectDraft; update: (patch: Partial<ProjectDraft>) => void; err: (key: string) => string | undefined; touch: (key: string) => void };

function inputProps(id: string, error: string | undefined) {
  return { id, "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${id}-error` : `${id}-help` } as const;
}

function StepProject({ state, draft, update, err, touch }: StepProps & { state: ErpState }) {
  const customer = draft.customerName.trim() ? existingCustomer(state, draft.customerName) : null;
  const codeOk = !validateStep(state, draft, 0).projectCode && draft.projectCode.trim();
  const fillExample = () => update({ projectName: "Hydraulic Actuator Assembly", projectCode: draft.projectCode || suggestProjectCode(state), customerName: "Apex Aerospace GmbH", poNumber: uniquePo(state), description: "Housings and piston rods for a hydraulic actuator assembly (fictional example)." });
  return <div className="erp-form-grid">
    <div className="erp-span-2"><button type="button" className="erp-btn erp-btn-sm" onClick={fillExample}><Wand2 size={14} /> Fill example values</button></div>
    <Field id="projectName" label="Project name *" error={err("projectName")} help="e.g. Hydraulic Actuator Assembly">
      <input className="erp-input" {...inputProps("projectName", err("projectName"))} value={draft.projectName} placeholder="Hydraulic Actuator Assembly" onChange={(event) => update({ projectName: event.target.value })} onBlur={() => touch("projectName")} />
    </Field>
    <Field id="projectCode" label="Project ID *" error={err("projectCode")} help={codeOk ? <span className="erp-ok-text">Available · uniquely identifies this project inside BOH ERP</span> : "Uniquely identifies the project inside BOH ERP. Suggested automatically; you can edit it."}>
      <div className="erp-inline">
        <input className="erp-input" {...inputProps("projectCode", err("projectCode"))} value={draft.projectCode} onChange={(event) => update({ projectCode: event.target.value.toUpperCase() })} onBlur={() => touch("projectCode")} />
        <button type="button" className="erp-btn erp-btn-sm" onClick={() => update({ projectCode: suggestProjectCode(state) })}>Suggest</button>
      </div>
    </Field>
    <Field id="customerName" label="Customer *" error={err("customerName")} help={customer ? <span className="erp-ok-text">Existing customer · the project will be linked to {customer.name}</span> : draft.customerName.trim() ? "New customer · a CRM record will be prepared" : "e.g. Apex Aerospace GmbH"}>
      <input className="erp-input" {...inputProps("customerName", err("customerName"))} list="erp-customers" value={draft.customerName} placeholder="Apex Aerospace GmbH" autoComplete="off" onChange={(event) => update({ customerName: event.target.value })} onBlur={() => touch("customerName")} />
      <datalist id="erp-customers">{state.customers.map((item) => <option key={item.id} value={item.name} />)}</datalist>
    </Field>
    <Field id="poNumber" label="Purchase order number *" error={err("poNumber")} help="The customer’s PO reference, e.g. PO-2026-1042">
      <input className="erp-input" {...inputProps("poNumber", err("poNumber"))} value={draft.poNumber} placeholder="PO-2026-1042" onChange={(event) => update({ poNumber: event.target.value.toUpperCase() })} onBlur={() => touch("poNumber")} />
    </Field>
    <Field id="description" label="Project description (optional)" className="erp-span-2" help="A short note for colleagues.">
      <textarea className="erp-textarea" id="description" value={draft.description} onChange={(event) => update({ description: event.target.value })} />
    </Field>
  </div>;
}

function StepCommercial({ state, draft, update, err, touch }: StepProps & { state: ErpState }) {
  const customer = draft.customerName.trim() ? existingCustomer(state, draft.customerName) : null;
  return <div className="erp-form-grid">
    <Field id="customerName2" label="Customer name *" error={err("customerName")} help={customer ? <span className="erp-ok-text">Linked to existing CRM record</span> : "A new CRM customer record will be prepared."}>
      <input className="erp-input" {...inputProps("customerName2", err("customerName"))} list="erp-customers-2" value={draft.customerName} onChange={(event) => update({ customerName: event.target.value })} onBlur={() => touch("customerName")} />
      <datalist id="erp-customers-2">{state.customers.map((item) => <option key={item.id} value={item.name} />)}</datalist>
    </Field>
    <Field id="contact" label="Contact or email (optional)" error={err("contact")} help="e.g. procurement@apex-aerospace.example">
      <input className="erp-input" {...inputProps("contact", err("contact"))} value={draft.contact} placeholder="procurement@apex-aerospace.example" onChange={(event) => update({ contact: event.target.value })} onBlur={() => touch("contact")} />
    </Field>
    <Field id="poDate" label="Purchase order date *" error={err("poDate")}>
      <input className="erp-input" type="date" {...inputProps("poDate", err("poDate"))} value={draft.poDate} onChange={(event) => update({ poDate: event.target.value })} onBlur={() => touch("poDate")} />
    </Field>
    <Field id="deliveryDate" label="Required delivery date *" error={err("deliveryDate")}>
      <input className="erp-input" type="date" {...inputProps("deliveryDate", err("deliveryDate"))} value={draft.deliveryDate} min={draft.poDate} onChange={(event) => update({ deliveryDate: event.target.value })} onBlur={() => touch("deliveryDate")} />
    </Field>
    <Field id="currency" label="Currency">
      <select className="erp-select" id="currency" value={draft.currency} onChange={(event) => update({ currency: event.target.value as Currency })}>{CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}</select>
    </Field>
    <Field id="orderValue" label="Total order value (optional)" error={err("orderValue")} help="Leave empty to calculate it from line item prices.">
      <input className="erp-input" inputMode="decimal" {...inputProps("orderValue", err("orderValue"))} value={draft.orderValue} placeholder="e.g. 14025.00" onChange={(event) => update({ orderValue: event.target.value })} onBlur={() => touch("orderValue")} />
    </Field>
  </div>;
}

type ListStepProps = StepProps & { setLastChange: (text: string) => void };

function StepLines({ state, draft, update, err, touch, errors, shown, setLastChange }: ListStepProps & { state: ErpState; errors: FieldErrors; shown: boolean }) {
  const setLine = (key: string, patch: Partial<DraftLine>) => update({ lines: draft.lines.map((line) => line.key === key ? { ...line, ...patch } : line) });
  const add = (line?: Partial<DraftLine>) => {
    const item: DraftLine = { key: newKey(), partNumber: "", description: "", quantity: "", unit: "pcs", unitPrice: "", revision: "A", ...line };
    update({ lines: [...draft.lines, item] });
    if (item.partNumber) setLastChange(`Line item ${item.partNumber} added. It becomes a part and revision linked to this project.`);
  };
  const remove = (key: string) => {
    const line = draft.lines.find((item) => item.key === key);
    update({
      lines: draft.lines.filter((item) => item.key !== key),
      documents: draft.documents.map((doc) => doc.partKey === key ? { ...doc, partKey: "" } : doc),
      inspections: draft.inspections.map((item) => item.partKey === key ? { ...item, partKey: "" } : item),
      materials: draft.materials.map((item) => item.lineKey === key ? { ...item, lineKey: "" } : item),
    });
    setLastChange(`${line?.partNumber || "Line item"} removed. Its preview records were removed too.`);
  };
  const example = () => {
    const used = new Set(draft.lines.map((line) => line.partNumber.toUpperCase()));
    const options: Partial<DraftLine>[] = [
      { partNumber: "ACT-204", description: "Hydraulic Actuator Housing", quantity: "50", unitPrice: "184.00", revision: "A" },
      { partNumber: "ACT-205", description: "Piston Rod", quantity: "50", unitPrice: "96.50", revision: "B" },
    ];
    const pick = options.find((option) => !used.has(option.partNumber ?? "")) ?? { partNumber: suggestPartNumber(state, draft), description: "Machined part (example)", quantity: "10", unitPrice: "", revision: "A" };
    add(pick);
  };
  return <div>
    {errors.lines && shown && <p className="erp-error" role="alert" style={{ marginBottom: 12 }}>{errors.lines}</p>}
    {draft.lines.map((line, index) => {
      const existing = line.partNumber.trim() ? existingPart(state, line.partNumber) : null;
      const revExists = existing && state.revisions.some((rev) => rev.partId === existing.id && rev.revision === line.revision.trim().toUpperCase());
      const id = (field: string) => `line-${line.key}-${field}`;
      const key = (field: string) => `lines.${line.key}.${field}`;
      return <div className="erp-item" key={line.key}>
        <div className="erp-item-head"><span>Line {index + 1}</span><button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => remove(line.key)} aria-label={`Remove line ${index + 1}`}><Trash2 size={14} /> Remove</button></div>
        <div className="erp-item-grid">
          <Field id={id("pn")} label="Part number *" className="erp-col-2" error={err(key("partNumber"))} help={existing ? <span className="erp-ok-text">Existing part · {revExists ? `rev ${line.revision.toUpperCase()} exists` : "a new revision will be added"}</span> : "e.g. ACT-204"}>
            <div className="erp-inline">
              <input className="erp-input" {...inputProps(id("pn"), err(key("partNumber")))} value={line.partNumber} onChange={(event) => setLine(line.key, { partNumber: event.target.value.toUpperCase() })} onBlur={() => touch(key("partNumber"))} />
              {!line.partNumber && <button type="button" className="erp-btn erp-btn-sm" onClick={() => setLine(line.key, { partNumber: suggestPartNumber(state, draft) })}>Suggest</button>}
            </div>
          </Field>
          <Field id={id("desc")} label="Description *" className="erp-col-3 erp-wide" error={err(key("description"))} help="e.g. Hydraulic Actuator Housing">
            <input className="erp-input" {...inputProps(id("desc"), err(key("description")))} value={line.description} onChange={(event) => setLine(line.key, { description: event.target.value })} onBlur={() => touch(key("description"))} />
          </Field>
          <Field id={id("rev")} label="Revision *" className="erp-col-1" error={err(key("revision"))}>
            <input className="erp-input" {...inputProps(id("rev"), err(key("revision")))} value={line.revision} maxLength={3} onChange={(event) => setLine(line.key, { revision: event.target.value.toUpperCase() })} onBlur={() => touch(key("revision"))} />
          </Field>
          <Field id={id("qty")} label="Quantity *" className="erp-col-2" error={err(key("quantity"))}>
            <input className="erp-input" inputMode="numeric" {...inputProps(id("qty"), err(key("quantity")))} value={line.quantity} placeholder="50" onChange={(event) => setLine(line.key, { quantity: event.target.value.replace(/[^0-9]/g, "") })} onBlur={() => touch(key("quantity"))} />
          </Field>
          <Field id={id("unit")} label="Unit" className="erp-col-1">
            <select className="erp-select" id={id("unit")} value={line.unit} onChange={(event) => setLine(line.key, { unit: event.target.value })}>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select>
          </Field>
          <Field id={id("price")} label={`Unit price, ${draft.currency} (optional)`} className="erp-col-3 erp-wide" error={err(key("unitPrice"))} help="Used for the invoice.">
            <input className="erp-input" inputMode="decimal" {...inputProps(id("price"), err(key("unitPrice")))} value={line.unitPrice} placeholder="184.00" onChange={(event) => setLine(line.key, { unitPrice: event.target.value })} onBlur={() => touch(key("unitPrice"))} />
          </Field>
        </div>
      </div>;
    })}
    {!draft.lines.length && <p className="erp-faint" style={{ marginBottom: 6 }}>No line items yet. Each line item belongs to this project; it does not create a separate project.</p>}
    <div className="erp-add-row">
      <button type="button" className="erp-btn" onClick={() => add()}><Plus size={15} /> Add line item</button>
      <button type="button" className="erp-btn erp-btn-ghost" onClick={example}><Wand2 size={15} /> Add example line</button>
    </div>
  </div>;
}

function partOptions(draft: ProjectDraft) {
  return draft.lines.filter((line) => line.partNumber.trim()).map((line) => ({ key: line.key, label: `${line.partNumber.toUpperCase()} rev ${line.revision.toUpperCase() || "?"}` }));
}

function StepDocuments({ draft, update, err, touch, setLastChange }: ListStepProps) {
  const parts = partOptions(draft);
  const setDoc = (key: string, patch: Partial<DraftDocument>) => update({ documents: draft.documents.map((doc) => doc.key === key ? { ...doc, ...patch } : doc) });
  const add = (doc: Omit<DraftDocument, "key">) => {
    update({ documents: [...draft.documents, { key: newKey(), ...doc }] });
    const part = parts.find((item) => item.key === doc.partKey);
    setLastChange(doc.number ? `You added ${doc.number}. It will be linked to your project${part ? ` and ${part.label}` : ""}.` : "Document added. Fill in its details.");
  };
  const remove = (key: string) => { const doc = draft.documents.find((item) => item.key === key); update({ documents: draft.documents.filter((item) => item.key !== key) }); setLastChange(`${doc?.number || "Document"} removed from the preview.`); };
  const base = draft.lines[0]?.partNumber.toUpperCase().replace(/-\d+$/, "") || draft.projectCode.toUpperCase();
  const samples: { label: string; doc: Omit<DraftDocument, "key"> }[] = [
    ...draft.lines.filter((line) => line.partNumber.trim()).map((line) => ({ label: `Drawing · ${line.partNumber.toUpperCase()}`, doc: { name: `${line.description || line.partNumber} drawing`, type: "Drawing" as DocType, number: `DRW-${line.partNumber.toUpperCase()}`, revision: line.revision.toUpperCase() || "A", partKey: line.key, status: "In review" as DocStatus, source: "sample" as const } })),
    { label: "Specification", doc: { name: `${draft.projectName || "Project"} specification`, type: "Specification", number: `SPEC-${base}`, revision: "A", partKey: "", status: "Approved", source: "sample" } },
    { label: "Bill of materials", doc: { name: `${draft.projectName || "Project"} bill of materials`, type: "Bill of materials", number: `BOM-${base}`, revision: "A", partKey: "", status: "Approved", source: "sample" } },
    { label: "Inspection plan", doc: { name: "Inspection plan", type: "Inspection plan", number: `IP-${base}`, revision: "A", partKey: parts[0]?.key ?? "", status: "Approved", source: "sample" } },
  ];
  const used = new Set(draft.documents.map((doc) => `${doc.number}|${doc.revision}`));
  return <div>
    <p className="erp-rule" style={{ marginBottom: 14 }}><span><span className="erp-tag">METADATA ONLY</span> No files are uploaded in this demo. Sample documents are fictional placeholders.</span></p>
    {draft.documents.map((doc, index) => {
      const id = (field: string) => `doc-${doc.key}-${field}`;
      const key = (field: string) => `documents.${doc.key}.${field}`;
      return <div className="erp-item" key={doc.key}>
        <div className="erp-item-head"><span>Document {index + 1} <span className="erp-tag">{doc.source === "sample" ? "SAMPLE METADATA" : "MANUAL METADATA"}</span></span><button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => remove(doc.key)} aria-label={`Remove document ${index + 1}`}><Trash2 size={14} /> Remove</button></div>
        <div className="erp-item-grid">
          <Field id={id("name")} label="Document name *" className="erp-col-3 erp-wide" error={err(key("name"))}>
            <input className="erp-input" {...inputProps(id("name"), err(key("name")))} value={doc.name} onChange={(event) => setDoc(doc.key, { name: event.target.value })} onBlur={() => touch(key("name"))} />
          </Field>
          <Field id={id("type")} label="Type" className="erp-col-3 erp-wide">
            <select className="erp-select" id={id("type")} value={doc.type} onChange={(event) => setDoc(doc.key, { type: event.target.value as DocType })}>{DOC_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
          </Field>
          <Field id={id("number")} label="Document number *" className="erp-col-2" error={err(key("number"))}>
            <input className="erp-input" {...inputProps(id("number"), err(key("number")))} value={doc.number} placeholder="DRW-ACT-204" onChange={(event) => setDoc(doc.key, { number: event.target.value.toUpperCase() })} onBlur={() => touch(key("number"))} />
          </Field>
          <Field id={id("rev")} label="Revision *" className="erp-col-1" error={err(key("revision"))}>
            <input className="erp-input" {...inputProps(id("rev"), err(key("revision")))} value={doc.revision} maxLength={3} onChange={(event) => setDoc(doc.key, { revision: event.target.value.toUpperCase() })} onBlur={() => touch(key("revision"))} />
          </Field>
          <Field id={id("part")} label="Associated part" className="erp-col-2" error={err(key("partKey"))}>
            <select className="erp-select" {...inputProps(id("part"), err(key("partKey")))} value={doc.partKey} onChange={(event) => setDoc(doc.key, { partKey: event.target.value })}><option value="">Whole project</option>{parts.map((part) => <option key={part.key} value={part.key}>{part.label}</option>)}</select>
          </Field>
          <Field id={id("status")} label="Approval" className="erp-col-1">
            <select className="erp-select" id={id("status")} value={doc.status} onChange={(event) => setDoc(doc.key, { status: event.target.value as DocStatus })}>{DOC_STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
          </Field>
        </div>
      </div>;
    })}
    {!draft.documents.length && <p className="erp-faint">No documents yet. Production needs an approved drawing for each part, so you will be asked for one later if it is missing.</p>}
    <p className="erp-label" style={{ marginTop: 18 }}>Add a sample document</p>
    <div className="erp-add-row" style={{ marginTop: 8 }}>
      {samples.map((sample) => <button key={sample.label} type="button" className="erp-btn erp-btn-sm" disabled={used.has(`${sample.doc.number}|${sample.doc.revision}`)} onClick={() => add(sample.doc)}><Plus size={14} /> {sample.label}</button>)}
      <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => add({ name: "", type: "Drawing", number: "", revision: "A", partKey: parts[0]?.key ?? "", status: "Draft", source: "metadata" })}><Pencil size={14} /> Add metadata manually</button>
    </div>
  </div>;
}

function StepInspection({ draft, update, err, touch, setLastChange }: ListStepProps) {
  const parts = partOptions(draft);
  const setItem = (key: string, patch: Partial<DraftInspection>) => update({ inspections: draft.inspections.map((item) => item.key === key ? { ...item, ...patch } : item) });
  const add = (item: Omit<DraftInspection, "key" | "partKey">) => {
    update({ inspections: [...draft.inspections, { key: newKey(), partKey: parts[0]?.key ?? "", ...item }] });
    setLastChange(item.name ? `${item.name} added. Your inspection requirements can now be used to generate an inspection report.` : "Inspection parameter added. Fill in its details.");
  };
  const remove = (key: string) => { update({ inspections: draft.inspections.filter((item) => item.key !== key) }); setLastChange("Inspection parameter removed from the preview."); };
  const examples: Omit<DraftInspection, "key" | "partKey">[] = [
    { name: "Outer diameter", spec: "63.50 ± 0.05", unit: "mm", acceptance: "All measured parts within tolerance" },
    { name: "Material grade", spec: "EN AW-7075-T6", unit: "", acceptance: "Mill certificate 3.1 on file" },
    { name: "Surface finish", spec: "Ra ≤ 0.8", unit: "µm", acceptance: "3 readings per part" },
    { name: "Dimensional tolerance", spec: "ISO 2768-m", unit: "", acceptance: "General tolerance class" },
  ];
  const used = new Set(draft.inspections.map((item) => item.name));
  return <div>
    <p className="erp-rule" style={{ marginBottom: 14 }}><span><span className="erp-tag">FICTIONAL EXAMPLES</span> Example values illustrate the format. They are not real engineering specifications.</span></p>
    {draft.inspections.map((item, index) => {
      const id = (field: string) => `insp-${item.key}-${field}`;
      const key = (field: string) => `inspections.${item.key}.${field}`;
      return <div className="erp-item" key={item.key}>
        <div className="erp-item-head"><span>Parameter {index + 1}</span><button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => remove(item.key)} aria-label={`Remove parameter ${index + 1}`}><Trash2 size={14} /> Remove</button></div>
        <div className="erp-item-grid">
          <Field id={id("name")} label="Parameter *" className="erp-col-2" error={err(key("name"))}>
            <input className="erp-input" {...inputProps(id("name"), err(key("name")))} value={item.name} placeholder="Outer diameter" onChange={(event) => setItem(item.key, { name: event.target.value })} onBlur={() => touch(key("name"))} />
          </Field>
          <Field id={id("spec")} label="Specification *" className="erp-col-2" error={err(key("spec"))}>
            <input className="erp-input" {...inputProps(id("spec"), err(key("spec")))} value={item.spec} placeholder="63.50 ± 0.05" onChange={(event) => setItem(item.key, { spec: event.target.value })} onBlur={() => touch(key("spec"))} />
          </Field>
          <Field id={id("unit")} label="Unit" className="erp-col-2">
            <input className="erp-input" id={id("unit")} value={item.unit} placeholder="mm" onChange={(event) => setItem(item.key, { unit: event.target.value })} />
          </Field>
          <Field id={id("acc")} label="Acceptance criteria" className="erp-col-3 erp-wide">
            <input className="erp-input" id={id("acc")} value={item.acceptance} placeholder="All parts within tolerance" onChange={(event) => setItem(item.key, { acceptance: event.target.value })} />
          </Field>
          <Field id={id("part")} label="Applies to" className="erp-col-3 erp-wide">
            <select className="erp-select" id={id("part")} value={item.partKey} onChange={(event) => setItem(item.key, { partKey: event.target.value })}><option value="">Whole project</option>{parts.map((part) => <option key={part.key} value={part.key}>{part.label}</option>)}</select>
          </Field>
        </div>
      </div>;
    })}
    {!draft.inspections.length && <p className="erp-faint">No inspection requirements yet. You can also add them later in Quality.</p>}
    <div className="erp-add-row">
      {examples.map((example) => <button key={example.name} type="button" className="erp-btn erp-btn-sm" disabled={used.has(example.name)} onClick={() => add(example)}><Plus size={14} /> {example.name}</button>)}
      <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => add({ name: "", spec: "", unit: "", acceptance: "" })}><Pencil size={14} /> Add custom parameter</button>
    </div>
  </div>;
}

function StepMaterials({ draft, update, err, touch, setLastChange }: ListStepProps) {
  const parts = partOptions(draft);
  const setItem = (key: string, patch: Partial<DraftMaterial>) => update({ materials: draft.materials.map((item) => item.key === key ? { ...item, ...patch } : item) });
  const add = (item: Omit<DraftMaterial, "key">) => {
    update({ materials: [...draft.materials, { key: newKey(), ...item }] });
    setLastChange(item.material ? `${item.material} added. A material requirement and a procurement record are prepared.` : "Material added. Fill in its details.");
  };
  const remove = (key: string) => { update({ materials: draft.materials.filter((item) => item.key !== key) }); setLastChange("Material removed from the preview."); };
  return <div>
    {draft.materials.map((item, index) => {
      const id = (field: string) => `mat-${item.key}-${field}`;
      const key = (field: string) => `materials.${item.key}.${field}`;
      return <div className="erp-item" key={item.key}>
        <div className="erp-item-head"><span>Material {index + 1}</span><button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => remove(item.key)} aria-label={`Remove material ${index + 1}`}><Trash2 size={14} /> Remove</button></div>
        <div className="erp-item-grid">
          <Field id={id("mat")} label="Material *" className="erp-col-3 erp-wide" error={err(key("material"))}>
            <input className="erp-input" {...inputProps(id("mat"), err(key("material")))} value={item.material} placeholder="EN AW-7075-T6 round bar Ø70 mm" onChange={(event) => setItem(item.key, { material: event.target.value })} onBlur={() => touch(key("material"))} />
          </Field>
          <Field id={id("qty")} label="Quantity *" className="erp-col-1" error={err(key("quantity"))}>
            <input className="erp-input" inputMode="decimal" {...inputProps(id("qty"), err(key("quantity")))} value={item.quantity} placeholder="42" onChange={(event) => setItem(item.key, { quantity: event.target.value.replace(/[^0-9.]/g, "") })} onBlur={() => touch(key("quantity"))} />
          </Field>
          <Field id={id("unit")} label="Unit" className="erp-col-2">
            <select className="erp-select" id={id("unit")} value={item.unit} onChange={(event) => setItem(item.key, { unit: event.target.value })}>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select>
          </Field>
          <Field id={id("line")} label="For line item" className="erp-col-2">
            <select className="erp-select" id={id("line")} value={item.lineKey} onChange={(event) => setItem(item.key, { lineKey: event.target.value })}><option value="">Whole project</option>{parts.map((part) => <option key={part.key} value={part.key}>{part.label}</option>)}</select>
          </Field>
          <Field id={id("sup")} label="Preferred supplier (optional)" className="erp-col-2">
            <input className="erp-input" id={id("sup")} value={item.supplier} placeholder="Northline Metals (Demo)" onChange={(event) => setItem(item.key, { supplier: event.target.value })} />
          </Field>
          <Field id={id("status")} label="Procurement status" className="erp-col-2">
            <select className="erp-select" id={id("status")} value={item.status} onChange={(event) => setItem(item.key, { status: event.target.value as ProcurementStatus })}>{PROCUREMENT_STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
          </Field>
        </div>
      </div>;
    })}
    {!draft.materials.length && <p className="erp-faint">No materials yet. Production needs received material for each part, so material readiness will show what is missing.</p>}
    <div className="erp-add-row">
      <button type="button" className="erp-btn" onClick={() => add({ material: "", quantity: "", unit: "kg", supplier: "", status: "Not ordered", lineKey: parts[0]?.key ?? "" })}><Plus size={15} /> Add material</button>
      <button type="button" className="erp-btn erp-btn-ghost" onClick={() => add({ material: "EN AW-7075-T6 round bar Ø70 mm", quantity: "42", unit: "kg", supplier: "Northline Metals (Demo)", status: "Not ordered", lineKey: parts[0]?.key ?? "" })}><Wand2 size={15} /> Add example material</button>
    </div>
  </div>;
}

function ReviewSection({ title, step, goTo, invalid, children }: { title: string; step: number; goTo: (step: number) => void; invalid: boolean; children: ReactNode }) {
  return <section aria-label={title}>
    <header><h3>{title} {invalid && <span className="erp-error">· needs attention</span>}</h3><button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => goTo(step)}><Pencil size={13} /> Edit</button></header>
    {children}
  </section>;
}

function StepReview({ state, draft, goTo }: { state: ErpState; draft: ProjectDraft; goTo: (step: number) => void }) {
  const invalid = (step: number) => Object.keys(validateStep(state, draft, step)).length > 0;
  const customer = existingCustomer(state, draft.customerName);
  const lineLabel = (key: string) => { const line = draft.lines.find((item) => item.key === key); return line ? `${line.partNumber.toUpperCase()} rev ${line.revision.toUpperCase()}` : "Whole project"; };
  const value = parseAmount(draft.orderValue);
  const linesTotal = draft.lines.every((line) => parseAmount(line.unitPrice) !== null) ? draft.lines.reduce((sum, line) => sum + (parseAmount(line.unitPrice) ?? 0) * Number(line.quantity || 0), 0) : null;
  return <div className="erp-review">
    <ReviewSection title="Project" step={0} goTo={goTo} invalid={invalid(0)}>
      <dl><dt>Name</dt><dd>{draft.projectName || "—"}</dd><dt>Project ID</dt><dd>{draft.projectCode || "—"}</dd><dt>Description</dt><dd>{draft.description || "—"}</dd></dl>
    </ReviewSection>
    <ReviewSection title="Customer and purchase order" step={1} goTo={goTo} invalid={invalid(1)}>
      <dl>
        <dt>Customer</dt><dd>{draft.customerName || "—"} {customer ? <span className="erp-ok-text">(existing, linked)</span> : <span className="erp-faint">(new CRM record)</span>}</dd>
        <dt>Contact</dt><dd>{draft.contact || "—"}</dd>
        <dt>PO number</dt><dd>{draft.poNumber || "—"}</dd>
        <dt>PO date · delivery</dt><dd>{formatDate(draft.poDate)} · {formatDate(draft.deliveryDate)}</dd>
        <dt>Order value</dt><dd>{value !== null && !Number.isNaN(value) ? formatMoney(value, draft.currency) : linesTotal !== null && draft.lines.length ? `${formatMoney(linesTotal, draft.currency)} (from line prices)` : "Not set"}</dd>
      </dl>
    </ReviewSection>
    <ReviewSection title={`Line items (${draft.lines.length})`} step={2} goTo={goTo} invalid={invalid(2)}>
      {draft.lines.length ? <ul>{draft.lines.map((line) => <li key={line.key}><b>{line.partNumber || "?"} rev {line.revision}</b> · {line.description} · {line.quantity} {line.unit}{parseAmount(line.unitPrice) ? ` · ${formatMoney(parseAmount(line.unitPrice) ?? 0, draft.currency)} each` : ""}</li>)}</ul> : <p className="erp-error">Add at least one line item.</p>}
    </ReviewSection>
    <ReviewSection title={`Documents (${draft.documents.length})`} step={3} goTo={goTo} invalid={invalid(3)}>
      {draft.documents.length ? <ul>{draft.documents.map((doc) => <li key={doc.key}><b>{doc.number} rev {doc.revision}</b> · {doc.type} · {doc.status} · {doc.partKey ? lineLabel(doc.partKey) : "Whole project"}</li>)}</ul> : <p className="erp-faint">None. Engineering readiness will ask for a drawing.</p>}
    </ReviewSection>
    <ReviewSection title={`Inspection requirements (${draft.inspections.length})`} step={4} goTo={goTo} invalid={invalid(4)}>
      {draft.inspections.length ? <ul>{draft.inspections.map((item) => <li key={item.key}><b>{item.name}</b> · {item.spec} {item.unit} · {item.partKey ? lineLabel(item.partKey) : "Whole project"}</li>)}</ul> : <p className="erp-faint">None. Quality readiness will ask for at least one.</p>}
    </ReviewSection>
    <ReviewSection title={`Materials (${draft.materials.length})`} step={5} goTo={goTo} invalid={invalid(5)}>
      {draft.materials.length ? <ul>{draft.materials.map((item) => <li key={item.key}><b>{item.material}</b> · {item.quantity} {item.unit} · {item.lineKey ? lineLabel(item.lineKey) : "Whole project"} · {item.status}{item.supplier ? ` · ${item.supplier}` : ""}</li>)}</ul> : <p className="erp-faint">None. Material readiness will ask for them.</p>}
    </ReviewSection>
  </div>;
}

function CreatedState({ projectId, onAnother }: { projectId: string; onAnother: () => void }) {
  const state = useErp();
  const router = useRouter();
  const records = projectRecords(state, projectId);
  if (!records.project) return <p className="erp-muted">Project created.</p>;
  const items = [
    ["CRM", `${records.customer?.name ?? ""} customer record`],
    ["Sales", `Purchase order ${records.purchaseOrders[0]?.number ?? ""}`],
    ["Parts", `${records.lineItems.length} line item${records.lineItems.length === 1 ? "" : "s"} with part revisions`],
    ["Documents", `${records.documents.length} document${records.documents.length === 1 ? "" : "s"} linked`],
    ["Quality", `${records.inspectionRequirements.length} inspection requirement${records.inspectionRequirements.length === 1 ? "" : "s"}`],
    ["Materials & procurement", `${records.materialRequirements.length} requirement${records.materialRequirements.length === 1 ? "" : "s"} with procurement records`],
  ];
  return <section className="erp-card erp-hero" aria-labelledby="created-title">
    <span className="erp-eyebrow">Project created</span>
    <h1 id="created-title">{records.project.name} is now connected across BOH ERP.</h1>
    <p>You entered the information once. These records were created or linked from it:</p>
    <ul className="erp-reasons" style={{ marginTop: 20, maxWidth: 640 }}>{items.map(([module, text]) => <li key={module}><span><CheckCircle2 size={16} color="#34D399" /> <b style={{ color: "#E7ECF5" }}>{module}</b> · {text}</span></li>)}</ul>
    <div className="erp-head-actions" style={{ marginTop: 24 }}>
      <button type="button" className="erp-btn erp-btn-primary" onClick={() => router.push(`/demo/projects/${projectId}`)}>Open project workspace <ArrowRight size={16} /></button>
      <button type="button" className="erp-btn" onClick={onAnother}><Plus size={15} /> Create another project</button>
    </div>
  </section>;
}
