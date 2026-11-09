"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowLeft, Boxes, Check, ChevronDown, ChevronsUpDown, Plus, Factory, FileText, FolderKanban, LayoutDashboard, Menu, PackageCheck, PanelLeftClose, PanelLeftOpen, Receipt, RotateCcw, Settings2, ShieldCheck, ShoppingCart, Sparkles, Truck, Users, X, Layers, Building2, Inbox, FileCheck2, Gauge, BriefcaseBusiness, Bell, Package, Repeat, LifeBuoy, Send, CircleHelp } from "lucide-react";
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
import { IndustryPicker } from "@/components/erp/industry-switch";
import { commit, resetDemo, useErp, useHydrated } from "@/components/erp/store";
import { startAnotherProject } from "@/components/erp/guided";
import { DEFAULT_TABS, DEFAULT_UI, type Industry, type TabKey } from "@/lib/erp/model";
import { PACKS, industryOf, tabsFor } from "@/lib/erp/packs";
import { PHASES, firstStepOfPhase, guideSteps, phaseIndex, workStepCount } from "@/components/erp/guide-steps";

const TAB_META: Record<TabKey, { href: string; icon: typeof Boxes }> = {
  overview: { href: "/demo/overview", icon: LayoutDashboard }, guided: { href: "/demo", icon: Sparkles }, projects: { href: "/demo/projects", icon: FolderKanban },
  inbox: { href: "/demo/inbox", icon: Inbox }, quotations: { href: "/demo/quotations", icon: FileCheck2 }, shopFloor: { href: "/demo/shop-floor", icon: Gauge }, people: { href: "/demo/people", icon: BriefcaseBusiness },
  crm: { href: "/demo/crm", icon: Users }, sales: { href: "/demo/sales", icon: ShoppingCart }, parts: { href: "/demo/parts", icon: Boxes },
  documents: { href: "/demo/documents", icon: FileText }, rawMaterials: { href: "/demo/raw-materials", icon: Layers }, purchasing: { href: "/demo/materials", icon: PackageCheck },
  suppliers: { href: "/demo/suppliers", icon: Building2 }, production: { href: "/demo/production", icon: Factory }, quality: { href: "/demo/quality", icon: ShieldCheck },
  dispatch: { href: "/demo/dispatch", icon: Truck }, finance: { href: "/demo/finance", icon: Receipt }, configuration: { href: "/demo/configuration", icon: Settings2 },
  products: { href: "/demo/products", icon: Package }, fulfilment: { href: "/demo/fulfilment", icon: Send },
  subscriptions: { href: "/demo/subscriptions", icon: Repeat }, support: { href: "/demo/support", icon: LifeBuoy },
};

/** Sidebar groups. Inside a group, tabs keep the order and labels set in Configuration. */
const NAV_GROUPS: { key: string; label: string; tabs: TabKey[] }[] = [
  { key: "workspace", label: "Workspace", tabs: ["overview", "guided", "inbox"] },
  { key: "sales", label: "Sales & customers", tabs: ["crm", "quotations", "sales", "fulfilment", "subscriptions", "support"] },
  { key: "operations", label: "Operations", tabs: ["projects", "parts", "documents", "products", "production", "shopFloor", "quality", "dispatch"] },
  { key: "supply", label: "Supply chain", tabs: ["rawMaterials", "purchasing", "suppliers"] },
  { key: "finance", label: "Finance & people", tabs: ["finance", "people"] },
  { key: "admin", label: "Administration", tabs: ["configuration"] },
];

/** The main record of each industry: the top bar's "New" action. */
const NEW_RECORD: Record<Industry, { label: string; href: string | null }> = {
  manufacturing: { label: "New project", href: null },
  commerce: { label: "New order", href: "/demo/fulfilment?new=1" },
  saas: { label: "New subscription", href: "/demo/subscriptions?new=1" },
};

/** Per-viewer layout preferences (sidebar collapsed, groups closed), kept in browser storage when it is available. */
const PREFS_KEY = "boh-erp-shell";
type ShellPrefs = { collapsed: boolean; closed: string[] };
const DEFAULT_PREFS: ShellPrefs = { collapsed: false, closed: [] };
let prefsCache: ShellPrefs | null = null;
const prefsListeners = new Set<() => void>();
function readPrefs(): ShellPrefs {
  if (prefsCache) return prefsCache;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    const parsed = raw ? JSON.parse(raw) as Partial<ShellPrefs> : {};
    prefsCache = { collapsed: parsed.collapsed === true, closed: Array.isArray(parsed.closed) ? parsed.closed.filter((item): item is string => typeof item === "string") : [] };
  } catch { prefsCache = DEFAULT_PREFS; }
  return prefsCache;
}
function writePrefs(patch: Partial<ShellPrefs>) {
  prefsCache = { ...readPrefs(), ...patch };
  try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefsCache)); } catch { /* storage blocked: the layout still works, it just isn't remembered */ }
  prefsListeners.forEach((listener) => listener());
}
function subscribePrefs(listener: () => void) {
  prefsListeners.add(listener);
  return () => { prefsListeners.delete(listener); };
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("") || "?";
}

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
  const [userOpen, setUserOpen] = useState(false);
  const [pickIndustry, setPickIndustry] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const prefs = useSyncExternalStore(subscribePrefs, readPrefs, () => DEFAULT_PREFS);
  const userRef = useRef<HTMLDivElement>(null);
  const steps = guideSteps(state);
  const WORK_STEPS = workStepCount(steps);
  const step = hydrated ? Math.min(state.guide.step, steps.length - 1) : 0;
  const furthest = Math.max(step, state.guide.furthest ?? 0);
  const onGuide = pathname === "/demo";
  const density = hydrated ? state.settings.ui.density : DEFAULT_UI.density;
  const industry: Industry = hydrated ? industryOf(state) : "manufacturing";
  const tabs = hydrated ? tabsFor(state) : DEFAULT_TABS.filter((tab) => PACKS.manufacturing.tabs.includes(tab.key));
  const visible = tabs.filter((tab) => tab.visible);
  const current = phaseIndex(steps, step);

  const updatePrefs = writePrefs;
  const toggleGroup = (key: string) => updatePrefs({ closed: prefs.closed.includes(key) ? prefs.closed.filter((item) => item !== key) : [...prefs.closed, key] });

  // User menu: close on outside click or Escape.
  useEffect(() => {
    if (!userOpen) return;
    const onDown = (event: MouseEvent) => { if (!userRef.current?.contains(event.target as Node)) setUserOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setUserOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [userOpen]);

  const goTo = (target: number) => {
    commit((value) => ({ ...value, guide: { ...value.guide, step: target } }));
    setMenuOpen(false);
  };
  const doReset = (mode: "demo" | "empty") => { if (mode === "empty") void clearStoredFiles(); resetDemo(mode); setConfirmReset(false); setMenuOpen(false); router.push(mode === "demo" || industry !== "manufacturing" ? "/demo/overview" : "/demo"); };
  const unread = hydrated ? unreadCount(state) : 0;
  const alertCount = hydrated ? alerts(state, new Date().toISOString().slice(0, 10)).filter((item) => item.tone !== "info").length : 0;
  const gmailLive = hydrated && state.mail.provider === "gmail";
  const me = hydrated && state.currentUserId ? state.employees.find((item) => item.id === state.currentUserId) ?? null : null;
  const company = hydrated ? state.settings.companyName : PACKS.manufacturing.company;
  const newProject = () => { setMenuOpen(false); setUserOpen(false); if (state.projects.length > 0) startAnotherProject(); router.push("/demo"); };
  const newRecord = () => { const target = NEW_RECORD[industry].href; if (target) { setMenuOpen(false); router.push(target); } else newProject(); };

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
          <span>{isDone ? <Check size={10} /> : index + 1}</span>{phase.label}
        </button>
      </li>;
    })}
  </ol>;

  const navLink = (key: TabKey, label: string) => {
    const { href, icon: Icon } = TAB_META[key];
    return <div key={key} className="erp-nav-item">
      <Link href={href} aria-current={isActive(pathname, href) ? "page" : undefined} title={prefs.collapsed ? label : undefined} onClick={() => setMenuOpen(false)}>
        <Icon size={16} aria-hidden="true" /><span>{label}</span>
        {href === "/demo" && hydrated && step > 0 && <em>{step > WORK_STEPS ? "Done" : `${step}/${WORK_STEPS}`}</em>}
        {key === "inbox" && unread > 0 && <em className="erp-nav-count" aria-label={`${unread} unread`}>{unread}</em>}
        {key === "shopFloor" && hydrated && state.activeOps.length > 0 && <em className="erp-nav-live" aria-label={`${state.activeOps.length} running`}>{state.activeOps.length} live</em>}
      </Link>
      {href === "/demo" && onGuide && phases}
    </div>;
  };

  const grouped = NAV_GROUPS.map((group) => ({ ...group, items: visible.filter((tab) => group.tabs.includes(tab.key)) })).filter((group) => group.items.length > 0);
  const ungrouped = visible.filter((tab) => !NAV_GROUPS.some((group) => group.tabs.includes(tab.key)));
  if (ungrouped.length && grouped.length) grouped[grouped.length - 1] = { ...grouped[grouped.length - 1], items: [...grouped[grouped.length - 1].items, ...ungrouped] };

  return <div className="erp" data-no-translate data-density={density} data-collapsed={prefs.collapsed ? "true" : undefined}>
    <div className="erp-shell">
      <aside className={`erp-side${menuOpen ? " is-open" : ""}`} aria-label="Navigation">
        <div className="erp-side-head">
          <Link className="erp-brand" href="/demo/overview" onClick={() => setMenuOpen(false)}><BohMark size={22} /><span><b>BOH</b> ERP</span><small>DEMO</small></Link>
          <button type="button" className="erp-collapse" aria-label={prefs.collapsed ? "Expand sidebar" : "Collapse sidebar"} title={prefs.collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => updatePrefs({ collapsed: !prefs.collapsed })}>
            {prefs.collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
        <button type="button" className="erp-workspace" onClick={() => setPickIndustry(true)} title={prefs.collapsed ? `${company} · switch industry` : undefined} aria-label={`Workspace: ${company}. Switch industry`}>
          <span className={`erp-workspace-mark is-${industry}`} aria-hidden="true">{initials(company.replace(/\(demo\)/i, ""))}</span>
          <span><b>{company}</b><small>{PACKS[industry].label}</small></span>
          <ChevronsUpDown size={14} aria-hidden="true" />
        </button>
        <nav className="erp-nav" aria-label="Modules">
          {grouped.map((group) => {
            const open = prefs.collapsed || !prefs.closed.includes(group.key);
            return <div key={group.key} className="erp-nav-group">
              <button type="button" className="erp-nav-group-toggle" aria-expanded={open} onClick={() => toggleGroup(group.key)}>{group.label}<ChevronDown size={13} aria-hidden="true" /></button>
              {open && group.items.map((tab) => navLink(tab.key, tab.label))}
            </div>;
          })}
        </nav>
        <div className="erp-side-foot">
          <Link href="/" title={prefs.collapsed ? "Back to website" : undefined}><ArrowLeft size={15} aria-hidden="true" /><span>Back to website</span></Link>
          <p className="erp-side-note">Fictional data, stored only in this browser. Please don’t enter confidential information.</p>
        </div>
      </aside>
      {menuOpen && <div className="erp-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <div className="erp-main">
        <header className="erp-topbar">
          <button type="button" className="erp-iconbtn erp-topbar-menu" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={18} /> : <Menu size={18} />}</button>
          <Link className="erp-brand" href="/demo/overview" aria-label="BOH ERP overview"><BohMark size={22} /><span><b>BOH</b> ERP</span></Link>
          <GlobalSearch />
          {hydrated && onGuide && step > 0 && <span className="erp-progress">{step > WORK_STEPS ? "Finished" : `Step ${step} of ${WORK_STEPS}`}</span>}
          <div className="erp-topbar-actions">
            <button type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={newRecord} aria-label={NEW_RECORD[industry].label}><Plus size={14} aria-hidden="true" /><span className="erp-hide-sm">{NEW_RECORD[industry].label}</span></button>
            <span className="erp-topbar-sep" aria-hidden="true" />
            <Link className="erp-bell" href="/demo/overview" aria-label={`${alertCount} alerts`} title="Alerts"><Bell size={17} />{alertCount > 0 && <em>{alertCount}</em>}</Link>
            <Link className="erp-bell" href="/demo/inbox" aria-label={`${unread} unread emails`} title="Inbox"><Inbox size={17} />{unread > 0 && <em>{unread}</em>}</Link>
            <Link className="erp-iconbtn erp-help" href="/demo" aria-label="Help: guided demo" title="Help: guided demo"><CircleHelp size={17} /></Link>
            <span className="erp-topbar-sep" aria-hidden="true" />
            <div className="erp-usermenu" ref={userRef}>
              <button type="button" aria-haspopup="menu" aria-expanded={userOpen} aria-label="Account menu" onClick={() => setUserOpen((open) => !open)}>
                <span className={`erp-avatar${me ? " is-online" : ""}`} aria-hidden="true">{me ? initials(me.name) : <Users size={14} />}</span>
                <b>{me ? me.name : "Guest"}</b><ChevronDown size={14} aria-hidden="true" />
              </button>
              {userOpen && <div className="erp-menu" role="menu" aria-label="Account">
                <div className="erp-menu-head"><b>{me ? `${me.name} · ${me.code}` : "Guest (not signed in)"}</b><small>{company}</small></div>
                {hydrated && state.employees.length > 0 && <label className="erp-user"><span>Signed in as</span>
                  <select value={state.currentUserId ?? ""} onChange={(event) => commit((value) => setCurrentUser(value, event.target.value || null))} aria-label="Signed in as">
                    <option value="">Nobody (anonymous)</option>{state.employees.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}
                  </select></label>}
                {hydrated && industry === "manufacturing" && state.projects.length > 0 && <button type="button" role="menuitem" onClick={newProject}><Plus size={15} /> New project</button>}
                <Link href="/demo/configuration" role="menuitem" onClick={() => setUserOpen(false)}><Settings2 size={15} /> Configuration</Link>
                <button type="button" role="menuitem" onClick={() => { setUserOpen(false); setPickIndustry(true); }}><ChevronsUpDown size={15} /> Switch industry</button>
                <hr />
                <button type="button" role="menuitem" className="is-danger" onClick={() => { setUserOpen(false); setConfirmReset(true); }}><RotateCcw size={15} /> Reset demo data</button>
                <Link href="/" role="menuitem"><ArrowLeft size={15} /> Back to website</Link>
              </div>}
            </div>
          </div>
        </header>
        <main className="erp-content">{children}</main>
      </div>
    </div>
    {pickIndustry && <IndustryPicker onClose={() => setPickIndustry(false)} />}
    {confirmReset && <Modal label="Reset demo" onClose={() => setConfirmReset(false)}>
      <h2>Reset the demo?</h2>
      <p style={{ marginTop: 8 }}>Both options replace everything in this browser: your projects, emails, logs and settings. To keep your work, export a backup in Configuration first.</p>
      <div className="erp-head-actions" style={{ marginTop: 20, justifyContent: "flex-end" }}>
        <button type="button" className="erp-btn erp-btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
        <button type="button" className="erp-btn" onClick={() => doReset("empty")}>Start empty</button>
        <button type="button" className="erp-btn erp-btn-danger" onClick={() => doReset("demo")}><RotateCcw size={15} /> Restore the {PACKS[industry].label.toLowerCase()} demo</button>
      </div>
    </Modal>}
    <Toasts />
  </div>;
}
