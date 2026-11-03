"use client";

import { useState, type DragEvent } from "react";
import { Box, CheckCircle2, FileImage, FileText, Paperclip, Plus, Search, Upload } from "lucide-react";
import { DocPreview, previewKind } from "@/components/erp/doc-preview";
import { EditButton, useEditor } from "@/components/erp/edit";
import { MAX_FILE_BYTES, fileExt, formatBytes, hasContent, storeUpload } from "@/components/erp/file-store";
import { FilterBar, Loading, NoProjects, projectOf, save, useProjectFilter } from "@/components/erp/modules";
import { commit, nowIso, useErp, useHydrated } from "@/components/erp/store";
import { Badge, Field, Modal, PageHead, Rule } from "@/components/erp/ui";
import {
  DOC_STATUSES, RULES, addDocumentToProject, canApprove, docTypes, formatDate, partNumber, setDocumentStatus, updateDocument,
  type DocStatus, type DocumentRecord, type ErpState, type StoredFile,
} from "@/lib/erp/model";

export const DOC_ACCEPT = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.dxf,.dwg,.step,.stp,.igs,.iges,.stl,.txt,.csv,.nc";

export function DocIcon({ doc, size = 16 }: { doc: DocumentRecord; size?: number }) {
  const kind = previewKind(doc.file);
  if (kind === "model") return <Box size={size} aria-hidden="true" />;
  if (kind === "image") return <FileImage size={size} aria-hidden="true" />;
  if (kind === "pdf") return <FileText size={size} aria-hidden="true" />;
  return <FileText size={size} aria-hidden="true" />;
}

/** Suggests the document type from the file name: STEP/IGES/STL are 3D models, others drawings. */
export function typeForFile(state: ErpState, name: string) {
  const ext = fileExt(name);
  if (["step", "stp", "igs", "iges", "stl"].includes(ext)) return "3D model";
  if (/cert|zeugnis|3\.1/i.test(name)) return docTypes(state).includes("Material certificate") ? "Material certificate" : docTypes(state)[0];
  if (/spec/i.test(name)) return "Specification";
  if (/inspect|prüf|ip-/i.test(name)) return "Inspection plan";
  return "Drawing";
}

/** "DRW-ACT-204_A.pdf" → number DRW-ACT-204, revision A. */
export function numberFromFile(name: string) {
  const base = name.replace(/\.[^.]+$/, "");
  const match = base.match(/^(.*?)[\s_-]+(?:rev[\s_-]*)?([A-Z0-9]{1,2})$/i);
  const number = (match ? match[1] : base).toUpperCase().replace(/[^A-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
  return { number: number || "DOC", revision: match ? match[2].toUpperCase() : "A" };
}

export function AddDocumentDialog({ state, initialFile, projectId, partId, onClose }: { state: ErpState; initialFile?: StoredFile | null; projectId?: string; partId?: string | null; onClose: () => void }) {
  const projects = [...state.projects].reverse();
  const guess = initialFile ? numberFromFile(initialFile.name) : { number: "", revision: "A" };
  const [values, setValues] = useState({
    project: projectId ?? projects[0]?.id ?? "", part: partId ?? "", type: initialFile ? typeForFile(state, initialFile.name) : docTypes(state)[0],
    name: initialFile ? initialFile.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") : "", number: guess.number, revision: guess.revision, status: "In review" as DocStatus,
  });
  const [file, setFile] = useState<StoredFile | null>(initialFile ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch: Partial<typeof values>) => setValues((current) => ({ ...current, ...patch }));
  const parts = state.lineItems.filter((line) => line.projectId === values.project).map((line) => state.parts.find((part) => part.id === line.partId)).filter((part, index, list): part is NonNullable<typeof part> => Boolean(part) && list.indexOf(part) === index);
  const pick = async (picked?: File) => {
    if (!picked) return;
    setBusy(true);
    const stored = await storeUpload(picked);
    setBusy(false);
    setFile(stored);
    const fromName = numberFromFile(picked.name);
    setValues((current) => ({ ...current, type: typeForFile(state, picked.name), name: current.name || picked.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "), number: current.number || fromName.number, revision: current.number ? current.revision : fromName.revision }));
  };
  const submit = () => {
    if (!values.project) { setError("Choose a project."); return; }
    if (!values.name.trim() || !values.number.trim()) { setError("Enter a name and a document number."); return; }
    const ok = commit((current) => addDocumentToProject(current, values.project, { name: values.name, type: values.type, number: values.number, revision: values.revision, partId: values.part || null, status: values.status, file: file ?? undefined }, nowIso()));
    if (!ok) { setError("This number and revision is already linked to the project, or the revision is not valid (1–3 letters or digits)."); return; }
    onClose();
  };
  return <Modal label="Add document" onClose={onClose}>
    <form className="erp-stack" style={{ gap: 14 }} onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <h2>Add document</h2>
      <div className="erp-field">
        <label htmlFor="doc-file">File</label>
        <label className="erp-upload"><Paperclip size={18} /><span>{busy ? "Saving the file in this browser…" : file ? <><b>{file.name}</b> · {formatBytes(file.size)}{hasContent(file) ? "" : " · too large, name only"}</> : "Choose a PDF, image, DXF, STEP, IGES or STL file"}</span>
          <input id="doc-file" type="file" accept={DOC_ACCEPT} onChange={(event) => pick(event.target.files?.[0])} /></label>
        <span className="erp-help">Kept in this browser only (up to {formatBytes(MAX_FILE_BYTES)} per file). STEP files open in the 3D viewer. Please use fictional data.</span>
      </div>
      <div className="erp-form-grid">
        <Field id="doc-project" label="Project"><select className="erp-select" id="doc-project" value={values.project} onChange={(event) => set({ project: event.target.value, part: "" })}>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</select></Field>
        <Field id="doc-part" label="Part"><select className="erp-select" id="doc-part" value={values.part} onChange={(event) => set({ part: event.target.value })}><option value="">Whole project</option>{parts.map((part) => <option key={part.id} value={part.id}>{part.number} · {part.description}</option>)}</select></Field>
        <Field id="doc-type" label="Type"><select className="erp-select" id="doc-type" value={values.type} onChange={(event) => set({ type: event.target.value })}>{docTypes(state).map((type) => <option key={type}>{type}</option>)}</select></Field>
        <Field id="doc-status" label="Approval status"><select className="erp-select" id="doc-status" value={values.status} onChange={(event) => set({ status: event.target.value as DocStatus })}>{DOC_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></Field>
        <Field id="doc-number" label="Document number"><input className="erp-input" id="doc-number" value={values.number} onChange={(event) => set({ number: event.target.value.toUpperCase() })} /></Field>
        <Field id="doc-rev" label="Revision"><input className="erp-input" id="doc-rev" maxLength={3} value={values.revision} onChange={(event) => set({ revision: event.target.value.toUpperCase() })} /></Field>
      </div>
      <Field id="doc-name" label="Name"><input className="erp-input" id="doc-name" value={values.name} onChange={(event) => set({ name: event.target.value })} /></Field>
      {error && <p className="erp-error" role="alert">{error}</p>}
      <div className="erp-head-actions" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="erp-btn erp-btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="erp-btn erp-btn-primary" disabled={busy}>Add document</button>
      </div>
    </form>
  </Modal>;
}

export function DocumentsModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const filter = useProjectFilter(state);
  const editor = useEditor();
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ file: StoredFile | null } | null>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [drag, setDrag] = useState(false);
  const [mobilePreview, setMobilePreview] = useState(false);
  const onDrop = async (event: DragEvent) => {
    event.preventDefault(); setDrag(false);
    const file = event.dataTransfer.files?.[0];
    if (file) setAdding({ file: await storeUpload(file) });
  };
  const head = <PageHead eyebrow="Engineering" title="Documents" description="Drawings, 3D models and certificates with revision and approval. Click a document to preview it here: PDFs, images and STEP models open without downloading." actions={state.projects.length ? <button type="button" className="erp-btn erp-btn-primary" onClick={() => setAdding({ file: null })}><Plus size={15} /> Add document</button> : undefined} />;
  if (!hydrated) return <>{head}<Loading /></>;
  if (!state.documents.length) return <>{head}<NoProjects what="documents" />{adding && <AddDocumentDialog state={state} initialFile={adding.file} onClose={() => setAdding(null)} />}</>;
  const q = query.trim().toLowerCase();
  const docs = state.documents.filter((doc) => (!filter || doc.projectIds.includes(filter.id)) && (!type || doc.type === type) && (!status || doc.status === status)
    && (!q || [doc.number, doc.name, doc.type, doc.file?.name ?? "", doc.partId ? partNumber(state, doc.partId) : ""].some((text) => text.toLowerCase().includes(q))));
  const current = docs.find((doc) => doc.id === selected) ?? docs[0] ?? null;
  const review = state.documents.filter((doc) => doc.status !== "Approved").length;
  const openEdit = (doc: DocumentRecord) => editor.open({
    title: `Edit ${doc.number}`,
    fields: [{ key: "name", label: "Name", required: true }, { key: "number", label: "Document number", required: true }, { key: "revision", label: "Revision", required: true }, { key: "file", label: "Replace file", type: "file", help: "Changing the file, number or revision sends an approved document back to review." }],
    initial: { name: doc.name, number: doc.number, revision: doc.revision, file: doc.file?.name ?? "" },
    onSave: (v, file) => save((value) => updateDocument(value, doc.id, { name: v.name, number: v.number, revision: v.revision, file }, nowIso())),
  });
  const preview = current && <DocPreview state={state} doc={current} onClose={mobilePreview ? () => setMobilePreview(false) : undefined} actions={<>
    <Field id={`status-${current.id}`} label="Approval status"><select className="erp-select" id={`status-${current.id}`} value={current.status} onChange={(event) => commit((value) => setDocumentStatus(value, current.id, event.target.value as DocStatus, nowIso()))}>{DOC_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></Field>
    {current.status !== "Approved" && (canApprove(state) ? <button type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={() => commit((value) => setDocumentStatus(value, current.id, "Approved", nowIso()))}><CheckCircle2 size={14} /> Approve</button> : <small className="erp-faint">Only an owner or admin can approve. Change “Signed in as” to approve.</small>)}
    <EditButton onClick={() => openEdit(current)} />
  </>} />;
  return <div onDragOver={(event) => { event.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
    {head}<FilterBar project={filter} base="/demo/documents" />
    <div className="erp-toolbar">
      <label className="erp-search"><Search size={15} /><input aria-label="Search documents" placeholder="Search number, name, part or file" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <select className="erp-select" aria-label="Filter by type" value={type} onChange={(event) => setType(event.target.value)}><option value="">All types</option>{docTypes(state).map((item) => <option key={item}>{item}</option>)}</select>
      <select className="erp-select" aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{DOC_STATUSES.map((item) => <option key={item}>{item}</option>)}</select>
      <span className="erp-faint">{docs.length} of {state.documents.length} · {review} awaiting approval</span>
    </div>
    <div className={`erp-dropzone${drag ? " is-active" : ""}`}><Upload size={16} /> Drop a file anywhere on this page to add it as a document</div>
    <div className="erp-docs">
      <section className="erp-card erp-doclist" aria-label="Documents">
        {docs.length ? <ul>{docs.map((doc) => {
          const active = current?.id === doc.id;
          return <li key={doc.id}><button type="button" className={active ? "is-active" : ""} aria-current={active ? "true" : undefined} onClick={() => { setSelected(doc.id); setMobilePreview(true); }}>
            <span className={`erp-docicon is-${previewKind(doc.file)}`}><DocIcon doc={doc} /></span>
            <span className="erp-docmain"><strong>{doc.number} <small>rev {doc.revision}</small></strong><span>{doc.name}</span>
              <small>{doc.type} · {doc.partId ? partNumber(state, doc.partId) : "Whole project"} · {doc.projectIds.map((id) => projectOf(state, id)?.code).join(", ")}{doc.file ? ` · ${doc.file.name}` : ""}</small></span>
            <span className="erp-docside"><Badge>{doc.status}</Badge><small>{formatDate(doc.updatedAt)}</small></span>
          </button></li>;
        })}</ul> : <p className="erp-faint erp-card-pad">No document matches the filter.</p>}
      </section>
      <aside className={`erp-card erp-docpreview${mobilePreview ? " is-open" : ""}`} aria-label="Document preview">{preview}</aside>
    </div>
    <div style={{ marginTop: 14 }}><Rule>{RULES.engineering} Files stay in this browser (IndexedDB); nothing is uploaded to a server.</Rule></div>
    {adding && <AddDocumentDialog state={state} initialFile={adding.file} projectId={filter?.id} onClose={() => setAdding(null)} />}
    {editor.dialog}
  </div>;
}

