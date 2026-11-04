import { createHash } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { BohMark } from "@/components/brand/boh-logo";
import { ActionForm, DrawingForm, InspectionForm, type PlanRow } from "@/components/app/production-forms";
import {
  addOperationAction, addPartAction, addPersonAction, addPlanAction, approveDrawingAction, createOrderAction, endOperationAction, linkLotAction, overrideAction,
  receiveMaterialAction, resolveReviewAction, setStatusAction, startOperationAction, supersedeDrawingAction,
} from "@/app/app/production/actions";
import { pageMetadata } from "@/lib/seo";
import { loadWorkspace } from "@/lib/supabase/workspace";

export const metadata = pageMetadata("Job release", "Release, run and inspect production orders in your BOH ERP workspace.", "/app/production", { indexable: false });

type Part = { id: string; sku: string; name: string; revision: string | null };
type Material = { id: string; sku: string; name: string; unit: string };
type Drawing = { id: string; number: string; revision: string; status: string; name: string; linked_id: string | null; storage_path: string; content_sha256: string | null; approved_sha256: string | null; superseded_reason: string | null };
type Operation = { item_id: string; seq: number; name: string; work_center: string; setup_min: number; run_min_per_pc: number };
type Person = { id: string; code: string; name: string; active: boolean };
type Order = { id: string; number: string; item_id: string; revision: string; quantity: number; status: string; notes: string; release_override: { reason: string } | null; cost_snapshot: { labour: number } | null };
type Progress = { seq: number; name: string; incoming: number; booked: number; remaining: number; done: boolean; running: number };
type Active = { id: string; order_id: string; seq: number; person_id: string; started_at: string };
type Inspection = { id: number; order_id: string; characteristic: string; observed: string; unit: string; passed: boolean; tolerance: string; outcome: string | null; resolved_decision: string | null; resolution_reason: string | null; round: number; inspected_by: string | null; spec: string };
type Plan = PlanRow & { item_id: string; revision: string };
type Lot = { order_id: string; material: string; heat: string; certificate: string };

const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(iso));

export default function ProductionPage() {
  return <div className="app-panel"><Suspense fallback={<p className="erp-faint">Loading job release…</p>}><Production /></Suspense></div>;
}

async function Production() {
  await connection();
  const ws = await loadWorkspace();
  if (ws.state === "signed-out") redirect("/app/login");
  if (ws.state !== "ready") redirect("/app");
  const { supabase, company, role, user } = ws;
  const canWrite = role !== "viewer";
  const isAdmin = role === "owner" || role === "admin";
  const c = company.id;

  const [parts, materials, levels, drawings, operations, people, orders, actives, inspections, lots, activity, plans] = await Promise.all([
    supabase.from("items").select("id, sku, name, revision").eq("company_id", c).eq("kind", "part").order("sku"),
    supabase.from("items").select("id, sku, name, unit").eq("company_id", c).eq("kind", "material").order("sku"),
    supabase.from("stock_levels").select("item_id, on_hand").eq("company_id", c),
    supabase.from("files").select("id, number, revision, status, name, linked_id, storage_path, content_sha256, approved_sha256, superseded_reason").eq("company_id", c).eq("doc_type", "Drawing").order("created_at", { ascending: false }),
    supabase.from("routing_operations").select("item_id, seq, name, work_center, setup_min, run_min_per_pc").eq("company_id", c).order("seq"),
    supabase.from("people").select("id, code, name, active").eq("company_id", c).order("code"),
    supabase.from("production_orders").select("id, number, item_id, revision, quantity, status, notes, release_override, cost_snapshot").eq("company_id", c).order("created_at", { ascending: false }).limit(50),
    supabase.from("active_operations").select("id, order_id, seq, person_id, started_at").eq("company_id", c),
    supabase.from("inspections").select("id, order_id, characteristic, observed, unit, passed, tolerance, outcome, resolved_decision, resolution_reason, round, inspected_by, spec").eq("company_id", c).order("id"),
    supabase.from("material_lots").select("order_id, material, heat, certificate").eq("company_id", c),
    supabase.from("activity_log").select("id, at, summary").eq("company_id", c).in("module", ["production", "shopfloor", "quality", "documents"]).order("at", { ascending: false }).limit(12),
    supabase.from("inspection_plans").select("id, item_id, revision, characteristic, kind, lower_limit, upper_limit, unit, required_gauge, sample_size, spec_text").eq("company_id", c).order("position").order("characteristic"),
  ]);
  if (orders.error) return <><Top email={user.email} name={company.name} /><p className="erp-error" role="alert">Production records could not be loaded. If the production migration (20261105000000_production.sql) has not been run on this database yet, run it first.</p></>;

  const P = (parts.data ?? []) as Part[];
  const M = (materials.data ?? []) as Material[];
  const stock = new Map(((levels.data ?? []) as { item_id: string; on_hand: number }[]).map((row) => [row.item_id, Number(row.on_hand)]));
  const D = (drawings.data ?? []) as Drawing[];
  const O = (operations.data ?? []) as Operation[];
  const People = (people.data ?? []) as Person[];
  const Orders = (orders.data ?? []) as Order[];
  const A = (actives.data ?? []) as Active[];
  const I = (inspections.data ?? []) as Inspection[];
  const L = (lots.data ?? []) as Lot[];
  const PL = (plans.data ?? []) as Plan[];
  const planFor = (itemId: string, revision: string) => PL.filter((row) => row.item_id === itemId && row.revision.toUpperCase() === revision.toUpperCase());
  // Approval counts only while the stored file still has the fingerprint it was approved with: re-hashed here from Storage.
  const integrity = new Map(await Promise.all(D.filter((doc) => doc.status === "Approved").map(async (doc) => {
    const { data } = await supabase.storage.from("company-files").download(doc.storage_path);
    const live = data ? createHash("sha256").update(Buffer.from(await data.arrayBuffer())).digest("hex") : null;
    return [doc.id, Boolean(live && doc.approved_sha256 && live === doc.approved_sha256)] as const;
  })));
  const sku = (itemId: string) => P.find((part) => part.id === itemId)?.sku ?? "—";
  const person = (id: string) => People.find((item) => item.id === id);

  // Live rule results from the database for open orders.
  const open = Orders.filter((order) => order.status !== "Completed");
  const checks = new Map(await Promise.all(open.map(async (order) => {
    const [progress, gate, finish] = await Promise.all([
      supabase.rpc("order_progress", { target_order: order.id }),
      supabase.rpc("release_gate", { target_order: order.id }),
      supabase.rpc("completion_blocker", { target_order: order.id }),
    ]);
    return [order.id, { progress: (progress.data ?? []) as Progress[], gate: (gate.data as string | null) ?? null, finish: (finish.data as string | null) ?? null }] as const;
  })));

  const hidden = <input type="hidden" name="companyId" value={c} />;
  return <>
    <Top email={user.email} name={company.name} />
    <div className="erp-head"><div><span className="erp-eyebrow">Production</span><h1>Job release</h1>
      <p>A job starts only with an approved drawing for the ordered revision, a routing and its material in stock. A newer drawing revision stops further operations. Owners and admins can override with a reason. The database enforces these rules. Use anonymised or non-confidential data during the pilot.</p></div></div>

    <section className="erp-card" aria-labelledby="orders-title">
      <div className="erp-card-head"><div><h2 id="orders-title">Production orders</h2><p>Release check, status and progress come from the database rules.</p></div></div>
      {canWrite && P.length > 0 && M.length > 0 && <ActionForm action={createOrderAction} submit="Create order" className="app-inline-form app-form-6">
        {hidden}
        <div className="erp-field"><label htmlFor="mo-part">Part</label><select id="mo-part" name="partId" className="erp-select">{P.map((part) => <option key={part.id} value={part.id}>{part.sku} · {part.name}</option>)}</select></div>
        <div className="erp-field"><label htmlFor="mo-rev">Revision</label><input id="mo-rev" name="revision" className="erp-input" required maxLength={8} defaultValue={P[0]?.revision ?? ""} /></div>
        <div className="erp-field"><label htmlFor="mo-qty">Quantity</label><input id="mo-qty" name="quantity" className="erp-input" inputMode="numeric" required /></div>
        <div className="erp-field"><label htmlFor="mo-mat">Material</label><select id="mo-mat" name="materialId" className="erp-select">{M.map((item) => <option key={item.id} value={item.id}>{item.sku} ({stock.get(item.id) ?? 0} {item.unit} in stock)</option>)}</select></div>
        <div className="erp-field"><label htmlFor="mo-matq">Material needed</label><input id="mo-matq" name="materialQty" className="erp-input" inputMode="decimal" required /></div>
      </ActionForm>}
      {canWrite && (!P.length || !M.length) && <p className="erp-faint app-pad">Add a part and receive its material below first.</p>}
      <div className="app-orders">
        {Orders.map((order) => {
          const check = checks.get(order.id);
          const running = A.filter((item) => item.order_id === order.id);
          const done = order.status === "Completed";
          const results = I.filter((item) => item.order_id === order.id);
          return <article key={order.id} className="app-order">
            <header><div><strong>{order.number}</strong><small>{sku(order.item_id)} rev {order.revision} · {order.quantity} pcs{order.notes ? ` · ${order.notes}` : ""}</small></div><span className={`erp-badge ${done ? "erp-badge-ok" : order.status === "On hold" ? "erp-badge-warn" : "erp-badge-info"}`}>{order.status}</span></header>
            {check && <ol className="erp-opstrip" aria-label={`Operations of ${order.number}`}>{check.progress.map((op) => <li key={op.seq} className={op.done ? "is-done" : op.running ? "is-running" : op.booked ? "is-partial" : ""} title={`${op.booked} of ${op.incoming} booked`}><b>{op.seq}</b><span>{op.name}</span><small>{op.booked}/{op.incoming}</small></li>)}</ol>}
            {check?.gate && <p className="erp-gate" role="status"><b>Release check:</b> {check.gate}</p>}
            {order.release_override && <p className="erp-faint">Released by override: “{order.release_override.reason}”</p>}
            {!done && !check?.gate && check?.finish && order.status !== "Planned" && <p className="erp-faint">{check.finish}</p>}
            {done && order.cost_snapshot && <p className="erp-faint">Labour cost frozen at close: €{Number(order.cost_snapshot.labour).toFixed(2)}</p>}
            {L.filter((lot) => lot.order_id === order.id).map((lot) => <p key={lot.material} className="erp-faint">Lot: {lot.material} · heat/batch {lot.heat}{lot.certificate ? ` · cert. ${lot.certificate}` : ""}</p>)}
            {results.length > 0 && <ul className="app-results">{results.filter((item) => item.round === Math.max(...results.map((row) => row.round))).map((item) => {
              const effective = item.resolved_decision ?? item.outcome ?? (item.passed ? "pass" : "fail");
              return <li key={item.id}>
                <span className={`erp-badge ${effective === "pass" ? "erp-badge-ok" : effective === "needs_review" ? "erp-badge-warn" : "erp-badge-bad"}`}>{effective === "pass" ? "Pass" : effective === "needs_review" ? "Needs review" : "Fail"}</span> {item.characteristic}: {item.observed} {item.unit} <small className="erp-faint">({item.spec})</small>
                {item.resolved_decision && <small className="erp-faint"> · originally {item.outcome === "needs_review" ? "needs review" : item.outcome}; resolved: “{item.resolution_reason}”</small>}
                {isAdmin && item.outcome === "needs_review" && !item.resolved_decision && (item.inspected_by !== user.id
                  ? <ActionForm action={resolveReviewAction} submit="Resolve" className="app-mini-form app-grow"><input type="hidden" name="inspectionId" value={item.id} /><select name="decision" className="erp-select" aria-label="Decision" defaultValue=""><option value="">Decision…</option><option value="pass">Pass</option><option value="fail">Fail</option></select><input name="reason" className="erp-input" aria-label="Reason" placeholder="Reason (saved with your name)" minLength={5} required /></ActionForm>
                  : <small className="erp-faint"> · another owner or admin must resolve this review</small>)}
              </li>;
            })}</ul>}

            {canWrite && !done && <div className="app-order-actions">
              {order.status === "Planned" && <ActionForm action={setStatusAction} submit="Release" className="app-mini-form"><input type="hidden" name="orderId" value={order.id} /><input type="hidden" name="status" value="Running" /></ActionForm>}
              {order.status === "Running" && <ActionForm action={setStatusAction} submit="Hold" tone="ghost" className="app-mini-form"><input type="hidden" name="orderId" value={order.id} /><input type="hidden" name="status" value="On hold" /></ActionForm>}
              {order.status === "On hold" && <ActionForm action={setStatusAction} submit="Resume" className="app-mini-form"><input type="hidden" name="orderId" value={order.id} /><input type="hidden" name="status" value="Running" /></ActionForm>}
              {isAdmin && check?.gate && <ActionForm action={overrideAction} submit="Override with reason" tone="danger" className="app-mini-form app-grow"><input type="hidden" name="orderId" value={order.id} /><input name="reason" className="erp-input" aria-label="Reason for the override" placeholder="Reason (saved with your name)" minLength={5} maxLength={300} required /></ActionForm>}
            </div>}

            {canWrite && !done && order.status !== "On hold" && <div className="app-shopfloor">
              {running.map((item) => <ActionForm key={item.id} action={endOperationAction} submit={`End Op ${item.seq}`} className="app-inline-form app-form-5">
                <input type="hidden" name="activeId" value={item.id} />
                <p className="app-running"><b>Op {item.seq}</b> running · {person(item.person_id)?.name ?? "—"} since {time(item.started_at)}</p>
                <div className="erp-field"><label htmlFor={`g-${item.id}`}>Good</label><input id={`g-${item.id}`} name="good" className="erp-input" inputMode="numeric" defaultValue={check?.progress.find((op) => op.seq === item.seq)?.remaining ?? ""} required /></div>
                <div className="erp-field"><label htmlFor={`s-${item.id}`}>Scrap</label><input id={`s-${item.id}`} name="scrap" className="erp-input" inputMode="numeric" defaultValue="0" required /></div>
                <div className="erp-field"><label htmlFor={`n-${item.id}`}>Notes</label><input id={`n-${item.id}`} name="notes" className="erp-input" maxLength={300} /></div>
              </ActionForm>)}
              {People.length > 0 && check && check.progress.some((op) => !op.done && op.remaining > 0) && <ActionForm action={startOperationAction} submit="Start operation" className="app-inline-form app-form-4">
                <input type="hidden" name="orderId" value={order.id} />
                <div className="erp-field"><label htmlFor={`p-${order.id}`}>Who</label><select id={`p-${order.id}`} name="personId" className="erp-select" required defaultValue=""><option value="">Choose…</option>{People.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></div>
                <div className="erp-field"><label htmlFor={`o-${order.id}`}>Operation</label><select id={`o-${order.id}`} name="seq" className="erp-select">{check.progress.filter((op) => !op.done && op.remaining > 0).map((op) => <option key={op.seq} value={op.seq}>Op {op.seq} {op.name} · {op.remaining} waiting</option>)}</select></div>
              </ActionForm>}
            </div>}

            {canWrite && <details className="app-more"><summary>Material lot and inspection</summary>
              <ActionForm action={linkLotAction} submit="Link lot" className="app-inline-form app-form-4">
                {hidden}<input type="hidden" name="orderId" value={order.id} />
                <div className="erp-field"><label htmlFor={`lm-${order.id}`}>Material</label><input id={`lm-${order.id}`} name="material" className="erp-input" required maxLength={120} /></div>
                <div className="erp-field"><label htmlFor={`lh-${order.id}`}>Heat number or batch</label><input id={`lh-${order.id}`} name="heat" className="erp-input" required maxLength={60} /></div>
                <div className="erp-field"><label htmlFor={`lc-${order.id}`}>Certificate (optional)</label><input id={`lc-${order.id}`} name="certificate" className="erp-input" maxLength={80} /></div>
              </ActionForm>
              {done ? <InspectionForm orderId={order.id} plan={planFor(order.item_id, order.revision)} /> : <p className="erp-faint">The inspection is recorded once every operation is booked.</p>}
            </details>}
          </article>;
        })}
        {!Orders.length && <div className="erp-empty"><p>No production orders yet.</p></div>}
      </div>
    </section>

    <div className="erp-grid-2" style={{ marginTop: 18 }}>
      <section className="erp-card" aria-labelledby="parts-title">
        <div className="erp-card-head"><div><h2 id="parts-title">Parts, drawings and routings</h2><p>{isAdmin ? "You can approve drawings." : "Only owners and admins approve drawings."}</p></div></div>
        {canWrite && <ActionForm action={addPartAction} submit="Add part" className="app-inline-form app-form-4">{hidden}
          <div className="erp-field"><label htmlFor="pt-sku">Part number</label><input id="pt-sku" name="sku" className="erp-input" required maxLength={40} /></div>
          <div className="erp-field"><label htmlFor="pt-name">Name</label><input id="pt-name" name="name" className="erp-input" required maxLength={160} /></div>
          <div className="erp-field"><label htmlFor="pt-rev">Revision</label><input id="pt-rev" name="revision" className="erp-input" required maxLength={8} /></div>
        </ActionForm>}
        {canWrite && P.length > 0 && <DrawingForm companyId={c} parts={P} />}
        {canWrite && P.length > 0 && <ActionForm action={addOperationAction} submit="Add operation" className="app-inline-form app-form-7">{hidden}
          <div className="erp-field"><label htmlFor="ro-part">Part</label><select id="ro-part" name="partId" className="erp-select">{P.map((part) => <option key={part.id} value={part.id}>{part.sku}</option>)}</select></div>
          <div className="erp-field"><label htmlFor="ro-seq">Op no.</label><input id="ro-seq" name="seq" className="erp-input" inputMode="numeric" required /></div>
          <div className="erp-field"><label htmlFor="ro-name">Operation</label><input id="ro-name" name="name" className="erp-input" required maxLength={80} /></div>
          <div className="erp-field"><label htmlFor="ro-wc">Work center</label><input id="ro-wc" name="workCenter" className="erp-input" maxLength={20} /></div>
          <div className="erp-field"><label htmlFor="ro-setup">Setup min</label><input id="ro-setup" name="setup" className="erp-input" inputMode="decimal" defaultValue="0" /></div>
          <div className="erp-field"><label htmlFor="ro-run">Min per piece</label><input id="ro-run" name="run" className="erp-input" inputMode="decimal" defaultValue="0" /></div>
        </ActionForm>}
        {isAdmin && P.length > 0 && <ActionForm action={addPlanAction} submit="Add to plan" className="app-inline-form app-form-plan">{hidden}
          <div className="erp-field"><label htmlFor="pl-part">Part</label><select id="pl-part" name="partId" className="erp-select">{P.map((part) => <option key={part.id} value={part.id}>{part.sku}</option>)}</select></div>
          <div className="erp-field"><label htmlFor="pl-rev">Revision</label><input id="pl-rev" name="revision" className="erp-input" required maxLength={8} defaultValue={P[0]?.revision ?? ""} /></div>
          <div className="erp-field"><label htmlFor="pl-char">Characteristic</label><input id="pl-char" name="characteristic" className="erp-input" required maxLength={80} /></div>
          <div className="erp-field"><label htmlFor="pl-kind">Type</label><select id="pl-kind" name="kind" className="erp-select"><option value="numeric">Measured value</option><option value="attribute">Pass / fail check</option></select></div>
          <div className="erp-field"><label htmlFor="pl-spec">Specification</label><input id="pl-spec" name="spec" className="erp-input" maxLength={60} placeholder="120.00 ± 0.05 · min 3, max 5" /></div>
          <div className="erp-field"><label htmlFor="pl-lo">Lower limit</label><input id="pl-lo" name="lower" className="erp-input" inputMode="decimal" /></div>
          <div className="erp-field"><label htmlFor="pl-hi">Upper limit</label><input id="pl-hi" name="upper" className="erp-input" inputMode="decimal" /></div>
          <div className="erp-field"><label htmlFor="pl-unit">Unit</label><input id="pl-unit" name="unit" className="erp-input" maxLength={10} defaultValue="mm" /></div>
          <div className="erp-field"><label htmlFor="pl-gauge">Gauge</label><input id="pl-gauge" name="gauge" className="erp-input" maxLength={40} /></div>
          <div className="erp-field"><label htmlFor="pl-n">Parts to measure</label><input id="pl-n" name="sample" className="erp-input" inputMode="numeric" defaultValue="1" /></div>
        </ActionForm>}
        {isAdmin && P.length > 0 && <p className="erp-faint app-pad">Limits typed here win. Otherwise they are read from the specification; fits such as H8 or f7 are never guessed, so results without limits need review.</p>}
        <ul className="app-list">{P.map((part) => <li key={part.id}>
          <b>{part.sku}</b> · {part.name}
          <small>Routing: {O.filter((op) => op.item_id === part.id).map((op) => `${op.seq} ${op.name}`).join(" → ") || "none yet"}</small>
          {D.filter((doc) => doc.linked_id === part.id).map((doc) => {
            const invalid = doc.status === "Approved" && !integrity.get(doc.id);
            return <span key={doc.id} className="app-doc">{doc.number} rev {doc.revision} <span className={`erp-badge ${invalid ? "erp-badge-bad" : doc.status === "Approved" ? "erp-badge-ok" : "erp-badge-warn"}`}>{invalid ? "Approval invalid: file changed or missing" : doc.status}</span>
              {doc.content_sha256 ? <small className="erp-faint">SHA-256 {doc.content_sha256.slice(0, 12)}…</small> : <small className="erp-faint">no file: cannot be approved</small>}
              {doc.superseded_reason && <small className="erp-faint">“{doc.superseded_reason}”</small>}
              {isAdmin && doc.status !== "Approved" && doc.status !== "Superseded" && doc.content_sha256 && <ActionForm action={approveDrawingAction} submit="Approve" className="app-mini-form"><input type="hidden" name="fileId" value={doc.id} /></ActionForm>}
              {isAdmin && doc.status !== "Superseded" && <details className="app-more"><summary>Supersede</summary><ActionForm action={supersedeDrawingAction} submit="Supersede" tone="danger" className="app-mini-form app-grow"><input type="hidden" name="fileId" value={doc.id} /><input name="reason" className="erp-input" aria-label="Reason" placeholder="Reason (saved with your name)" minLength={5} required /></ActionForm></details>}
            </span>;
          })}
          <small>Inspection plan: {PL.filter((row) => row.item_id === part.id).map((row) => `rev ${row.revision} ${row.characteristic} (${row.kind === "numeric" ? (row.lower_limit != null || row.upper_limit != null ? `${row.lower_limit ?? "–"} … ${row.upper_limit ?? "–"}` : "no limits, needs review") : "pass/fail"}, n≥${row.sample_size}${row.required_gauge ? `, ${row.required_gauge}` : ""})`).join(" · ") || "none yet"}</small>
        </li>)}{!P.length && <li className="erp-faint">No parts yet.</li>}</ul>
      </section>

      <section className="erp-card" aria-labelledby="stock-title">
        <div className="erp-card-head"><div><h2 id="stock-title">Material, people and activity</h2><p>Goods receipt adds to the stock ledger; starting a job issues its material once.</p></div></div>
        {canWrite && <ActionForm action={receiveMaterialAction} submit="Receive" className="app-inline-form app-form-5">{hidden}
          <div className="erp-field"><label htmlFor="rm-sku">Material code</label><input id="rm-sku" name="sku" className="erp-input" required maxLength={40} list="rm-list" /><datalist id="rm-list">{M.map((item) => <option key={item.id} value={item.sku} />)}</datalist></div>
          <div className="erp-field"><label htmlFor="rm-name">Name</label><input id="rm-name" name="name" className="erp-input" maxLength={160} /></div>
          <div className="erp-field"><label htmlFor="rm-unit">Unit</label><input id="rm-unit" name="unit" className="erp-input" maxLength={8} defaultValue="kg" /></div>
          <div className="erp-field"><label htmlFor="rm-qty">Quantity</label><input id="rm-qty" name="quantity" className="erp-input" inputMode="decimal" required /></div>
        </ActionForm>}
        <ul className="app-list">{M.map((item) => <li key={item.id}><b>{item.sku}</b> · {item.name}<small>{stock.get(item.id) ?? 0} {item.unit} in stock</small></li>)}</ul>
        {canWrite && <ActionForm action={addPersonAction} submit="Add person" className="app-inline-form app-form-3">{hidden}
          <div className="erp-field"><label htmlFor="pp-code">Employee ID</label><input id="pp-code" name="code" className="erp-input" required maxLength={16} /></div>
          <div className="erp-field"><label htmlFor="pp-name">Name</label><input id="pp-name" name="name" className="erp-input" required maxLength={120} /></div>
        </ActionForm>}
        <ul className="app-list">{People.map((item) => <li key={item.id}><b>{item.code}</b> · {item.name}</li>)}</ul>
        <ol className="erp-activity">{((activity.data ?? []) as { id: number; at: string; summary: string }[]).map((event) => <li key={event.id}><time dateTime={event.at}>{time(event.at)}</time><span>{event.summary}</span></li>)}</ol>
      </section>
    </div>
  </>;
}

function Top({ email, name }: { email?: string; name: string }) {
  return <header className="app-top">
    <Link className="erp-brand" href="/app"><BohMark size={32} /><span><b>BOH</b> ERP</span></Link>
    <Link className="erp-btn erp-btn-sm erp-btn-ghost" href="/app"><ArrowLeft size={14} /> {name}</Link>
    {email && <div className="app-top-user"><span>{email}</span></div>}
  </header>;
}
