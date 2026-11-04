import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { freshDatabase, helpers, sha256 } from "./db-helpers.ts";

/**
 * Phase 1 pilot blockers (migration 20261106000000_pilot_blockers.sql): controlled drawing fields, hash-bound approval,
 * immutable Storage objects, demo flags and purge, audited closure, and server-stored inspection plans.
 */
const OWNER = "00000000-0000-4000-8000-0000000000a3";
const ADMIN = "00000000-0000-4000-8000-0000000000d3";
const MEMBER = "00000000-0000-4000-8000-0000000000c3";
const OUTSIDER = "00000000-0000-4000-8000-0000000000b3";
let db: PGlite;
let h: ReturnType<typeof helpers>;
let company = "";
let warehouse = "";
let steel = "";
let ben = "";
const LIMIT_CASES = JSON.parse(readFileSync(new URL("./fixtures/limit-cases.json", import.meta.url), "utf8")) as { observed: string; lower: number | null; upper: number | null; outcome: string }[];

before(async () => {
  db = await freshDatabase([OWNER, ADMIN, MEMBER, OUTSIDER]);
  h = helpers(db);
  company = (await h.as(OWNER, () => h.one<{ id: string }>("select public.create_company('Precision Works', 'manufacturing') as id")))!.id;
  await h.as(OUTSIDER, () => db.query("select public.create_company('Other Shop', 'manufacturing')"));
  await h.as(OWNER, async () => {
    await db.query("insert into public.memberships (company_id, user_id, role) values ($1, $2, 'admin'), ($1, $3, 'member')", [company, ADMIN, MEMBER]);
    warehouse = (await h.one<{ id: string }>("insert into public.warehouses (company_id, code, name) values ($1, 'MAIN', 'Main store') returning id", [company]))!.id;
    steel = (await h.one<{ id: string }>("insert into public.items (company_id, kind, sku, name, unit, track_stock) values ($1, 'material', 'STEEL', 'Steel', 'kg', true) returning id", [company]))!.id;
    ben = (await h.one<{ id: string }>("insert into public.people (company_id, code, name) values ($1, 'E-2', 'Ben Op') returning id", [company]))!.id;
    await db.query("insert into public.stock_moves (company_id, item_id, warehouse_id, quantity, reason) values ($1, $2, $3, 1000, 'receipt')", [company, steel, warehouse]);
  });
});

async function drawing(part: string, sku: string, revision: string, user = MEMBER, content = `${sku}-${revision}`) {
  const hash = sha256(content);
  const id = (await h.as(user, () => h.one<{ id: string }>(
    "insert into public.files (company_id, storage_path, name, doc_type, number, revision, status, linked_type, linked_id, content_sha256) values ($1::uuid, $1::text || '/drawings/' || gen_random_uuid() || '.pdf', $2, 'Drawing', 'DRW-' || $2::text, $3, 'In review', 'item', $4, $5) returning id",
    [company, sku, revision, part, hash])))!.id;
  return { id, hash };
}

async function part(sku: string) {
  return (await h.as(MEMBER, async () => {
    const id = (await h.one<{ id: string }>("insert into public.items (company_id, kind, sku, name, revision) values ($1, 'part', $2, 'Bracket', 'A') returning id", [company, sku]))!.id;
    await db.query("insert into public.routing_operations (company_id, item_id, seq, name) values ($1, $2, 10, 'Saw'), ($1, $2, 20, 'Mill')", [company, id]);
    return id;
  }));
}

async function order(item: string, quantity = 2) {
  return h.as(MEMBER, async () => {
    const id = (await h.one<{ id: string }>("insert into public.production_orders (company_id, item_id, revision, quantity) values ($1, $2, 'A', $3) returning id", [company, item, quantity]))!.id;
    await db.query("insert into public.order_materials (company_id, order_id, item_id, warehouse_id, quantity) values ($1, $2, $3, $4, 1)", [company, id, steel, warehouse]);
    return id;
  });
}

async function runAll(orderId: string, quantity = 2) {
  await h.as(MEMBER, async () => {
    for (let i = 0; i < 2; i += 1) {
      const active = (await h.one<{ id: string }>("select public.start_operation($1, $2, null) as id", [orderId, ben]))!.id;
      await db.query("select public.end_operation($1, $2, 0, '')", [active, quantity]);
    }
  });
}

/* ---------- N1, N2, N7: drawings ---------- */

test("N1/N2: members cannot retype, relink, renumber, re-revise or supersede a drawing; nobody can after approval", async () => {
  const p = await part("REL-1");
  const other = await part("REL-2");
  const d = await drawing(p, "REL-1", "A");
  for (const change of ["doc_type = 'Other'", `linked_id = '${other}'`, "linked_type = 'project'", "number = 'DRW-X'", "revision = 'B'", `content_sha256 = '${sha256("swap")}'`, "storage_path = company_id::text || '/other.pdf'"]) {
    await h.as(MEMBER, () => h.refuses(`update public.files set ${change} where id = $1`, [d.id], /immutable|new version/));
  }
  await h.as(MEMBER, () => h.refuses("update public.files set status = 'Superseded' where id = $1", [d.id], /supersede_file/));
  await h.as(OWNER, () => h.refuses("delete from public.files where id = $1", [d.id], /drawings are not deleted/));
  await h.as(MEMBER, () => h.refuses("select public.supersede_file($1, 'not needed any more')", [d.id], /owner or admin/));
  await h.as(OWNER, () => db.query("select public.approve_file($1, $2)", [d.id, d.hash]));
  await h.as(OWNER, () => h.refuses("update public.files set revision = 'B' where id = $1", [d.id], /immutable|new version/));
});

test("N7: approval is bound to the verified SHA-256 of the file; the one-argument approval is gone", async () => {
  const p = await part("HASH-1");
  const d = await drawing(p, "HASH-1", "A");
  await h.as(OWNER, () => h.refuses("select public.approve_file($1)", [d.id], /permission denied|verified fingerprint/));
  await h.as(OWNER, () => h.refuses("select public.approve_file($1, $2)", [d.id, sha256("something else")], /does not match/));
  await h.as(MEMBER, () => h.refuses("select public.approve_file($1, $2)", [d.id, d.hash], /owner or admin/));
  const noFile = (await h.as(MEMBER, () => h.one<{ id: string }>("insert into public.files (company_id, storage_path, name, doc_type, number, revision, status, linked_type, linked_id) values ($1::uuid, $1::text || '/drawings/x', 'x', 'Drawing', 'DRW-NF', 'A', 'In review', 'item', $2) returning id", [company, p])))!.id;
  await h.as(OWNER, () => h.refuses("select public.approve_file($1, $2)", [noFile, d.hash], /no file fingerprint/));
  await h.as(OWNER, () => db.query("select public.approve_file($1, $2)", [d.id, d.hash]));
  const row = await h.one<{ status: string; approved_sha256: string; approved_by: string }>("select status, approved_sha256, approved_by from public.files where id = $1", [d.id]);
  assert.deepEqual(row, { status: "Approved", approved_sha256: d.hash, approved_by: OWNER });
});

test("N7: a replaced file never keeps approval: a new version is a new record that starts in review", async () => {
  const p = await part("REPL-1");
  const a = await drawing(p, "REPL-1", "A", MEMBER, "v1");
  await h.as(OWNER, () => db.query("select public.approve_file($1, $2)", [a.id, a.hash]));
  await h.as(MEMBER, () => h.refuses("update public.files set content_sha256 = $2 where id = $1", [a.id, sha256("v2")], /immutable|new version/));
  const b = await drawing(p, "REPL-1", "A", MEMBER, "v2");
  assert.equal((await h.one<{ status: string }>("select status from public.files where id = $1", [b.id]))!.status, "In review");
  const o = await order(p);
  const gate = await h.as(MEMBER, () => h.one<{ g: string | null }>("select public.release_gate($1) as g", [o]));
  assert.equal(gate!.g, null, "the approved, unchanged version still releases the job");
});

test("N1: a newer revision blocks until an owner or admin supersedes it with a reason", async () => {
  const p = await part("SUP-1");
  const a = await drawing(p, "SUP-1", "A");
  await h.as(OWNER, () => db.query("select public.approve_file($1, $2)", [a.id, a.hash]));
  const b = await drawing(p, "SUP-1", "B");
  const o = await order(p);
  assert.match((await h.as(MEMBER, () => h.one<{ g: string }>("select public.release_gate($1) as g", [o])))!.g, /revision B exists/);
  await h.as(OWNER, () => h.refuses("select public.supersede_file($1, ' ')", [b.id], /reason/));
  await h.as(ADMIN, () => db.query("select public.supersede_file($1, 'Rev B was issued by mistake; customer confirmed rev A')", [b.id]));
  assert.equal((await h.as(MEMBER, () => h.one<{ g: string | null }>("select public.release_gate($1) as g", [o])))!.g, null);
  const log = await h.one<{ summary: string; actor: string }>("select summary, actor from public.activity_log where action = 'supersede' order by id desc limit 1");
  assert.equal(log!.actor, ADMIN);
});

test("N7: Storage objects cannot be overwritten, and approved drawings cannot be removed from Storage", async () => {
  const bucket = await h.one<{ file_size_limit: string; allowed_mime_types: string[] }>("select file_size_limit, allowed_mime_types from storage.buckets where id = 'company-files'");
  assert.equal(Number(bucket!.file_size_limit), 20 * 1024 * 1024);
  assert.ok(bucket!.allowed_mime_types.includes("application/pdf") && !bucket!.allowed_mime_types.includes("application/octet-stream"));
  const p = await part("STO-1");
  const d = await drawing(p, "STO-1", "A");
  const path = (await h.one<{ storage_path: string }>("select storage_path from public.files where id = $1", [d.id]))!.storage_path;
  await h.as(MEMBER, () => db.query("insert into storage.objects (bucket_id, name) values ('company-files', $1)", [path]));
  const overwritten = await h.as(MEMBER, async () => (await db.query("update storage.objects set owner = null where name = $1", [path])).affectedRows);
  assert.equal(overwritten, 0, "no update (upsert) policy: objects are immutable");
  await h.as(OWNER, () => db.query("select public.approve_file($1, $2)", [d.id, d.hash]));
  const removed = await h.as(OWNER, async () => (await db.query("delete from storage.objects where name = $1", [path])).affectedRows);
  assert.equal(removed, 0, "an approved drawing's file cannot be deleted");
});

/* ---------- N5, N6: demo flag, purge, closure ---------- */

test("N5: only the server creates demo companies; the demo flag and expiry cannot be changed", async () => {
  await h.as(OWNER, () => h.refuses("select public.create_company('Sneaky Demo', 'manufacturing', true)", [], /created by the BOH ERP server/));
  await h.as(OWNER, () => h.refuses("update public.companies set is_demo = true, expires_at = now() where id = $1", [company], /demo flag/));
  await h.as(OWNER, () => h.refuses("update public.companies set expires_at = now() where id = $1", [company], /demo flag/));
});

test("N6: a company flagged demo with an issued invoice is not deleted from the app", async () => {
  const demo = (await h.one<{ id: string }>("insert into public.companies (name, industry, is_demo, expires_at) values ('Flagged', 'manufacturing', true, now() + interval '1 day') returning id"))!.id;
  await db.query("insert into public.memberships (company_id, user_id, role) values ($1, $2, 'owner')", [demo, OWNER]);
  await h.as(OWNER, async () => {
    const contact = (await h.one<{ id: string }>("insert into public.contacts (company_id, name, is_customer) values ($1, 'Real customer', true) returning id", [demo]))!.id;
    const doc = (await h.one<{ id: string }>("insert into public.sales_documents (company_id, kind, number, contact_id) values ($1, 'invoice', '', $2) returning id", [demo, contact]))!.id;
    await db.query("insert into public.sales_lines (company_id, document_id, description, quantity, unit_price) values ($1, $2, 'Part', 1, 10)", [demo, doc]);
    await db.query("select public.issue_sales_document($1)", [doc]);
    await h.refuses("delete from public.companies where id = $1", [demo], /retention process/);
  });
});

test("N6: the demo purge works even with shop-floor logs and people", async () => {
  const demo = (await h.one<{ id: string }>("insert into public.companies (name, industry, is_demo, expires_at) values ('Sandbox', 'manufacturing', true, now() + interval '1 day') returning id"))!.id;
  await db.query("insert into public.memberships (company_id, user_id, role) values ($1, $2, 'owner')", [demo, OWNER]);
  await h.as(OWNER, async () => {
    const wh = (await h.one<{ id: string }>("insert into public.warehouses (company_id, code, name) values ($1, 'MAIN', 'Main') returning id", [demo]))!.id;
    const mat = (await h.one<{ id: string }>("insert into public.items (company_id, kind, sku, name) values ($1, 'material', 'M', 'M') returning id", [demo]))!.id;
    await db.query("insert into public.stock_moves (company_id, item_id, warehouse_id, quantity, reason) values ($1, $2, $3, 10, 'receipt')", [demo, mat, wh]);
    const person = (await h.one<{ id: string }>("insert into public.people (company_id, code, name) values ($1, 'E-9', 'Demo Op') returning id", [demo]))!.id;
    const prt = (await h.one<{ id: string }>("insert into public.items (company_id, kind, sku, name) values ($1, 'part', 'P', 'P') returning id", [demo]))!.id;
    await db.query("insert into public.routing_operations (company_id, item_id, seq, name) values ($1, $2, 10, 'Saw')", [demo, prt]);
    const f = (await h.one<{ id: string }>("insert into public.files (company_id, storage_path, name, doc_type, number, revision, status, linked_type, linked_id, content_sha256) values ($1::uuid, $1::text || '/d.pdf', 'd', 'Drawing', 'D', 'A', 'In review', 'item', $2, $3) returning id", [demo, prt, sha256("d")]))!.id;
    await db.query("select public.approve_file($1, $2)", [f, sha256("d")]);
    const o = (await h.one<{ id: string }>("insert into public.production_orders (company_id, item_id, revision, quantity) values ($1, $2, 'A', 1) returning id", [demo, prt]))!.id;
    await db.query("insert into public.order_materials (company_id, order_id, item_id, warehouse_id, quantity) values ($1, $2, $3, $4, 1)", [demo, o, mat, wh]);
    const active = (await h.one<{ id: string }>("select public.start_operation($1, $2, null) as id", [o, person]))!.id;
    await db.query("select public.end_operation($1, 1, 0, '')", [active]);
  });
  await db.query("update public.companies set expires_at = now() - interval '1 minute' where id = $1", [demo]);
  const purged = await h.one<{ n: number }>("select public.purge_expired_demos() as n");
  assert.ok(purged!.n >= 1);
  assert.equal((await h.rows("select 1 from public.companies where id = $1", [demo])).length, 0);
  assert.equal((await h.rows("select 1 from public.operation_logs where company_id = $1", [demo])).length, 0);
});

test("N6: pilot closure is requested by the owner and carried out by an operator; issued invoices are kept unless retention has ended", async () => {
  const pilot = (await h.as(MEMBER, () => h.one<{ id: string }>("select public.create_company('Pilot Shop', 'manufacturing') as id")))!.id;
  await h.as(MEMBER, async () => {
    const contact = (await h.one<{ id: string }>("insert into public.contacts (company_id, name, is_customer) values ($1, 'Customer', true) returning id", [pilot]))!.id;
    const doc = (await h.one<{ id: string }>("insert into public.sales_documents (company_id, kind, number, contact_id) values ($1, 'invoice', '', $2) returning id", [pilot, contact]))!.id;
    await db.query("insert into public.sales_lines (company_id, document_id, description, quantity, unit_price) values ($1, $2, 'Part', 1, 10)", [pilot, doc]);
    await db.query("select public.issue_sales_document($1)", [doc]);
  });
  await h.as(OUTSIDER, () => h.refuses("select public.request_company_closure($1, 'please close this')", [pilot], /owner/));
  await h.as(MEMBER, () => db.query("select public.request_company_closure($1, 'Pilot ended, please close')", [pilot]));
  await h.as(MEMBER, () => h.refuses("select public.operator_delete_company($1, 'Pilot Shop', false, 'x')", [pilot], /permission denied/));
  await h.refuses("select public.operator_delete_company($1, 'Wrong name', false, 'x')", [pilot], /confirm/);
  await h.refuses("select public.operator_delete_company($1, 'Pilot Shop', false, 'customer asked')", [pilot], /issued invoices must be kept/);
  await db.query("select public.operator_close_access($1, 'Pilot ended; records kept for the legal period')", [pilot]);
  assert.equal((await h.rows("select 1 from public.memberships where company_id = $1", [pilot])).length, 0);
  await db.query("select public.operator_delete_company($1, 'Pilot Shop', true, 'Retention period ended; tax adviser confirmed in writing')", [pilot]);
  assert.equal((await h.rows("select 1 from public.companies where id = $1", [pilot])).length, 0);
  assert.equal((await h.rows("select 1 from public.audit_history where company_id = $1", [pilot])).length, 0, "audit history deleted with the company");
  const closure = await h.one<{ state: string; legal_records_deleted: boolean }>("select state, legal_records_deleted from public.company_closures where company_id = $1 order by id desc limit 1", [pilot]);
  assert.deepEqual(closure, { state: "deleted", legal_records_deleted: true });
});

/* ---------- N3, N4: inspection plans ---------- */

async function plan(item: string, rows: { characteristic: string; kind: string; lower?: number | null; upper?: number | null; nominal?: number | null; sample?: number; gauge?: string; spec?: string }[]) {
  await h.as(OWNER, async () => {
    for (const [index, row] of rows.entries()) {
      await db.query("insert into public.inspection_plans (company_id, item_id, revision, position, characteristic, kind, nominal, lower_limit, upper_limit, unit, required_gauge, sample_size, spec_text) values ($1, $2, 'A', $3, $4, $5, $6, $7, $8, 'mm', $9, $10, $11)",
        [company, item, index, row.characteristic, row.kind, row.nominal ?? null, row.lower ?? null, row.upper ?? null, row.gauge ?? "", row.sample ?? 1, row.spec ?? ""]);
    }
  });
  return (await h.rows<{ id: string; characteristic: string }>("select id, characteristic from public.inspection_plans where item_id = $1 order by position", [item]));
}

async function completedJob(sku: string) {
  const p = await part(sku);
  const d = await drawing(p, sku, "A");
  await h.as(OWNER, () => db.query("select public.approve_file($1, $2)", [d.id, d.hash]));
  const o = await order(p);
  await runAll(o);
  return { p, o };
}

const record = (orderId: string, results: unknown[]) => h.one<{ ok: boolean }>("select public.record_inspection($1, $2) as ok", [orderId, JSON.stringify(results)]);

test("N3: the inspection plan comes from the server; blank, missing, duplicate, extra and client-sent specs are refused", async () => {
  const job = await completedJob("INS-A");
  await h.as(MEMBER, () => h.refuses("select public.record_inspection($1, $2)", [job.o, JSON.stringify([{ characteristic: "Width", spec: "0 ± 1000", observed: "5", result: "pass", sample_size: 1 }])], /no inspection plan/));
  const [width, visual] = await plan(job.p, [{ characteristic: "Width", kind: "numeric", nominal: 120, lower: 119.95, upper: 120.05, sample: 2, gauge: "MIC-07" }, { characteristic: "Visual", kind: "attribute" }]);
  await h.as(MEMBER, async () => {
    await h.refuses("select public.record_inspection($1, $2)", [job.o, JSON.stringify([{ plan_id: width.id, observed: "", result: "pass", sample_size: 2, gauge_id: "MIC-07" }, { plan_id: visual.id, observed: "OK", result: "pass", sample_size: 1 }])], /measured value/);
    await h.refuses("select public.record_inspection($1, $2)", [job.o, JSON.stringify([{ plan_id: width.id, observed: "120.01", result: "pass", sample_size: 2, gauge_id: "MIC-07" }])], /missing: Visual/);
    await h.refuses("select public.record_inspection($1, $2)", [job.o, JSON.stringify([{ plan_id: width.id, observed: "120.01", result: "pass", sample_size: 2, gauge_id: "MIC-07" }, { plan_id: width.id, observed: "120.02", result: "pass", sample_size: 2, gauge_id: "MIC-07" }, { plan_id: visual.id, observed: "OK", result: "pass", sample_size: 1 }])], /more than once/);
    await h.refuses("select public.record_inspection($1, $2)", [job.o, JSON.stringify([{ plan_id: width.id, observed: "120.01", result: "pass", sample_size: 2, gauge_id: "MIC-07" }, { plan_id: visual.id, observed: "OK", result: "pass", sample_size: 1 }, { plan_id: "00000000-0000-4000-8000-000000000999", observed: "1", result: "pass", sample_size: 1 }])], /not in the inspection plan/);
    await h.refuses("select public.record_inspection($1, $2)", [job.o, JSON.stringify([{ plan_id: width.id, observed: "120.01", result: "pass", sample_size: 1, gauge_id: "MIC-07" }, { plan_id: visual.id, observed: "OK", result: "pass", sample_size: 1 }])], /at least 2/);
    await h.refuses("select public.record_inspection($1, $2)", [job.o, JSON.stringify([{ plan_id: width.id, observed: "120.01", result: "pass", sample_size: 2, gauge_id: "CALIPER" }, { plan_id: visual.id, observed: "OK", result: "pass", sample_size: 1 }])], /gauge MIC-07/);
    await h.refuses("select public.record_inspection($1, $2)", [job.o, JSON.stringify([{ plan_id: width.id, observed: "about 120", result: "pass", sample_size: 2, gauge_id: "MIC-07" }, { plan_id: visual.id, observed: "OK", result: "pass", sample_size: 1 }])], /number/);
    const ok = await record(job.o, [{ plan_id: width.id, observed: "999", result: "pass", sample_size: 2, gauge_id: "mic-07", spec: "0 ± 10000" }, { plan_id: visual.id, observed: "OK", result: "pass", sample_size: 1 }]);
    assert.equal(ok!.ok, false, "a client-sent spec is ignored: 999 fails against the stored limits");
  });
  const row = await h.one<{ outcome: string; inspected_by: string; spec: string }>("select outcome, inspected_by, spec from public.inspections where plan_id = $1", [width.id]);
  assert.equal(row!.outcome, "fail");
  assert.equal(row!.inspected_by, MEMBER);
  assert.doesNotMatch(row!.spec, /10000/);
});

test("N3: 999 against an H8 or f7 fit needs review (never pass); min/max and 'max' limits apply", async () => {
  const job = await completedJob("INS-B");
  const [bore, rod, flat, range] = await plan(job.p, [
    { characteristic: "Bore", kind: "numeric", spec: "Ø40.00 H8" }, { characteristic: "Rod", kind: "numeric", spec: "Ø25 f7" },
    { characteristic: "Flatness", kind: "numeric", upper: 0.05, spec: "0.05 max" }, { characteristic: "Thickness", kind: "numeric", lower: 3, upper: 5, spec: "min 3, max 5" },
  ]);
  await h.as(MEMBER, () => record(job.o, [
    { plan_id: bore.id, observed: "999", result: "pass", sample_size: 1 }, { plan_id: rod.id, observed: "999", result: "pass", sample_size: 1 },
    { plan_id: flat.id, observed: "0.07", result: "pass", sample_size: 1 }, { plan_id: range.id, observed: "6", result: "pass", sample_size: 1 },
  ]));
  const outcomes = await h.rows<{ characteristic: string; outcome: string }>("select characteristic, outcome from public.inspections where order_id = $1 order by characteristic", [job.o]);
  assert.deepEqual(Object.fromEntries(outcomes.map((row) => [row.characteristic, row.outcome])), { Bore: "needs_review", Flatness: "fail", Rod: "needs_review", Thickness: "fail" });
  assert.equal((await h.as(MEMBER, () => h.one<{ s: string }>("select public.inspection_status($1) as s", [job.o])))!.s, "failed");
});

test("N4: a review is resolved by an owner or admin with a reason, not by the inspector, and the original result is kept", async () => {
  const job = await completedJob("INS-C");
  const [bore] = await plan(job.p, [{ characteristic: "Bore", kind: "numeric", spec: "Ø40.00 H8" }]);
  await h.as(ADMIN, () => record(job.o, [{ plan_id: bore.id, observed: "40.02", result: "pass", sample_size: 1 }]));
  const id = (await h.one<{ id: number }>("select id from public.inspections where order_id = $1", [job.o]))!.id;
  assert.equal((await h.as(MEMBER, () => h.one<{ s: string }>("select public.inspection_status($1) as s", [job.o])))!.s, "needs_review");
  await h.as(MEMBER, () => h.refuses("select public.resolve_inspection($1, 'pass', 'plug gauge ok')", [id], /owner or admin/));
  await h.as(ADMIN, () => h.refuses("select public.resolve_inspection($1, 'pass', 'I checked it myself')", [id], /different owner or admin/));
  await h.as(OWNER, () => h.refuses("select public.resolve_inspection($1, 'pass', ' ')", [id], /reason/));
  await h.as(OWNER, () => db.query("select public.resolve_inspection($1, 'pass', 'H8 plug gauge go/no-go checked on both parts')", [id]));
  const row = await h.one<{ outcome: string; resolved_decision: string; resolved_by: string }>("select outcome, resolved_decision, resolved_by from public.inspections where id = $1", [id]);
  assert.deepEqual(row, { outcome: "needs_review", resolved_decision: "pass", resolved_by: OWNER });
  assert.equal((await h.as(MEMBER, () => h.one<{ s: string }>("select public.inspection_status($1) as s", [job.o])))!.s, "passed");
  await h.as(OWNER, () => h.refuses("select public.resolve_inspection($1, 'fail', 'changed my mind')", [id], /already resolved|needs review/));
});

test("N3: plan rows used by an inspection cannot be changed, and members cannot edit plans", async () => {
  const job = await completedJob("INS-D");
  const [width] = await plan(job.p, [{ characteristic: "Width", kind: "numeric", lower: 1, upper: 2 }]);
  await h.as(MEMBER, async () => {
    const changed = (await db.query("update public.inspection_plans set upper_limit = 1000 where id = $1", [width.id])).affectedRows;
    assert.equal(changed, 0, "members cannot edit the plan");
  });
  await h.as(MEMBER, () => record(job.o, [{ plan_id: width.id, observed: "1.5", result: "pass", sample_size: 1 }]));
  await h.as(OWNER, () => h.refuses("update public.inspection_plans set upper_limit = 1000 where id = $1", [width.id], /used by a recorded inspection/));
});

test("shared limit cases: the database gives the same outcome as the demo", async () => {
  for (const item of LIMIT_CASES) {
    const row = await h.one<{ o: string }>("select public.inspection_outcome($1, $2, $3) as o", [item.observed, item.lower, item.upper]);
    assert.equal(row!.o, item.outcome, `${item.observed} in [${item.lower}, ${item.upper}]`);
  }
});

test("isolation: company B cannot read A's plans, closures or files", async () => {
  await h.as(OUTSIDER, async () => {
    assert.equal((await db.query("select * from public.inspection_plans")).rows.length, 0);
    assert.equal((await db.query("select * from public.company_closures")).rows.length, 0);
    assert.equal((await db.query("select * from public.files")).rows.length, 0);
  });
});
