"use client";

import { useState, type FormEvent } from "react";
import { commit, nowIso } from "@/components/erp/store";
import { Field, Modal } from "@/components/erp/ui";
import { UNITS, addInspectionRequirement, addMaterialRequirement, partNumber, revisionLabel, type ErpState } from "@/lib/erp/model";

export function AddMaterialDialog({ state, projectId, lineItemId, onClose }: { state: ErpState; projectId: string; lineItemId: string | null; onClose: () => void }) {
  const lines = state.lineItems.filter((line) => line.projectId === projectId);
  const [values, setValues] = useState({ material: "", quantity: "", unit: "kg", supplier: "", lineItemId: lineItemId ?? lines[0]?.id ?? "" });
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!values.material.trim()) { setError("Name the material."); return; }
    if (!(Number(values.quantity) > 0)) { setError("Enter a quantity above 0."); return; }
    commit((current) => addMaterialRequirement(current, projectId, { lineItemId: values.lineItemId || null, material: values.material, quantity: Number(values.quantity), unit: values.unit, supplier: values.supplier }, nowIso()));
    onClose();
  };
  return <Modal label="Add material requirement" onClose={onClose}>
    <form onSubmit={submit} className="erp-stack">
      <div><h2>Add material requirement</h2><p className="erp-muted">A procurement record is created with it, starting as “Not ordered”.</p></div>
      <Field id="am-material" label="Material *"><input className="erp-input" id="am-material" value={values.material} placeholder="EN AW-7075-T6 round bar Ø70 mm" onChange={(event) => setValues({ ...values, material: event.target.value })} /></Field>
      <div className="erp-form-grid">
        <Field id="am-qty" label="Quantity *"><input className="erp-input" id="am-qty" inputMode="decimal" value={values.quantity} onChange={(event) => setValues({ ...values, quantity: event.target.value.replace(/[^0-9.]/g, "") })} /></Field>
        <Field id="am-unit" label="Unit"><select className="erp-select" id="am-unit" value={values.unit} onChange={(event) => setValues({ ...values, unit: event.target.value })}>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></Field>
        <Field id="am-line" label="For line item"><select className="erp-select" id="am-line" value={values.lineItemId} onChange={(event) => setValues({ ...values, lineItemId: event.target.value })}><option value="">Whole project</option>{lines.map((line) => <option key={line.id} value={line.id}>{partNumber(state, line.partId)} rev {revisionLabel(state, line.revisionId)}</option>)}</select></Field>
        <Field id="am-sup" label="Supplier (optional)"><input className="erp-input" id="am-sup" value={values.supplier} onChange={(event) => setValues({ ...values, supplier: event.target.value })} /></Field>
      </div>
      {error && <p className="erp-error" role="alert">{error}</p>}
      <div className="erp-head-actions" style={{ justifyContent: "flex-end" }}><button type="button" className="erp-btn erp-btn-ghost" onClick={onClose}>Cancel</button><button type="submit" className="erp-btn erp-btn-primary">Add material</button></div>
    </form>
  </Modal>;
}

export function AddInspectionDialog({ state, projectId, onClose }: { state: ErpState; projectId: string; onClose: () => void }) {
  const lines = state.lineItems.filter((line) => line.projectId === projectId);
  const [values, setValues] = useState({ name: "", spec: "", unit: "", acceptance: "", partId: lines[0]?.partId ?? "" });
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!values.name.trim() || !values.spec.trim()) { setError("Enter the parameter and its specification."); return; }
    commit((current) => addInspectionRequirement(current, projectId, { partId: values.partId || null, name: values.name, spec: values.spec, unit: values.unit, acceptance: values.acceptance }, nowIso()));
    onClose();
  };
  return <Modal label="Add inspection requirement" onClose={onClose}>
    <form onSubmit={submit} className="erp-stack">
      <div><h2>Add inspection requirement</h2><p className="erp-muted">Use fictional example values. These are not real engineering specifications.</p></div>
      <div className="erp-form-grid">
        <Field id="ai-name" label="Parameter *"><input className="erp-input" id="ai-name" value={values.name} placeholder="Outer diameter" onChange={(event) => setValues({ ...values, name: event.target.value })} /></Field>
        <Field id="ai-spec" label="Specification *"><input className="erp-input" id="ai-spec" value={values.spec} placeholder="63.50 ± 0.05" onChange={(event) => setValues({ ...values, spec: event.target.value })} /></Field>
        <Field id="ai-unit" label="Unit"><input className="erp-input" id="ai-unit" value={values.unit} placeholder="mm" onChange={(event) => setValues({ ...values, unit: event.target.value })} /></Field>
        <Field id="ai-part" label="Applies to"><select className="erp-select" id="ai-part" value={values.partId} onChange={(event) => setValues({ ...values, partId: event.target.value })}><option value="">Whole project</option>{lines.map((line) => <option key={line.id} value={line.partId}>{partNumber(state, line.partId)}</option>)}</select></Field>
        <Field id="ai-acc" label="Acceptance criteria" className="erp-span-2"><input className="erp-input" id="ai-acc" value={values.acceptance} placeholder="All parts within tolerance" onChange={(event) => setValues({ ...values, acceptance: event.target.value })} /></Field>
      </div>
      {error && <p className="erp-error" role="alert">{error}</p>}
      <div className="erp-head-actions" style={{ justifyContent: "flex-end" }}><button type="button" className="erp-btn erp-btn-ghost" onClick={onClose}>Cancel</button><button type="submit" className="erp-btn erp-btn-primary">Add requirement</button></div>
    </form>
  </Modal>;
}
