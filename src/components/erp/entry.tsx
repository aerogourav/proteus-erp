"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Boxes, Factory, FileText, FolderKanban, PackageCheck, PlayCircle, Receipt, Settings2, ShieldCheck, ShoppingCart, Sparkles, Truck, Users,
} from "lucide-react";
import { commit, getState, nowIso, useErp, useHydrated } from "@/components/erp/store";
import { Badge } from "@/components/erp/ui";
import { STAGE_ORDER, WIZARD_STEPS, loadSample, projectStage } from "@/lib/erp/model";

const modules = [
  { icon: FolderKanban, name: "Projects", text: "The single record everything else links to." },
  { icon: Users, name: "CRM", text: "Customers, created once and reused." },
  { icon: ShoppingCart, name: "Sales orders", text: "Purchase orders received from customers." },
  { icon: Boxes, name: "Parts", text: "Part identities and their revisions." },
  { icon: FileText, name: "Documents", text: "Drawings, specs and plans with approval status." },
  { icon: PackageCheck, name: "Materials", text: "Material requirements and procurement." },
  { icon: Factory, name: "Production", text: "Production orders for eligible line items." },
  { icon: ShieldCheck, name: "Quality", text: "Inspection requirements and reports." },
  { icon: Truck, name: "Dispatch", text: "Delivery readiness and dispatch notes." },
  { icon: Receipt, name: "Invoices", text: "Invoices built from the order data." },
  { icon: Settings2, name: "Configuration", text: "Tax rate, currency and payment terms." },
];

export function DemoEntry() {
  const router = useRouter();
  const state = useErp();
  const hydrated = useHydrated();

  const exploreSample = () => {
    const result = loadSample(getState(), nowIso());
    commit(() => result.state);
    router.push(`/demo/projects/${result.projectId}`);
  };

  const projects = [...state.projects].reverse();

  return <div className="erp-entry">
    <section className="erp-card erp-hero" aria-labelledby="entry-title">
      <span className="erp-eyebrow">Interactive demo · about 5 minutes</span>
      <h1 id="entry-title">One project. One source of truth.</h1>
      <p>Create a project once and see how BOH ERP connects its information across sales, engineering, procurement, production, quality, and dispatch.</p>
      <div className="erp-choices">
        <button type="button" className="erp-choice" onClick={() => router.push("/demo/new")}>
          <span className="erp-choice-icon"><Sparkles size={20} /></span>
          <strong>Create a Project</strong>
          <span>Enter your project step by step and watch every department receive it live.</span>
          <em>{hydrated && state.draft ? `Resume draft · step ${state.draft.step + 1} of ${WIZARD_STEPS.length}` : "Start guided setup"} <ArrowRight size={14} style={{ verticalAlign: "-2px" }} /></em>
        </button>
        <button type="button" className="erp-choice" onClick={exploreSample}>
          <span className="erp-choice-icon"><PlayCircle size={20} /></span>
          <strong>Explore Sample Project</strong>
          <span>Open “Hydraulic Actuator Assembly” for Apex Aerospace GmbH, already in production.</span>
          <em>Open sample <ArrowRight size={14} style={{ verticalAlign: "-2px" }} /></em>
        </button>
      </div>
      <div className="erp-chain" aria-label="How records connect">
        <span>Customer</span>→<span>Purchase order</span>→<span>Project</span>→<span>Line items</span>→<span>Parts &amp; revisions</span>→<span>Production</span>→<span>Inspection</span>→<span>Dispatch</span>→<span>Invoice</span>
      </div>
    </section>

    {hydrated && projects.length > 0 && <section className="erp-card" aria-labelledby="your-projects">
      <div className="erp-card-head"><div><h2 id="your-projects">Projects in this demo</h2><p>Stored in this browser.</p></div><Link className="erp-link" href="/demo/projects">All projects</Link></div>
      <div className="erp-rows">
        {projects.slice(0, 5).map((project) => {
          const stage = projectStage(state, project.id);
          const progress = Math.round(((STAGE_ORDER.indexOf(stage) + 1) / STAGE_ORDER.length) * 100);
          return <Link key={project.id} href={`/demo/projects/${project.id}`} className="erp-row erp-row-click" style={{ gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr) 180px" }}>
            <span><strong>{project.name}</strong><small>{project.code}{project.isSample ? " · sample" : ""}</small></span>
            <span><Badge>{stage}</Badge></span>
            <span className="erp-progress" aria-label={`${progress}% through the order lifecycle`}><span className="erp-progress-bar"><span style={{ width: `${progress}%` }} /></span>{progress}%</span>
          </Link>;
        })}
      </div>
    </section>}

    <section aria-labelledby="modules-title">
      <h2 id="modules-title" style={{ fontSize: 18, marginBottom: 12 }}>What each module does</h2>
      <div className="erp-modules">{modules.map(({ icon: Icon, name, text }) => <div className="erp-card erp-module" key={name}><strong><Icon size={16} /> {name}</strong><span>{text}</span></div>)}</div>
      <p className="erp-faint" style={{ marginTop: 16 }}>Looking for the earlier demo? The <Link className="erp-link" href="/demo/classic">classic workspace</Link> and the <Link className="erp-link" href="/demo/classic/journey">order journey</Link> are still available.</p>
    </section>
  </div>;
}
