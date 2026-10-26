"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ArrowLeft, Boxes, Check, Factory, FileText, FolderKanban, LayoutDashboard, Menu, PackageCheck, Receipt, RotateCcw, Settings2, ShieldCheck,
  ShoppingCart, Sparkles, Truck, Users, X,
} from "lucide-react";
import { BohMark } from "@/components/brand/boh-logo";
import { Modal } from "@/components/erp/ui";
import { commit, resetDemo, useErp, useHydrated } from "@/components/erp/store";
import { PHASES, firstStepOfPhase, guideSteps, phaseIndex, workStepCount } from "@/components/erp/guide-steps";

const groups = [
  { label: "Workspace", items: [{ label: "Overview", href: "/demo/overview", icon: LayoutDashboard }, { label: "Guided demo", href: "/demo", icon: Sparkles }, { label: "Projects", href: "/demo/projects", icon: FolderKanban }] },
  { label: "Commercial", items: [{ label: "CRM", href: "/demo/crm", icon: Users }, { label: "Sales orders", href: "/demo/sales", icon: ShoppingCart }] },
  { label: "Engineering", items: [{ label: "Parts", href: "/demo/parts", icon: Boxes }, { label: "Documents", href: "/demo/documents", icon: FileText }] },
  { label: "Operations", items: [{ label: "Purchasing", href: "/demo/materials", icon: PackageCheck }, { label: "Production", href: "/demo/production", icon: Factory }, { label: "Quality", href: "/demo/quality", icon: ShieldCheck }, { label: "Dispatch", href: "/demo/dispatch", icon: Truck }] },
  { label: "Finance", items: [{ label: "Invoices", href: "/demo/finance", icon: Receipt }, { label: "Configuration", href: "/demo/configuration", icon: Settings2 }] },
];

function isActive(pathname: string, href: string) {
  if (href === "/demo") return pathname === "/demo";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ErpShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const state = useErp();
  const hydrated = useHydrated();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const steps = guideSteps(state);
  const WORK_STEPS = workStepCount(steps);
  const step = hydrated ? Math.min(state.guide.step, steps.length - 1) : 0;
  const furthest = Math.max(step, state.guide.furthest ?? 0);
  const onGuide = pathname === "/demo";
  const current = phaseIndex(steps, step);

  const goTo = (target: number) => {
    commit((value) => ({ ...value, guide: { ...value.guide, step: target } }));
    setMenuOpen(false);
  };
  const doReset = () => { resetDemo(); setConfirmReset(false); setMenuOpen(false); router.push("/demo"); };

  const phases = <ol className="erp-phases" aria-label="Guided demo steps">
    {PHASES.map((phase, index) => {
      const first = firstStepOfPhase(steps, phase.key);
      const nextFirst = index < PHASES.length - 1 ? firstStepOfPhase(steps, PHASES[index + 1].key) : Infinity;
      const reached = hydrated && first <= furthest;
      const isCurrent = index === current;
      const isDone = hydrated && !isCurrent && nextFirst <= furthest;
      return <li key={phase.key}>
        <button type="button" className={isCurrent ? "is-current" : isDone ? "is-done" : ""} disabled={!reached} aria-current={isCurrent ? "step" : undefined} onClick={() => goTo(first)}>
          <span>{isDone ? <Check size={11} /> : index + 1}</span>{phase.label}
        </button>
      </li>;
    })}
  </ol>;

  return <div className="erp" data-no-translate>
    <div className="erp-shell">
      <aside className={`erp-side${menuOpen ? " is-open" : ""}`} aria-label="Demo navigation">
        <Link className="erp-brand" href="/demo/overview" onClick={() => setMenuOpen(false)}><BohMark size={28} /><span><b>BOH</b> ERP</span><small>DEMO</small></Link>
        <nav className="erp-nav">
          {groups.map((group) => <div className="erp-nav-group" key={group.label}>
            <span>{group.label}</span>
            {group.items.map(({ label, href, icon: Icon }) => <div key={href}>
              <Link href={href} aria-current={isActive(pathname, href) ? "page" : undefined} onClick={() => setMenuOpen(false)}>
                <Icon size={17} />{label}
                {href === "/demo" && hydrated && step > 0 && <em>{step > WORK_STEPS ? "Done" : `${step}/${WORK_STEPS}`}</em>}
              </Link>
              {href === "/demo" && onGuide && phases}
            </div>)}
          </div>)}
        </nav>
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
          <Link className="erp-brand" href="/demo/overview"><BohMark size={24} /><span><b>BOH</b> ERP</span></Link>
          {hydrated && onGuide && step > 0 && <span className="erp-progress">{step > WORK_STEPS ? "Finished" : `Step ${step} of ${WORK_STEPS}`}</span>}
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
