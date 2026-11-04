import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { toleranceCheck } from "../src/lib/erp/model.ts";

/**
 * The job release workflow enforced by the database (migration 20261105000000_production.sql), in PGlite.
 * The same cases as tests/erp-rules.test.ts, but through the functions the /app screens call.
 */

const SUPABASE_STANDIN = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated nologin;
  create role anon nologin;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`;
const OWNER = "00000000-0000-4000-8000-0000000000a2";
const OUTSIDER = "00000000-0000-4000-8000-0000000000b2";
const MEMBER = "00000000-0000-4000-8000-0000000000c2";
const db = new PGlite();
let company = "";
let warehouse = "";
let steel = "";
let lena = "";
let ben = "";

async function as<T>(user: string, run: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  try { return await run(); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}
const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
async function refuses(sql: string, params: unknown[], pattern: RegExp) {
  await assert.rejects(db.query(sql, params), (error: Error) => { assert.match(error.message, pattern); return true; });
}

before(async () => {
  await db.exec(SUPABASE_STANDIN);
  const dir = new URL("../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()) await db.exec(readFileSync(new URL(file, dir), "utf8"));
  await db.exec("grant usage on schema auth to authenticated, anon;");
  await db.query("insert into auth.users (id) values ($1), ($2), ($3)", [OWNER, OUTSIDER, MEMBER]);
  company = (await as(OWNER, () => one<{ id: string }>("select public.create_company('Precision Works', 'manufacturing') as id")))!.id;
  await as(OUTSIDER, () => db.query("select public.create_company('Other Shop', 'manufacturing')"));
  await as(OWNER, async () => {
    await db.query("insert into public.memberships (company_id, user_id, role) values ($1, $2, 'member')", [company, MEMBER]);
    warehouse = (await one<{ id: string }>("insert into public.warehouses (company_id, code, name) values ($1, 'MAIN', 'Main store') returning id", [company]))!.id;
    steel = (await one<{ id: string }>("insert into public.items (company_id, kind, sku, name, unit, track_stock) values ($1, 'material', 'STEEL-20', 'Steel bar Ø20', 'kg', true) returning id", [company]))!.id;
    lena = (await one<{ id: string }>("insert into public.people (company_id, code, name) values ($1, 'E-1', 'Lena Admin') returning id", [company]))!.id;
    // Since migration 20261107000000 bookings need the operator's own sign-in or their PIN: Ben is the member's sign-in, Lena uses a PIN.
    ben = (await one<{ id: string }>("insert into public.people (company_id, code, name, user_id) values ($1, 'E-2', 'Ben Op', $2) returning id", [company, MEMBER]))!.id;
    await db.query("select public.set_person_pin($1, '2468')", [lena]);
    await db.query("insert into public.people_pay (person_id, company_id, pay_type, hourly_rate) values ($1, $2, 'hourly', 30)", [ben, company]);
  });
});

/** A part with a two-step routing, a drawing in review, and a Planned order of `quantity` needing 5 kg steel. */
async function job(sku: string, quantity = 10) {
  return as(MEMBER, async () => {
    const part = (await one<{ id: string }>("insert into public.items (company_id, kind, sku, name, revision) values ($1, 'part', $2, 'Bracket', 'A') returning id", [company, sku]))!.id;
    await db.query("insert into public.routing_operations (company_id, item_id, seq, name, work_center, setup_min, run_min_per_pc) values ($1, $2, 10, 'Saw cutting', 'SAW-01', 5, 1), ($1, $2, 20, 'CNC milling', 'MILL-03', 30, 4)", [company, part]);
    const drawing = (await one<{ id: string }>("insert into public.files (company_id, storage_path, name, doc_type, number, revision, status, linked_type, linked_id, content_sha256) values ($1::uuid, $1::text || '/drawings/' || $2::text, $2, 'Drawing', 'DRW-' || $2::text, 'A', 'In review', 'item', $3, encode(sha256(convert_to($2::text, 'UTF8')), 'hex')) returning id", [company, sku, part]))!.id;
    const order = (await one<{ id: string; number: string }>("insert into public.production_orders (company_id, item_id, revision, quantity) values ($1, $2, 'A', $3) returning id, number", [company, part, quantity]))!;
    await db.query("insert into public.order_materials (company_id, order_id, item_id, warehouse_id, quantity) values ($1, $2, $3, $4, 5)", [company, order.id, steel, warehouse]);
    return { part, drawing, order: order.id, number: order.number };
  });
}
const approve = (drawing: string) => as(OWNER, () => db.query("select public.approve_file(f.id, f.content_sha256) from public.files f where f.id = $1", [drawing]));
const stock = (kg: number) => as(MEMBER, () => db.query("insert into public.stock_moves (company_id, item_id, warehouse_id, quantity, reason) values ($1, $2, $3, $4, 'receipt')", [company, steel, warehouse, kg]));
const start = (order: string, person: string, seq: number | null = null) => one<{ id: string }>("select public.start_operation($1, $2, $3) as id", [order, person, seq]);
const end = (active: string, good: number, scrap = 0) => one<{ status: string }>("select public.end_operation($1, $2, $3, '') as status", [active, good, scrap]);

test("a production order gets its number from the yearly sequence and starts as Planned", async () => {
  const j = await job("NUM-1");
  assert.match(j.number, /^MO-\d{4}-0001$/);
  await as(MEMBER, () => refuses("insert into public.production_orders (company_id, item_id, revision, quantity, status) values ($1, $2, 'A', 5, 'Completed')", [company, j.part], /start as Planned/));
});

test("starting on an unapproved drawing is refused", async () => {
  const j = await job("GATE-1");
  await stock(5);
  await as(MEMBER, () => refuses("select public.start_operation($1, $2, null)", [j.order, ben], /not approved/));
  await as(MEMBER, () => refuses("select public.set_order_status($1, 'Running')", [j.order], /not approved/));
  await as(MEMBER, () => refuses("update public.production_orders set status = 'Running' where id = $1", [j.order], /production functions/));
});

test("starting with material short is refused; once in stock, the first start issues it", async () => {
  const j = await job("MAT-1");
  await approve(j.drawing);
  const before = await one<{ on_hand: string }>("select coalesce(sum(quantity), 0) as on_hand from public.stock_moves where item_id = $1", [steel]);
  if (Number(before!.on_hand) >= 5) await as(OWNER, () => db.query("select public.adjust_stock($1, $2, $3, 'Test: leave 2 kg')", [steel, warehouse, -Number(before!.on_hand) + 2]));
  await as(MEMBER, () => refuses("select public.start_operation($1, $2, null)", [j.order, ben], /STEEL-20: 2 of 5 kg in stock/));
  await stock(10);
  await as(MEMBER, async () => { await end((await start(j.order, ben))!.id, 10); });
  const issued = await one<{ n: number }>("select count(*)::int as n from public.stock_moves where ref_id = $1 and reason = 'issue'", [j.order]);
  assert.equal(issued!.n, 1);
});

test("999 good on an order of 10 is refused; Op 10 with 4 good then Op 20 reporting 10 is refused", async () => {
  const j = await job("QTY-1");
  await approve(j.drawing);
  await stock(5);
  await as(MEMBER, async () => {
    const first = (await start(j.order, ben))!.id;
    await refuses("select public.end_operation($1, 999, 0, '')", [first], /Only 10 parts can be booked at Op 10/);
    await refuses("select public.end_operation($1, 9, 2, '')", [first], /Only 10 parts/);
    await end(first, 4, 6);
    const second = (await start(j.order, ben))!.id;
    await refuses("select public.end_operation($1, 10, 0, '')", [second], /Only 4 parts can be booked at Op 20/);
    assert.equal((await end(second, 4))!.status, "Completed");
  });
  const order = await one<{ status: string; cost_snapshot: { labour: number } }>("select status, cost_snapshot from public.production_orders where id = $1", [j.order]);
  assert.equal(order!.status, "Completed");
  assert.ok(order!.cost_snapshot && "labour" in order!.cost_snapshot, "labour cost frozen at close");
});

test("Completed with an open operation is refused, directly or through the status function", async () => {
  const j = await job("OPEN-1");
  await approve(j.drawing);
  await stock(5);
  await as(MEMBER, async () => {
    const active = (await start(j.order, ben))!.id;
    await refuses("select public.set_order_status($1, 'Completed')", [j.order], /still running/);
    await refuses("update public.production_orders set status = 'Completed' where id = $1", [j.order], /production functions/);
    await end(active, 10);
    await refuses("select public.set_order_status($1, 'Completed')", [j.order], /Op 20 CNC milling is not booked in full \(0 of 10 parts\)/);
    await refuses("select public.set_order_status($1, 'Waiting for paint')", [j.order], /not a production status/);
  });
});

test("partial bookings and parallel operators on one operation", async () => {
  const j = await job("PAR-1");
  await approve(j.drawing);
  await stock(5);
  await as(MEMBER, async () => {
    const benOp = (await start(j.order, ben))!.id;
    const lenaOp = (await one<{ id: string }>("select public.start_operation_pin($1, $2, 10, '2468') as id", [j.order, lena]))!.id;
    await end(benOp, 6);
    await refuses("select public.end_operation_pin($1, 5, 0, '', '2468')", [lenaOp], /Only 4 parts/);
    await db.query("select public.end_operation_pin($1, 4, 0, '', '2468')", [lenaOp]);
    const split = (await start(j.order, ben, 20))!.id;
    assert.equal((await end(split, 3))!.status, "Running", "3 of 10 at Op 20: still running");
  });
  const progress = (await db.query<{ seq: number; remaining: number; done: boolean }>("select seq, remaining, done from public.order_progress($1)", [j.order])).rows;
  assert.deepEqual(progress.map((op) => [op.seq, op.remaining, op.done]), [[10, 0, true], [20, 7, false]]);
});

test("a drawing revised mid-job stops further operations; only an admin can override, with a reason", async () => {
  const j = await job("REV-1");
  await approve(j.drawing);
  await stock(5);
  await as(MEMBER, async () => { await end((await start(j.order, ben))!.id, 10); });
  await as(MEMBER, () => db.query("insert into public.files (company_id, storage_path, name, doc_type, number, revision, status, linked_type, linked_id) values ($1::uuid, $1::text || '/drawings/rev-b', 'rev B', 'Drawing', 'DRW-REV-1', 'B', 'In review', 'item', $2)", [company, j.part]));
  await as(MEMBER, () => refuses("select public.start_operation($1, $2, null)", [j.order, ben], /revision B exists; this job is for revision A/));
  await as(MEMBER, () => refuses("select public.override_release($1, 'Customer said fine')", [j.order], /only an owner or admin/));
  await as(OWNER, () => refuses("select public.override_release($1, ' ')", [j.order], /reason/));
  await as(OWNER, () => db.query("select public.override_release($1, 'Rev B only changes the note; customer confirmed by email')", [j.order]));
  const log = await one<{ actor: string; summary: string }>("select actor, summary from public.activity_log where action = 'override' order by id desc limit 1");
  assert.equal(log!.actor, OWNER);
  assert.match(log!.summary, /customer confirmed/);
  await as(MEMBER, async () => { assert.equal((await end((await start(j.order, ben))!.id, 10))!.status, "Completed"); });
});

test("a member cannot approve a drawing", async () => {
  const j = await job("APR-1");
  await as(MEMBER, () => refuses("select public.approve_file(f.id, f.content_sha256) from public.files f where f.id = $1", [j.drawing], /only an owner or admin/));
});

test("inspection: 999 mm against 120.00 ± 0.05 mm fails even when marked pass; results need explicit values", async () => {
  const j = await job("INS-1", 2);
  await approve(j.drawing);
  await stock(5);
  // Since migration 20261106000000 the specification comes from the server-stored plan, not from the client.
  const plan = (await as(OWNER, () => one<{ id: string }>("insert into public.inspection_plans (company_id, item_id, revision, characteristic, kind, nominal, lower_limit, upper_limit, unit, sample_size) values ($1, $2, 'A', 'Width', 'numeric', 120, 119.95, 120.05, 'mm', 2) returning id", [company, j.part])))!.id;
  await as(MEMBER, async () => {
    await refuses("select public.record_inspection($1, $2)", [j.order, JSON.stringify([{ plan_id: plan, observed: "120.01", result: "pass", sample_size: 2 }])], /must be booked/);
    await end((await start(j.order, ben))!.id, 2);
    await end((await start(j.order, ben))!.id, 2);
    await refuses("select public.record_inspection($1, $2)", [j.order, JSON.stringify([{ plan_id: plan, observed: "120.01", sample_size: 2 }])], /choose pass or fail/);
    await refuses("select public.record_inspection($1, $2)", [j.order, JSON.stringify([{ plan_id: plan, observed: "120.01", result: "pass" }])], /at least 2/);
    const passed = await one<{ ok: boolean }>("select public.record_inspection($1, $2) as ok", [j.order, JSON.stringify([{ plan_id: plan, observed: "999", result: "pass", sample_size: 2, gauge_id: "MIC-07" }])]);
    assert.equal(passed!.ok, false);
    await refuses("update public.inspections set passed = true", [], /permission denied/);
    await refuses("insert into public.operation_logs (company_id, order_id, seq, operation, person_id, started_at, ended_at, minutes, planned_minutes, qty_good, qty_scrap) values ($1, $2, 10, 'x', $3, now(), now(), 1, 1, 5, 0)", [company, j.order, ben], /permission denied/);
  });
  const row = await one<{ tolerance: string; passed: boolean; gauge_id: string; sample_size: number }>("select tolerance, passed, gauge_id, sample_size from public.inspections where order_id = $1", [j.order]);
  assert.deepEqual(row, { tolerance: "out", passed: false, gauge_id: "MIC-07", sample_size: 2 });
});

test("company B cannot read or act on company A's production records", async () => {
  const j = await job("ISO-1");
  await as(OUTSIDER, async () => {
    assert.equal((await db.query("select * from public.production_orders")).rows.length, 0);
    assert.equal((await db.query("select * from public.operation_logs")).rows.length, 0);
    assert.equal((await db.query("select * from public.inspections")).rows.length, 0);
    assert.equal((await db.query("select * from public.order_progress($1)", [j.order])).rows.length, 0, "progress of a foreign order is empty");
    await refuses("select public.start_operation($1, $2, null)", [j.order, ben], /not allowed|not linked to your sign-in/);
    await refuses("select public.set_order_status($1, 'On hold')", [j.order], /not allowed/);
    await refuses("select public.override_release($1, 'not my company')", [j.order], /only an owner or admin/);
  });
});

test("the database and the demo read tolerances the same way", async () => {
  const cases: [string, string][] = [
    ["120.00 ± 0.05", "999"], ["120.00 ± 0.05", "120.03"], ["120,00 ± 0,05", "120,06"], ["20 +0.1/-0.05", "19.96"], ["20 +0.1/-0.05", "19.9"],
    ["≤ 0.05", "0.07"], ["Ra ≤ 0.8", "0.6"], ["min 3", "2.5"], ["8–12", "10"], ["8-12", "13"], ["Ø40.00 H8", "40.01"], ["± 0.10", "0.05"], ["EN AW-7075-T6", "OK"], ["100 ± 0.1", "abc"],
  ];
  for (const [spec, observed] of cases) {
    const sql = await one<{ t: string }>("select public.tolerance_check($1, $2) as t", [spec, observed]);
    assert.equal(sql!.t, toleranceCheck(spec, observed), `${spec} / ${observed}`);
  }
});
