/** The guided demo: one project, many small steps. The parts section repeats for every part on the order. */

import type { ErpState } from "@/lib/erp/model";

export type PhaseKey = "start" | "sales" | "parts" | "review" | "purchasing" | "production" | "inspection" | "dispatch" | "finance" | "done";

export const PHASES: { key: PhaseKey; label: string }[] = [
  { key: "start", label: "Start" },
  { key: "sales", label: "Sales" },
  { key: "parts", label: "Parts" },
  { key: "review", label: "Create project" },
  { key: "purchasing", label: "Purchasing" },
  { key: "production", label: "Production" },
  { key: "inspection", label: "Final inspection" },
  { key: "dispatch", label: "Dispatch" },
  { key: "finance", label: "Invoice" },
  { key: "done", label: "Finished" },
];

export type StepKind =
  | "welcome" | "customer" | "project" | "order" | "part-count"
  | "part" | "drawing" | "inspection" | "quantity" | "material"
  | "review" | "purchase" | "production-order" | "run-production" | "inspect" | "dispatch" | "invoice" | "done";

export type StepId = StepKind;
export type GuideStep = { kind: StepKind; phase: PhaseKey; part?: number };

const PART_STEPS: StepKind[] = ["part", "drawing", "inspection", "quantity", "material"];
export const MAX_PARTS = 8;

export function buildSteps(partCount: number): GuideStep[] {
  const count = Math.min(Math.max(partCount, 1), MAX_PARTS);
  const steps: GuideStep[] = [
    { kind: "welcome", phase: "start" },
    { kind: "customer", phase: "sales" },
    { kind: "project", phase: "sales" },
    { kind: "order", phase: "sales" },
    { kind: "part-count", phase: "sales" },
  ];
  for (let part = 0; part < count; part += 1) for (const kind of PART_STEPS) steps.push({ kind, phase: "parts", part });
  steps.push(
    { kind: "review", phase: "review" },
    { kind: "purchase", phase: "purchasing" },
    { kind: "production-order", phase: "production" },
    { kind: "run-production", phase: "production" },
    { kind: "inspect", phase: "inspection" },
    { kind: "dispatch", phase: "dispatch" },
    { kind: "invoice", phase: "finance" },
    { kind: "done", phase: "done" },
  );
  return steps;
}

/** Number of parts the visitor's project has (or will have). */
export function guidePartCount(state: ErpState) {
  if (state.guide.projectId) {
    const lines = state.lineItems.filter((line) => line.projectId === state.guide.projectId).length;
    if (lines) return lines;
  }
  return state.draft?.lines.length || 1;
}

export function guideSteps(state: ErpState) {
  return buildSteps(guidePartCount(state));
}

/** Working steps shown to the visitor (welcome and finish excluded). */
export function workStepCount(steps: GuideStep[]) {
  return steps.length - 2;
}

export function phaseIndex(steps: GuideStep[], step: number) {
  const phase = steps[Math.min(step, steps.length - 1)].phase;
  return PHASES.findIndex((item) => item.key === phase);
}

export function firstStepOfPhase(steps: GuideStep[], phase: PhaseKey) {
  return steps.findIndex((step) => step.phase === phase);
}

/** Index of a step kind (for a part, when given) in the current step list. */
export function stepIndex(steps: GuideStep[], kind: StepKind, part = 0) {
  const index = steps.findIndex((step) => step.kind === kind && (step.part === undefined || step.part === part));
  return index < 0 ? 0 : index;
}
