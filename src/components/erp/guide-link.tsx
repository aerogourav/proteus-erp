"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { commit } from "@/components/erp/store";
import { guideSteps, stepIndex, type StepId } from "@/components/erp/guide-steps";
import type { ErpState, ResolveAction } from "@/lib/erp/model";

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
