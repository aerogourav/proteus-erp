"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, AlertTriangle, ArrowLeft, Boxes, ChevronDown, ClipboardList, FileStack, LayoutDashboard, Menu, Route, Search, Settings2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import styles from "./demo.module.css";
import { DEMO_COMPANY } from "@/lib/demo-data";
import { LanguageSwitcher } from "@/components/language-provider";
import { BohMark } from "@/components/brand/boh-logo";

const nav = [
  { label: "Overview", href: "/demo/classic", icon: LayoutDashboard },
  { label: "Order Journey", href: "/demo/classic/journey", icon: Route },
  { label: "Production Orders", href: "/demo/classic/production", icon: ClipboardList },
  { label: "Parts & Revisions", href: "/demo/classic/parts", icon: Boxes },
  { label: "Documents", href: "/demo/classic/documents", icon: FileStack },
  { label: "Configuration", href: "/demo/classic/configuration", icon: Settings2 },
  { label: "Activity", href: "/demo/classic/activity", icon: Activity },
];

/** Modules kept in the codebase but hidden from the focused demo navigation. */
const hiddenModules = [
  { label: "CRM", href: "/demo/classic/crm" },
  { label: "Suppliers", href: "/demo/classic/suppliers" },
  { label: "Raw Materials", href: "/demo/classic/materials" },
  { label: "Finance", href: "/demo/classic/finance" },
  { label: "Workflows", href: "/demo/classic/workflows" },
  { label: "Community", href: "/demo/classic/community" },
];

export function DemoWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const hidden = hiddenModules.find((item) => pathname.startsWith(item.href));
  const active = nav.find((item) => item.href === "/demo/classic" ? pathname === "/demo/classic" : pathname.startsWith(item.href)) ?? { ...nav[0], label: hidden?.label ?? nav[0].label, href: hidden?.href ?? nav[0].href };
  const onNav = () => setMenuOpen(false);

  return <div className={styles.app}>
    <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`} aria-label="Workspace sidebar">
      <Link href="/" className={`${styles.brand} ${styles.brandBoh}`} aria-label="BOH ERP home"><BohMark size={30} tone="dark" /><strong data-no-translate><b>BOH</b> ERP</strong></Link>
      <div className={styles.company} title={DEMO_COMPANY.name}><span className={styles.companyMark}>AP</span><span className={styles.companyText}><strong>{DEMO_COMPANY.name}</strong><small>{DEMO_COMPANY.label}</small></span><ChevronDown size={14} aria-hidden="true" /></div>
      <span className={styles.sideLabel}>Workspace</span>
      <nav className={styles.nav} aria-label="Demo navigation">
        {nav.map(({ label, href, icon: Icon }) => <Link key={href} href={href} onClick={onNav} aria-current={active.href === href ? "page" : undefined} className={`${styles.navLink} ${active.href === href ? styles.navLinkActive : ""}`}><Icon size={16} strokeWidth={1.8} /><span>{label}</span></Link>)}
      </nav>
      <div className={styles.sidebarBottom}><Link href="/" className={styles.navLink}><ArrowLeft size={16} /><span>Back to BOH ERP site</span></Link><div className={styles.demoNote}><AlertTriangle size={14} /><span>Synthetic records for demonstration only. No files or customer data are connected.</span></div></div>
    </aside>
    <div className={styles.main}>
      <header className={styles.topbar}>
        <button type="button" className={styles.mobileToggle} aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={17} /> : <Menu size={17} />}</button>
        <Link className={styles.mobileBrand} href="/demo/classic">BOH ERP</Link>
        <div className={styles.crumbs}><Link href="/demo/classic">Workspace</Link><span>/</span><strong>{active.label}</strong></div>
        <div className={styles.topActions}><label className={styles.searchTop}><Search size={14} /><input aria-label="Search the demo workspace" placeholder="Search records" onKeyDown={(event) => { if (event.key === "Enter" && event.currentTarget.value.trim()) router.push(`/demo/classic/documents?q=${encodeURIComponent(event.currentTarget.value.trim())}`); }} /></label><LanguageSwitcher className="demo-language" /><span className={styles.demoBadge}><i /> DEMO ENVIRONMENT</span></div>
      </header>
      <main className={styles.content}>{children}</main>
    </div>
  </div>;
}
