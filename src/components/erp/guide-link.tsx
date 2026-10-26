"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { commit } from "@/components/erp/store";
import { guideSteps, stepIndex, type StepId } from "@/components/erp/guide-steps";
import { isProductionComplete, projectRecords, type ErpState, type ResolveAction } from "@/lib/erp/model";

/** Opens the guided demo, optionally at a specific step. All editing happens there. */
export function useOpenGuide() {
  const router = useRouter();
  return (to?: StepId) => {
    commit((state) => {
      if (!to) return state;
      const step = stepIndex(guideSteps(state), to);
      return { ...state, guide: { ...state.guide, step, furthest: Math.max(step, state.guide.furthest ?? 0) } };
    });
    router.push("/demo");
  };
}

export function GuideLink({ to, children, primary = false }: { to?: StepId; children: ReactNode; primary?: boolean }) {
  const open = useOpenGuide();
  return <button type="button" className={`erp-btn erp-btn-sm${primary ? " erp-btn-primary" : ""}`} onClick={() => open(to)}>{children} <ArrowRight size={13} /></button>;
}

/** Which guided step performs a readiness fix. */
export function stepForAction(state: ErpState, action: ResolveAction): StepId {
  switch (action.kind) {
    case "approve-document":
    case "advance-procurement":
    case "add-drawing":
    case "add-material":
    case "add-inspection": return "purchase";
    case "create-production-order": return "production-order";
    case "advance-production": return "run-production";
    case "generate-inspection-report": return "inspect";
    case "dispatch": return "dispatch";
    case "generate-invoice": return "invoice";
  }
}

/** Makes a project the current one and resumes the guided demo where it stands. */
export function focusProject(state: ErpState, projectId: string): ErpState {
  const r = projectRecords(state, projectId);
  if (!r.project) return state;
  const kind: StepId = r.invoices.length ? "done" : r.dispatches.length ? "invoice" : r.inspectionReports[0]?.passed ? "dispatch"
    : r.productionOrders.length && r.productionOrders.length >= r.lineItems.length ? (r.productionOrders.every((order) => isProductionComplete(order.status)) ? "inspect" : "run-production")
    : r.productionOrders.length ? "production-order" : "purchase";
  const next = { ...state, draft: null, guide: { ...state.guide, projectId, v: 2 } };
  const step = stepIndex(guideSteps(next), kind);
  return { ...next, guide: { ...next.guide, step, furthest: step } };
}
