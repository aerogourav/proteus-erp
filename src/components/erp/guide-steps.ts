/** The guided demo: one project, many small steps, every department. */

export type PhaseKey = "start" | "sales" | "engineering" | "quality-plan" | "purchasing" | "production" | "inspection" | "dispatch" | "finance" | "done";

export const PHASES: { key: PhaseKey; label: string }[] = [
  { key: "start", label: "Start" },
  { key: "sales", label: "Sales" },
  { key: "engineering", label: "Engineering" },
  { key: "quality-plan", label: "Quality plan" },
  { key: "purchasing", label: "Purchasing" },
  { key: "production", label: "Production" },
  { key: "inspection", label: "Final inspection" },
  { key: "dispatch", label: "Dispatch" },
  { key: "finance", label: "Invoice" },
  { key: "done", label: "Finished" },
];

export type StepId =
  | "welcome" | "customer" | "project" | "order" | "part" | "quantity"
  | "drawing" | "approve" | "inspection" | "material" | "order-material" | "receive-material"
  | "release" | "start" | "complete" | "inspect" | "dispatch" | "invoice" | "done";

export const STEPS: { id: StepId; phase: PhaseKey }[] = [
  { id: "welcome", phase: "start" },
  { id: "customer", phase: "sales" },
  { id: "project", phase: "sales" },
  { id: "order", phase: "sales" },
  { id: "part", phase: "sales" },
  { id: "quantity", phase: "sales" },
  { id: "drawing", phase: "engineering" },
  { id: "approve", phase: "engineering" },
  { id: "inspection", phase: "quality-plan" },
  { id: "material", phase: "purchasing" },
  { id: "order-material", phase: "purchasing" },
  { id: "receive-material", phase: "purchasing" },
  { id: "release", phase: "production" },
  { id: "start", phase: "production" },
  { id: "complete", phase: "production" },
  { id: "inspect", phase: "inspection" },
  { id: "dispatch", phase: "dispatch" },
  { id: "invoice", phase: "finance" },
  { id: "done", phase: "done" },
];

/** Number of working steps shown to the visitor (welcome and finish excluded). */
export const WORK_STEPS = STEPS.length - 2;

export function phaseIndex(step: number) {
  const phase = STEPS[Math.min(step, STEPS.length - 1)].phase;
  return PHASES.findIndex((item) => item.key === phase);
}

export function firstStepOfPhase(phase: PhaseKey) {
  return STEPS.findIndex((step) => step.phase === phase);
}
