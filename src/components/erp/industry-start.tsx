"use client";

import { useSearchParams } from "next/navigation";
import { useErp, useHydrated } from "@/components/erp/store";
import { IndustryCards } from "@/components/erp/industry-switch";
import { GuidedDemo } from "@/components/erp/guided";
import { PageHead, Rule } from "@/components/erp/ui";
import { INDUSTRY_KEYS, type Industry } from "@/lib/erp/model";
import { PACKS, industryOf } from "@/lib/erp/packs";
import Link from "next/link";

/** /demo/start: pick the industry demo. A link from the website can highlight one with ?industry=. */
export function IndustryStart() {
  const params = useSearchParams();
  const wanted = params.get("industry");
  const highlight = INDUSTRY_KEYS.includes(wanted as Industry) ? wanted as Industry : null;
  return <>
    <PageHead eyebrow="Demo" title="Choose your industry" description="The same BOH ERP, set up for three kinds of business. Each opens a fictional company with months of realistic data you can work with: ship orders, change plans, approve drawings, run payroll." />
    <IndustryCards highlight={highlight} />
    <div style={{ marginTop: 16 }}><Rule>Everything stays in this browser. Switching industry replaces the demo data here; nothing is sent anywhere.</Rule></div>
  </>;
}

/** /demo: the guided walkthrough follows a manufacturing order; other industries are pointed to their overview. */
export function GuidedOrPack() {
  const state = useErp();
  const hydrated = useHydrated();
  if (!hydrated || industryOf(state) === "manufacturing") return <GuidedDemo />;
  const pack = PACKS[industryOf(state)];
  return <>
    <PageHead eyebrow="Guided demo" title="The guided walkthrough is for manufacturing" description={`You are looking at ${pack.company.replace(/ \(demo\)$/, "")}, the ${pack.label.toLowerCase()} demo. Its overview shows what needs attention and where to start.`} />
    <div className="erp-head-actions"><Link className="erp-btn erp-btn-primary" href="/demo/overview">Open the {pack.label.toLowerCase()} overview</Link><Link className="erp-btn" href="/demo/start?industry=manufacturing">Switch to manufacturing</Link></div>
  </>;
}
