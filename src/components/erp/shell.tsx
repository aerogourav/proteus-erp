"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Boxes, Check, Plus, Factory, FileText, FolderKanban, LayoutDashboard, Menu, PackageCheck, Receipt, RotateCcw, Settings2, ShieldCheck, ShoppingCart, Sparkles, Truck, Users, X, Layers, Building2, Inbox, FileCheck2, Gauge, BriefcaseBusiness, Bell } from "lucide-react";
import { GlobalSearch } from "@/components/erp/search";
import { Toasts, toast } from "@/components/erp/toast";
import { hasToken } from "@/components/erp/gmail";
import { syncGmail } from "@/components/erp/mailer";
import { clearStoredFiles } from "@/components/erp/file-store";
import { unreadCount } from "@/lib/erp/mail";
import { alerts } from "@/lib/erp/alerts";
import { setCurrentUser } from "@/lib/erp/shopfloor";
import { BohMark } from "@/components/brand/boh-logo";
import { Modal } from "@/components/erp/ui";
import { commit, resetDemo, useErp, useHydrated } from "@/components/erp/store";
import { startAnotherProject } from "@/components/erp/guided";
import { DEFAULT_TABS, DEFAULT_UI, type TabKey } from "@/lib/erp/model";
import { PHASES, firstStepOfPhase, guideSteps, phaseIndex, workStepCount } from "@/components/erp/guide-steps";

const TAB_META: Record<TabKey, { href: string; icon: typeof Boxes }> = {
  overview: { href: "/demo/overview", icon: LayoutDashboard }, guided: { href: "/demo", icon: Sparkles }, projects: { href: "/demo/projects", icon: FolderKanban },
  inbox: { href: "/demo/inbox", icon: Inbox }, quotations: { href: "/demo/quotations", icon: FileCheck2 }, shopFloor: { href: "/demo/shop-floor", icon: Gauge }, people: { href: "/demo/people", icon: BriefcaseBusiness },
  crm: { href: "/demo/crm", icon: Users }, sales: { href: "/demo/sales", icon: ShoppingCart }, parts: { href: "/demo/parts", icon: Boxes },
  documents: { href: "/demo/documents", icon: FileText }, rawMaterials: { href: "/demo/raw-materials", icon: Layers }, purchasing: { href: "/demo/materials", icon: PackageCheck },
  suppliers: { href: "/demo/suppliers", icon: Building2 }, production: { href: "/demo/production", icon: Factory }, quality: { href: "/demo/quality", icon: ShieldCheck },
  dispatch: { href: "/demo/dispatch", icon: Truck }, finance: { href: "/demo/finance", icon: Receipt }, configuration: { href: "/demo/configuration", icon: Settings2 },
};

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
  const ui = hydrated ? state.settings.ui : DEFAULT_UI;
  const tabs = hydrated ? state.settings.tabs : DEFAULT_TABS;
  const current = phaseIndex(steps, step);

  const goTo = (target: number) => {
    commit((value) => ({ ...value, guide: { ...value.guide, step: target } }));
    setMenuOpen(false);
  };
  const doReset = (mode: "demo" | "empty") => { if (mode === "empty") void clearStoredFiles(); resetDemo(mode); setConfirmReset(false); setMenuOpen(false); router.push(mode === "demo" ? "/demo/overview" : "/demo"); };
  const unread = hydrated ? unreadCount(state) : 0;
  const alertCount = hydrated ? alerts(state, new Date().toISOString().slice(0, 10)).filter((item) => item.tone !== "info").length : 0;
  const gmailLive = hydrated && state.mail.provider === "gmail";

  // Gmail: check for new mail every minute while the ERP is open and signed in.
  useEffect(() => {
    if (!gmailLive) return;
    const tick = async () => {
      if (!hasToken()) return;
      const result = await syncGmail();
      if (result.added) toast(`${result.added} new email${result.added === 1 ? "" : "s"} in the inbox.`, { href: "/demo/inbox", action: "Open", tone: "info" });
    };
    const id = window.setInterval(tick, 60000);
    return () => window.clearInterval(id);
  }, [gmailLive]);

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

  return <div className="erp" data-no-translate data-accent={ui.accent} data-density={ui.density} data-corners={ui.corners} data-sidebar={ui.sidebar} data-nav={ui.nav} data-font={ui.font}>
    <div className="erp-shell">
      <aside className={`erp-side${menuOpen ? " is-open" : ""}`} aria-label="Demo navigation">
        <Link className="erp-brand" href="/demo/overview" onClick={() => setMenuOpen(false)}><BohMark size={28} /><span><b>BOH</b> ERP</span><small>DEMO</small></Link>
        <nav className="erp-nav" aria-label="Modules">
          {tabs.filter((tab) => tab.visible).map((tab) => {
            const { href, icon: Icon } = TAB_META[tab.key];
            return <div key={tab.key} className="erp-nav-item">
              <Link href={href} aria-current={isActive(pathname, href) ? "page" : undefined} onClick={() => setMenuOpen(false)}>
                <Icon size={17} />{tab.label}
                {href === "/demo" && hydrated && step > 0 && <em>{step > WORK_STEPS ? "Done" : `${step}/${WORK_STEPS}`}</em>}
                {tab.key === "inbox" && unread > 0 && <em className="erp-nav-count" aria-label={`${unread} unread`}>{unread}</em>}
                {tab.key === "shopFloor" && hydrated && state.activeOps.length > 0 && <em className="erp-nav-live" aria-label={`${state.activeOps.length} running`}>{state.activeOps.length} live</em>}
              </Link>
              {href === "/demo" && onGuide && ui.nav !== "top" && phases}
            </div>;
          })}
        </nav>
        <div className="erp-side-foot">
          {hydrated && state.employees.length > 0 && <label className="erp-user"><span>Signed in as</span>
            <select value={state.currentUserId ?? ""} onChange={(event) => commit((value) => setCurrentUser(value, event.target.value || null))} aria-label="Signed in as">
              <option value="">Nobody (anonymous)</option>{state.employees.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}
            </select></label>}
          {hydrated && state.projects.length > 0 && <button type="button" onClick={() => { startAnotherProject(); setMenuOpen(false); router.push("/demo"); }}><Plus size={15} /> New project</button>}
          <button type="button" onClick={() => setConfirmReset(true)}><RotateCcw size={15} /> Reset demo data</button>
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
        <div className="erp-commandbar">
          <GlobalSearch />
          <Link className="erp-bell" href="/demo/overview" aria-label={`${alertCount} alerts`}><Bell size={17} />{alertCount > 0 && <em>{alertCount}</em>}</Link>
          <Link className="erp-bell" href="/demo/inbox" aria-label={`${unread} unread emails`}><Inbox size={17} />{unread > 0 && <em>{unread}</em>}</Link>
        </div>
        <main className="erp-content">{children}</main>
      </div>
    </div>
    {confirmReset && <Modal label="Reset demo" onClose={() => setConfirmReset(false)}>
      <h2>Reset the demo?</h2>
      <p style={{ marginTop: 8 }}>Both options replace everything in this browser: your projects, emails, logs and settings. To keep your work, export a backup in Configuration first.</p>
      <div className="erp-head-actions" style={{ marginTop: 20, justifyContent: "flex-end" }}>
        <button type="button" className="erp-btn erp-btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
        <button type="button" className="erp-btn" onClick={() => doReset("empty")}>Start empty</button>
        <button type="button" className="erp-btn erp-btn-danger" onClick={() => doReset("demo")}><RotateCcw size={15} /> Restore the 2 demo projects</button>
      </div>
    </Modal>}
    <Toasts />
  </div>;
}
