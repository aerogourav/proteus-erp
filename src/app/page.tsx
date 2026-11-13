import { ArrowRight, Check, CircleDashed, PlayCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BohMark } from "@/components/brand/boh-logo";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { legal } from "@/lib/legal";
import { OFFERS, PILOT_PLACES } from "@/lib/offers";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("BOH ERP — Job release and shop-floor software for small manufacturers", "BOH ERP connects orders, drawing revisions, material, shop-floor bookings, inspection and dispatch for small manufacturers. Book a workflow call, a demo walkthrough or a 2-week pilot run.", "/");

const problems = [
  ["Work lives in too many places", "Orders, drawings, approvals and status updates are spread across spreadsheets, inboxes and shared folders."],
  ["Off-the-shelf ERP forces your process", "Standard systems expect you to change how you work, and custom software is slow and expensive to build."],
  ["Mistakes show up late", "An outdated drawing or missing material is often found on the shop floor, not before the job starts."],
] as const;

const story = [
  ["Enter the order once", "Customer, purchase order, parts and revisions, drawings, inspection and material in a short guided form."],
  ["Release only when ready", "A job cannot start without an approved drawing for the ordered revision and its material in stock. A revised drawing stops further work. Overrides need an owner or admin and a reason."],
  ["Book work on the shop floor", "Operators book good and scrap per operation, in parts across shifts. Quantities can never exceed what arrived, and the job completes only when every operation is booked."],
  ["Inspect, dispatch, invoice", "Every measurement needs an explicit result; out-of-tolerance values fail. Delivery note and invoice come from the same records, and issued invoices are cancelled with a credit note, never deleted."],
] as const;

const today = [
  "Manufacturing demo with a fictional job shop and months of synthetic data",
  "Customer orders linked to parts, revisions, drawings and material",
  "Release checks that block jobs with unapproved drawings or missing material, with logged owner/admin overrides",
  "Shop-floor booking per operation: partial quantities, several shifts and operators, good and scrap",
  "Inspection with explicit results, sample size and gauge; dispatch and invoices from the same records",
  "E-commerce and SaaS demos on the same core",
  "English and German interface",
];

const planned = [
  "Invite-only cloud workspace for pilot shops (in testing, not yet open)",
  "Screens for roles and permissions in the cloud workspace (an audit history screen is in testing)",
  "Export of invoices to DATEV or a specialist e-invoicing provider",
  "Reusable industry templates",
  "AI that turns a plain-language request into a configuration you review and approve",
];

const faqs = [
  ["Is BOH ERP ready to use today?", "Not yet as a production system. Today there is an interactive demo with synthetic data, and an invite-only workspace that is still being prepared. We are looking for first pilot shops to shape the production version with us."],
  ["Is the pilot a production-ready ERP?", "No. The pilot tests one workflow on one production cell with anonymised or non-confidential data. Keep your current process running alongside it. At the end you get a short written result and decide whether to continue."],
  ["What happens after the 2-week pilot?", "We review the agreed success criteria with you. You can stop at no cost: we close your access and delete the pilot records we have no legal duty to keep, through a documented process. If you want to continue, we agree scope and price in writing first. Nothing renews or is billed automatically."],
  ["Who is it for?", "Small manufacturers and job shops that have outgrown spreadsheets: machining, fabrication and assembly with drawings, revisions and routings. The same core also runs e-commerce and SaaS demos as part of our long-term platform."],
  ["What does it cost after the pilot?", "A one-time implementation fee plus a monthly subscription. Both depend on the scope of your workflows and are agreed in writing before any paid work starts."],
  ["Does it use AI?", "Not yet. The current checks are clear, rule-based logic. AI-assisted configuration is on our roadmap, and any change it proposes will always need human approval."],
] as const;

const pilot = [
  ["Scope", "One workflow, usually job release and shop-floor booking, on one production cell. Bills of material, capacity planning and accounting are not part of the pilot."],
  ["Data rules", "Anonymised or non-confidential job data only. No confidential drawings or customer personal data until data processing terms are signed and the hosted workspace has passed its security checks."],
  ["Success criteria", "Agreed with you at the start. For example: every job released in the cell has its approved drawing revision and material confirmed, and every operation is booked with good and scrap quantities."],
  ["After 2 weeks", "We review the results together and send a short written summary. You decide: stop at no cost, and we close your access and delete the pilot records we have no legal duty to keep; or continue with a paid implementation agreed in writing beforehand."],
] as const;


export default function Home() {
  return <div className="b-site">
    <SiteHeader />
    <main id="top">
      <section className="b-hero b-dark" aria-labelledby="hero-title">
        <div className="b-wrap b-hero-grid">
          <div>
            <span className="b-kicker">Configurable ERP for small manufacturers</span>
            <h1 id="hero-title"><span>Your business.</span><span>Your workflows.</span><span className="b-accent-line">Your ERP.</span></h1>
            <p className="b-lead">BOH ERP links customer orders, drawing revisions, material, shop-floor bookings, inspection and dispatch, and stops a job from starting on an unapproved drawing or without its material.</p>
            <div className="b-hero-actions">
              <Link className="b-btn b-btn-primary" href="/contact?offer=call">Book a workflow call <ArrowRight size={18} /></Link>
              <Link className="b-btn b-btn-ghost" href="/contact?offer=walkthrough"><PlayCircle size={18} /> Demo walkthrough</Link>
            </div>
            <p className="b-hero-pilot"><Link href="/contact?offer=pilot">Join the pilot waitlist for a 2-week pilot run <ArrowRight size={15} /></Link></p>
            <p className="b-hero-proof">Founded by Gourav Mehta (M.Sc. Space Systems, Hochschule Bremen) and advised by Kajinder Srivastava (aerospace and defence). <Link href="/#who-we-are">Who we are</Link></p>
            <span className="b-tagline" data-no-translate>BUILD. OPERATE. HARMONISE.</span>
          </div>
          <figure className="b-shot b-shot-hero">
            <Image src="/screens/production-order.png" width={1280} height={800} priority sizes="(max-width: 900px) 100vw, 560px" alt="Screenshot of the BOH ERP demo: a production order with its release checks, routing and shop-floor bookings" />
            <figcaption>From the demo · fictional company and data</figcaption>
          </figure>
        </div>
      </section>

      <section className="b-section" id="film" aria-labelledby="film-title">
        <div className="b-wrap b-film-wrap">
          <span className="b-kicker">BOH ERP in two minutes</span>
          <h2 className="b-h2" id="film-title">From scattered spreadsheets to one connected workflow.</h2>
          {/* Hosted with the site (no third-party player or cookies); nothing downloads until someone presses play. */}
          <video className="b-film" controls playsInline preload="none" poster="/video/boh-erp-film-poster.jpg" aria-label="BOH ERP product film, 1 minute 51 seconds, with English voiceover">
            <source src="/video/boh-erp-film.mp4" type="video/mp4" />
            <track kind="captions" src="/video/boh-erp-film.en.vtt" srcLang="en" label="English" />
          </video>
          <p className="b-fineprint">English voiceover · subtitles available in the player</p>
          <Link className="b-tut-teaser" href="/tutorials">
            <span className="b-tut-thumbs" aria-hidden="true">
              <Image src="/video/tutorials/new-project-poster.jpg" width={256} height={144} alt="" />
              <Image src="/video/tutorials/release-production-order-poster.jpg" width={256} height={144} alt="" />
              <Image src="/video/tutorials/dashboard-tour-poster.jpg" width={256} height={144} alt="" />
            </span>
            <span className="b-tut-teaser-copy"><strong>8 short video tutorials</strong><span>One job from order to invoice, about a minute each.</span></span>
            <span className="b-tut-teaser-go"><PlayCircle size={20} aria-hidden="true" /> Watch the tutorials</span>
          </Link>
        </div>
      </section>

      <section className="b-section" aria-labelledby="problem-title">
        <div className="b-wrap">
          <span className="b-kicker">The problem</span>
          <h2 className="b-h2" id="problem-title">Growing job shops outgrow spreadsheets before they are ready for a big ERP.</h2>
          <div className="b-problems">{problems.map(([title, body]) => <article className="b-problem b-reveal" key={title}><h3>{title}</h3><p>{body}</p></article>)}</div>
        </div>
      </section>

      <section className="b-section" aria-labelledby="demo-title">
        <div className="b-wrap b-demo">
          <div>
            <span className="b-kicker">See it working</span>
            <h2 className="b-h2" id="demo-title">One job. One source of truth.</h2>
            <p className="b-lead">Follow a job from customer order to invoice in the manufacturing demo. Everything runs in your browser with a fictional company.</p>
            <ol className="b-story" style={{ marginTop: 28 }}>{story.map(([title, body], index) => <li key={title} className="b-reveal"><span className="b-story-num">{index + 1}</span><div><strong>{title}</strong><span>{body}</span></div></li>)}</ol>
            <div className="b-hero-actions"><Link className="b-btn b-btn-dark" href="/demo/start?industry=manufacturing">Open the manufacturing demo <ArrowRight size={18} /></Link><Link className="b-btn b-btn-ghost" href="/contact?offer=walkthrough">Or get a walkthrough</Link></div>
            <p className="b-hero-pilot"><Link href="/tutorials">Watch the short video tutorials <ArrowRight size={16} /></Link></p>
          </div>
          <figure className="b-shot b-reveal">
            <Image src="/screens/shop-floor.png" width={1280} height={800} sizes="(max-width: 900px) 100vw, 560px" alt="Screenshot of the BOH ERP demo shop floor: running operations, operators and booked quantities" />
            <figcaption>Shop floor in the demo · fictional data</figcaption>
          </figure>
        </div>
      </section>

      <section className="b-section b-offers-section" id="offers" aria-labelledby="offers-title">
        <div className="b-wrap">
          <span className="b-kicker">Get started</span>
          <h2 className="b-h2" id="offers-title">Three ways to find out if BOH ERP fits.</h2>
          <p className="b-lead">Start small. All three cost nothing and commit you to nothing. Any paid next step is agreed in writing before work starts.</p>
          <div className="b-offers">{OFFERS.map((offer) => <article key={offer.key} className={`b-offer b-reveal${offer.key === "pilot" ? " is-pilot" : ""}`}>
            <h3>{offer.title}</h3>
            <dl>
              <div><dt>Length</dt><dd>{offer.length}</dd></div>
              <div><dt>Who attends</dt><dd>{offer.attendees}</dd></div>
              <div><dt>What you get</dt><dd>{offer.youGet}</dd></div>
              <div><dt>What we need</dt><dd>{offer.weNeed}</dd></div>
            </dl>
            <p className="b-offer-free">No cost · no obligation</p>
            <Link className={`b-btn ${offer.key === "pilot" ? "b-btn-primary" : "b-btn-dark"}`} href={`/contact?offer=${offer.key}`}>{offer.key === "call" ? "Book a workflow call" : offer.key === "walkthrough" ? "Ask for a walkthrough" : "Join the pilot waitlist"} <ArrowRight size={17} /></Link>
          </article>)}</div>

          <details className="b-pilot">
            <summary>The 2-week pilot run in detail</summary>
            <div className="b-pilot-head">
              <p>{PILOT_PLACES} places at a time. Pilots start once our pilot readiness checks pass; until then you join the waitlist. The pilot uses early-stage software and is not a production-ready ERP: keep your current process running alongside it.</p>
            </div>
            <dl className="b-pilot-grid">{pilot.map(([title, body]) => <div key={title}><dt>{title}</dt><dd>{body}</dd></div>)}</dl>
          </details>
        </div>
      </section>

      <section className="b-section" style={{ paddingTop: 0 }} aria-labelledby="status-title">
        <div className="b-wrap">
          <span className="b-kicker">Honest status</span>
          <h2 className="b-h2" id="status-title">What exists today, and what comes next.</h2>
          <p className="b-lead">BOH ERP is early-stage. The demo runs in your browser with synthetic data. Please don’t enter confidential information.</p>
          <div className="b-status">
            <div className="b-status-col"><h3><Check size={20} /> Available in the demo</h3><ul>{today.map((item) => <li key={item}><Check size={17} /><span>{item}</span></li>)}</ul></div>
            <div className="b-status-col planned"><h3><CircleDashed size={20} /> Planned</h3><ul>{planned.map((item) => <li key={item}><CircleDashed size={17} /><span>{item}</span></li>)}</ul></div>
          </div>
        </div>
      </section>

      <section className="b-section" style={{ paddingTop: 0 }} id="who-we-are" aria-labelledby="who-title">
        <div className="b-wrap b-who">
          <div>
            <span className="b-kicker">Who we are</span>
            <h2 className="b-h2" id="who-title">A small, early-stage team building BOH ERP.</h2>
            <p className="b-lead">We are starting with job release and shop-floor work for small manufacturers, and we are looking for our first pilot shops. We will tell you plainly what works today and what doesn’t yet.</p>
            <p className="b-lead">BOH ERP is founded by Gourav Mehta and advised by Kajinder Srivastava. The legal company details are still being set up and are shown here once confirmed.</p>
          </div>
          <dl className="b-legal-table b-who-facts">
            <dt>Founder</dt><dd><b data-no-translate>Gourav Mehta</b><br /><small data-no-translate>M.Sc. Engineering and Management of Space Systems, Hochschule Bremen (Germany)</small><br /><small data-no-translate>M.Sc. Satellite Technologies, Gdansk University of Technology (Poland)</small></dd>
            <dt>Advisor</dt><dd><b data-no-translate>Kajinder Srivastava</b><br /><small>Startup advisor</small><br /><small data-no-translate>Founder | Co-founder &amp; Business Head, Danphe Private Limited (Aerospace &amp; Defence)</small></dd>
            {/* Shown only once real values exist (W1/W2); the Impressum lists what is still to be confirmed. */}
            {legal.companyName && <><dt>Company</dt><dd data-no-translate>{[legal.companyName, legal.legalForm].filter(Boolean).join(" ")}</dd></>}
            {legal.representative && <><dt>Represented by</dt><dd data-no-translate>{legal.representative}</dd></>}
            {legal.postalCity && <><dt>Location</dt><dd data-no-translate>{legal.postalCity}</dd></>}
            <dt>Contact</dt><dd>{legal.email ? <a href={`mailto:${legal.email}`} data-no-translate>{legal.email}</a> : <Link href="/contact">Contact form</Link>}</dd>
          </dl>
        </div>
      </section>

      <section className="b-section" style={{ paddingTop: 0 }} aria-labelledby="faq-title">
        <div className="b-wrap b-faq">
          <div><span className="b-kicker">Questions</span><h2 className="b-h2" id="faq-title">Straight answers.</h2></div>
          <div className="b-faq-list">{faqs.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
        </div>
      </section>

      <section className="b-section b-dark" aria-labelledby="cta-title">
        <div className="b-wrap b-cta">
          <div className="b-cta-copy">
            <BohMark size={72} tone="dark" smile />
            <div><h2 className="b-h2" id="cta-title" style={{ marginBottom: 8 }}>Which workflow slows you down?</h2><p className="b-lead">Tell us about it. We’ll tell you honestly whether BOH ERP can help.</p></div>
          </div>
          <div className="b-hero-actions" style={{ marginTop: 0 }}>
            <Link className="b-btn b-btn-primary" href="/contact?offer=call">Book a workflow call <ArrowRight size={18} /></Link>
            <Link className="b-btn b-btn-ghost" href="/contact?offer=pilot">Join the pilot waitlist</Link>
          </div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
