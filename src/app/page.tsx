import { ArrowDown, ArrowRight, ArrowUpRight, BrainCircuit, Boxes, Check, ClipboardCheck, FileClock, FileStack, GitBranch, Layers3, Link2, MoveUpRight, ScanSearch, ShieldCheck, Workflow } from "lucide-react";
import Link from "next/link";
import { IndustryExplorer } from "@/components/marketing/industry-explorer";
import { ProductPreview } from "@/components/marketing/product-preview";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Your business. Your workflows. Your ERP.", "PROTEUS is developing configurable business software shaped around how a company works. Explore the synthetic product demonstration and its current limits.", "/");

const commonChallenges = [
  { number: "01", icon: Layers3, title: "Work split across tools", description: "Important context can end up spread across spreadsheets, email, folders, and separate applications." },
  { number: "02", icon: FileStack, title: "Processes held in inboxes", description: "People rely on messages and reminders to keep routine reviews and handoffs moving." },
  { number: "03", icon: Workflow, title: "Software that expects one way", description: "A fixed process may not match the steps a business has developed for its own work." },
  { number: "04", icon: FileClock, title: "Change gets harder to manage", description: "As a team grows, it can become harder to keep records and responsibilities aligned." },
];

const implementationSteps = [
  ["Understand the business", "Learn how work moves today, where it gets stuck, and what needs to be visible."],
  ["Map the workflows", "Agree on records, responsibilities, decisions, and important exceptions."],
  ["Configure the platform", "Shape supported fields, rules, and handoffs around the agreed requirements."],
  ["Review and test", "Walk through sample work with the people who will use the process."],
  ["Refine over time", "Adjust the setup as requirements and the business change."],
] as const;

const futureSteps = ["Business request", "AI interpretation", "Proposed configuration", "Validation & preview", "Human approval"];

const faqs = [
  ["What is PROTEUS?", "PROTEUS is an early-stage configurable ERP concept. The aim is to organize business records and workflows around how each company operates, combining reusable platform capabilities with business-specific configuration."],
  ["Which businesses is it intended for?", "The initial focus is startups and small businesses that need more structure than spreadsheets can provide, while the long-term concept is intended to support different industries. The current detailed demonstration uses fictional precision-manufacturing records."],
  ["Is PROTEUS a finished ERP?", "No. The repository contains a product website and an interactive demonstration. It is not a production-ready commercial ERP and has no shared backend, accounts, or production security controls."],
  ["Can a business customise its workflows today?", "The demonstration lets you configure document types, custom fields, document requirement rules, and descriptive approval stages in this browser. Those settings do not run a production workflow or sync between users."],
  ["Does PROTEUS currently offer AI-powered ERP generation?", "No. Natural-language configuration and AI-generated modules are a future product vision. No AI model or provider is connected to the current demonstration."],
  ["How would implementation work?", "The intended approach is to understand the business, map its workflows, configure supported capabilities, review the setup with the team, and refine it. This is a proposed customer approach, not an automated onboarding feature or a confirmed service commitment."],
  ["How does pricing work?", "There is no published fixed price. Scope would depend on the requirements and implementation complexity; those details need to be discussed before any estimate."],
  ["How can I discuss my requirements?", "Use the Contact page to check the current inquiry options. A verified contact address has not yet been configured on this website."],
] as const;

export default function Home() {
  return <>
    <SiteHeader />
    <main id="top">
      <section className="hero-section" aria-labelledby="hero-title">
        <div className="hero-grid-lines" aria-hidden="true" />
        <div className="hero-inner page-container">
          <div className="hero-copy">
            <div className="eyebrow light-eyebrow"><span className="eyebrow-dot" /> CONFIGURABLE ERP · EARLY-STAGE CONCEPT</div>
            <h1 id="hero-title">Your business.<br />Your workflows.<br /><span>Your ERP.</span></h1>
            <p className="hero-description">PROTEUS is developing configurable business software shaped around how your company operates—from the records you need to the handoffs that keep work moving.</p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/contact">Discuss Your Workflow <ArrowRight size={16} /></Link>
              <Link className="button button-ghost" href="/demo">Explore the Demo <MoveUpRight size={15} /></Link>
            </div>
            <div className="hero-note"><span className="hero-note-rule" /> A product concept with a working synthetic demonstration.</div>
          </div>
          <div className="hero-aside systems-visual" role="img" aria-label="Conceptual diagram showing business records and operations connected through one configurable software platform">
            <div className="hero-aside-index">PLATFORM CONCEPT / 01</div>
            <svg viewBox="0 0 360 330" aria-hidden="true">
              <defs><linearGradient id="flow" x1="0" x2="1"><stop stopColor="#5797ff" stopOpacity=".18"/><stop offset="1" stopColor="#80c5ff" stopOpacity=".95"/></linearGradient></defs>
              <circle cx="180" cy="165" r="102" className="system-orbit"/><circle cx="180" cy="165" r="65" className="system-orbit orbit-inner"/>
              <path className="system-path" d="M180 165 L75 70 M180 165 L285 70 M180 165 L75 260 M180 165 L285 260" />
              <rect x="139" y="124" width="82" height="82" rx="16" className="system-core"/><text x="180" y="158" textAnchor="middle" className="system-core-name">PROTEUS</text><text x="180" y="176" textAnchor="middle" className="system-core-label">CONFIGURABLE CORE</text>
              <g className="system-node"><rect x="26" y="42" width="100" height="49" rx="8"/><text x="76" y="63" textAnchor="middle">RECORDS</text><text x="76" y="78" textAnchor="middle" className="system-node-sub">Fields · documents</text></g>
              <g className="system-node"><rect x="234" y="42" width="100" height="49" rx="8"/><text x="284" y="63" textAnchor="middle">WORKFLOWS</text><text x="284" y="78" textAnchor="middle" className="system-node-sub">Reviews · handoffs</text></g>
              <g className="system-node"><rect x="26" y="238" width="100" height="49" rx="8"/><text x="76" y="259" textAnchor="middle">TEMPLATES</text><text x="76" y="274" textAnchor="middle" className="system-node-sub">Reusable patterns</text></g>
              <g className="system-node"><rect x="234" y="238" width="100" height="49" rx="8"/><text x="284" y="259" textAnchor="middle">IMPLEMENTATION</text><text x="284" y="274" textAnchor="middle" className="system-node-sub">Business context</text></g>
              <circle cx="180" cy="165" r="4" className="system-pulse" />
            </svg>
            <div className="hero-aside-copy">Shared platform.<br />Room for your process.</div>
            <a href="#approach" tabIndex={-1}><span>SCROLL TO EXPLORE</span><ArrowDown size={14} /></a>
          </div>
        </div>
        <div className="hero-bottom-line page-container"><span>CONFIGURABLE RECORDS</span><i /><span>BUSINESS-SPECIFIC WORKFLOWS</span><i /><span>A PLATFORM THAT CAN EVOLVE</span></div>
      </section>

      <section className="preview-stage" aria-labelledby="demo-preview-title">
        <div className="page-container"><div className="story-section-heading preview-story-heading"><span className="section-index">A REAL INTERFACE · SYNTHETIC RECORDS</span><h2 id="demo-preview-title">Explore what exists today.</h2><p>The interactive preview below uses the same fictional manufacturing scenario as the live demonstration.</p></div><ProductPreview /><p className="demo-boundary-inline"><ShieldCheck size={15} /> Browser-local configuration and synthetic document metadata. No production service, real files, or AI provider is connected.</p></div>
      </section>

      <section className="problem-section section-pad" aria-labelledby="problem-title">
        <div className="page-container">
          <div className="section-intro split-intro"><div><span className="section-index">01 / THE CHALLENGE</span><h2 id="problem-title">Good work can outgrow <em>the systems around it.</em></h2></div><p>Some businesses find that day-to-day work spans tools and processes that were never designed to fit together.</p></div>
          <div className="problem-grid">{commonChallenges.map(({ number, icon: Icon, title, description }) => <article className="problem-card" key={number}><div className="problem-card-top"><span className="problem-number">{number}</span><Icon size={19} strokeWidth={1.6} /></div><h3>{title}</h3><p>{description}</p><span className="card-bottom-rule" /></article>)}</div>
        </div>
      </section>

      <section className="solution-section section-pad" id="approach" aria-labelledby="approach-title">
        <div className="solution-pattern" aria-hidden="true" />
        <div className="page-container solution-container">
          <div className="solution-topline"><span className="section-index section-index-light">02 / THE PROTEUS APPROACH</span><span className="solution-chip"><Link2 size={12} /> CONFIGURABLE BY DESIGN</span></div>
          <div className="solution-heading"><h2 id="approach-title">One platform.<br /><em>Configured with context.</em></h2><p>Reusable software capabilities can be shaped around the records, decisions, and handoffs that matter to a particular business.</p></div>
          <div className="approach-grid">
            <article className="approach-card"><span>01 · SHARED PLATFORM</span><Boxes size={21} /><h3>Configure supported capabilities</h3><p>The current demo lets you shape document types, custom fields, requirement rules, and descriptive workflow stages.</p><Link href="/product">See the product scope <ArrowRight size={14} /></Link></article>
            <article className="approach-card"><span>02 · BUSINESS CONTEXT</span><ClipboardCheck size={21} /><h3>Start with how work happens</h3><p>The intended approach begins by understanding the business and its processes, then configuring a suitable workflow with the team.</p><Link href="#how-it-works">Explore the approach <ArrowRight size={14} /></Link></article>
            <article className="approach-card"><span>03 · REUSABLE PATTERNS</span><GitBranch size={21} /><h3>Build on useful patterns</h3><p>Where a relevant pattern exists, it can be a starting point. Industry templates and finished solutions are not available across every sector today.</p><Link href="#solutions">View potential applications <ArrowRight size={14} /></Link></article>
            <article className="approach-card approach-card-future"><span>04 · LONG-TERM DIRECTION</span><BrainCircuit size={21} /><h3>Work toward assisted configuration</h3><p>Natural-language requests and AI-proposed changes are part of the vision, not a capability in the current product demo.</p><Link href="#vision">See the future direction <ArrowRight size={14} /></Link></article>
          </div>
        </div>
      </section>

      <section className="industries-section section-pad" id="solutions" aria-labelledby="solutions-title">
        <div className="page-container"><div className="section-intro split-intro"><div><span className="section-index">03 / ONE PLATFORM · DIFFERENT CONTEXTS</span><h2 id="solutions-title">A platform concept for <em>different kinds of work.</em></h2></div><p>These examples show workflows a configurable platform could support. They are possibilities to explore, not finished industry products.</p></div><IndustryExplorer /></div>
      </section>

      <section className="journey-section section-pad" id="how-it-works" aria-labelledby="journey-title">
        <div className="page-container"><div className="journey-heading"><span className="section-index">04 / A PROPOSED IMPLEMENTATION APPROACH</span><h2 id="journey-title">Start with the work.<br /><em>Refine the system together.</em></h2><p>This is the intended path for a customer conversation and implementation—not an automated setup process currently offered by the product.</p></div>
          <ol className="journey-list">{implementationSteps.map(([title, description], index) => <li key={title}><span className="journey-number">0{index + 1}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol>
        </div>
      </section>

      <section className="demo-story-section section-pad" aria-labelledby="demo-story-title">
        <div className="page-container demo-story-grid"><div className="demo-story-copy"><span className="section-index">05 / EXPLORE THE CURRENT DEMONSTRATION</span><h2 id="demo-story-title">A connected manufacturing scenario.</h2><p>Explore fictional engineering records, part revisions, production orders, configurable document requirements, and descriptive approval workflows.</p><ul><li><Check size={15} /> Browse linked synthetic records</li><li><Check size={15} /> Configure supported document checks in this browser</li><li><Check size={15} /> See where the demonstration stops</li></ul><Link className="button button-primary" href="/demo">Explore the Demo <ArrowRight size={16} /></Link><p className="demo-caveat">The demo stores some edits in this browser only. It has no accounts, shared backend, file storage, executed approvals, or production-readiness assessment. Do not enter confidential information.</p></div>
          <div className="demo-story-visual"><div className="demo-story-map"><span>FICTIONAL WORKSPACE</span><strong>Apex Precision Components GmbH</strong><div className="demo-map-links"><div><FileStack size={17} /><span>Document records<small>Revision · status · links</small></span></div><div><Layers3 size={17} /><span>Part examples<small>Part · revision history</small></span></div><div><ClipboardCheck size={17} /><span>Order examples<small>Configured record checks</small></span></div></div><div className="demo-story-map-note"><ShieldCheck size={15} /> Illustrative data only · no customer files</div></div></div>
        </div>
      </section>

      <section className="vision-section section-pad" id="vision" aria-labelledby="vision-title">
        <div className="solution-pattern" aria-hidden="true" />
        <div className="page-container vision-container"><div className="solution-topline"><span className="section-index section-index-light">06 / LONG-TERM PRODUCT VISION</span><span className="vision-badge"><BrainCircuit size={14} /> FUTURE DIRECTION · NOT BUILT</span></div><div className="vision-heading"><h2 id="vision-title">A more natural way to shape <em>business software.</em></h2><p>Over time, PROTEUS aims to explore how AI could help translate a business request into a configuration people can inspect and validate.</p></div>
          <ol className="vision-flow">{futureSteps.map((step, index) => <li key={step}><span>0{index + 1}</span><strong>{step}</strong></li>)}</ol>
          <p className="vision-note">This is a product vision. No AI interpretation, automatic validation, or deployment capability is connected to the current demo. Any future change should remain reviewable and require human approval.</p>
        </div>
      </section>

      <section className="audience-section section-pad" aria-labelledby="audience-title"><div className="page-container audience-grid"><div><span className="section-index">07 / WHO IT MAY SUIT</span><h2 id="audience-title">For teams finding their <em>operational shape.</em></h2><p>PROTEUS is initially intended for startups and small businesses that want more structure without beginning with a complex enterprise implementation.</p></div><ul><li><span>01</span> Establishing first repeatable workflows</li><li><span>02</span> Moving beyond spreadsheets and inbox reminders</li><li><span>03</span> Needing processes that reflect day-to-day operations</li><li><span>04</span> Expecting their systems to evolve as they grow</li></ul></div></section>

      <section className="collaboration-section section-pad" aria-labelledby="collaboration-title"><div className="page-container collaboration-panel"><div><span className="section-index section-index-light">08 / EARLY COLLABORATION</span><h2 id="collaboration-title">Help shape the way your <em>business software works.</em></h2><p>PROTEUS is early-stage and does not yet offer a confirmed production-ready commercial ERP. An initial conversation can help clarify requirements and assess whether the direction may fit.</p></div><div className="collaboration-actions"><Link className="button button-primary" href="/contact">Discuss Your Workflow <ArrowRight size={16} /></Link><Link className="inline-link collaboration-demo-link" href="/demo">Explore the current demo <ArrowUpRight size={15} /></Link></div></div></section>

      <section className="faq-section section-pad" aria-labelledby="faq-title"><div className="page-container faq-grid"><div><span className="section-index">09 / FREQUENT QUESTIONS</span><h2 id="faq-title">Clear answers, <em>without the guesswork.</em></h2><p>What the product is, what the demonstration shows, and what remains ahead.</p></div><div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></div></section>

      <section className="contact-section" aria-labelledby="closing-title"><div className="contact-grid-lines" aria-hidden="true" /><div className="page-container contact-inner"><div><span className="section-index section-index-light">10 / START WITH A CONVERSATION</span><h2 id="closing-title">Your work is worth <em>understanding.</em></h2><p>Tell us what your business needs to organize. We can start by understanding the workflow and the problem behind it.</p></div><div className="closing-actions"><Link className="contact-cta" href="/contact"><span className="contact-cta-icon"><ScanSearch size={20} /></span><span><b>Discuss Your Workflow</b><small>See current inquiry options</small></span><ArrowUpRight size={18} /></Link><Link className="closing-demo-link" href="/demo">Or explore the synthetic demo <ArrowRight size={14} /></Link></div></div></section>
    </main>
    <SiteFooter />
  </>;
}
