"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Factory, Repeat, ShoppingBag, Shuffle } from "lucide-react";
import { switchIndustry, useErp, useHydrated } from "@/components/erp/store";
import { Modal } from "@/components/erp/ui";
import { INDUSTRY_KEYS, type Industry } from "@/lib/erp/model";
import { PACKS, industryOf } from "@/lib/erp/packs";

export const INDUSTRY_ICON: Record<Industry, typeof Factory> = { manufacturing: Factory, commerce: ShoppingBag, saas: Repeat };

/** The three industry demos as cards. Choosing one opens its sample company. */
export function IndustryCards({ highlight, onPicked }: { highlight?: Industry | null; onPicked?: () => void }) {
  const state = useErp();
  const hydrated = useHydrated();
  const router = useRouter();
  const current = hydrated ? industryOf(state) : null;
  const open = (industry: Industry) => {
    if (industry !== current) switchIndustry(industry);
    onPicked?.();
    router.push("/demo/overview");
  };
  return <div className="erp-industries">
    {INDUSTRY_KEYS.map((key) => {
      const pack = PACKS[key];
      const Icon = INDUSTRY_ICON[key];
      return <button key={key} type="button" className={`erp-industry is-${key}${highlight === key ? " is-highlight" : ""}`} aria-current={current === key ? "true" : undefined} onClick={() => open(key)}>
        <span className="erp-industry-icon" aria-hidden="true"><Icon size={22} /></span>
        <b>{pack.label}</b>
        <span>{pack.tagline}</span>
        <small>{current === key ? "You are here · open" : `Open ${pack.company.replace(/ \(demo\)$/, "")}`}</small>
      </button>;
    })}
  </div>;
}

/** Compact button that opens the industry picker. */
export function IndustrySwitch({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className={`erp-btn${compact ? " erp-btn-sm" : ""}`} onClick={() => setOpen(true)}><Shuffle size={14} /> Switch industry</button>
    {open && <Modal label="Choose an industry" onClose={() => setOpen(false)} wide>
      <div className="erp-dialog-panel" style={{ width: "100%" }}>
        <h2>See BOH ERP for your industry</h2>
        <p style={{ marginTop: 6 }}>Same platform, set up for a different kind of business, each with its own sample company. Switching replaces the demo data in this browser; export a backup in Configuration first if you want to keep your changes.</p>
        <div style={{ marginTop: 18 }}><IndustryCards onPicked={() => setOpen(false)} /></div>
      </div>
    </Modal>}
  </>;
}
