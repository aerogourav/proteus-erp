"use client";

import { useSyncExternalStore } from "react";
import { createInitialState, log, parseStoredState, RULES_VERSION, stateProblems, STORAGE_KEY, type ErpState, type Industry } from "@/lib/erp/model";
import { createDemoState } from "@/lib/erp/seed";
import { createIndustryDemoState } from "@/lib/erp/demo-companies";
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
    } else cache = upgradeRules(migrateGuide(parseStoredState(raw)));
  } catch { cache = createInitialState(); }
  return cache;
}

/**
 * Browser data saved before the current rules: kept when it already follows them, otherwise replaced by a fresh demo
 * (with a note in the activity log), so returning visitors never see completed jobs or shipments the rules would refuse.
 */
function upgradeRules(state: ErpState): ErpState {
  if (state.rulesVersion === RULES_VERSION) return state;
  const now = new Date().toISOString();
  const problems = stateProblems(state);
  const next = problems.length
    ? log(createDemoState(now), now, "settings", `Your earlier demo data was reset because it did not follow the current rules (${problems.length} issue${problems.length === 1 ? "" : "s"}, for example: ${problems[0]})`, null)
    : { ...state, rulesVersion: RULES_VERSION };
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* keep in memory */ }
  return next;
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

/** "demo" restores the sample company of the current (or given) industry; "empty" starts with nothing in that industry. */
export function resetDemo(mode: "demo" | "empty" = "demo", industry: Industry = read().settings.industry ?? "manufacturing") {
  const now = new Date().toISOString();
  if (mode === "demo") cache = createIndustryDemoState(industry, now);
  else { const empty = createInitialState(); cache = { ...empty, settings: { ...empty.settings, industry } }; }
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache)); } catch { /* ignore */ }
  notify();
}

/** Opens the sample company of another industry. Replaces the data in this browser. */
export function switchIndustry(industry: Industry) {
  resetDemo("demo", industry);
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
