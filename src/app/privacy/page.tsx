import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { legal } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Privacy", "How the BOH ERP website and demo handle data.", "/privacy", { indexable: false });

export default function PrivacyPage() {
  return <div className="b-site"><SiteHeader /><main id="top" className="b-page"><div className="b-wrap b-prose">
    <span className="b-kicker">Privacy notice</span>
    <h1>How this website handles data.</h1>
    <p>This notice describes the current BOH ERP website and its demo. It will be reviewed before the production product launches.</p>

    <h2>Who is responsible</h2>
    <p>The provider named in the <Link href="/impressum">Impressum</Link>. Contact: <span data-no-translate>{legal.email || "see Impressum"}</span>.</p>

    <h2>Hosting</h2>
    <p>The website is hosted on Vercel. When you visit a page, the hosting provider processes technical data such as your IP address and browser information to deliver the page and keep it secure. We do not use analytics or advertising cookies.</p>

    <h2>Contact form</h2>
    <p>If you send a message, we receive your name, email, company, optional role and your message, and use them only to reply and discuss your inquiry. Messages are delivered by email through the service Resend. If the form opens your own email app instead, the message is sent by your email provider. We delete inquiries that do not lead to a business relationship when they are no longer needed.</p>

    <h2>The demo</h2>
    <p>The demo shows a fictional company with synthetic records. Anything you change or create in the demo is stored only in your own browser:</p>
    <ul>
      <li>Configuration changes, created parts, documents, opportunities, community posts and activity entries are kept in your browser’s local storage.</li>
      <li>Files you attach to demo finance entries are kept in your browser’s IndexedDB storage.</li>
      <li>Your language choice is remembered in local storage.</li>
    </ul>
    <p>This data is not sent to us or shared with other users. You can remove it with “Reset demo” on the Configuration page or by clearing your browser’s site data. The demo has no accounts and is not encrypted storage, so please don’t enter confidential information.</p>

    <h2>Your rights</h2>
    <p>You can ask us for access to, correction or deletion of personal data we hold about you, and you can complain to a data protection supervisory authority.</p>
  </div></main><SiteFooter /></div>;
}
