"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowRight, Route, X } from "lucide-react";
import styles from "@/components/demo/demo.module.css";

const dismissedKey = "proteus-demo-guide-dismissed";
const changedEvent = "proteus-demo-guide-change";

function subscribe(callback: () => void) {
  window.addEventListener(changedEvent, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(changedEvent, callback);
    window.removeEventListener("storage", callback);
  };
}

function getDismissed() {
  try { return window.sessionStorage.getItem(dismissedKey) === "true"; }
  catch { return false; }
}

function dismissGuide() {
  try { window.sessionStorage.setItem(dismissedKey, "true"); }
  catch { /* The guide can still be dismissed for this mounted session. */ }
  window.dispatchEvent(new Event(changedEvent));
}

export function GuidedDemo() {
  const dismissed = useSyncExternalStore(subscribe, getDismissed, () => false);
  if (dismissed) return null;

  return <section className={styles.guideCard} aria-labelledby="guide-title">
    <div className={styles.guideTop}><span><Route size={15} /> OPTIONAL WALKTHROUGH · SYNTHETIC RECORDS</span><button type="button" onClick={dismissGuide} aria-label="Dismiss guided demo"><X size={15} /></button></div>
    <div className={styles.guideIntro}><h2 id="guide-title">A drawing changed. What should you check?</h2><p>Follow the sample part and order, inspect their linked records, then adjust a rule and see the browser-local evaluation update. Nothing is sent to a production system.</p></div>
    <ol className={styles.guideSteps}>
      <li><span>01</span><Link href="/demo/parts/ap-1001"><strong>Open AP-1001</strong><small>Inspect its part record and current revision.</small><ArrowRight size={14} /></Link></li>
      <li><span>02</span><Link href="/demo/documents/dwg-ap-1001"><strong>Inspect the drawing record</strong><small>Review revision C metadata and its linked order.</small><ArrowRight size={14} /></Link></li>
      <li><span>03</span><Link href="/demo/documents/insp-ap-1001"><strong>Follow linked documents</strong><small>Find the outdated inspection-plan reference.</small><ArrowRight size={14} /></Link></li>
      <li><span>04</span><Link href="/demo/production/mo-2026-0142"><strong>Open MO-2026-0142</strong><small>Read its exact completeness warning.</small><ArrowRight size={14} /></Link></li>
      <li><span>05</span><Link href="/demo/configuration"><strong>Change a rule</strong><small>Choose which statuses satisfy the sample requirement.</small><ArrowRight size={14} /></Link></li>
      <li><span>06</span><Link href="/demo/production/mo-2026-0142"><strong>Compare the evaluation</strong><small>Return to the order after changing the rule.</small><ArrowRight size={14} /></Link></li>
      <li><span>07</span><Link href="/demo/materials#lot-al6082-2409"><strong>Trace a material lot</strong><small>Follow its supplier and synthetic certificate reference.</small><ArrowRight size={14} /></Link></li>
      <li><span>08</span><Link href="/demo/crm"><strong>Explore connected companies</strong><small>See a sample customer and its related production work.</small><ArrowRight size={14} /></Link></li>
      <li><span>09</span><Link href="/demo/parts/ap-1001"><strong>Review the relationship map</strong><small>Return to part context and revision impact.</small><ArrowRight size={14} /></Link></li>
    </ol>
    <div className={styles.guideFoot}>Exit any time with “Dismiss guide.” Your changes stay in this browser until you reset the demo.</div>
  </section>;
}
