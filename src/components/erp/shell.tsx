"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft, Boxes, Factory, FileText, FolderKanban, LayoutDashboard, Menu, PackageCheck, Receipt, RotateCcw, Settings2, ShieldCheck,
  ShoppingCart, Sparkles, Truck, Users, X,
} from "lucide-react";
import { BohMark } from "@/components/brand/boh-logo";
import { Modal } from "@/components/erp/ui";
import { resetDemo, useErp, useHydrated } from "@/components/erp/store";
import type { ActivityEvent, ModuleKey } from "@/lib/erp/model";

const groups = [
  { label: "Workspace", items: [{ label: "Overview", href: "/demo", icon: LayoutDashboard }, { label: "Projects", href: "/demo/projects", icon: FolderKanban }] },
  { label: "Commercial", items: [{ label: "CRM", href: "/demo/crm", icon: Users }, { label: "Sales orders", href: "/demo/sales", icon: ShoppingCart }] },
  { label: "Engineering", items: [{ label: "Parts", href: "/demo/parts", icon: Boxes }, { label: "Documents", href: "/demo/documents", icon: FileText }] },
  { label: "Operations", items: [{ label: "Materials", href: "/demo/materials", icon: PackageCheck }, { label: "Production", href: "/demo/production", icon: Factory }, { label: "Quality", href: "/demo/quality", icon: ShieldCheck }, { label: "Dispatch", href: "/demo/dispatch", icon: Truck }] },
  { label: "Finance", items: [{ label: "Invoices", href: "/demo/finance", icon: Receipt }, { label: "Configuration", href: "/demo/configuration", icon: Settings2 }] },
];

const explain: Partial<Record<ModuleKey, string>> = {
  documents: "It is linked to the project and its part revision.",
  quality: "Inspection requirements now feed the inspection report.",
  production: "The production order references the project, part and revision.",
  procurement: "Material readiness updates automatically.",
  materials: "Material readiness updates automatically.",
  dispatch: "The dispatch note reuses the order and its line items.",
  finance: "The invoice reuses the purchase order and line items.",
  sales: "The invoice will use this price.",
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
  const [baseline, setBaseline] = useState<string | null | undefined>(undefined);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const latest: ActivityEvent | undefined = state.activity[0];

  useEffect(() => {
    if (!hydrated) return;
    // Events created while in the wizard are summarised on its own success screen.
    if (baseline === undefined || pathname === "/demo/new") setBaseline(latest?.id ?? null);
  }, [hydrated, baseline, latest, pathname]);

  const routeProject = pathname.startsWith("/demo/projects/") ? state.projects.find((project) => project.id === pathname.split("/")[3]) : undefined;
  const current = routeProject ?? [...state.projects].reverse().find((project) => !project.isSample) ?? state.projects.find((project) => project.isSample);
  const showHint = Boolean(latest && baseline !== undefined && latest.id !== baseline && latest.id !== dismissed && pathname !== "/demo/new");

  const doReset = () => {
    resetDemo();
    setConfirmReset(false);
    setBaseline(null);
    router.push("/demo");
  };

  return <div className="erp" data-no-translate>
    <div className="erp-shell">
      <aside className={`erp-side${menuOpen ? " is-open" : ""}`} aria-label="Demo navigation">
        <Link className="erp-brand" href="/demo" onClick={() => setMenuOpen(false)}><BohMark size={28} tone="dark" /><span><b>BOH</b> ERP</span><small>DEMO</small></Link>
        {hydrated && current && <Link className="erp-current" href={`/demo/projects/${current.id}`} onClick={() => setMenuOpen(false)}>
          <small>Current project</small><strong>{current.name}</strong><span>{current.code}</span>
        </Link>}
        <nav className="erp-nav">
          {groups.map((group) => <div className="erp-nav-group" key={group.label}>
            <span>{group.label}</span>
            {group.items.map(({ label, href, icon: Icon }) => <Link key={href} href={href} aria-current={isActive(pathname, href) ? "page" : undefined} onClick={() => setMenuOpen(false)}><Icon size={17} />{label}</Link>)}
          </div>)}
        </nav>
        <div className="erp-side-foot">
          <Link href="/demo/new" onClick={() => setMenuOpen(false)}><Sparkles size={15} /> Create a project</Link>
          <button type="button" onClick={() => setConfirmReset(true)}><RotateCcw size={15} /> Reset demo</button>
          <Link href="/"><ArrowLeft size={15} /> Back to website</Link>
          <p className="erp-side-note">Fictional data, stored only in this browser. Please don’t enter confidential information.</p>
        </div>
      </aside>
      {menuOpen && <div className="erp-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <div className="erp-main">
        <div className="erp-topbar">
          <button type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={18} /> : <Menu size={18} />}</button>
          <Link className="erp-brand" href="/demo"><BohMark size={24} tone="dark" /><span><b>BOH</b> ERP</span></Link>
        </div>
        <main className="erp-content">
          {showHint && latest && <div className="erp-hint" role="status"><Sparkles size={16} /><span>{latest.text}. {explain[latest.module] ?? "Every module reads this from the same project data."}</span><button type="button" aria-label="Dismiss" onClick={() => setDismissed(latest.id)}><X size={15} /></button></div>}
          {children}
        </main>
      </div>
    </div>
    {confirmReset && <Modal label="Reset demo" onClose={() => setConfirmReset(false)}>
      <h2>Reset the demo?</h2>
      <p>This removes all projects, sample data and your draft from this browser. You can load the sample project again at any time.</p>
      <div className="erp-head-actions" style={{ marginTop: 20, justifyContent: "flex-end" }}>
        <button type="button" className="erp-btn erp-btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
        <button type="button" className="erp-btn erp-btn-danger" onClick={doReset}><RotateCcw size={15} /> Reset demo</button>
      </div>
    </Modal>}
  </div>;
}
