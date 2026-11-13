import Link from "next/link";
import { BohLogo } from "@/components/brand/boh-logo";

export function SiteFooter() {
  return <footer className="b-footer">
    <div className="b-wrap">
      <div className="b-footer-top">
        <div>
          <Link href="/" aria-label="BOH ERP home"><BohLogo tone="dark" /></Link>
          <span className="b-footer-tagline" data-no-translate>BUILD. OPERATE. HARMONISE.</span>
        </div>
        <nav className="b-footer-links" aria-label="Footer navigation">
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/demo/start">Demo</Link>
          <Link href="/tutorials">Tutorials</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/impressum">Impressum</Link>
        </nav>
      </div>
      <div className="b-footer-bottom">
        <span>© 2026 BOH ERP</span>
        <span>The demo uses a fictional company and synthetic records.</span>
      </div>
    </div>
  </footer>;
}
