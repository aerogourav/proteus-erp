import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata("Page not found", "This PROTEUS page could not be found.", "/404", { indexable: false });

export default function NotFound() {
  return <><SiteHeader /><main className="marketing-page not-found-page"><div className="page-container"><span className="section-index">404 · PAGE NOT FOUND</span><h1>That page isn’t <em>here.</em></h1><p>Use the links below to continue exploring PROTEUS.</p><div><Link className="button button-primary" href="/">Return home <ArrowRight size={16} /></Link><Link className="inline-link" href="/demo">Explore the demo <ArrowRight size={14} /></Link></div></div></main><SiteFooter /></>;
}
