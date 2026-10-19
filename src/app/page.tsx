import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  Check,
  CircleDot,
  ClipboardCheck,
  FileCheck2,
  FileClock,
  FileStack,
  GitBranch,
  Layers3,
  Link2,
  MoveUpRight,
  ScanSearch,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { ProductPreview } from "@/components/marketing/product-preview";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

const capabilities = [
  {
    number: "01",
    icon: FileStack,
    title: "Engineering documents",
    description: "Keep drawings, specifications, and setup sheets with the parts and orders that depend on them.",
    detail: "A clear home for the record",
  },
  {
    number: "02",
    icon: FileClock,
    title: "Revision control",
    description: "See what changed, what is current, and where a review or approval is still needed.",
    detail: "Current state, made visible",
  },
  {
    number: "03",
    icon: Layers3,
    title: "Parts and relationships",
    description: "Connect part records to their engineering documents and the work moving through your shop.",
    detail: "Context travels with the part",
  },
  {
    number: "04",
    icon: ClipboardCheck,
    title: "Production workflows",
    description: "Shape order steps around the way your team actually plans, makes, and checks work.",
    detail: "Workflows that fit your process",
  },
];

const problems = [
  { icon: FileStack, title: "Documents in too many places", description: "The drawing is in one folder, the setup sheet is in another, and the order carries the questions." },
  { icon: FileClock, title: "Revision doubt on the floor", description: "When an old copy is easy to find, every handoff creates another opportunity for rework." },
  { icon: Workflow, title: "Follow-ups held together by memory", description: "Manual checks and rigid systems leave people chasing what should already be clear." },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="top">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-grid-lines" aria-hidden="true" />
          <div className="hero-inner page-container">
            <div className="hero-copy">
              <div className="eyebrow light-eyebrow"><span className="eyebrow-dot" /> CONFIGURABLE BUSINESS SOFTWARE</div>
              <h1 id="hero-title">Business software that <span>adapts to the way you work.</span></h1>
              <p className="hero-description">Configure records, workflows, and operational processes around your company—from a growing startup to a precision-manufacturing team.</p>
              <div className="hero-actions">
                <a className="button button-primary" href="/demo">Explore the Live Demo <ArrowRight size={16} /></a>
                <a className="button button-ghost" href="#platform">See How It Works <MoveUpRight size={15} /></a>
              </div>
              <div className="hero-note"><span className="hero-note-rule" /> Built for the details that keep production moving.</div>
            </div>
            <div className="hero-aside systems-visual" role="img" aria-label="Illustration of configurable records linking production, finance, CRM, and supplier workflows">
              <div className="hero-aside-index">SYSTEM MAP / 01</div>
              <svg viewBox="0 0 360 330" aria-hidden="true">
                <defs><linearGradient id="flow" x1="0" x2="1"><stop stopColor="#5797ff" stopOpacity=".18"/><stop offset="1" stopColor="#80c5ff" stopOpacity=".95"/></linearGradient></defs>
                <circle cx="180" cy="165" r="102" className="system-orbit"/><circle cx="180" cy="165" r="65" className="system-orbit orbit-inner"/>
                <path className="system-path" d="M180 165 L75 70 M180 165 L285 70 M180 165 L75 260 M180 165 L285 260" />
                <rect x="139" y="124" width="82" height="82" rx="16" className="system-core"/><text x="180" y="158" textAnchor="middle" className="system-core-name">PROTEUS</text><text x="180" y="176" textAnchor="middle" className="system-core-label">CONFIGURABLE CORE</text>
                <g className="system-node"><rect x="26" y="42" width="100" height="49" rx="8"/><text x="76" y="63" textAnchor="middle">RECORDS</text><text x="76" y="78" textAnchor="middle" className="system-node-sub">Documents · parts</text></g>
                <g className="system-node"><rect x="234" y="42" width="100" height="49" rx="8"/><text x="284" y="63" textAnchor="middle">PRODUCTION</text><text x="284" y="78" textAnchor="middle" className="system-node-sub">Orders · workflows</text></g>
                <g className="system-node"><rect x="26" y="238" width="100" height="49" rx="8"/><text x="76" y="259" textAnchor="middle">RELATIONSHIPS</text><text x="76" y="274" textAnchor="middle" className="system-node-sub">CRM · suppliers</text></g>
                <g className="system-node"><rect x="234" y="238" width="100" height="49" rx="8"/><text x="284" y="259" textAnchor="middle">OPERATIONS</text><text x="284" y="274" textAnchor="middle" className="system-node-sub">Materials · finance</text></g>
                <circle cx="180" cy="165" r="4" className="system-pulse" />
              </svg>
              <div className="hero-aside-copy">One connected workspace.<br />Configured around your team.</div>
              <a href="#product-preview" tabIndex={-1}><span>SCROLL TO EXPLORE</span><ArrowDown size={14} /></a>
            </div>
            <div className="hero-coordinate coordinate-one" aria-hidden="true">51° 30′ 26.4″ N</div>
            <div className="hero-coordinate coordinate-two" aria-hidden="true">SYSTEM / 001</div>
          </div>
          <div className="hero-bottom-line page-container"><span>ENGINEERING RECORDS</span><i /><span>CONNECTED WORKFLOWS</span><i /><span>BUILT AROUND YOUR PROCESS</span></div>
        </section>

        <div className="preview-stage"><div className="page-container"><ProductPreview /></div></div>

        <section className="problem-section section-pad">
          <div className="page-container">
            <div className="section-intro split-intro">
              <div><span className="section-index">01 / THE REALITY</span><h2>Precision work deserves <em>clearer systems.</em></h2></div>
              <p>Good work can slow down when its information is scattered. Teams spend too much time searching, checking, and following up—before the work can move forward.</p>
            </div>
            <div className="problem-grid">
              {problems.map(({ icon: Icon, title, description }, index) => <article className="problem-card" key={title}>
                <div className="problem-card-top"><span className="problem-number">0{index + 1}</span><Icon size={19} strokeWidth={1.6} /></div>
                <h3>{title}</h3><p>{description}</p><span className="card-bottom-rule" />
              </article>)}
            </div>
            <div className="problem-footer"><span className="tiny-cross">＋</span><span>More visibility. Fewer avoidable handoffs.</span><span className="problem-footer-line" /></div>
          </div>
        </section>

        <section className="solution-section section-pad" id="platform">
          <div className="solution-pattern" aria-hidden="true" />
          <div className="page-container solution-container">
            <div className="solution-topline"><span className="section-index section-index-light">02 / THE PROTEUS APPROACH</span><span className="solution-chip"><CircleDot size={12} /> CONNECTED BY DESIGN</span></div>
            <div className="solution-heading"><h2>One connected view.<br /><em>Room for your way.</em></h2><p>PROTEUS brings the records behind the work together, then lets you shape the handoffs around your process.</p></div>
            <div className="solution-flow">
              <article className="flow-node"><span className="flow-node-number">01</span><div className="flow-node-icon"><FileCheck2 size={20} /></div><h3>Engineering records</h3><p>Drawings, revisions, and supporting documents stay connected to their parts.</p><span className="flow-node-tag">A CLEAR SOURCE OF RECORD</span></article>
              <div className="flow-connector"><span /><ArrowRight size={14} /></div>
              <article className="flow-node"><span className="flow-node-number">02</span><div className="flow-node-icon"><Link2 size={20} /></div><h3>Completeness checks</h3><p>See what is present, what is approved, and what a job still needs to move.</p><span className="flow-node-tag">THE RIGHT CONTEXT, LINKED</span></article>
              <div className="flow-connector"><span /><ArrowRight size={14} /></div>
              <article className="flow-node"><span className="flow-node-number">03</span><div className="flow-node-icon"><GitBranch size={20} /></div><h3>Configurable workflows</h3><p>Set up practical steps and handoffs that reflect how your factory operates.</p><span className="flow-node-tag">YOUR PROCESS, MADE VISIBLE</span></article>
            </div>
            <div className="solution-foot"><span>LESS SEARCHING</span><span>MORE SHARED CONTEXT</span><span>WORK THAT CAN MOVE</span></div>
          </div>
        </section>

        <section className="capabilities-section section-pad" id="product">
          <div className="page-container">
            <div className="section-intro capability-intro">
              <div><span className="section-index">03 / WHAT COMES TOGETHER</span><h2>Built around the <em>work itself.</em></h2></div>
              <p>Start with the records and workflows your team needs to keep work accurate, traceable, and moving.</p>
            </div>
            <div className="capability-grid">
              {capabilities.map(({ number, icon: Icon, title, description, detail }) => <article className="capability-card" key={number}>
                <div className="capability-top"><span>{number}</span><Icon size={20} strokeWidth={1.6} /></div>
                <h3>{title}</h3><p>{description}</p><div className="capability-detail"><Check size={13} /><span>{detail}</span></div>
                <span className="capability-arrow"><ArrowUpRight size={16} /></span>
              </article>)}
            </div>
          </div>
        </section>

        <section className="difference-section section-pad" id="about">
          <div className="page-container difference-grid">
            <div className="difference-visual" aria-hidden="true">
              <div className="diagram-frame"><span className="diagram-label label-top">PART / AP-1001</span><span className="diagram-label label-bottom">RELATIONSHIP MAP · SYNTHETIC</span>
                <div className="diagram-orbit orbit-large" /><div className="diagram-orbit orbit-small" />
                <div className="diagram-node node-drawing"><FileCheck2 size={17} /><span>Drawing<br /><b>DWG-AP-1001 · Rev C</b></span></div>
                <div className="diagram-node node-part"><Layers3 size={18} /><span>Part record<br /><b>AP-1001</b></span></div>
                <div className="diagram-node node-order"><ClipboardCheck size={17} /><span>Production order<br /><b>MO-2026-0142</b></span></div>
                <div className="diagram-center"><span>LINKED</span><i /></div>
                <svg className="diagram-connectors" viewBox="0 0 500 360" fill="none"><path d="M250 180 126 106M250 180l124-74M250 180v112" stroke="currentColor" strokeWidth="1" strokeDasharray="4 5" /></svg>
              </div>
            </div>
            <div className="difference-copy"><span className="section-index">04 / SOFTWARE SHOULD FIT</span><h2>Your company has its own <em>way of working.</em></h2><p className="difference-lead">Your processes reflect the way your team works. PROTEUS is being shaped around configurable records and handoffs, with precision manufacturing as the first detailed demonstration.</p>
              <ul className="difference-list"><li><span><Check size={13} /></span>Keep engineering context close to the work</li><li><span><Check size={13} /></span>Make revision status easier to understand</li><li><span><Check size={13} /></span>Configure the steps that suit your operation</li></ul>
              <a className="inline-link" href="#contact">See how PROTEUS fits <ArrowRight size={15} /></a>
            </div>
          </div>
        </section>

        <section className="trust-section section-pad" aria-labelledby="trust-title">
          <div className="page-container">
            <div className="section-intro split-intro"><div><span className="section-index">05 / BUILT WITH CLEAR LIMITS</span><h2 id="trust-title">Useful direction.<br /><em>Honest boundaries.</em></h2></div><p>PROTEUS is an early product concept. The demo is explicit about what works today and what remains a future direction.</p></div>
            <div className="trust-grid">
              <article className="trust-card"><BrainCircuit size={20} /><span>AI ASSISTANCE · CONCEPT PREVIEW</span><h3>Reduce repetitive information work.</h3><p>Future assistance could suggest document types, extract supplied metadata, or surface missing information. No AI model or external AI service is connected in this demo.</p></article>
              <article className="trust-card"><ShieldCheck size={20} /><span>SECURITY & DATA HANDLING</span><h3>Keep the demonstration data in view.</h3><p>Only fictional sample records are included. Changes you make are stored in this browser’s local storage. There is no authentication, server-side persistence, or production security review.</p></article>
            </div>
          </div>
        </section>

        <section className="contact-section" id="contact">
          <div className="contact-grid-lines" aria-hidden="true" />
          <div className="page-container contact-inner">
            <div><span className="section-index section-index-light">05 / START WITH THE WORK</span><h2>Make the next handoff<br /><em>feel more certain.</em></h2><p>Explore a sample workspace and see how connected records can support the way your team works.</p></div>
            <a className="contact-cta" href="/demo"><span className="contact-cta-icon"><ScanSearch size={20} /></span><span><b>Explore the live demo</b><small>Move through documents, orders, and more</small></span><ArrowUpRight size={18} /></a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
