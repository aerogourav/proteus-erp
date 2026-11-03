"use client";

import { startTransition, useActionState, useState, type FormEvent, type ReactNode } from "react";
import type { FormState } from "@/app/app/actions";
import { addDrawingAction, recordInspectionAction } from "@/app/app/production/actions";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toleranceCheck } from "@/lib/erp/model";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

function Status({ state }: { state: FormState }) {
  if (state.error) return <p className="erp-error" role="alert">{state.error}</p>;
  if (state.ok) return <p className="erp-ok-text" role="status">{state.ok}</p>;
  return null;
}

/** A form bound to a server action, with its success or error message underneath. */
export function ActionForm({ action, submit, children, className = "app-inline-form", tone = "primary" }: { action: Action; submit: string; children?: ReactNode; className?: string; tone?: "primary" | "ghost" | "danger" }) {
  const [state, run, pending] = useActionState(action, {});
  return <form className={className} action={run}>
    {children}
    <button type="submit" className={`erp-btn erp-btn-sm erp-btn-${tone}`} disabled={pending}>{pending ? "Saving…" : submit}</button>
    <div className="app-form-status"><Status state={state} /></div>
  </form>;
}

/** Adds a drawing revision for review. A chosen file goes straight from the browser into the company's private Storage folder. */
export function DrawingForm({ companyId, parts }: { companyId: string; parts: { id: string; sku: string; revision: string | null }[] }) {
  const [state, run, pending] = useActionState(addDrawingAction, {});
  const [upload, setUpload] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    form.delete("file");
    if (file instanceof File && file.size > 0) {
      setUpload("Uploading the file…");
      const path = `${companyId}/drawings/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const { error } = await supabaseBrowser().storage.from("company-files").upload(path, file, { contentType: file.type || undefined });
      if (error) { setUpload(`The file could not be uploaded (${error.message}). Save the drawing without a file, or try again.`); return; }
      form.set("storagePath", path); form.set("fileName", file.name); form.set("size", String(file.size)); form.set("mime", file.type);
    }
    setUpload("");
    startTransition(() => run(form));
  }
  return <form className="app-inline-form app-form-5" onSubmit={submit}>
    <input type="hidden" name="companyId" value={companyId} />
    <div className="erp-field"><label htmlFor="dr-part">Part</label><select id="dr-part" name="partId" className="erp-select" required>{parts.map((part) => <option key={part.id} value={part.id}>{part.sku}</option>)}</select></div>
    <div className="erp-field"><label htmlFor="dr-number">Drawing number</label><input id="dr-number" name="number" className="erp-input" required maxLength={40} /></div>
    <div className="erp-field"><label htmlFor="dr-rev">Revision</label><input id="dr-rev" name="revision" className="erp-input" required maxLength={8} /></div>
    <div className="erp-field"><label htmlFor="dr-file">File <span className="erp-faint">(optional)</span></label><input id="dr-file" name="file" type="file" className="erp-input" /></div>
    <button type="submit" className="erp-btn erp-btn-sm erp-btn-primary" disabled={pending || Boolean(upload)}>{pending ? "Saving…" : "Add for review"}</button>
    <div className="app-form-status">{upload ? <p className="erp-faint" role="status">{upload}</p> : <Status state={state} />}</div>
  </form>;
}

/** Records an inspection of a completed order: up to three characteristics, each with an explicit result and sample size. */
export function InspectionForm({ orderId }: { orderId: string }) {
  const [state, run, pending] = useActionState(recordInspectionAction, {});
  const [rows, setRows] = useState([0, 1, 2].map(() => ({ spec: "", observed: "" })));
  return <form className="erp-stack app-inspect" action={run}>
    <input type="hidden" name="orderId" value={orderId} />
    {rows.map((row, index) => {
      const outside = row.spec && row.observed && toleranceCheck(row.spec, row.observed) === "out";
      return <div key={index} className="app-inspect-row">
        <input className="erp-input" name={`characteristic${index}`} aria-label={`Characteristic ${index + 1}`} placeholder={index === 0 ? "Characteristic, e.g. Outer width" : "Characteristic (optional)"} maxLength={80} />
        <input className="erp-input" name={`spec${index}`} aria-label={`Specification ${index + 1}`} placeholder="Spec, e.g. 120.00 ± 0.05" maxLength={60} onChange={(event) => setRows(rows.map((item, i) => i === index ? { ...item, spec: event.target.value } : item))} />
        <input className="erp-input" name={`unit${index}`} aria-label={`Unit ${index + 1}`} placeholder="Unit" maxLength={10} />
        <input className="erp-input" name={`observed${index}`} aria-label={`Measured value ${index + 1}`} placeholder="Measured" maxLength={40} onChange={(event) => setRows(rows.map((item, i) => i === index ? { ...item, observed: event.target.value } : item))} />
        <select className="erp-select" name={`result${index}`} aria-label={`Result ${index + 1}`} defaultValue=""><option value="">Result…</option><option value="pass">Pass</option><option value="fail">Fail</option></select>
        <input className="erp-input" name={`sample${index}`} aria-label={`Parts measured ${index + 1}`} placeholder="Parts measured" inputMode="numeric" maxLength={5} />
        <input className="erp-input" name={`gauge${index}`} aria-label={`Gauge ID ${index + 1}`} placeholder="Gauge ID" maxLength={40} />
        {outside && <p className="erp-error app-inspect-note">{row.observed} is outside {row.spec}: it will be recorded as failed.</p>}
      </div>;
    })}
    <div><button type="submit" className="erp-btn erp-btn-sm erp-btn-primary" disabled={pending}>{pending ? "Saving…" : "Record inspection"}</button></div>
    <Status state={state} />
  </form>;
}
