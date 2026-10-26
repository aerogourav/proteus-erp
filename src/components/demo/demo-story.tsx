"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, FilePlus2, RotateCcw } from "lucide-react";
import { BohMark } from "@/components/brand/boh-logo";
import { useDemoConfiguration } from "@/components/demo/configuration-context";
import { useDemoBusinessRecords } from "@/components/demo/business-records-context";
import { DocumentCreateDialog } from "@/components/demo/document-create-dialog";
import { evaluateOrderCompleteness } from "@/lib/configuration-rules";
import { resetAllDemoData } from "@/lib/demo-reset";
import styles from "@/components/demo/demo.module.css";

const ORDER_ID = "mo-2026-0142";

const fixPreset = {
  typeId: "inspection-plan",
  partId: "ap-1001",
  orderId: ORDER_ID,
  title: "Mounting Bracket — Inspection Plan (Rev C)",
  revision: "C",
  status: "Approved" as const,
};

/** The guided 3-minute story: one order, one changed drawing, one outdated document, one fix. */
export function DemoStory() {
  const { state, documents, ready: configReady } = useDemoConfiguration();
  const { parts, productionOrders, ready: recordsReady } = useDemoBusinessRecords();
  const [fixing, setFixing] = useState(false);
  const order = productionOrders.find((item) => item.id === ORDER_ID);
  const issues = order ? evaluateOrderCompleteness(order, state, documents, parts) : [];
  const ready = configReady && recordsReady;
  const clear = ready && Boolean(order) && issues.length === 0;

  return <section className={styles.storyCard} aria-labelledby="story-title">
    <div className={styles.storyHead}>
      <BohMark size={52} tone="dark" smile />
      <div>
        <span className={styles.storyEyebrow}>GUIDED DEMO · ABOUT 3 MINUTES</span>
        <h2 id="story-title">A drawing changed. Is order MO-2026-0142 safe to start?</h2>
        <p>Follow one order for 48 actuator mounting brackets through the linked records, find the problem and fix it.</p>
      </div>
      <div className={`${styles.storyStatus} ${clear ? styles.storyStatusClear : ""}`} role="status" aria-live="polite">
        {!ready ? <span>Loading…</span> : clear ? <><CheckCircle2 size={18} /><span><strong>All checks clear</strong><small>MO-2026-0142 · configured document checks</small></span></> : <><AlertTriangle size={18} /><span><strong>{issues.length === 1 ? "1 issue found" : `${issues.length} issues found`}</strong><small>MO-2026-0142 · configured document checks</small></span></>}
      </div>
    </div>
    <ol className={styles.storySteps}>
      <li><span>1</span><Link href={`/demo/classic/production/${ORDER_ID}`}><strong>Open the order</strong><small>48 × AP-1001, revision C. See why it is flagged.</small><ArrowRight size={14} /></Link></li>
      <li><span>2</span><Link href="/demo/classic/parts/ap-1001"><strong>Check the part</strong><small>The drawing moved to revision C. All linked records sit on the part.</small><ArrowRight size={14} /></Link></li>
      <li><span>3</span><Link href="/demo/classic/documents/insp-ap-1001"><strong>Find the outdated document</strong><small>The inspection plan is still on revision A.</small><ArrowRight size={14} /></Link></li>
      <li><span>4</span><button type="button" onClick={() => setFixing(true)} disabled={!ready || clear}><strong>{clear ? "Fixed" : "Fix it"}</strong><small>{clear ? "An approved inspection plan for revision C is linked." : "Add the approved inspection plan for revision C."}</small><FilePlus2 size={14} /></button></li>
      <li><span>5</span><Link href={`/demo/classic/production/${ORDER_ID}`}><strong>Confirm the result</strong><small>Back on the order, the check updates immediately.</small><ArrowRight size={14} /></Link></li>
    </ol>
    <div className={styles.storyFoot}>
      <span>Want more? <Link href="/demo/classic/configuration">Change a rule</Link> and see which orders are affected.</span>
      <button type="button" onClick={resetAllDemoData}><RotateCcw size={14} /> Restart demo</button>
    </div>
    {fixing && <DocumentCreateDialog preset={fixPreset} onClose={() => setFixing(false)} />}
  </section>;
}
