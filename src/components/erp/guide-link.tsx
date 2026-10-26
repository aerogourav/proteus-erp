"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { commit } from "@/components/erp/store";
import { STEPS, type StepId } from "@/components/erp/guide-steps";
import type { ErpState, ResolveAction } from "@/lib/erp/model";

/** Opens the guided demo, optionally at a specific step. All editing happens there. */
export function useOpenGuide() {
  const router = useRouter();
  return (to?: StepId) => {
    commit((state) => {
      if (!to) return state;
      const step = STEPS.findIndex((item) => item.id === to);
      if (step < 0) return state;
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
    case "approve-document": return "approve";
    case "add-drawing": return "drawing";
    case "add-material": return "material";
    case "advance-procurement": return state.procurement.find((item) => item.id === action.procurementId)?.status === "Ordered" ? "receive-material" : "order-material";
    case "add-inspection": return "inspection";
    case "create-production-order": return "release";
    case "advance-production": return state.productionOrders.find((item) => item.id === action.productionOrderId)?.status === "In progress" ? "complete" : "start";
    case "generate-inspection-report": return "inspect";
    case "dispatch": return "dispatch";
    case "generate-invoice": return "invoice";
  }
}
