"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Download, Maximize2, FileText, X } from "lucide-react";
import { MODEL_EXTENSIONS, ModelViewer } from "@/components/erp/model-viewer";
import { downloadStoredFile, fileExt, formatBytes, hasContent, loadFile } from "@/components/erp/file-store";
import { Badge, Modal } from "@/components/erp/ui";
import { formatDate, partNumber, type DocumentRecord, type ErpState, type StoredFile } from "@/lib/erp/model";

export type PreviewKind = "pdf" | "image" | "model" | "text" | "none";

export function previewKind(file?: StoredFile | null): PreviewKind {
  if (!file) return "none";
  const ext = fileExt(file.name);
  if (ext === "pdf" || file.type === "application/pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext) || file.type.startsWith("image/")) return ext === "dxf" ? "text" : "image";
  if (MODEL_EXTENSIONS.includes(ext)) return "model";
  if (["txt", "csv", "dxf", "md", "json", "xml", "nc", "gcode", "tap"].includes(ext) || file.type.startsWith("text/")) return "text";
  return "none";
}

export const KIND_LABEL: Record<PreviewKind, string> = { pdf: "PDF", image: "Image", model: "3D model", text: "Text", none: "File" };

/** Loads the stored bytes of a file and keeps an object URL for them while mounted. Mount it with a key per file. */
function useFileBlob(file: StoredFile) {
  const [state, setState] = useState<{ blob: Blob | null; url: string | null; loading: boolean }>({ blob: null, url: null, loading: hasContent(file) });
  useEffect(() => {
    if (!hasContent(file)) return;
    let url: string | null = null;
    let cancelled = false;
    loadFile(file).then((blob) => {
      if (cancelled) return;
      // Re-type the blob so PDFs and SVGs display inline.
      const typed = blob && file.type && blob.type !== file.type ? new Blob([blob], { type: file.type }) : blob;
      url = typed ? URL.createObjectURL(typed) : null;
      setState({ blob: typed, url, loading: false });
    });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [file]);
  return state;
}

export const fileId = (file: StoredFile) => `${file.key ?? ""}|${file.url ?? ""}|${file.data?.length ?? 0}|${file.name}|${file.size}`;

function TextPreview({ blob }: { blob: Blob }) {
  const [text, setText] = useState("");
  useEffect(() => { blob.slice(0, 40000).text().then(setText); }, [blob]);
  return <pre className="erp-preview-text">{text}{blob.size > 40000 ? "\n…" : ""}</pre>;
}

/** The content of a file: PDF, image, 3D model or text. */
export function FilePreview({ file, height = 460 }: { file: StoredFile; height?: number }) {
  return <FileContent key={fileId(file)} file={file} height={height} />;
}

function FileContent({ file, height }: { file: StoredFile; height: number }) {
  const kind = previewKind(file);
  const { blob, url, loading } = useFileBlob(file);
  if (!hasContent(file)) return <div className="erp-preview-empty"><FileText size={26} /><p><b>{file.name}</b> ({formatBytes(file.size)})</p><p>Only the name was kept for this file, so it can’t be shown. Replace the file to preview it.</p></div>;
  if (loading) return <div className="erp-preview-empty" role="status"><p>Opening {file.name}…</p></div>;
  if (!blob || !url) return <div className="erp-preview-empty"><FileText size={26} /><p>This file is no longer available in this browser.</p></div>;
  if (kind === "pdf") return <iframe className="erp-preview-frame" style={{ height }} src={`${url}#toolbar=0&navpanes=0&view=FitH`} title={`Preview of ${file.name}`} />;
  if (kind === "image") return <div className="erp-preview-image" style={{ maxHeight: height }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={url} alt={`Preview of ${file.name}`} /></div>;
  if (kind === "model") return <ModelViewer blob={blob} name={file.name} height={height} />;
  if (kind === "text") return <TextPreview blob={blob} />;
  return <div className="erp-preview-empty"><FileText size={26} /><p><b>{file.name}</b> can’t be previewed in the browser. Download it to open it.</p></div>;
}

/** A drawing sheet generated from the record when no file was uploaded. */
export function GeneratedDrawing({ state, doc }: { state: ErpState; doc: DocumentRecord }) {
  const part = doc.partId ? state.parts.find((item) => item.id === doc.partId) : null;
  const company = state.settings.companyName;
  return <svg className="erp-preview-sheet" viewBox="0 0 420 297" role="img" aria-label={`Generated placeholder sheet for ${doc.number}`}>
    <rect x="4" y="4" width="412" height="289" fill="#fff" stroke="#1F0E18" strokeWidth="1" />
    <rect x="8" y="8" width="404" height="281" fill="none" stroke="#1F0E18" strokeWidth=".4" />
    <g stroke="#1F0E18" strokeWidth=".8" fill="none">
      <rect x="60" y="70" width="140" height="90" rx="6" />
      <circle cx="130" cy="115" r="22" />
      {[[78, 88], [182, 88], [78, 142], [182, 142]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="5" />)}
      <rect x="240" y="80" width="120" height="70" />
      <line x1="300" y1="70" x2="300" y2="160" strokeDasharray="8 2 2 2" strokeWidth=".4" />
      <line x1="50" y1="115" x2="210" y2="115" strokeDasharray="8 2 2 2" strokeWidth=".4" />
    </g>
    <text x="210" y="40" fontSize="9" textAnchor="middle" fill="#B4213F" fontFamily="Helvetica, Arial">No file uploaded · placeholder generated from the record</text>
    <g fontFamily="Helvetica, Arial" fill="#1F0E18">
      <rect x="236" y="225" width="176" height="64" fill="none" stroke="#1F0E18" strokeWidth=".6" />
      <line x1="236" y1="241" x2="412" y2="241" stroke="#1F0E18" strokeWidth=".4" />
      <line x1="236" y1="257" x2="412" y2="257" stroke="#1F0E18" strokeWidth=".4" />
      <line x1="236" y1="273" x2="412" y2="273" stroke="#1F0E18" strokeWidth=".4" />
      <text x="240" y="236" fontSize="7" fontWeight="700">{company}</text>
      <text x="240" y="252" fontSize="7">{doc.name}</text>
      <text x="240" y="268" fontSize="7">{doc.number} · rev {doc.revision} · {doc.type}</text>
      <text x="240" y="284" fontSize="7">{part ? `${part.number} · ${part.description}` : "Whole project"} · {doc.status}</text>
    </g>
  </svg>;
}

/** Everything you need to judge a document without opening it: metadata, status and the content itself. */
export function DocPreview({ state, doc, height = 460, onClose, actions }: { state: ErpState; doc: DocumentRecord; height?: number; onClose?: () => void; actions?: ReactNode }) {
  const [full, setFull] = useState(false);
  const file = doc.file;
  const projects = doc.projectIds.map((id) => state.projects.find((project) => project.id === id)?.code).filter(Boolean).join(", ");
  const body = file ? <FilePreview file={file} height={height} /> : doc.type === "Drawing" ? <GeneratedDrawing state={state} doc={doc} /> : <div className="erp-preview-empty"><FileText size={26} /><p><b>{doc.name}</b> is recorded without a file.</p><p>Add the file with “Edit” to preview it here.</p></div>;
  return <div className="erp-preview">
    <div className="erp-preview-head">
      <div><span className="erp-eyebrow">{doc.type} · {file ? KIND_LABEL[previewKind(file)] : "No file"}</span><h2>{doc.number} <small>rev {doc.revision}</small></h2><p>{doc.name}</p></div>
      <div className="erp-head-actions">
        <Badge>{doc.status}</Badge>
        {file && hasContent(file) && <button type="button" className="erp-btn erp-btn-sm" onClick={() => downloadStoredFile(file)} aria-label={`Download ${file.name}`}><Download size={13} /></button>}
        <button type="button" className="erp-btn erp-btn-sm" onClick={() => setFull(true)} aria-label="Open large preview"><Maximize2 size={13} /></button>
        {onClose && <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={onClose} aria-label="Close preview"><X size={13} /></button>}
      </div>
    </div>
    <div className="erp-preview-body">{body}</div>
    <dl className="erp-preview-meta">
      <div><dt>File</dt><dd>{file ? `${file.name} · ${formatBytes(file.size)}` : "None"}</dd></div>
      <div><dt>Part</dt><dd>{doc.partId ? partNumber(state, doc.partId) : "Whole project"}</dd></div>
      <div><dt>Projects</dt><dd>{projects || "—"}</dd></div>
      <div><dt>Approved</dt><dd>{doc.status === "Approved" ? `${doc.approvedBy ?? "Yes"}${doc.approvedAt ? ` · ${formatDate(doc.approvedAt)}` : ""}` : "Not yet"}</dd></div>
      <div><dt>Changed</dt><dd>{formatDate(doc.updatedAt)}</dd></div>
    </dl>
    {actions && <div className="erp-preview-actions">{actions}</div>}
    {full && <Modal label={`Preview ${doc.number}`} wide onClose={() => setFull(false)}>
      <div className="erp-dialog-bar"><h2>{doc.number} rev {doc.revision} · {doc.name}</h2><button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => setFull(false)}><X size={14} /> Close</button></div>
      <div className="erp-card-pad">{file ? <FilePreview file={file} height={Math.max(420, typeof window !== "undefined" ? window.innerHeight - 200 : 600)} /> : body}</div>
    </Modal>}
  </div>;
}
