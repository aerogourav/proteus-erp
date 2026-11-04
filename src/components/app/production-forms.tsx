"use client";

import { startTransition, useActionState, useState, type FormEvent, type ReactNode } from "react";
import type { FormState } from "@/app/app/actions";
import { addDrawingAction, recordInspectionAction } from "@/app/app/production/actions";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { limitOutcome } from "@/lib/erp/model";

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

/** Content types the private bucket accepts (see migration 20261106000000), chosen from the file extension. */
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml",
  dxf: "image/vnd.dxf", dwg: "image/vnd.dwg", step: "model/step", stp: "model/step", igs: "model/iges", iges: "model/iges", stl: "model/stl",
};

async function sha256Hex(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Adds a drawing version for review. The file is required and goes to a new, never-overwritten path in the company's
 * private Storage folder. The browser's SHA-256 is checked again by the server against the stored bytes.
 */
export function DrawingForm({ companyId, parts }: { companyId: string; parts: { id: string; sku: string; revision: string | null }[] }) {
  const [state, run, pending] = useActionState(addDrawingAction, {});
  const [upload, setUpload] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    form.delete("file");
    if (!(file instanceof File) || file.size === 0) { setUpload("Choose the drawing file (PDF, image, DXF/DWG, STEP, IGES or STL)."); return; }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mime = MIME_BY_EXTENSION[extension];
    if (!mime) { setUpload("This file type is not accepted. Use PDF, PNG, JPG, SVG, DXF, DWG, STEP, IGES or STL."); return; }
    if (file.size > 20 * 1024 * 1024) { setUpload("Files can be up to 20 MB."); return; }
    setUpload("Uploading the file…");
    const hash = await sha256Hex(file);
    const path = `${companyId}/drawings/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const { error } = await supabaseBrowser().storage.from("company-files").upload(path, file, { contentType: mime, upsert: false });
    if (error) { setUpload(`The file could not be uploaded (${error.message}).`); return; }
    form.set("storagePath", path); form.set("fileName", file.name); form.set("size", String(file.size)); form.set("mime", mime); form.set("sha256", hash);
    setUpload("");
    startTransition(() => run(form));
  }
  return <form className="app-inline-form app-form-5" onSubmit={submit}>
    <input type="hidden" name="companyId" value={companyId} />
    <div className="erp-field"><label htmlFor="dr-part">Part</label><select id="dr-part" name="partId" className="erp-select" required>{parts.map((part) => <option key={part.id} value={part.id}>{part.sku}</option>)}</select></div>
    <div className="erp-field"><label htmlFor="dr-number">Drawing number</label><input id="dr-number" name="number" className="erp-input" required maxLength={40} /></div>
    <div className="erp-field"><label htmlFor="dr-rev">Revision</label><input id="dr-rev" name="revision" className="erp-input" required maxLength={8} /></div>
    <div className="erp-field"><label htmlFor="dr-file">File</label><input id="dr-file" name="file" type="file" className="erp-input" required accept=".pdf,.png,.jpg,.jpeg,.svg,.dxf,.dwg,.step,.stp,.igs,.iges,.stl" /></div>
    <button type="submit" className="erp-btn erp-btn-sm erp-btn-primary" disabled={pending || upload === "Uploading the file…"}>{pending ? "Saving…" : "Add for review"}</button>
    <div className="app-form-status">{upload ? <p className={upload.startsWith("Uploading") ? "erp-faint" : "erp-error"} role="status">{upload}</p> : <Status state={state} />}</div>
  </form>;
}

export type PlanRow = { id: string; characteristic: string; kind: string; lower_limit: number | null; upper_limit: number | null; unit: string; required_gauge: string; sample_size: number; spec_text: string };

const limitsText = (row: PlanRow) => row.kind !== "numeric" ? "pass / fail" : row.lower_limit != null && row.upper_limit != null ? `${row.lower_limit} – ${row.upper_limit}` : row.upper_limit != null ? `max ${row.upper_limit}` : row.lower_limit != null ? `min ${row.lower_limit}` : "no limits: needs review";

/** Records an inspection of a completed order against its stored plan: every characteristic once, with result, sample size and gauge. */
export function InspectionForm({ orderId, plan }: { orderId: string; plan: PlanRow[] }) {
  const [state, run, pending] = useActionState(recordInspectionAction, {});
  const [values, setValues] = useState<Record<string, string>>({});
  if (!plan.length) return <p className="erp-faint">No inspection plan for this part revision yet. An owner or admin adds it under “Parts, drawings and routings”.</p>;
  return <form className="erp-stack app-inspect" action={run}>
    <input type="hidden" name="orderId" value={orderId} />
    {plan.map((row) => {
      const value = values[row.id] ?? "";
      const outcome = row.kind === "numeric" && value.trim() ? limitOutcome(value, row.lower_limit, row.upper_limit) : null;
      return <div key={row.id} className="app-inspect-row app-inspect-plan">
        <input type="hidden" name="planId" value={row.id} />
        <span><b>{row.characteristic}</b><small>{row.spec_text || limitsText(row)}{row.unit ? ` ${row.unit}` : ""} · {limitsText(row)} · at least {row.sample_size} part{row.sample_size === 1 ? "" : "s"}{row.required_gauge ? ` · gauge ${row.required_gauge}` : ""}</small></span>
        <input className="erp-input" name={`observed-${row.id}`} aria-label={`Measured ${row.characteristic}`} placeholder={row.kind === "numeric" ? "Value (number)" : "Observation"} maxLength={40} required onChange={(event) => setValues({ ...values, [row.id]: event.target.value })} />
        <select className="erp-select" name={`result-${row.id}`} aria-label={`Result ${row.characteristic}`} defaultValue="" required><option value="">Result…</option><option value="pass">Pass</option><option value="fail">Fail</option></select>
        <input className="erp-input" name={`sample-${row.id}`} aria-label={`Parts measured ${row.characteristic}`} placeholder={`Parts (min ${row.sample_size})`} inputMode="numeric" maxLength={5} required />
        <input className="erp-input" name={`gauge-${row.id}`} aria-label={`Gauge ${row.characteristic}`} placeholder={row.required_gauge || "Gauge ID"} maxLength={40} required={Boolean(row.required_gauge)} />
        {outcome === "invalid" && <p className="erp-error app-inspect-note">Enter a plain number, for example 120.02.</p>}
        {outcome === "fail" && <p className="erp-error app-inspect-note">{value} is outside the limits: it will be recorded as failed.</p>}
        {outcome === "needs_review" && <p className="erp-faint app-inspect-note">No usable limits: this result will need review by an owner or admin.</p>}
      </div>;
    })}
    <div><button type="submit" className="erp-btn erp-btn-sm erp-btn-primary" disabled={pending}>{pending ? "Saving…" : "Record inspection"}</button></div>
    <Status state={state} />
  </form>;
}
