"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  AlertTriangle, ArrowRight, CalendarDays, Check, CheckCircle2, CircleDashed, ClipboardList, Cog, FileCheck2, FileText,
  Layers3, PackageCheck, Pause, Play, RotateCcw, Search, Send, ShieldCheck, Users,
} from "lucide-react";
import { BohMark } from "@/components/brand/boh-logo";
import { PageHeader, StatusPill } from "@/components/demo/demo-ui";
import {
  JOURNEY_STORAGE_KEY, allJourneyTaskIds, costLines, costTotal, formatEur, inspectionResults, inspectionSample, journeyOrder, journeyStages,
  marginRate, materialFreeStockKg, materialRequiredKg, materialShortageKg, operations, purchaseQuantityKg, quoteTotal, unitPrice,
  type JourneyStage,
} from "@/lib/journey-data";
import { DEMO_COMPANY } from "@/lib/demo-data";
import styles from "@/components/demo/demo.module.css";

/* ---------- Browser-local journey store ---------- */
const EMPTY: string[] = [];
const listeners = new Set<() => void>();
let cache: string[] | null = null;

function readDone(): string[] {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(JOURNEY_STORAGE_KEY) ?? "[]");
    cache = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && allJourneyTaskIds.includes(id)) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function writeDone(next: string[]) {
  cache = next;
  try { window.localStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(next)); } catch { /* Keep working in memory if storage is blocked. */ }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const stageIcons: Record<JourneyStage["id"], typeof Users> = {
  lead: Users, feasibility: Search, quote: FileText, order: FileCheck2, engineering: Layers3, material: PackageCheck,
  planning: CalendarDays, production: Cog, quality: ShieldCheck, dispatch: Send, invoice: ClipboardList,
};

const stageStatus: Record<JourneyStage["id"], string> = {
  lead: "Enquiry", feasibility: "Under review", quote: "Quoting", order: "Order entry", engineering: "Engineering release",
  material: "Material planning", planning: "Planning", production: "In production", quality: "Final inspection", dispatch: "Ready to ship", invoice: "Invoicing",
};

export function OrderJourney() {
  const done = useSyncExternalStore(subscribe, readDone, () => EMPTY);
  const doneSet = new Set(done);
  const currentIndex = journeyStages.findIndex((stage) => stage.tasks.some((task) => !doneSet.has(task.id)));
  const finished = currentIndex === -1;
  const [selected, setSelected] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const viewIndex = selected ?? (finished ? journeyStages.length - 1 : currentIndex);
  const stage = journeyStages[viewIndex];
  const nextTask = finished ? undefined : journeyStages[currentIndex].tasks.find((task) => !doneSet.has(task.id));
  const progress = Math.round((done.length / allJourneyTaskIds.length) * 100);

  const advance = useCallback(() => {
    const current = readDone();
    const next = allJourneyTaskIds.find((id) => !current.includes(id));
    if (!next) { setPlaying(false); return; }
    writeDone([...current, next]);
    setSelected(null);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(advance, 1400);
    return () => window.clearInterval(timer);
  }, [playing, advance]);

  const restart = () => { setPlaying(false); setSelected(null); writeDone([]); };
  const Icon = stageIcons[stage.id];
  const viewingCurrent = viewIndex === currentIndex;

  return <>
    <PageHeader eyebrow={`${DEMO_COMPANY.name} · Fictional demo`} title="Order journey" description="Follow one customer order from first enquiry to dispatch. Every step creates a record, and every hand-off is checked before work moves on." meta="SIMULATION" />

    <section className={`${styles.card} ${styles.journeyBar}`} aria-label="Journey progress">
      <div className={styles.journeyBarHead}>
        <div><strong>{journeyOrder.quantity} × {journeyOrder.partNumber} {journeyOrder.partName}</strong><small>{journeyOrder.customer} · requested {journeyOrder.requestedDelivery}</small></div>
        <div className={styles.journeyControls}>
          <span className={styles.journeyPercent}>{progress}%</span>
          {!finished && <button type="button" className={styles.configAction} onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? "Pause" : "Auto-play"}</button>}
          <button type="button" className={styles.configAction} onClick={restart}><RotateCcw size={14} /> Restart</button>
        </div>
      </div>
      <div className={styles.journeyTrack} aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
      <ol className={styles.journeySteps}>
        {journeyStages.map((item, index) => {
          const StageIcon = stageIcons[item.id];
          const complete = item.tasks.every((task) => doneSet.has(task.id));
          const locked = !finished && index > currentIndex;
          const state = complete ? styles.journeyStepDone : index === currentIndex ? styles.journeyStepCurrent : "";
          return <li key={item.id}>
            <button type="button" className={`${styles.journeyStep} ${state}`} disabled={locked} aria-current={index === viewIndex ? "step" : undefined} onClick={() => setSelected(index)}>
              <span>{complete ? <Check size={14} /> : <StageIcon size={14} />}</span>
              <small>{item.name}</small>
            </button>
          </li>;
        })}
      </ol>
    </section>

    {finished && <section className={styles.journeyDone} role="status">
      <BohMark size={48} tone="dark" smile />
      <div><strong>Delivered and invoiced, 4 days before the due date.</strong><span>21 days from first enquiry to dispatch, with every document, check and hand-off on record.</span></div>
      <button type="button" onClick={restart}><RotateCcw size={14} /> Run it again</button>
    </section>}

    <div className={styles.journeyGrid}>
      <section className={`${styles.card} ${styles.journeyStage}`} aria-labelledby="journey-stage-title">
        <header className={styles.journeyStageHead}>
          <span className={styles.journeyStageIcon}><Icon size={20} /></span>
          <div>
            <small>Step {viewIndex + 1} of {journeyStages.length}</small>
            <h2 id="journey-stage-title">{stage.name}</h2>
            <p>{stage.summary}</p>
          </div>
        </header>

        <ul className={styles.journeyTasks}>
          {stage.tasks.map((task) => {
            const complete = doneSet.has(task.id);
            const isNext = nextTask?.id === task.id;
            return <li key={task.id} className={complete ? styles.journeyTaskDone : isNext ? styles.journeyTaskNext : ""}>
              <span className={styles.journeyTaskIcon}>{complete ? <Check size={14} /> : isNext ? <ArrowRight size={14} /> : <CircleDashed size={14} />}</span>
              <span className={styles.journeyTaskText}><strong>{task.label}</strong><small>{task.role}{complete ? ` · ${task.date}` : ""}</small></span>
            </li>;
          })}
        </ul>

        <div className={styles.journeyDetail}><StageDetail id={stage.id} done={doneSet} /></div>

        <footer className={styles.journeyStageFoot}>
          {viewingCurrent && nextTask ? <>
            <span>Next: <b>{nextTask.role}</b></span>
            <button type="button" className={styles.journeyPrimary} onClick={advance}>{nextTask.action} <ArrowRight size={16} /></button>
          </> : finished || viewIndex < currentIndex ? <span className={styles.journeyStageComplete}><CheckCircle2 size={16} /> Stage complete</span> : null}
          {selected !== null && !finished && viewIndex !== currentIndex && <button type="button" className={styles.configAction} onClick={() => setSelected(null)}>Back to current step</button>}
        </footer>
      </section>

      <aside className={styles.journeySide}>
        <section className={`${styles.card} ${styles.journeyRecord}`} aria-label="Order record">
          <h3>Order record</h3>
          <dl>
            <Row label="Status" value={finished ? "Delivered · invoiced" : stageStatus[journeyStages[currentIndex].id]} />
            <Row label="Customer" value={journeyOrder.customer} />
            <Row label="Contact" value={`${journeyOrder.contact} · ${journeyOrder.contactRole}`} />
            <Row label="Part" value={`${journeyOrder.partNumber} rev ${journeyOrder.revision}`} />
            <Row label="Quantity" value={`${journeyOrder.quantity} pcs`} />
            <Row label="Value" value={doneSet.has("quote-send") ? formatEur(quoteTotal) : "—"} />
            <Row label="Customer PO" value={doneSet.has("order-po") ? journeyOrder.customerPo : "—"} />
            <Row label="Sales order" value={doneSet.has("order-confirm") ? journeyOrder.salesOrder : "—"} />
            <Row label="Production order" value={doneSet.has("order-confirm") ? journeyOrder.productionOrder : "—"} />
            <Row label="Due" value={journeyOrder.requestedDelivery} />
          </dl>
        </section>
        <section className={`${styles.card} ${styles.journeyLog}`} aria-label="Audit trail">
          <h3>Audit trail</h3>
          {done.length ? <ol>{[...journeyStages.flatMap((item) => item.tasks)].filter((task) => doneSet.has(task.id)).reverse().map((task) => <li key={task.id}><small>{task.date} · {task.role}</small><span>{task.event}</span></li>)}</ol> : <p>Every action you take is recorded here with time and role.</p>}
        </section>
      </aside>
    </div>
  </>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className={styles.journeyRow}><dt>{label}</dt><dd>{value}</dd></div>;
}

function Check2({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <li className={ok ? styles.gateOk : styles.gateOpen}>{ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}<span>{children}</span></li>;
}

function StageDetail({ id, done }: { id: JourneyStage["id"]; done: Set<string> }) {
  switch (id) {
    case "lead":
      return <div className={styles.journeyMail}>
        <small>Website enquiry · {journeyOrder.enquiryId}</small>
        <strong>{journeyOrder.contact}, {journeyOrder.customer}</strong>
        <p>“We need {journeyOrder.quantity} linear guide carriage plates in 6082-T6, black anodised, to drawing AP-2040 rev A. Delivery to Stuttgart by {journeyOrder.requestedDelivery}. Can you quote?”</p>
        <ul className={styles.gateList}>
          <Check2 ok={done.has("lead-qualify")}>Quantity, material and finish specified</Check2>
          <Check2 ok={done.has("lead-qualify")}>Delivery date inside the available capacity window</Check2>
          <Check2 ok={done.has("lead-qualify")}>Existing customer with good payment history</Check2>
        </ul>
      </div>;
    case "feasibility":
      return <>
        <table className={styles.journeyTable}><thead><tr><th>Critical feature</th><th>Requirement</th><th>Capability</th></tr></thead><tbody>
          {inspectionResults.slice(0, 5).map((row) => <tr key={row.feature}><td>{row.feature}</td><td>{row.tolerance}</td><td>{done.has("feas-review") ? "Within capability" : "To review"}</td></tr>)}
        </tbody></table>
        <ul className={styles.gateList}>
          <Check2 ok={done.has("feas-ok")}>5-axis machining on DMU 50</Check2>
          <Check2 ok={done.has("feas-ok")}>CMM available for bore and flatness</Check2>
          <Check2 ok={done.has("feas-ok")}>Approved anodising subcontractor</Check2>
        </ul>
      </>;
    case "quote":
      return <>
        <table className={styles.journeyTable}><thead><tr><th>Cost element</th><th>Basis</th><th className={styles.num}>Amount</th></tr></thead><tbody>
          {costLines.map((line) => <tr key={line.label}><td>{line.label}</td><td>{line.detail}</td><td className={styles.num}>{done.has("quote-build") ? formatEur(line.amount) : "—"}</td></tr>)}
          <tr className={styles.totalRow}><td>Total cost</td><td>Margin {Math.round(marginRate * 100)}%</td><td className={styles.num}>{done.has("quote-build") ? formatEur(costTotal) : "—"}</td></tr>
          <tr className={styles.totalRow}><td>Quote {journeyOrder.quoteId}</td><td>{done.has("quote-build") ? `${formatEur(unitPrice)} per piece` : "—"}</td><td className={styles.num}>{done.has("quote-build") ? formatEur(quoteTotal) : "—"}</td></tr>
        </tbody></table>
        {done.has("quote-accept") && <p className={styles.journeyNote}><CheckCircle2 size={15} /> Accepted by the customer on 5 Nov.</p>}
      </>;
    case "order": {
      const fixed = done.has("order-fix");
      const received = done.has("order-po");
      return <>
        <table className={styles.journeyTable}><thead><tr><th>Check</th><th>Quote</th><th>Customer PO</th><th>Result</th></tr></thead><tbody>
          <tr><td>Part / revision</td><td>AP-2040 rev A</td><td>{received ? (fixed ? "AP-2040 rev A" : "AP-2040 rev B") : "—"}</td><td>{received ? <StatusPill status={fixed ? "Approved" : "Blocked"} /> : "—"}</td></tr>
          <tr><td>Quantity</td><td>120</td><td>{received ? "120" : "—"}</td><td>{received ? <StatusPill status="Approved" /> : "—"}</td></tr>
          <tr><td>Unit price</td><td>{formatEur(unitPrice)}</td><td>{received ? formatEur(unitPrice) : "—"}</td><td>{received ? <StatusPill status="Approved" /> : "—"}</td></tr>
          <tr><td>Delivery</td><td>{journeyOrder.requestedDelivery}</td><td>{received ? journeyOrder.requestedDelivery : "—"}</td><td>{received ? <StatusPill status="Approved" /> : "—"}</td></tr>
        </tbody></table>
        {received && !fixed && <p className={`${styles.journeyNote} ${styles.journeyWarn}`}><AlertTriangle size={15} /> The PO asks for revision B, but only revision A exists and was quoted. The order cannot be confirmed until this is resolved.</p>}
      </>;
    }
    case "engineering":
      return <table className={styles.journeyTable}><thead><tr><th>Document</th><th>Revision</th><th>Status</th></tr></thead><tbody>
        <tr><td>Drawing DWG-AP-2040</td><td>A</td><td><StatusPill status={done.has("eng-drawing") ? "Approved" : "In review"} /></td></tr>
        <tr><td>CAM program CNC-AP-2040</td><td>A</td><td><StatusPill status={done.has("eng-cam") ? "Approved" : "Draft"} /></td></tr>
        <tr><td>Setup sheet SET-AP-2040</td><td>A</td><td><StatusPill status={done.has("eng-cam") ? "Approved" : "Draft"} /></td></tr>
        <tr><td>Inspection plan INSP-AP-2040</td><td>A</td><td><StatusPill status={done.has("eng-insp") ? "Approved" : "Draft"} /></td></tr>
      </tbody></table>;
    case "material": {
      const received = done.has("mat-receive");
      const free = received ? materialFreeStockKg + purchaseQuantityKg : materialFreeStockKg;
      return <>
        <div className={styles.journeyStock}>
          <div><small>Required</small><strong>{materialRequiredKg.toFixed(1)} kg</strong></div>
          <div><small>Free stock</small><strong>{free.toFixed(1)} kg</strong></div>
          <div><small>{received ? "Reserved" : "Shortage"}</small><strong className={received ? "" : styles.journeyWarnText}>{received ? (done.has("mat-reserve") ? `${materialRequiredKg.toFixed(1)} kg` : "—") : `${materialShortageKg.toFixed(1)} kg`}</strong></div>
        </div>
        <ul className={styles.gateList}>
          <Check2 ok={done.has("mat-po")}>Purchase order {journeyOrder.purchaseOrder} · {purchaseQuantityKg} kg to {journeyOrder.supplier}</Check2>
          <Check2 ok={received}>EN 10204 3.1 certificate matches heat number</Check2>
          <Check2 ok={done.has("mat-reserve")}>Material reserved for {journeyOrder.productionOrder}</Check2>
        </ul>
      </>;
    }
    case "planning":
      return <>
        <table className={styles.journeyTable}><thead><tr><th>Op</th><th>Operation</th><th>Resource</th><th>Window</th></tr></thead><tbody>
          {operations.map((op) => <tr key={op.op}><td>{op.op}</td><td>{op.name}</td><td>{op.resource}</td><td>{done.has("plan-schedule") ? op.window : "—"}</td></tr>)}
        </tbody></table>
        <p className={styles.journeySubhead}>Release checks</p>
        <ul className={styles.gateList}>
          <Check2 ok={done.has("eng-insp")}>All production documents approved</Check2>
          <Check2 ok={done.has("mat-reserve")}>Certified material reserved</Check2>
          <Check2 ok={done.has("plan-schedule")}>Capacity booked on DMU 50 for 10–12 Nov</Check2>
        </ul>
      </>;
    case "production":
      return <>
        <table className={styles.journeyTable}><thead><tr><th>Op</th><th>Operation</th><th>Status</th></tr></thead><tbody>
          <tr><td>10</td><td>Saw blanks</td><td><StatusPill status={done.has("prod-10") ? "Complete" : "In progress"} /></td></tr>
          <tr><td>20</td><td>5-axis milling</td><td><StatusPill status={done.has("prod-20") ? "Complete" : done.has("prod-fai") ? "In progress" : done.has("prod-10") ? "On hold" : "Queued"} /></td></tr>
          <tr><td>30</td><td>Deburr &amp; clean</td><td><StatusPill status={done.has("prod-30") ? "Complete" : "Queued"} /></td></tr>
          <tr><td>40</td><td>Black anodising (outside)</td><td><StatusPill status={done.has("prod-40") ? "Complete" : "Queued"} /></td></tr>
        </tbody></table>
        {done.has("prod-10") && !done.has("prod-fai") && <p className={`${styles.journeyNote} ${styles.journeyWarn}`}><AlertTriangle size={15} /> Series machining is held until the first article passes inspection.</p>}
      </>;
    case "quality":
      return <>
        <table className={styles.journeyTable}><thead><tr><th>Feature</th><th>Tolerance</th><th className={styles.num}>Measured (worst of {inspectionSample})</th><th>Result</th></tr></thead><tbody>
          {inspectionResults.map((row) => <tr key={row.feature}><td>{row.feature}</td><td>{row.tolerance}</td><td className={styles.num}>{done.has("qa-inspect") ? row.measured : "—"}</td><td>{done.has("qa-inspect") ? <StatusPill status={row.ok ? "Approved" : "Blocked"} /> : "—"}</td></tr>)}
        </tbody></table>
        {done.has("qa-coc") && <p className={styles.journeyNote}><CheckCircle2 size={15} /> Certificate of conformity CoC-2026-0412 issued.</p>}
      </>;
    case "dispatch":
      return <>
        <p className={styles.journeySubhead}>Dispatch checks</p>
        <ul className={styles.gateList}>
          <Check2 ok={done.has("qa-inspect")}>Final inspection passed</Check2>
          <Check2 ok={done.has("qa-coc")}>Certificate of conformity attached</Check2>
          <Check2 ok={done.has("mat-receive")}>3.1 material certificate attached</Check2>
          <Check2 ok={done.has("disp-pack")}>Packed: 120 pcs in 2 crates, packing list printed</Check2>
          <Check2 ok={done.has("disp-ship")}>Delivery note {journeyOrder.deliveryNote} signed by carrier</Check2>
        </ul>
      </>;
    case "invoice": {
      const vat = Math.round(quoteTotal * 0.19 * 100) / 100;
      return <table className={styles.journeyTable}><tbody>
        <tr><td>{journeyOrder.quantity} × {journeyOrder.partNumber} at {formatEur(unitPrice)}</td><td className={styles.num}>{formatEur(quoteTotal)}</td></tr>
        <tr><td>VAT 19%</td><td className={styles.num}>{formatEur(vat)}</td></tr>
        <tr className={styles.totalRow}><td>Invoice {journeyOrder.invoice} · due in 30 days</td><td className={styles.num}>{formatEur(quoteTotal + vat)}</td></tr>
      </tbody></table>;
    }
  }
}
