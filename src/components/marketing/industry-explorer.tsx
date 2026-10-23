"use client";

import { useState } from "react";
import { Boxes, BriefcaseBusiness, Building2, PackageCheck, Rocket } from "lucide-react";

const industries = [
  { id: "manufacturing", icon: Boxes, name: "Manufacturing & engineering", summary: "Example workflows", workflows: ["Part and revision records", "Document review and approval steps", "Production order handoffs"] },
  { id: "distribution", icon: PackageCheck, name: "Trading & distribution", summary: "Potential workflows", workflows: ["Purchase and sales order handoffs", "Supplier and customer records", "Stock movement and exception review"] },
  { id: "services", icon: BriefcaseBusiness, name: "Professional & field services", summary: "Potential workflows", workflows: ["Client intake and project setup", "Field work assignment and completion", "Service review and billing handoff"] },
  { id: "commerce", icon: Building2, name: "E-commerce & product businesses", summary: "Potential workflows", workflows: ["Product information and change review", "Order fulfilment handoffs", "Supplier and returns workflows"] },
  { id: "startups", icon: Rocket, name: "Growing startups", summary: "Potential workflows", workflows: ["First structured customer records", "Repeatable internal approvals", "Operational handoffs as the team grows"] },
] as const;

export function IndustryExplorer() {
  const [selected, setSelected] = useState<(typeof industries)[number]["id"]>("manufacturing");
  const active = industries.find((industry) => industry.id === selected)!;
  return <div className="industry-explorer">
    <div className="industry-options" aria-label="Example business contexts">
      {industries.map(({ id, icon: Icon, name }) => <button key={id} type="button" aria-pressed={selected === id} className={`industry-option${selected === id ? " is-selected" : ""}`} onClick={() => setSelected(id)}><Icon size={18} strokeWidth={1.7} /><span>{name}</span></button>)}
    </div>
    <div className="industry-detail" aria-live="polite" aria-atomic="true">
      <span className="section-index">{active.summary.toUpperCase()} · ILLUSTRATIVE</span>
      <h3>{active.name}</h3>
      <p>A configurable platform could organize records and handoffs around workflows such as:</p>
      <ul>{active.workflows.map((workflow) => <li key={workflow}>{workflow}</li>)}</ul>
      <small>These are examples of possible applications, not finished industry products.</small>
    </div>
  </div>;
}
