import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { ContactForm } from "@/components/marketing/contact-form";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { siteConfig } from "@/lib/site-config";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Contact PROTEUS", "Discuss the operational workflows PROTEUS aims to support and assess whether the early-stage product direction may fit your business.", "/contact", { indexable: false });

export default function ContactPage() {
  return <><SiteHeader /><main id="top" className="marketing-page"><section className="marketing-page-hero"><div className="page-container contact-page-content">
    <span className="section-index">EARLY-STAGE PRODUCT CONVERSATION</span><MessageCircle size={24} /><h1>Start with <em>your workflow.</em></h1>
    <p>Tell us what your business needs to organize. An initial conversation can help clarify the requirements and assess whether the PROTEUS direction may be a fit. The product is early-stage; no production-ready ERP or availability commitment is implied.</p>
    {siteConfig.contactEmail ? <ContactForm contactEmail={siteConfig.contactEmail} /> : <div className="contact-unavailable" role="status"><h2>Inquiry delivery is not configured yet.</h2><p>A verified contact address or submission service has not been provided. This page will not collect your details or pretend a message was sent. When a contact address is verified, the form can open a draft in your email app for you to review and send.</p><p>For now, you can explore the synthetic product demonstration. Please do not enter confidential information there.</p><Link className="button button-primary" href="/demo">Explore the Demo <ArrowRight size={16} /></Link></div>}
  </div></section></main><SiteFooter /></>;
}
