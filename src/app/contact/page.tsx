import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { ContactForm } from "@/components/marketing/contact-form";
import { siteConfig } from "@/lib/site-config";
export const metadata: Metadata = { title: "Contact | PROTEUS", description: "Contact and pilot information for the PROTEUS product concept." };
export default function ContactPage() { return <><SiteHeader /><main id="top" className="marketing-page"><section className="marketing-page-hero"><div className="page-container contact-page-content"><span className="section-index">CONTACT & PILOT INTEREST</span><MessageCircle size={24} /><h1>Let’s talk about <em>how your work fits.</em></h1><p>Share what you are looking for in this form preview. It is not connected to a message-delivery service.</p>{siteConfig.contactEmail && <p>Project contact: <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a></p>}<ContactForm /></div></section></main><SiteFooter /></>; }
