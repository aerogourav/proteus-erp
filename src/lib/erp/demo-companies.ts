/** The sample company a visitor starts with, per industry pack. */
import type { ErpState, Industry } from "./model.ts";
import { createDemoState } from "./seed.ts";
import { createCommerceDemoState } from "./seed-commerce.ts";
import { createSaasDemoState } from "./seed-saas.ts";

export function createIndustryDemoState(industry: Industry, now: string): ErpState {
  if (industry === "commerce") return createCommerceDemoState(now);
  if (industry === "saas") return createSaasDemoState(now);
  return createDemoState(now);
}
