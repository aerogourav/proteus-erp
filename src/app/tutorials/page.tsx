import { ArrowRight, Clock3 } from "lucide-react";
import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Tutorials", "Short video tutorials for the BOH ERP demo: the dashboard, creating a project, releasing a job, shop-floor logging, inspection, dispatch and invoicing.", "/tutorials");

// Files live in /public/video/tutorials as <slug>.mp4, <slug>-poster.jpg and <slug>.en.vtt.
const tutorials = [
  { slug: "dashboard-tour", length: "1:09", title: "Find your way around the dashboard", body: "A tour of the Overview: search, alerts, the project lifecycle, key figures, charts and the department cards." },
  { slug: "new-project", length: "1:05", title: "Create a new manufacturing project", body: "Enter the customer, purchase order, part, drawing, quality check, quantity and material once, then create the project." },
  { slug: "approve-and-order", length: "0:37", title: "Approve the drawing and order material", body: "Approve the drawing in Documents, order the material by email from Purchasing and mark the order confirmed. In the demo the email is recorded, not sent." },
  { slug: "release-production-order", length: "0:40", title: "Release a production order", body: "Create a production order and see Release stay blocked until the material is in stock. Receive the material, then release the job." },
  { slug: "shop-floor-logging", length: "0:31", title: "Log work on the shop floor", body: "Choose the operator, start and end an operation, book good parts and scrap, and find the entry in the operation log." },
  { slug: "final-inspection", length: "0:35", title: "Record the final inspection", body: "Enter a measured value, see an out-of-tolerance reading flagged straight away, then save a passing result." },
  { slug: "dispatch-and-invoice", length: "0:32", title: "Dispatch and invoice", body: "Dispatch the order, open the dispatch note, create the invoice from the same records and mark it paid." },
  { slug: "download-invoice", length: "0:25", title: "Download an invoice as a PDF", body: "Open Finance, find the invoice and use Print / save as PDF. The invoice in the opening seconds is an illustration, not the demo's document." },
] as const;

export default function TutorialsPage() {
  return <div className="b-site">
    <SiteHeader />
    <main id="top">
      <section className="b-section b-tutorials-head" aria-labelledby="tutorials-title">
        <div className="b-wrap">
          <span className="b-kicker">Tutorials</span>
          <h1 className="b-h2" id="tutorials-title">Learn BOH ERP in short videos.</h1>
          <p className="b-lead">Eight tutorials that follow one job from customer order to paid invoice. Each one takes about a minute or less.</p>
          <p className="b-fineprint">Recorded in the manufacturing demo with a fictional company and synthetic data · English voiceover · subtitles available in the player</p>
        </div>
      </section>

      <section className="b-section" style={{ paddingTop: 0 }} aria-label="Video tutorials">
        <div className="b-wrap">
          <ol className="b-tutorials">
            {tutorials.map((item, index) => <li key={item.slug} className="b-tutorial" id={item.slug}>
              {/* Hosted with the site (no third-party player or cookies); nothing downloads until someone presses play. */}
              <video controls playsInline preload="none" poster={`/video/tutorials/${item.slug}-poster.jpg`} aria-label={`${item.title}, tutorial video, ${item.length}, with English voiceover`}>
                <source src={`/video/tutorials/${item.slug}.mp4`} type="video/mp4" />
                <track kind="captions" src={`/video/tutorials/${item.slug}.en.vtt`} srcLang="en" label="English" />
              </video>
              <div className="b-tutorial-copy">
                <span className="b-tutorial-meta"><b>{String(index + 1).padStart(2, "0")}</b><Clock3 size={14} aria-hidden="true" />{item.length}</span>
                <h2>{item.title}</h2>
                <p>{item.body}</p>
              </div>
            </li>)}
          </ol>
        </div>
      </section>

      <section className="b-section b-dark" aria-labelledby="tutorials-cta-title">
        <div className="b-wrap b-cta">
          <div className="b-cta-copy">
            <div><h2 className="b-h2" id="tutorials-cta-title" style={{ marginBottom: 8 }}>Try it yourself.</h2><p className="b-lead">Everything in these videos runs in the demo, in your browser, with nothing to install.</p></div>
          </div>
          <div className="b-hero-actions" style={{ marginTop: 0 }}>
            <Link className="b-btn b-btn-primary" href="/demo/start?industry=manufacturing">Open the manufacturing demo <ArrowRight size={18} /></Link>
            <Link className="b-btn b-btn-ghost" href="/contact?offer=walkthrough">Get a walkthrough</Link>
          </div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
