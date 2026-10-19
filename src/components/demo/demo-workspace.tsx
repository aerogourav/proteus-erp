"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, AlertTriangle, Boxes, Building2, ChevronDown, ClipboardList, FileStack, GitBranch, Hexagon, LayoutDashboard, Menu, Package, Search, Settings2, Truck, WalletCards, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import styles from "./demo.module.css";
import { DEMO_COMPANY } from "@/lib/demo-data";

const nav = [
  { label: "Overview", href: "/demo", icon: LayoutDashboard },
  { label: "Documents", href: "/demo/documents", icon: FileStack },
  { label: "Parts & Revisions", href: "/demo/parts", icon: Boxes },
  { label: "Production Orders", href: "/demo/production", icon: ClipboardList },
  { label: "CRM", href: "/demo/crm", icon: Building2 },
  { label: "Suppliers", href: "/demo/suppliers", icon: Truck },
  { label: "Raw Materials", href: "/demo/materials", icon: Package },
  { label: "Finance", href: "/demo/finance", icon: WalletCards },
  { label: "Workflows", href: "/demo/workflows", icon: GitBranch },
  { label: "Configuration", href: "/demo/configuration", icon: Settings2 },
  { label: "Activity", href: "/demo/activity", icon: Activity },
];

export function DemoWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const active = nav.find((item) => item.href === "/demo" ? pathname === "/demo" : pathname.startsWith(item.href)) ?? nav[0];
  const onNav = () => setMenuOpen(false);

  return <div className={styles.app}>
    <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`} aria-label="Workspace sidebar">
      <Link href="/" className={styles.brand} aria-label="PROTEUS home"><span className={styles.brandMark}><Hexagon size={18} /></span><strong>PROTEUS</strong></Link>
      <div className={styles.company} title={DEMO_COMPANY.name}><span className={styles.companyMark}>AP</span><span className={styles.companyText}><strong>{DEMO_COMPANY.name}</strong><small>{DEMO_COMPANY.label}</small></span><ChevronDown size={14} aria-hidden="true" /></div>
      <span className={styles.sideLabel}>Workspace</span>
      <nav className={styles.nav} aria-label="Demo navigation">
        {nav.map(({ label, href, icon: Icon }) => <Link key={href} href={href} onClick={onNav} aria-current={active.href === href ? "page" : undefined} className={`${styles.navLink} ${active.href === href ? styles.navLinkActive : ""}`}><Icon size={16} strokeWidth={1.8} /><span>{label}</span></Link>)}
      </nav>
      <div className={styles.sidebarBottom}><Link href="/" className={styles.navLink}><Hexagon size={16} /><span>Back to PROTEUS site</span></Link><div className={styles.demoNote}><AlertTriangle size={14} /><span>Synthetic records for demonstration only. No files or customer data are connected.</span></div></div>
    </aside>
    <div className={styles.main}>
      <header className={styles.topbar}>
        <button type="button" className={styles.mobileToggle} aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={17} /> : <Menu size={17} />}</button>
        <Link className={styles.mobileBrand} href="/demo">PROTEUS</Link>
        <div className={styles.crumbs}><Link href="/demo">Workspace</Link><span>/</span><strong>{active.label}</strong></div>
        <div className={styles.topActions}><label className={styles.searchTop}><Search size={14} /><input aria-label="Search the demo workspace" placeholder="Search records" onKeyDown={(event) => { if (event.key === "Enter" && event.currentTarget.value.trim()) router.push(`/demo/documents?q=${encodeURIComponent(event.currentTarget.value.trim())}`); }} /></label><span className={styles.demoBadge}><i /> DEMO ENVIRONMENT</span></div>
      </header>
      <main className={styles.content}>{children}</main>
    </div>
  </div>;
}
