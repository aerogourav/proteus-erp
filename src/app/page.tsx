import { ArrowRight, Check, CircleDashed, Cog, Factory, Layers3, PlayCircle, Repeat, ShoppingBag, Workflow } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BohMark } from "@/components/brand/boh-logo";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { legal } from "@/lib/legal";
import { OFFERS, PILOT_PLACES } from "@/lib/offers";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("BOH ERP — Job release and shop-floor software for small manufacturers", "BOH ERP connects orders, drawing revisions, material, shop-floor bookings, inspection and dispatch for small manufacturers. Book a free workflow call, a free demo walkthrough or a free 2-week pilot run.", "/");

const problems = [
  ["Work lives in too many places", "Orders, drawings, approvals and status updates are spread across spreadsheets, inboxes and shared folders."],
  ["Off-the-shelf ERP forces your process", "Standard systems expect you to change how you work, and custom software is slow and expensive to build."],
  ["Mistakes show up late", "An outdated drawing or missing material is often found on the shop floor, not before the job starts."],
] as const;

const pillars = [
  { icon: Cog, title: "BUILD", sub: "We set it up around your work", body: "We learn how your work actually moves, then configure records, fields, rules and approval steps on one shared platform." },
  { icon: Workflow, title: "OPERATE", sub: "Your team runs daily work in one place", body: "Orders, parts, drawings, operations and inspections stay linked, so everyone sees the same current information." },
  { icon: Layers3, title: "HARMONISE", sub: "It improves as you grow", body: "Repeated needs become reusable modules and templates, so changes stay consistent instead of becoming one-off custom code." },
] as const;

const steps = [
  ["Free workflow call", "30 minutes about one process that costs you time or causes errors today. No preparation needed."],
  ["Free demo walkthrough", "We follow one job through the demo with your team and answer questions live."],
  ["Free 2-week pilot run", "One workflow on one production cell, with anonymised data and success criteria agreed up front."],
  ["Paid implementation, only if you want it", "If the pilot works, we agree scope, a one-time implementation fee and a monthly subscription in writing before any paid work starts."],
] as const;

const story = [
  ["Enter the order once", "Customer, purchase order, parts and revisions, drawings, inspection and material in a short guided form."],
  ["Release only when ready", "A job cannot start without an approved drawing for the ordered revision and its material in stock. A revised drawing stops further work. Overrides need an owner or admin and a reason."],
  ["Book work on the shop floor", "Operators book good and scrap per operation, in parts across shifts. Quantities can never exceed what arrived, and the job completes only when every operation is booked."],
  ["Inspect, dispatch, invoice", "Every measurement needs an explicit result; out-of-tolerance values fail. Delivery note and invoice come from the same records, and issued invoices are cancelled with a credit note, never deleted."],
] as const;

const industries = [
  { key: "commerce", icon: ShoppingBag, title: "E-commerce & wholesale", company: "Fjord & Fern Home Goods", body: "Products and variants, stock per warehouse, orders from every channel, pick, pack and ship, returns and invoices." },
  { key: "saas", icon: Repeat, title: "Software & SaaS", company: "Northwind Analytics", body: "Plans and seats, subscriptions, monthly recurring revenue, renewals and churn, recurring invoices and support tickets." },
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
  "Screens for roles, permissions and the audit history in the cloud workspace (the database already records the history)",
  "Export of invoices to DATEV or a specialist e-invoicing provider",
  "Reusable industry templates",
  "AI that turns a plain-language request into a configuration you review and approve",
];

const faqs = [
  ["Is BOH ERP ready to use today?", "Not yet as a production system. Today there is an interactive demo with synthetic data, and an invite-only workspace that is still being prepared. We are looking for first pilot shops to shape the production version with us."],
  ["Is the free pilot a production-ready ERP?", "No. The pilot tests one workflow on one production cell with anonymised or non-confidential data. Keep your current process running alongside it. At the end you get a short written result and decide whether to continue."],
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

const tbc = "To be confirmed";

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
              <Link className="b-btn b-btn-primary" href="/contact?offer=call">Book a free workflow call <ArrowRight size={18} /></Link>
              <Link className="b-btn b-btn-ghost" href="/contact?offer=walkthrough"><PlayCircle size={18} /> Free demo walkthrough</Link>
            </div>
            <p className="b-hero-pilot"><Link href="/contact?offer=pilot">Join the pilot waitlist for a free 2-week pilot run <ArrowRight size={15} /></Link></p>
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
        </div>
      </section>

      <section className="b-section" aria-labelledby="problem-title">
        <div className="b-wrap">
          <span className="b-kicker">The problem</span>
          <h2 className="b-h2" id="problem-title">Growing job shops outgrow spreadsheets before they are ready for a big ERP.</h2>
          <div className="b-problems">{problems.map(([title, body]) => <article className="b-problem b-reveal" key={title}><h3>{title}</h3><p>{body}</p></article>)}</div>
        </div>
      </section>

      <section className="b-section b-offers-section" id="offers" aria-labelledby="offers-title">
        <div className="b-wrap">
          <span className="b-kicker">Free offers</span>
          <h2 className="b-h2" id="offers-title">Three ways to find out if BOH ERP fits. All free, no obligation.</h2>
          <p className="b-lead">Start small. Any paid next step is agreed in writing before work starts.</p>
          <div className="b-offers">{OFFERS.map((offer) => <article key={offer.key} className={`b-offer b-reveal${offer.key === "pilot" ? " is-pilot" : ""}`}>
            <h3>{offer.title}</h3>
            <dl>
              <div><dt>Length</dt><dd>{offer.length}</dd></div>
              <div><dt>Who attends</dt><dd>{offer.attendees}</dd></div>
              <div><dt>What you get</dt><dd>{offer.youGet}</dd></div>
              <div><dt>What we need</dt><dd>{offer.weNeed}</dd></div>
            </dl>
            <p className="b-offer-free">Free · no obligation</p>
            <Link className={`b-btn ${offer.key === "pilot" ? "b-btn-primary" : "b-btn-dark"}`} href={`/contact?offer=${offer.key}`}>{offer.key === "call" ? "Book a free workflow call" : offer.key === "walkthrough" ? "Ask for a walkthrough" : "Join the pilot waitlist"} <ArrowRight size={17} /></Link>
          </article>)}</div>

          <div className="b-pilot b-reveal" aria-labelledby="pilot-title">
            <div className="b-pilot-head">
              <h3 id="pilot-title">The free 2-week pilot run in detail</h3>
              <p>{PILOT_PLACES} places at a time. Pilots start once our pilot readiness checks pass; until then you join the waitlist. The pilot uses early-stage software and is not a production-ready ERP: keep your current process running alongside it.</p>
            </div>
            <dl className="b-pilot-grid">{pilot.map(([title, body]) => <div key={title}><dt>{title}</dt><dd>{body}</dd></div>)}</dl>
          </div>
        </div>
      </section>

      <section className="b-section" style={{ paddingTop: 0 }} aria-labelledby="pillars-title">
        <div className="b-wrap">
          <span className="b-kicker">Our approach</span>
          <h2 className="b-h2" id="pillars-title">One shared platform, configured for your business.</h2>
          <p className="b-lead">Not a collection of custom apps. Every customer runs on the same core, set up for their own way of working.</p>
          <div className="b-pillars">{pillars.map(({ icon: Icon, title, sub, body }) => <article className="b-pillar b-reveal" key={title}><span className="b-pillar-icon"><Icon size={22} /></span><h3 data-no-translate>{title}</h3><span className="b-pillar-sub">{sub}</span><p>{body}</p></article>)}</div>
        </div>
      </section>

      <section className="b-section b-dark" id="how-it-works" aria-labelledby="how-title">
        <div className="b-wrap">
          <span className="b-kicker">How it works</span>
          <h2 className="b-h2" id="how-title">Start with one workflow. Grow from there.</h2>
          <p className="b-lead">The first three steps are free. You only pay if you decide to continue.</p>
          <ol className="b-steps b-steps-4">{steps.map(([title, body]) => <li key={title} className="b-reveal"><h3>{title}</h3><p>{body}</p></li>)}</ol>
          <p className="b-fineprint">Fees depend on scope and are agreed in writing before any paid work starts. Custom development and complex integrations are quoted separately.</p>
        </div>
      </section>

      <section className="b-section" aria-labelledby="demo-title">
        <div className="b-wrap b-demo">
          <div>
            <span className="b-kicker">See it working</span>
            <h2 className="b-h2" id="demo-title">One job. One source of truth.</h2>
            <p className="b-lead">Follow a job from customer order to invoice in the manufacturing demo. Everything runs in your browser with a fictional company.</p>
            <ol className="b-story" style={{ marginTop: 28 }}>{story.map(([title, body], index) => <li key={title} className="b-reveal"><span className="b-story-num">{index + 1}</span><div><strong>{title}</strong><span>{body}</span></div></li>)}</ol>
            <div className="b-hero-actions"><Link className="b-btn b-btn-dark" href="/demo/start?industry=manufacturing">Open the manufacturing demo <ArrowRight size={18} /></Link><Link className="b-btn b-btn-ghost" href="/contact?offer=walkthrough">Or get a free walkthrough</Link></div>
          </div>
          <figure className="b-shot b-reveal">
            <Image src="/screens/shop-floor.png" width={1280} height={800} sizes="(max-width: 900px) 100vw, 560px" alt="Screenshot of the BOH ERP demo shop floor: running operations, operators and booked quantities" />
            <figcaption>Shop floor in the demo · fictional data</figcaption>
          </figure>
        </div>
      </section>

      <section className="b-section" style={{ paddingTop: 0 }} aria-labelledby="industries-title">
        <div className="b-wrap">
          <span className="b-kicker">Built for manufacturing first</span>
          <h2 className="b-h2" id="industries-title">Made for job shops today. One platform for more industries later.</h2>
          <Link href="/demo/start?industry=manufacturing" className="b-pillar b-industry b-industry-main b-reveal">
            <span className="b-pillar-icon"><Factory size={22} /></span>
            <h3>Manufacturing</h3>
            <span className="b-pillar-sub">Harmonie Präzisionstechnik · fictional demo company</span>
            <p>Customer orders, drawings and revisions, purchasing, production orders and routings, shop-floor times, inspection, dispatch and invoicing.</p>
            <span className="b-industry-cta">Open this demo <ArrowRight size={16} /></span>
          </Link>
          <p className="b-lead" style={{ marginTop: 28 }}>The same core also runs these demos. They show where the platform is heading; our pilots focus on manufacturing.</p>
          <div className="b-pillars b-industries b-industries-2">{industries.map(({ key, icon: Icon, title, company, body }) => <Link key={key} href={`/demo/start?industry=${key}`} className="b-pillar b-industry b-reveal">
            <span className="b-pillar-icon"><Icon size={22} /></span>
            <h3>{title}</h3>
            <span className="b-pillar-sub">{company}</span>
            <p>{body}</p>
            <span className="b-industry-cta">Open this demo <ArrowRight size={16} /></span>
          </Link>)}</div>
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
            <dt>Company</dt><dd data-no-translate={legal.companyName ? true : undefined}>{[legal.companyName, legal.legalForm].filter(Boolean).join(" ") || tbc}</dd>
            <dt>Represented by</dt><dd data-no-translate={legal.representative ? true : undefined}>{legal.representative || tbc}</dd>
            <dt>Location</dt><dd data-no-translate={legal.postalCity ? true : undefined}>{legal.postalCity || tbc}</dd>
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
            <Link className="b-btn b-btn-primary" href="/contact?offer=call">Book a free workflow call <ArrowRight size={18} /></Link>
            <Link className="b-btn b-btn-ghost" href="/contact?offer=pilot">Join the pilot waitlist</Link>
          </div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
