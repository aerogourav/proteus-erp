import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { DEMO_COMPANY } from "@/lib/demo-data";
import { siteConfig } from "@/lib/site-config";

export function SiteFooter() {
  return <footer className="site-footer"><div className="page-container footer-main">
    <Link className="brand footer-brand" href="/"><span className="brand-mark"><span className="footer-mark-outline" /><i /></span><span className="brand-word">PROTEUS</span></Link>
    <p>Business software shaped around your work.</p>
    <div className="footer-links"><Link href="/product">Product</Link><Link href="/#solutions">Solutions</Link><Link href="/#vision">Vision</Link><Link href="/about">About</Link><Link href="/contact">Contact</Link>{siteConfig.contactEmail && <a href={`mailto:${siteConfig.contactEmail}`}>Email PROTEUS</a>}<Link href="/privacy">Data & privacy</Link></div>
    <a className="back-top" href="#top">BACK TO TOP <ArrowUpRight size={13} /></a>
  </div><div className="page-container footer-legal"><span>© 2026 PROTEUS</span><span>Configurable business software</span><span>{DEMO_COMPANY.label}; all records are synthetic</span></div></footer>;
}
