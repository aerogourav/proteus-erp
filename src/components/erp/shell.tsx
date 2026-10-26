"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowLeft, Check, Menu, RotateCcw, X } from "lucide-react";
import { BohMark } from "@/components/brand/boh-logo";
import { Modal } from "@/components/erp/ui";
import { commit, resetDemo, useErp, useHydrated } from "@/components/erp/store";
import { PHASES, STEPS, WORK_STEPS, firstStepOfPhase, phaseIndex } from "@/components/erp/guide-steps";

export function ErpShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const state = useErp();
  const hydrated = useHydrated();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const step = hydrated ? Math.min(state.guide.step, STEPS.length - 1) : 0;
  const onGuide = pathname === "/demo";
  const current = phaseIndex(step);
  const shownStep = Math.min(Math.max(step, 0), WORK_STEPS);

  const goTo = (target: number) => {
    commit((value) => ({ ...value, guide: { ...value.guide, step: target } }));
    setMenuOpen(false);
    if (!onGuide) router.push("/demo");
  };
  const doReset = () => { resetDemo(); setConfirmReset(false); setMenuOpen(false); router.push("/demo"); };

  return <div className="erp" data-no-translate>
    <div className="erp-shell">
      <aside className={`erp-side${menuOpen ? " is-open" : ""}`} aria-label="Demo progress">
        <Link className="erp-brand" href="/demo" onClick={() => setMenuOpen(false)}><BohMark size={28} tone="dark" /><span><b>BOH</b> ERP</span><small>DEMO</small></Link>
        <p className="erp-side-title">Your project’s journey</p>
        <ol className="erp-phases">
          {PHASES.map((phase, index) => {
            const first = firstStepOfPhase(phase.key);
            const reached = hydrated && first <= step;
            const isCurrent = onGuide && index === current;
            const isDone = hydrated && index < current;
            return <li key={phase.key}>
              <button type="button" className={isCurrent ? "is-current" : isDone ? "is-done" : ""} disabled={!reached} aria-current={isCurrent ? "step" : undefined} onClick={() => goTo(first)}>
                <span>{isDone ? <Check size={13} /> : index + 1}</span>{phase.label}
              </button>
            </li>;
          })}
        </ol>
        <div className="erp-side-foot">
          <button type="button" onClick={() => setConfirmReset(true)}><RotateCcw size={15} /> Restart demo</button>
          <Link href="/"><ArrowLeft size={15} /> Back to website</Link>
          <p className="erp-side-note">Fictional data, stored only in this browser. Please don’t enter confidential information.</p>
        </div>
      </aside>
      {menuOpen && <div className="erp-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <div className="erp-main">
        <div className="erp-topbar">
          <button type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={18} /> : <Menu size={18} />}</button>
          <Link className="erp-brand" href="/demo"><BohMark size={24} tone="dark" /><span><b>BOH</b> ERP</span></Link>
          {hydrated && step > 0 && <span className="erp-progress">{step > WORK_STEPS ? "Finished" : `Step ${shownStep} of ${WORK_STEPS}`}</span>}
        </div>
        <main className="erp-content">{children}</main>
      </div>
    </div>
    {confirmReset && <Modal label="Restart demo" onClose={() => setConfirmReset(false)}>
      <h2>Start again?</h2>
      <p>This removes your project from this browser and takes you back to the first step.</p>
      <div className="erp-head-actions" style={{ marginTop: 20, justifyContent: "flex-end" }}>
        <button type="button" className="erp-btn erp-btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
        <button type="button" className="erp-btn erp-btn-danger" onClick={doReset}><RotateCcw size={15} /> Restart demo</button>
      </div>
    </Modal>}
  </div>;
}
