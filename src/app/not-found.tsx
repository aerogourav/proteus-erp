import type { Metadata } from "next";
import Link from "next/link";
import { BohMark } from "@/components/brand/boh-logo";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata("Page not found", "This BOH ERP page could not be found.", "/404", { indexable: false });

export default function NotFound() {
  return <div className="b-site"><SiteHeader /><main className="b-page"><div className="b-wrap b-prose">
    <BohMark size={72} />
    <span className="b-kicker" style={{ display: "block", marginTop: 20 }}>404</span>
    <h1>This page doesn’t exist.</h1>
    <div className="b-hero-actions"><Link className="b-btn b-btn-dark" href="/">Back to home</Link><Link className="b-btn b-btn-ghost" href="/demo">Open the demo</Link></div>
  </div></main><SiteFooter /></div>;
}
