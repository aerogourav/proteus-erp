/**
 * Industry packs: one shared core, configured per industry. A pack decides which tabs are on, what they are
 * called by default and which sample company a visitor starts with. It never forks the data model.
 */
import { DEFAULT_TABS, type ErpState, type Industry, type TabConfig, type TabKey } from "./model.ts";

export type Pack = {
  key: Industry;
  label: string;
  tagline: string;
  company: string;
  tabs: TabKey[];
  /** Default tab names that differ in this industry. A name the visitor changed is always kept. */
  labels: Partial<Record<TabKey, string>>;
};

const MANUFACTURING_TABS: TabKey[] = ["overview", "guided", "inbox", "projects", "crm", "quotations", "sales", "parts", "documents", "rawMaterials", "purchasing", "suppliers", "production", "shopFloor", "quality", "dispatch", "finance", "people", "configuration"];

export const PACKS: Record<Industry, Pack> = {
  manufacturing: {
    key: "manufacturing", label: "Manufacturing", company: "Harmonie Präzisionstechnik GmbH (demo)",
    tagline: "Customer orders, drawings and revisions, purchasing, production, shop floor, inspection, dispatch and invoicing.",
    tabs: MANUFACTURING_TABS, labels: {},
  },
  commerce: {
    key: "commerce", label: "E-commerce & wholesale", company: "Fjord & Fern Home Goods (demo)",
    tagline: "Products and variants, stock per warehouse, orders from every channel, pick, pack and ship, returns and invoicing.",
    tabs: ["overview", "inbox", "fulfilment", "products", "crm", "suppliers", "documents", "finance", "people", "configuration"],
    labels: { crm: "Customers" },
  },
  saas: {
    key: "saas", label: "Software & SaaS", company: "Northwind Analytics (demo)",
    tagline: "Plans and seats, subscriptions, monthly recurring revenue, renewals and churn, recurring invoices and customer support.",
    tabs: ["overview", "inbox", "subscriptions", "crm", "support", "documents", "finance", "people", "configuration"],
    labels: { crm: "Customers" },
  },
};

export const industryOf = (state: ErpState): Industry => state.settings.industry ?? "manufacturing";
export const packOf = (state: ErpState) => PACKS[industryOf(state)];

const DEFAULT_LABEL = new Map(DEFAULT_TABS.map((tab) => [tab.key, tab.label]));

/** The visitor's tabs (their order, names and visibility) limited to the ones this industry uses. */
export function tabsFor(state: ErpState, tabs: TabConfig[] = state.settings.tabs): TabConfig[] {
  const pack = packOf(state);
  return tabs.filter((tab) => pack.tabs.includes(tab.key)).map((tab) => ({
    ...tab,
    label: tab.label === DEFAULT_LABEL.get(tab.key) ? pack.labels[tab.key] ?? tab.label : tab.label,
  }));
}
