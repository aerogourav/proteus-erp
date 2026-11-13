import { ArrowRight, Clock3 } from "lucide-react";
import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Tutorials", "Short video tutorials for the BOH ERP demo: the dashboard, creating a project, releasing a job, shop-floor logging, inspection, dispatch and invoicing.", "/tutorials");

type Tutorial = { slug: string; length: string; title: string; body: string; stage?: string };

// Files live in /public/video/tutorials as <slug>.mp4, <slug>-poster.jpg and <slug>.en.vtt.
const start: Tutorial = { slug: "dashboard-tour", length: "1:09", title: "Find your way around the dashboard", body: "A tour of the Overview: search, alerts, the project lifecycle, key figures, charts and the department cards." };

// One job, in the order it moves through the shop.
const journey: Tutorial[] = [
  { slug: "new-project", stage: "Order", length: "1:05", title: "Create a new manufacturing project", body: "Enter the customer, purchase order, part, drawing, quality check, quantity and material once, then create the project." },
  { slug: "approve-and-order", stage: "Prepare", length: "0:37", title: "Approve the drawing and order material", body: "Approve the drawing in Documents, order the material by email from Purchasing and mark the order confirmed. In the demo the email is recorded, not sent." },
  { slug: "release-production-order", stage: "Release", length: "0:40", title: "Release a production order", body: "Create a production order and see Release stay blocked until the material is in stock. Receive the material, then release the job." },
  { slug: "shop-floor-logging", stage: "Make", length: "0:31", title: "Log work on the shop floor", body: "Choose the operator, start and end an operation, book good parts and scrap, and find the entry in the operation log." },
  { slug: "final-inspection", stage: "Check", length: "0:35", title: "Record the final inspection", body: "Enter a measured value, see an out-of-tolerance reading flagged straight away, then save a passing result." },
  { slug: "dispatch-and-invoice", stage: "Ship", length: "0:32", title: "Dispatch and invoice", body: "Dispatch the order, open the dispatch note, create the invoice from the same records and mark it paid." },
];

const everyday: Tutorial[] = [
  { slug: "download-invoice", length: "0:25", title: "Download an invoice as a PDF", body: "Open Finance, find the invoice and use Print / save as PDF. The invoice in the opening seconds is an illustration, not the demo's document." },
];

// Hosted with the site (no third-party player or cookies); nothing downloads until someone presses play.
function Player({ item }: { item: Tutorial }) {
  return <video controls playsInline preload="none" poster={`/video/tutorials/${item.slug}-poster.jpg`} aria-label={`${item.title}, tutorial video, ${item.length}, with English voiceover`}>
    <source src={`/video/tutorials/${item.slug}.mp4`} type="video/mp4" />
    <track kind="captions" src={`/video/tutorials/${item.slug}.en.vtt`} srcLang="en" label="English" />
  </video>;
}

function Length({ value }: { value: string }) {
  return <span className="b-tutorial-meta"><Clock3 size={14} aria-hidden="true" />{value}</span>;
}

export default function TutorialsPage() {
  return <div className="b-site">
    <SiteHeader />
    <main id="top">
      <section className="b-section b-tutorials-head" aria-labelledby="tutorials-title">
        <div className="b-wrap">
          <span className="b-kicker">Tutorials</span>
          <h1 className="b-h2" id="tutorials-title">Learn BOH ERP in short videos.</h1>
          <p className="b-lead">Start with the tour, then follow one job from customer order to paid invoice. Each video takes about a minute or less.</p>
          <nav className="b-tut-jump" aria-label="Jump to a tutorial">
            <a href={`#${start.slug}`}>Start here</a>
            {journey.map((item) => <a key={item.slug} href={`#${item.slug}`}>{item.stage}</a>)}
            <a href="#everyday">Everyday tasks</a>
          </nav>
          <p className="b-fineprint">Recorded in the manufacturing demo with a fictional company and synthetic data · English voiceover · subtitles available in the player</p>
        </div>
      </section>

      <section className="b-section" style={{ paddingTop: 0 }} aria-label="Start here">
        <div className="b-wrap">
          <article className="b-tut-feature" id={start.slug}>
            <Player item={start} />
            <div>
              <span className="b-tut-sticker">Start here</span>
              <h2>{start.title}</h2>
              <p>{start.body}</p>
              <Length value={start.length} />
            </div>
          </article>
        </div>
      </section>

      <section className="b-section" style={{ paddingTop: 0 }} aria-labelledby="journey-title">
        <div className="b-wrap">
          <span className="b-kicker">Follow one job</span>
          <h2 className="b-h2" id="journey-title">From order to invoice, in six stops.</h2>
          <p className="b-lead">The same project runs through every video, so each one picks up where the last one ended.</p>
          <ol className="b-route">
            {journey.map((item) => <li key={item.slug} className="b-route-stop" id={item.slug}>
              <article className="b-tutorial">
                <Player item={item} />
                <div className="b-tutorial-copy">
                  <span className="b-route-meta"><span className="b-tut-sticker">{item.stage}</span><Length value={item.length} /></span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </article>
            </li>)}
          </ol>
        </div>
      </section>

      <section className="b-section" style={{ paddingTop: 0 }} id="everyday" aria-labelledby="everyday-title">
        <div className="b-wrap">
          <span className="b-kicker">Everyday tasks</span>
          <h2 className="b-h2" id="everyday-title">Quick answers.</h2>
          <div className="b-tutorials">
            {everyday.map((item) => <article key={item.slug} className="b-tutorial" id={item.slug}>
              <Player item={item} />
              <div className="b-tutorial-copy">
                <Length value={item.length} />
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </article>)}
            <div className="b-tut-request">
              <h3>Missing a task?</h3>
              <p>Tell us what you would like to see and we will record it next.</p>
              <Link className="b-btn b-btn-dark" href="/contact">Request a tutorial <ArrowRight size={17} /></Link>
            </div>
          </div>
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
