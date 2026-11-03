"use client";

import { useState } from "react";
import { Paperclip, Pencil } from "lucide-react";
import { formatBytes, hasContent, storeUpload } from "@/components/erp/file-store";
import { Field, Modal } from "@/components/erp/ui";
import { customFieldsFor, isProductionComplete, type CustomEntity, type CustomValues, type ErpState, type StoredFile } from "@/lib/erp/model";

/* ---------- Files kept in this browser (IndexedDB, see file-store) ---------- */

/** Kept for older imports: stores a picked file in this browser. */
export const readStoredFile = storeUpload;

export const DRAWING_ACCEPT = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.dxf,.dwg,.step,.stp,.igs,.iges,.stl,.txt,.csv";

export const statusTone = (status: string) => isProductionComplete(status) ? "ok" as const : status === "Planned" ? "neutral" as const : "info" as const;

/* ---------- Generic edit dialog ---------- */

export type EditField = { key: string; label: string; type?: "text" | "number" | "date" | "select" | "file" | "textarea" | "email"; options?: string[]; help?: string; required?: boolean; list?: string[] };

export function EditButton({ label = "Edit", onClick }: { label?: string; onClick: () => void }) {
  return <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={onClick}><Pencil size={13} /> {label}</button>;
}

/** onSave returns an error message, or null when saved. */
export function EditDialog({ title, fields, initial, onSave, onClose }: { title: string; fields: EditField[]; initial: Record<string, string>; onSave: (values: Record<string, string>, file?: StoredFile | null) => string | null; onClose: () => void }) {
  const [values, setValues] = useState(initial);
  const [file, setFile] = useState<StoredFile | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const save = () => {
    if (busy) return;
    const missing = fields.find((field) => field.required && field.type !== "file" && !values[field.key]?.trim());
    if (missing) { setError(`${missing.label} is required.`); return; }
    const result = onSave(values, file);
    if (result) { setError(result); return; }
    onClose();
  };
  return <Modal label={title} onClose={onClose}>
    <form className="erp-stack" style={{ gap: 14 }} onSubmit={(event) => { event.preventDefault(); save(); }}>
      <h2>{title}</h2>
      {fields.map((field) => {
        const id = `edit-${field.key}`;
        if (field.type === "file") return <div key={field.key} className="erp-field">
          <label htmlFor={id}>{field.label}</label>
          <label className="erp-upload"><Paperclip size={18} /><span>{busy ? "Saving the file in this browser…" : file ? <><b>{file.name}</b> · {formatBytes(file.size)}{hasContent(file) ? "" : " · too large, name only"}</> : values[field.key] ? <>Current: <b>{values[field.key]}</b>. Choose a file to replace it.</> : "Choose a file"}</span>
            <input id={id} type="file" accept={DRAWING_ACCEPT} onChange={async (event) => { const picked = event.target.files?.[0]; if (picked) { setBusy(true); setFile(await storeUpload(picked)); setBusy(false); } }} /></label>
          {field.help && <span className="erp-help">{field.help}</span>}
        </div>;
        if (field.type === "select") return <Field key={field.key} id={id} label={field.label} help={field.help}><select className="erp-select" id={id} value={values[field.key] ?? ""} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}>{field.options?.map((option) => <option key={option}>{option}</option>)}</select></Field>;
        if (field.type === "textarea") return <Field key={field.key} id={id} label={field.label} help={field.help}><textarea className="erp-textarea" id={id} rows={4} value={values[field.key] ?? ""} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} /></Field>;
        return <Field key={field.key} id={id} label={field.label} help={field.help}>
          <input className="erp-input" id={id} type={field.type === "date" ? "date" : field.type === "email" ? "email" : "text"} inputMode={field.type === "number" ? "decimal" : undefined} list={field.list ? `${id}-list` : undefined} value={values[field.key] ?? ""} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} />
          {field.list && <datalist id={`${id}-list`}>{field.list.map((option) => <option key={option} value={option} />)}</datalist>}
        </Field>;
      })}
      {error && <p className="erp-error" role="alert">{error}</p>}
      <div className="erp-head-actions" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="erp-btn erp-btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="erp-btn erp-btn-primary">Save changes</button>
      </div>
    </form>
  </Modal>;
}

/** Applies a pure update and reports whether it was accepted. */
export function tryCommit(commitFn: (update: (state: ErpState) => ErpState) => boolean, update: (state: ErpState) => ErpState, message: string): string | null {
  return commitFn(update) ? null : message;
}

export type EditSpec = { title: string; fields: EditField[]; initial: Record<string, string>; onSave: (values: Record<string, string>, file?: StoredFile | null) => string | null };

/** One edit dialog per screen: `open(spec)` shows it, `dialog` renders it. */
export function useEditor() {
  const [spec, setSpec] = useState<EditSpec | null>(null);
  return { open: setSpec, dialog: spec ? <EditDialog {...spec} onClose={() => setSpec(null)} /> : null };
}

export const NOT_SAVED = "Nothing was changed, or a value is not valid (for example a number that is already in use).";

/* ---------- Custom fields (configured by the user) ---------- */

export function customEditFields(state: ErpState, entity: CustomEntity): EditField[] {
  return customFieldsFor(state, entity).map((field) => ({
    key: `cf:${field.id}`, label: field.label,
    type: field.type === "select" ? "select" : field.type === "number" ? "number" : field.type === "date" ? "date" : "text",
    options: field.type === "select" ? ["", ...field.options] : undefined,
    help: "Custom field",
  }));
}

export function customInitial(state: ErpState, entity: CustomEntity, custom?: CustomValues): Record<string, string> {
  return Object.fromEntries(customFieldsFor(state, entity).map((field) => [`cf:${field.id}`, custom?.[field.id] ?? ""]));
}

export function pickCustom(values: Record<string, string>): CustomValues {
  return Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith("cf:")).map(([key, value]) => [key.slice(3), value]));
}

/** Shows the custom field values of a record as small label/value pairs. */
export function CustomValuesView({ state, entity, custom }: { state: ErpState; entity: CustomEntity; custom?: CustomValues }) {
  const fields = customFieldsFor(state, entity).filter((field) => custom?.[field.id]);
  if (!fields.length) return null;
  return <span className="erp-custom-values">{fields.map((field) => <span key={field.id}><small>{field.label}</small>{custom![field.id]}</span>)}</span>;
}
