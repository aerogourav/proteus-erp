import { AlertTriangle, ArrowRight, Check, CircleDashed, Cog, Layers3, PlayCircle, Workflow } from "lucide-react";
import Link from "next/link";
import { BohMark } from "@/components/brand/boh-logo";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Your business. Your workflows. Your ERP.", "BOH ERP sets up configurable business software around how your company works. Explore the guided demo and talk to us about your workflow.", "/");

const problems = [
  ["Work lives in too many places", "Orders, drawings, approvals and status updates are spread across spreadsheets, inboxes and shared folders."],
  ["Off-the-shelf ERP forces your process", "Standard systems expect you to change how you work, and custom software is slow and expensive to build."],
  ["Mistakes show up late", "An outdated document or a missing approval is often found on the shop floor, not before the job starts."],
] as const;

const pillars = [
  { icon: Cog, title: "BUILD", sub: "We set it up around your work", body: "We learn how your work actually moves, then configure records, fields, rules and approval steps on one shared platform." },
  { icon: Workflow, title: "OPERATE", sub: "Your team runs daily work in one place", body: "Orders, parts, documents and approvals stay linked, so everyone sees the same current information." },
  { icon: Layers3, title: "HARMONISE", sub: "It improves as you grow", body: "Repeated needs become reusable modules and templates, so changes stay consistent instead of becoming one-off custom code." },
] as const;

const steps = [
  ["Workflow conversation", "A short call about one process that costs you time or causes errors today. No preparation needed."],
  ["Bounded pilot", "We configure that one workflow with agreed scope and clear success criteria, and test it with your team."],
  ["Implementation + subscription", "If the pilot works, we roll it out for a one-time implementation fee and a monthly cloud subscription."],
] as const;

const story = [
  ["A customer order arrives", "Order MO-2026-0142: 48 actuator mounting brackets, part AP-1001."],
  ["The drawing changed", "Revision C of the drawing was just approved. Which other records are affected?"],
  ["BOH checks the linked documents", "Setup sheet and material certificate are fine, but the inspection plan is still on an old revision."],
  ["The issue is caught before production", "The order is flagged with the exact reason. Change the rule and see the result update."],
] as const;

const today = [
  "Interactive demo with a fictional precision-manufacturing company",
  "Linked orders, parts, revisions and engineering documents",
  "Configurable document types, fields and requirement rules",
  "Automatic checks that flag missing, outdated or unapproved records",
  "English and German interface",
];

const planned = [
  "Secure multi-user cloud workspace for each customer",
  "Roles, permissions and a complete audit history",
  "Executable approval workflows with notifications",
  "Reusable industry templates",
  "AI that turns a plain-language request into a configuration you review and approve",
];

const faqs = [
  ["Is BOH ERP ready to use today?", "Not yet as a production system. Today there is an interactive demo with synthetic data. We are looking for first pilot customers to shape the production version with us."],
  ["Who is it for?", "Startups and small businesses that have outgrown spreadsheets. Our first focus is manufacturing and precision engineering, but the platform is built to support other industries."],
  ["What does it cost?", "A one-time implementation fee plus a monthly subscription. Both depend on the scope of your workflows, so we agree them after the first conversation, before any work starts."],
  ["Does it use AI?", "Not yet. The current checks are clear, rule-based logic. AI-assisted configuration is on our roadmap, and any change it proposes will always need human approval."],
] as const;

export default function Home() {
  return <div className="b-site">
    <SiteHeader />
    <main id="top">
      <section className="b-hero b-dark" aria-labelledby="hero-title">
        <div className="b-wrap b-hero-grid">
          <div>
            <span className="b-kicker">Configurable ERP for growing businesses</span>
            <h1 id="hero-title"><span>Your business.</span><span>Your workflows.</span><span className="b-accent-line">Your ERP.</span></h1>
            <p className="b-lead">BOH ERP is business software we set up around how your company already works, so orders, parts, documents and approvals stay connected.</p>
            <div className="b-hero-actions">
              <Link className="b-btn b-btn-primary" href="/contact">Book a workflow call <ArrowRight size={18} /></Link>
              <Link className="b-btn b-btn-ghost" href="/demo"><PlayCircle size={18} /> Try the 3-minute demo</Link>
            </div>
            <span className="b-tagline" data-no-translate>BUILD. OPERATE. HARMONISE.</span>
          </div>
          <div className="b-card-stage" role="img" aria-label="Example from the demo: production order MO-2026-0142 flagged because the inspection plan is outdated">
            <BohMark size={64} tone="dark" smile className="b-card-mascot" />
            <div className="b-order-card" aria-hidden="true">
              <div className="b-order-head">
                <div><small>Production order</small><strong>MO-2026-0142</strong><small>48 × AP-1001 · Rev C</small></div>
                <span className="b-pill b-pill-warn"><AlertTriangle size={14} /> 1 issue</span>
              </div>
              <ul className="b-checks">
                <li><span className="b-check-icon ok"><Check size={16} /></span><span>Drawing<small>Rev C · Approved</small></span><span className="b-pill b-pill-ok">OK</span></li>
                <li><span className="b-check-icon ok"><Check size={16} /></span><span>Setup sheet<small>Rev B · Approved</small></span><span className="b-pill b-pill-ok">OK</span></li>
                <li><span className="b-check-icon warn"><AlertTriangle size={16} /></span><span>Inspection plan<small>Rev A · Outdated</small></span><span className="b-pill b-pill-warn">Check</span></li>
                <li><span className="b-check-icon ok"><Check size={16} /></span><span>Material certificate<small>Reference linked</small></span><span className="b-pill b-pill-ok">OK</span></li>
              </ul>
              <p className="b-card-note">From the demo · fictional company and data</p>
            </div>
          </div>
        </div>
      </section>

      <section className="b-section" aria-labelledby="problem-title">
        <div className="b-wrap">
          <span className="b-kicker">The problem</span>
          <h2 className="b-h2" id="problem-title">Growing companies outgrow spreadsheets before they are ready for a big ERP.</h2>
          <div className="b-problems">{problems.map(([title, body]) => <article className="b-problem" key={title}><h3>{title}</h3><p>{body}</p></article>)}</div>
        </div>
      </section>

      <section className="b-section" style={{ paddingTop: 0 }} aria-labelledby="pillars-title">
        <div className="b-wrap">
          <span className="b-kicker">Our approach</span>
          <h2 className="b-h2" id="pillars-title">One shared platform, configured for your business.</h2>
          <p className="b-lead">Not a collection of custom apps. Every customer runs on the same reliable core, set up for their own way of working.</p>
          <div className="b-pillars">{pillars.map(({ icon: Icon, title, sub, body }) => <article className="b-pillar" key={title}><span className="b-pillar-icon"><Icon size={22} /></span><h3 data-no-translate>{title}</h3><span className="b-pillar-sub">{sub}</span><p>{body}</p></article>)}</div>
        </div>
      </section>

      <section className="b-section b-dark" id="how-it-works" aria-labelledby="how-title">
        <div className="b-wrap">
          <span className="b-kicker">How it works</span>
          <h2 className="b-h2" id="how-title">Start with one workflow. Grow from there.</h2>
          <p className="b-lead">We start small and prove the value with one workflow before you commit to more.</p>
          <ol className="b-steps">{steps.map(([title, body]) => <li key={title}><h3>{title}</h3><p>{body}</p></li>)}</ol>
          <p className="b-fineprint">Fees depend on scope and are agreed in writing before any work starts. Custom development and complex integrations are quoted separately.</p>
        </div>
      </section>

      <section className="b-section" aria-labelledby="demo-title">
        <div className="b-wrap b-demo">
          <div>
            <span className="b-kicker">See it working</span>
            <h2 className="b-h2" id="demo-title">One order. Four steps. Three minutes.</h2>
            <p className="b-lead">The demo follows a fictional precision-engineering company through one realistic situation: a drawing changes while an order is waiting.</p>
            <div className="b-hero-actions"><Link className="b-btn b-btn-dark" href="/demo">Start the guided demo <ArrowRight size={18} /></Link></div>
          </div>
          <ol className="b-story">{story.map(([title, body], index) => <li key={title}><span className="b-story-num">{index + 1}</span><div><strong>{title}</strong><span>{body}</span></div></li>)}</ol>
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
          <ul className="b-chips" aria-label="Industries">
            <li className="first">Manufacturing &amp; engineering · first focus</li>
            <li>Trading &amp; distribution</li>
            <li>Professional &amp; field services</li>
            <li>Growing startups</li>
          </ul>
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
          <Link className="b-btn b-btn-primary" href="/contact">Book a workflow call <ArrowRight size={18} /></Link>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
