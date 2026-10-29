"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { X } from "lucide-react";

/** Small notifications ("Order sent", "New email from …"). */
export type Toast = { id: number; text: string; href?: string; action?: string; tone?: "ok" | "info" | "bad" };
let toasts: Toast[] = [];
let counter = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const EMPTY: Toast[] = [];

export function toast(text: string, options: Omit<Toast, "id" | "text"> = {}) {
  counter += 1;
  const id = counter;
  toasts = [...toasts, { id, text, ...options }].slice(-4);
  emit();
  window.setTimeout(() => dismiss(id), 6500);
}

export function dismiss(id: number) {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function Toasts() {
  const list = useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
  if (!list.length) return null;
  return <div className="erp-toasts" role="status" aria-live="polite">
    {list.map((item) => <div key={item.id} className={`erp-toast${item.tone ? ` is-${item.tone}` : ""}`}>
      <span>{item.text}</span>
      {item.href && <Link href={item.href} onClick={() => dismiss(item.id)}>{item.action ?? "Open"}</Link>}
      <button type="button" aria-label="Dismiss" onClick={() => dismiss(item.id)}><X size={14} /></button>
    </div>)}
  </div>;
}
