"use client";

import { useSyncExternalStore } from "react";
import { createInitialState, parseStoredState, STORAGE_KEY, type ErpState } from "@/lib/erp/model";

/** Browser-local store shared by every demo screen. Not a database: data stays in this browser only. */
const SERVER_STATE = createInitialState();
const listeners = new Set<() => void>();
let cache: ErpState | null = null;

function read(): ErpState {
  if (cache) return cache;
  try { cache = parseStoredState(window.localStorage.getItem(STORAGE_KEY)); } catch { cache = createInitialState(); }
  return cache;
}

function notify() { listeners.forEach((listener) => listener()); }

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) { cache = null; notify(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

/** Applies a pure state transition and persists it. */
export function commit(update: (state: ErpState) => ErpState) {
  const current = read();
  const next = update(current);
  if (next === current) return false;
  cache = next;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Keep working in memory if storage is blocked. */ }
  notify();
  return true;
}

export function getState() { return read(); }

export function resetDemo() {
  cache = createInitialState();
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  notify();
}

export function useErp(): ErpState {
  return useSyncExternalStore(subscribe, read, () => SERVER_STATE);
}

const noopSubscribe = () => () => {};
/** False during server render and hydration, true once browser data is available. */
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export const nowIso = () => new Date().toISOString();
export const todayIso = () => new Date().toISOString().slice(0, 10);

export function newKey() {
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
