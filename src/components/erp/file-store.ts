"use client";

import type { StoredFile } from "@/lib/erp/model";

/**
 * Files attached in the demo live in this browser's IndexedDB (not in localStorage), so drawings and
 * 3D models of normal size fit. Nothing is uploaded to a server.
 */
const DB_NAME = "boh-erp-files";
const STORE = "files";
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB unavailable")); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB error"));
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB error"));
    tx.oncomplete = () => db.close();
  });
}

const newFileKey = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function guessType(name: string, type = "") {
  if (type && type !== "application/octet-stream") return type;
  const ext = fileExt(name);
  const map: Record<string, string> = {
    pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    step: "model/step", stp: "model/step", igs: "model/iges", iges: "model/iges", stl: "model/stl", dxf: "image/vnd.dxf", txt: "text/plain", csv: "text/csv",
  };
  return map[ext] ?? "application/octet-stream";
}

export const fileExt = (name: string) => (name.split(".").pop() ?? "").toLowerCase();

/** Whether the file's content is available in this browser (not just its name). */
export const hasContent = (file?: StoredFile | null) => Boolean(file && (file.data || file.key || file.url));

/** Keeps a picked file in this browser. Files above 50 MB keep only their name and size. */
export async function storeUpload(file: File): Promise<StoredFile> {
  const meta: StoredFile = { name: file.name, size: file.size, type: guessType(file.name, file.type) };
  if (file.size > MAX_FILE_BYTES) return meta;
  try {
    const key = newFileKey();
    await run("readwrite", (store) => store.put(file, key));
    return { ...meta, key };
  } catch {
    if (file.size > 1024 * 1024) return meta;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? { ...meta, data: reader.result } : meta);
      reader.onerror = () => resolve(meta);
      reader.readAsDataURL(file);
    });
  }
}

/** Stores generated content (for example a PDF or CSV) and returns it as an attachable file. */
export async function storeBlob(blob: Blob, name: string): Promise<StoredFile> {
  return storeUpload(new File([blob], name, { type: blob.type || guessType(name) }));
}

/** Loads a file's bytes from wherever they are kept. */
export async function loadFile(file: StoredFile): Promise<Blob | null> {
  try {
    if (file.key) {
      const blob = await run<Blob | undefined>("readonly", (store) => store.get(file.key!) as IDBRequest<Blob | undefined>);
      return blob ?? null;
    }
    if (file.url || file.data) {
      const response = await fetch((file.url ?? file.data)!);
      return response.ok ? await response.blob() : null;
    }
  } catch { /* fall through */ }
  return null;
}

export async function deleteStoredFile(file?: StoredFile | null) {
  if (!file?.key) return;
  try { await run("readwrite", (store) => store.delete(file.key!)); } catch { /* ignore */ }
}

export async function clearStoredFiles() {
  try { await run("readwrite", (store) => store.clear()); } catch { /* ignore */ }
}

/** Starts a browser download of a blob or text. */
export function downloadBlob(content: Blob | string, name: string, type = "text/plain;charset=utf-8") {
  const blob = typeof content === "string" ? new Blob([content.startsWith("﻿") || !type.includes("csv") ? content : `﻿${content}`], { type }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function downloadStoredFile(file: StoredFile) {
  const blob = await loadFile(file);
  if (blob) downloadBlob(blob, file.name);
  return Boolean(blob);
}

export const formatBytes = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
