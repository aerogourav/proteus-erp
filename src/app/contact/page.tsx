import Link from "next/link";
import { Suspense } from "react";
import { Clock3, MessageSquareText, ShieldCheck } from "lucide-react";
import { BohMark } from "@/components/brand/boh-logo";
import { ContactForm, ContactFormFromLink } from "@/components/marketing/contact-form";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { siteConfig } from "@/lib/site-config";
import { supabaseConfigured } from "@/lib/supabase/config";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Contact", "Ask for a workflow call, a demo walkthrough or a 2-week pilot run of BOH ERP.", "/contact");

export default function ContactPage() {
  // Inquiries are saved as leads in Supabase and/or emailed through Resend (see /api/contact).
  const apiReady = supabaseConfigured() || Boolean(process.env.RESEND_API_KEY && process.env.CONTACT_TO_EMAIL);
  const mode = apiReady ? "api" : siteConfig.contactEmail ? "mailto" : null;

  return <div className="b-site"><SiteHeader /><main id="top" className="b-page"><div className="b-wrap b-page-grid">
    <div>
      <BohMark size={56} smile />
      <span className="b-kicker" style={{ display: "block", marginTop: 20 }}>Contact</span>
      <h1>Tell us which workflow slows you down.</h1>
      <p className="b-lead">Choose a workflow call, a demo walkthrough or a 2-week pilot run. We’ll reply by email to arrange it. If BOH ERP isn’t a good fit, we’ll tell you.</p>
      <ul className="b-contact-points">
        <li><MessageSquareText size={20} /><span>Every offer is free and without obligation. Any paid next step is agreed in writing before work starts.</span></li>
        <li><Clock3 size={20} /><span>No preparation needed for the call. Bring a spreadsheet or an example if you have one.</span></li>
        <li><ShieldCheck size={20} /><span>Please don’t send confidential drawings or customer data through this form.</span></li>
      </ul>
      <p className="b-form-note" style={{ marginTop: 24 }}><Link href="/#offers">Compare the three offers</Link></p>
      {siteConfig.contactEmail && <p className="b-form-note">Prefer email? <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a></p>}
    </div>
    <div>
      {mode ? <Suspense fallback={<ContactForm mode={mode} contactEmail={siteConfig.contactEmail} />}><ContactFormFromLink mode={mode} contactEmail={siteConfig.contactEmail} /></Suspense> : <div className="b-form" role="status">
        <h2 style={{ margin: 0, fontFamily: "var(--b-display)" }}>The contact form is being set up.</h2>
        <p className="b-form-note">Message delivery is not connected yet, so this page does not collect any details. In the meantime you can explore the guided demo.</p>
        <div><Link className="b-btn b-btn-dark" href="/demo/start">Open the demo</Link></div>
      </div>}
    </div>
  </div></main><SiteFooter /></div>;
}
