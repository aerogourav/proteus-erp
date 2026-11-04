import { test, before } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { freshDatabase, helpers, sha256 } from "./db-helpers.ts";

/** Phase 3 (migration 20261108000000_dispatch_review.sql): dispatch with final checks, and the gaps found in the table review. */
const OWNER = "00000000-0000-4000-8000-0000000000a5";
const MEMBER = "00000000-0000-4000-8000-0000000000c5";
const OUTSIDER = "00000000-0000-4000-8000-0000000000b5";
let db: PGlite;
let h: ReturnType<typeof helpers>;
let company = "";
let warehouse = "";
let steel = "";
let ben = "";

before(async () => {
  db = await freshDatabase([OWNER, MEMBER, OUTSIDER]);
  h = helpers(db);
  company = (await h.as(OWNER, () => h.one<{ id: string }>("select public.create_company('Precision Works', 'manufacturing') as id")))!.id;
  await h.as(OUTSIDER, () => db.query("select public.create_company('Other Shop', 'manufacturing')"));
  await h.as(OWNER, async () => {
    await db.query("insert into public.memberships (company_id, user_id, role) values ($1, $2, 'member')", [company, MEMBER]);
    warehouse = (await h.one<{ id: string }>("insert into public.warehouses (company_id, code, name) values ($1, 'MAIN', 'Main') returning id", [company]))!.id;
    steel = (await h.one<{ id: string }>("insert into public.items (company_id, kind, sku, name) values ($1, 'material', 'STEEL', 'Steel') returning id", [company]))!.id;
    ben = (await h.one<{ id: string }>("insert into public.people (company_id, code, name, user_id) values ($1, 'E-2', 'Ben Op', $2) returning id", [company, MEMBER]))!.id;
  });
  await h.as(MEMBER, () => db.query("insert into public.stock_moves (company_id, item_id, warehouse_id, quantity, reason) values ($1, $2, $3, 100, 'receipt')", [company, steel, warehouse]));
});

/** A completed order of 3 with an approved drawing and a one-line plan (Width 10 ± 0.1). */
async function completed(sku: string) {
  const part = (await h.as(MEMBER, () => h.one<{ id: string }>("insert into public.items (company_id, kind, sku, name, revision) values ($1, 'part', $2, 'Bracket', 'A') returning id", [company, sku])))!.id;
  await h.as(MEMBER, () => db.query("insert into public.routing_operations (company_id, item_id, seq, name) values ($1, $2, 10, 'Saw')", [company, part]));
  const drawing = (await h.as(MEMBER, () => h.one<{ id: string }>("insert into public.files (company_id, storage_path, name, doc_type, number, revision, status, linked_type, linked_id, content_sha256) values ($1::uuid, $1::text || '/d/' || $2::text, $2, 'Drawing', 'D-' || $2::text, 'A', 'In review', 'item', $3, $4) returning id", [company, sku, part, sha256(sku)])))!.id;
  await h.as(OWNER, () => db.query("select public.approve_file($1, $2)", [drawing, sha256(sku)]));
  const plan = (await h.as(OWNER, () => h.one<{ id: string }>("insert into public.inspection_plans (company_id, item_id, revision, characteristic, kind, nominal, lower_limit, upper_limit, unit) values ($1, $2, 'A', 'Width', 'numeric', 10, 9.9, 10.1, 'mm') returning id", [company, part])))!.id;
  const order = (await h.as(MEMBER, () => h.one<{ id: string }>("insert into public.production_orders (company_id, item_id, revision, quantity) values ($1, $2, 'A', 3) returning id", [company, part])))!.id;
  await h.as(MEMBER, () => db.query("insert into public.order_materials (company_id, order_id, item_id, warehouse_id, quantity) values ($1, $2, $3, $4, 1)", [company, order, steel, warehouse]));
  await h.as(MEMBER, async () => {
    const active = (await h.one<{ id: string }>("select public.start_operation($1, $2, null) as id", [order, ben]))!.id;
    await db.query("select public.end_operation($1, 3, 0, '')", [active]);
  });
  return { part, drawing, plan, order };
}
const inspect = (order: string, plan: string, observed: string) => h.as(MEMBER, () => db.query("select public.record_inspection($1, $2)", [order, JSON.stringify([{ plan_id: plan, observed, result: "pass", sample_size: 1 }])]));

test("dispatch needs a completed job and a passed inspection", async () => {
  const j = await completed("DSP-1");
  await h.as(MEMBER, () => h.refuses("select public.dispatch_order($1, '')", [j.order], /inspection/));
  await inspect(j.order, j.plan, "12");
  await h.as(MEMBER, () => h.refuses("select public.dispatch_order($1, '')", [j.order], /inspection/));
  await inspect(j.order, j.plan, "10.02");
  const number = (await h.as(MEMBER, () => h.one<{ n: string }>("select public.dispatch_order($1, 'Pallet 1') as n", [j.order])))!.n;
  assert.match(number, /^DN-\d{4}-\d{4}$/);
  const row = await h.one<{ quantity: number; dispatched_by: string }>("select quantity, dispatched_by from public.dispatches where number = $1", [number]);
  assert.deepEqual(row, { quantity: 3, dispatched_by: MEMBER });
  await h.as(MEMBER, () => h.refuses("select public.dispatch_order($1, '')", [j.order], /already been dispatched/));
});

test("dispatch is blocked after the drawing went back to review or a newer revision appeared, unless an owner or admin releases it", async () => {
  const j = await completed("DSP-2");
  await inspect(j.order, j.plan, "10.0");
  await h.as(MEMBER, () => db.query("update public.files set status = 'In review' where id = $1", [j.drawing]));
  await h.as(MEMBER, () => h.refuses("select public.dispatch_order($1, '')", [j.order], /not approved/));
  await h.as(MEMBER, () => db.query("insert into public.files (company_id, storage_path, name, doc_type, number, revision, status, linked_type, linked_id, content_sha256) values ($1::uuid, $1::text || '/d/dsp2b', 'b', 'Drawing', 'D-DSP-2', 'B', 'In review', 'item', $2, $3)", [company, j.part, sha256("b")]));
  await h.as(MEMBER, () => h.refuses("select public.dispatch_order($1, '')", [j.order], /revision B exists|not approved/));
  await h.as(MEMBER, () => h.refuses("select public.release_dispatch($1, 'customer is fine with it')", [j.order], /owner or admin/));
  await h.as(OWNER, () => h.refuses("select public.release_dispatch($1, ' ')", [j.order], /reason/));
  await h.as(OWNER, () => db.query("select public.release_dispatch($1, 'Customer accepts rev A parts in writing (mail of today)')", [j.order]));
  await h.as(MEMBER, () => h.refuses("update public.production_orders set dispatch_release = null where id = $1", [j.order], /production functions/));
  assert.match((await h.as(MEMBER, () => h.one<{ n: string }>("select public.dispatch_order($1, '') as n", [j.order])))!.n, /^DN-/);
});

test("dispatch does not ship results that need review or failed, and dispatches cannot be written directly", async () => {
  const j = await completed("DSP-3");
  const review = (await h.as(OWNER, () => h.one<{ id: string }>("insert into public.inspection_plans (company_id, item_id, revision, characteristic, kind, unit) values ($1, $2, 'A', 'Bore H8', 'numeric', 'mm') returning id", [company, j.part])))!.id;
  await h.as(MEMBER, () => db.query("select public.record_inspection($1, $2)", [j.order, JSON.stringify([{ plan_id: j.plan, observed: "10", result: "pass", sample_size: 1 }, { plan_id: review, observed: "999", result: "pass", sample_size: 1 }])]));
  await h.as(MEMBER, () => h.refuses("select public.dispatch_order($1, '')", [j.order], /needs review/));
  await h.as(MEMBER, () => h.refuses("insert into public.dispatches (company_id, order_id, number, quantity) values ($1, $2, 'DN-X', 3)", [company, j.order], /permission denied/));
  await h.as(OUTSIDER, () => h.refuses("select public.dispatch_order($1, '')", [j.order], /not allowed/));
  assert.equal((await h.as(OUTSIDER, () => h.rows("select * from public.dispatches"))).length, 0);
});

test("review gaps: recorded payments cannot be edited or deleted from the app", async () => {
  const contact = (await h.as(MEMBER, () => h.one<{ id: string }>("insert into public.contacts (company_id, name, is_customer) values ($1, 'Payer', true) returning id", [company])))!.id;
  const payment = (await h.as(MEMBER, () => h.one<{ id: string }>("insert into public.payments (company_id, direction, contact_id, amount) values ($1, 'in', $2, 100) returning id", [company, contact])))!.id;
  await h.as(MEMBER, () => h.refuses("update public.payments set amount = 1 where id = $1", [payment], /payments are not edited/));
  await h.as(OWNER, () => h.refuses("update public.payments set amount = 1 where id = $1", [payment], /payments are not edited/));
  await h.as(OWNER, () => h.refuses("delete from public.payments where id = $1", [payment], /payments are not edited/));
});
