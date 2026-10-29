"use client";

import { useSyncExternalStore } from "react";
import { createInitialState, parseStoredState, STORAGE_KEY, type ErpState } from "@/lib/erp/model";
import { createDemoState } from "@/lib/erp/seed";
import { guideSteps, stepIndex } from "@/components/erp/guide-steps";

/** Browser-local store shared by every demo screen. Not a database: data stays in this browser only. */
const SERVER_STATE = createInitialState();
const listeners = new Set<() => void>();
let cache: ErpState | null = null;
/** Set when the browser refused to save (storage full or blocked). */
export let storageFull = false;

function read(): ErpState {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    // A first visit starts with the two demo projects already in place.
    if (raw === null) {
      cache = createDemoState(new Date().toISOString());
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache)); } catch { /* keep in memory */ }
    } else cache = migrateGuide(parseStoredState(raw));
  } catch { cache = createInitialState(); }
  return cache;
}

/** Progress saved by the earlier single-part flow used different step numbers: resume at the first operational step. */
function migrateGuide(state: ErpState): ErpState {
  if (state.guide.v === 2) return state;
  const step = state.guide.projectId ? stepIndex(guideSteps(state), "purchase") : 0;
  return { ...state, guide: { step, projectId: state.guide.projectId, furthest: step, v: 2 } };
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
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { storageFull = true; /* Keep working in memory if storage is blocked or full. */ }
  notify();
  return true;
}

export function getState() { return read(); }

/** "demo" restores the two demo projects; "empty" starts with nothing. */
export function resetDemo(mode: "demo" | "empty" = "demo") {
  cache = mode === "demo" ? createDemoState(new Date().toISOString()) : createInitialState();
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache)); } catch { /* ignore */ }
  notify();
}

/** Replaces all data, for example from an imported backup. */
export function replaceState(next: ErpState) {
  cache = next;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* keep in memory */ }
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
