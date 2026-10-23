import { ArrowRight, BrainCircuit, FileStack, GitBranch, Link2, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { ProductPreview } from "@/components/marketing/product-preview";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Product", "Explore the configurable records, document requirement rules, workflow definitions, and synthetic manufacturing scenario in the PROTEUS demonstration.", "/product");

const capabilities = [
  { icon: FileStack, title: "Records and custom fields", body: "Add document types and fields to the browser-local demonstration. Required fields are checked when sample records are created." },
  { icon: GitBranch, title: "Workflow definitions", body: "Set the order of approval stages and name the responsible roles. The demo displays these definitions; it does not assign or execute real approvals." },
  { icon: SlidersHorizontal, title: "Rules and completeness", body: "Configure supported document requirements. The sample orders and parts are evaluated against linked synthetic records and configured statuses." },
  { icon: Link2, title: "Connected records", body: "Follow the links between parts, revisions, engineering records, and production-order examples to understand the surrounding context." },
];

export default function ProductPage() {
  return <><SiteHeader /><main id="top" className="marketing-page">
    <section className="marketing-page-hero"><div className="page-container"><span className="section-index">THE PROTEUS PRODUCT</span><h1>Your business. Your workflows. <em>Your ERP.</em></h1><p>PROTEUS is an early configurable ERP concept. The current demonstration explores document types, custom fields, supported document requirement rules, and descriptive workflow stages through a fictional precision-manufacturing workspace.</p><a className="button button-primary" href="/demo">Explore the Demo <ArrowRight size={16} /></a></div></section>
    <section className="page-container marketing-page-preview"><ProductPreview /></section>
    <section className="page-container marketing-product-grid" aria-label="Product capabilities">{capabilities.map(({ icon: Icon, title, body }) => <article className="marketing-product-card" key={title}><Icon size={20} /><h2>{title}</h2><p>{body}</p></article>)}</section>
    <section className="page-container product-boundaries"><article><BrainCircuit size={20} /><span>AI ASSISTANCE · PLANNED</span><h2>Concepts, not a connected AI service.</h2><p>Potential future uses include document classification suggestions, metadata extraction, and missing-information prompts. No model is called and no records are sent to an AI provider.</p></article><article><ShieldCheck size={20} /><span>SECURITY · DEMO LIMITS</span><h2>Suitable for exploring synthetic data only.</h2><p>The demo has no authentication, server-side authorization, shared database, or production security review. Browser-local persistence is not encrypted storage and is not intended for confidential information.</p></article></section>
    <section className="product-final-cta"><div className="page-container"><div><span className="section-index section-index-light">START WITH A SAMPLE</span><h2>Explore the manufacturing scenario.</h2><p>Fictional records only · Browser-local edits · No connected production service</p></div><a className="button button-primary" href="/demo">Open the synthetic workspace <ArrowRight size={16} /></a></div></section>
  </main><SiteFooter /></>;
}
