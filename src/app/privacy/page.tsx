import { ArrowRight, Database, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Demo data and privacy boundaries", "Learn what the PROTEUS demonstration stores in this browser and which privacy and security capabilities it does not provide.", "/privacy", { indexable: false });

export default function PrivacyPage() {
  return <><SiteHeader /><main id="top" className="marketing-page"><section className="marketing-page-hero"><div className="page-container privacy-copy"><span className="section-index">DATA HANDLING · DEMONSTRATION</span><h1>Know where the <em>demo data lives.</em></h1><p>The PROTEUS demonstration is a product exploration, not a production service for confidential company records.</p>
    <div className="privacy-facts"><article><Database size={20} /><h2>Browser-local settings</h2><p>Configuration edits, CRM opportunities, and synthetic documents created in the demo are saved in this browser’s local storage. They do not sync to another browser or user. Reset in Configuration to restore sample settings and remove browser-created opportunities and documents.</p></article><article><ShieldCheck size={20} /><h2>What is not provided</h2><p>This application has no accounts, authentication, server-side authorization, shared backend, or production security review. Local storage is not encrypted by the application. Do not enter confidential information.</p></article></div>
    <p className="privacy-note">The manufacturing company, people, records, identifiers, dates, and activity shown in the demonstration are fictional. It includes no customer drawing files, no connected AI provider, no analytics tracking, and no external product integration. If a verified contact email is configured, the inquiry form opens a draft in your email application; the website does not receive or store it. This page describes the current prototype and is not a legal compliance statement.</p>
    <p className="privacy-note">Before public launch, verify the responsible business identity, hosting and data-handling details, inquiry contact, and any legal information required for the intended operating jurisdictions.</p>
    <Link className="button button-primary" href="/demo">Return to the synthetic demo <ArrowRight size={16} /></Link>
  </div></section></main><SiteFooter /></>;
}
