import { test, before } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { freshDatabase, helpers, sha256 } from "./db-helpers.ts";

/**
 * Hardening phase 2 (migration 20261107000000_finance_material.sql): credit notes, document kinds, numbering, issue dates,
 * stock and material controls, locked lots, frozen job costs, operator identity and activity written only by the database.
 */
const OWNER = "00000000-0000-4000-8000-0000000000a4";
const MEMBER = "00000000-0000-4000-8000-0000000000c4";
const OUTSIDER = "00000000-0000-4000-8000-0000000000b4";
let db: PGlite;
let h: ReturnType<typeof helpers>;
let company = "";
let customer = "";
let warehouse = "";
let steel = "";
let ben = "";
let lena = "";
const day = (offset: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); };

before(async () => {
  db = await freshDatabase([OWNER, MEMBER, OUTSIDER]);
  h = helpers(db);
  company = (await h.as(OWNER, () => h.one<{ id: string }>("select public.create_company('Precision Works', 'manufacturing') as id")))!.id;
  await h.as(OUTSIDER, () => db.query("select public.create_company('Other Shop', 'manufacturing')"));
  await h.as(OWNER, async () => {
    await db.query("insert into public.memberships (company_id, user_id, role) values ($1, $2, 'member')", [company, MEMBER]);
    customer = (await h.one<{ id: string }>("insert into public.contacts (company_id, name, is_customer) values ($1, 'Kessler Maschinenbau', true) returning id", [company]))!.id;
    warehouse = (await h.one<{ id: string }>("insert into public.warehouses (company_id, code, name) values ($1, 'MAIN', 'Main') returning id", [company]))!.id;
    steel = (await h.one<{ id: string }>("insert into public.items (company_id, kind, sku, name, unit, cost) values ($1, 'material', 'STEEL', 'Steel', 'kg', 2) returning id", [company]))!.id;
    ben = (await h.one<{ id: string }>("insert into public.people (company_id, code, name, user_id) values ($1, 'E-2', 'Ben Op', $2) returning id", [company, MEMBER]))!.id;
    lena = (await h.one<{ id: string }>("insert into public.people (company_id, code, name) values ($1, 'E-1', 'Lena Shift') returning id", [company]))!.id;
    await db.query("insert into public.people_pay (person_id, company_id, pay_type, hourly_rate) values ($1, $2, 'hourly', 30), ($3, $2, 'hourly', 40)", [ben, company, lena]);
    await db.query("select public.set_person_pin($1, '4321')", [lena]);
  });
  await h.as(MEMBER, () => db.query("insert into public.stock_moves (company_id, item_id, warehouse_id, quantity, reason, lot, certificate) values ($1, $2, $3, 500, 'receipt', 'H-777', 'CERT-777')", [company, steel, warehouse]));
});

async function draft(user: string, issueDate = day(0)) {
  return h.as(user, async () => {
    const id = (await h.one<{ id: string }>("insert into public.sales_documents (company_id, kind, number, contact_id, issue_date) values ($1, 'invoice', '', $2, $3) returning id", [company, customer, issueDate]))!.id;
    await db.query("insert into public.sales_lines (company_id, document_id, description, quantity, unit_price, tax_rate) values ($1, $2, 'Part', 1, 100, 19)", [company, id]);
    return id;
  });
}

async function job(sku: string) {
  const part = (await h.as(MEMBER, () => h.one<{ id: string }>("insert into public.items (company_id, kind, sku, name, revision) values ($1, 'part', $2, 'Bracket', 'A') returning id", [company, sku])))!.id;
  await h.as(MEMBER, () => db.query("insert into public.routing_operations (company_id, item_id, seq, name) values ($1, $2, 10, 'Saw')", [company, part]));
  const file = (await h.as(MEMBER, () => h.one<{ id: string }>("insert into public.files (company_id, storage_path, name, doc_type, number, revision, status, linked_type, linked_id, content_sha256) values ($1::uuid, $1::text || '/d/' || $2::text, $2, 'Drawing', 'D-' || $2::text, 'A', 'In review', 'item', $3, $4) returning id", [company, sku, part, sha256(sku)])))!.id;
  await h.as(OWNER, () => db.query("select public.approve_file($1, $2)", [file, sha256(sku)]));
  const order = (await h.as(MEMBER, () => h.one<{ id: string }>("insert into public.production_orders (company_id, item_id, revision, quantity) values ($1, $2, 'A', 2) returning id", [company, part])))!.id;
  const material = (await h.as(MEMBER, () => h.one<{ id: string }>("insert into public.order_materials (company_id, order_id, item_id, warehouse_id, quantity) values ($1, $2, $3, $4, 5) returning id", [company, order, steel, warehouse])))!.id;
  return { part, order, material };
}

/* ---------- N8 ---------- */

test("N8: a member cannot create or issue a credit note; quotes cannot become invoices", async () => {
  await h.as(MEMBER, () => h.refuses("insert into public.sales_documents (company_id, kind, number, contact_id) values ($1, 'credit_note', '', $2)", [company, customer], /cancelling an invoice/));
  const quote = (await h.as(MEMBER, () => h.one<{ id: string; number: string }>("insert into public.sales_documents (company_id, kind, number, contact_id) values ($1, 'quote', '', $2) returning id, number", [company, customer])))!;
  assert.match(quote.number, /^QT-\d{4}-\d{4}$/, "numbers still come from the yearly sequence");
  await h.as(MEMBER, () => h.refuses("update public.sales_documents set kind = 'invoice' where id = $1", [quote.id], /kind of a document never changes/));
  await h.as(OWNER, () => h.refuses("update public.sales_documents set kind = 'invoice', status = 'Issued' where id = $1", [quote.id], /kind of a document never changes/));
});

test("N8: nobody burns document numbers directly", async () => {
  await h.as(MEMBER, () => h.refuses("select public.document_number($1, 'invoice', 'INV', current_date)", [company], /permission denied/));
  await h.as(OWNER, () => h.refuses("select public.next_number($1, 'invoice', 'INV')", [company], /permission denied/));
});

test("N8: issue dates: no future, no older than the last issued, backdating needs an owner or admin with a reason, closed periods stay closed", async () => {
  const today = await draft(MEMBER);
  await h.as(MEMBER, () => db.query("select public.issue_sales_document($1)", [today]));
  const future = await draft(MEMBER, day(5));
  await h.as(MEMBER, () => h.refuses("select public.issue_sales_document($1)", [future], /future/));
  const earlier = await draft(MEMBER, day(-1));
  await h.as(MEMBER, () => h.refuses("select public.issue_sales_document($1)", [earlier], /not be earlier than the last issued/));
  // In a fresh year sequence nothing is issued before it, so only the backdating rule applies.
  const oldOne = (await h.as(MEMBER, () => h.one<{ id: string }>("insert into public.sales_documents (company_id, kind, number, contact_id, issue_date) values ($1, 'invoice', '', $2, $3) returning id", [company, customer, `${Number(day(0).slice(0, 4)) - 1}-12-20`])))!.id;
  await h.as(MEMBER, () => db.query("insert into public.sales_lines (company_id, document_id, description, quantity, unit_price) values ($1, $2, 'Part', 1, 10)", [company, oldOne]));
  await h.as(MEMBER, () => h.refuses("select public.issue_sales_document($1)", [oldOne], /more than 3 days back/));
  await h.as(MEMBER, () => h.refuses("select public.issue_sales_document($1, 'forgot it')", [oldOne], /more than 3 days back/));
  await h.as(OWNER, () => h.refuses("select public.issue_sales_document($1, ' ')", [oldOne], /more than 3 days back/));
  await h.as(OWNER, () => db.query("select public.issue_sales_document($1, 'Delivered in December; invoice was forgotten')", [oldOne]));
  await h.as(MEMBER, () => h.refuses("select public.close_books($1, $2, 'month end')", [company, day(-1)], /owner or admin/));
  await h.as(OWNER, () => h.refuses("update public.companies set books_closed_until = $2 where id = $1", [company, day(-1)], /set by the server|close_books/));
  await h.as(OWNER, () => db.query("select public.close_books($1, $2, 'Previous year handed to the tax adviser')", [company, `${Number(day(0).slice(0, 4)) - 1}-12-31`]));
  const inClosed = (await h.as(MEMBER, () => h.one<{ id: string }>("insert into public.sales_documents (company_id, kind, number, contact_id, issue_date) values ($1, 'invoice', '', $2, $3) returning id", [company, customer, `${Number(day(0).slice(0, 4)) - 1}-12-30`])))!.id;
  await h.as(MEMBER, () => db.query("insert into public.sales_lines (company_id, document_id, description, quantity, unit_price) values ($1, $2, 'Part', 1, 10)", [company, inClosed]));
  await h.as(OWNER, () => h.refuses("select public.issue_sales_document($1, 'late but justified reason')", [inClosed], /closed/));
  await h.as(OWNER, () => h.refuses("select public.close_books($1, $2, 'reopen please')", [company, `${Number(day(0).slice(0, 4)) - 1}-06-30`], /never reopened/));
});

test("N9: a cancelled invoice cannot be marked paid", async () => {
  const id = await draft(MEMBER);
  await h.as(MEMBER, () => db.query("select public.issue_sales_document($1)", [id]));
  await h.as(OWNER, () => db.query("select public.cancel_sales_document($1, 'Wrong price on line 1')", [id]));
  await h.as(MEMBER, () => h.refuses("update public.sales_documents set status = 'Paid' where id = $1", [id], /locked/));
});

/* ---------- N10 ---------- */

test("N10: members record real receipts only; adjustments need an owner or admin, a reason and leave audit history", async () => {
  await h.as(MEMBER, () => h.refuses("insert into public.stock_moves (company_id, item_id, warehouse_id, quantity, reason) values ($1, $2, $3, 1000, 'adjustment')", [company, steel, warehouse], /only goods receipts/));
  await h.as(MEMBER, () => h.refuses("insert into public.stock_moves (company_id, item_id, warehouse_id, quantity, reason) values ($1, $2, $3, -50, 'receipt')", [company, steel, warehouse], /only goods receipts/));
  await h.as(MEMBER, () => h.refuses("select public.adjust_stock($1, $2, 1000, 'found more')", [steel, warehouse], /owner or admin/));
  await h.as(OWNER, () => h.refuses("select public.adjust_stock($1, $2, -3, ' ')", [steel, warehouse], /reason/));
  await h.as(OWNER, () => db.query("select public.adjust_stock($1, $2, -3, 'Stock count: 3 kg missing')", [steel, warehouse]));
  const audit = await h.rows("select 1 from public.audit_history where table_name = 'stock_moves' and company_id = $1", [company]);
  assert.ok(audit.length >= 2, "receipts and adjustments are in the audit history");
});

test("N10: after release a member cannot shrink material; an owner or admin changes it with a reason and the stock follows", async () => {
  const j = await job("REL-1");
  // Before release a member may still plan the material.
  await h.as(MEMBER, () => db.query("update public.order_materials set quantity = 5 where id = $1", [j.material]));
  await h.as(MEMBER, async () => { await db.query("select public.start_operation($1, $2, null)", [j.order, ben]); });
  await h.as(MEMBER, () => h.refuses("update public.order_materials set quantity = 1 where id = $1", [j.material], /fixed once the order is released/));
  await h.as(MEMBER, () => h.refuses("select public.change_order_material($1, 1, 'less needed')", [j.material], /owner or admin/));
  const before = Number((await h.one<{ s: string }>("select coalesce(sum(quantity), 0) as s from public.stock_moves where item_id = $1", [steel]))!.s);
  await h.as(OWNER, () => db.query("select public.change_order_material($1, 3, 'Nesting saved 2 kg, confirmed by planning')", [j.material]));
  const after = Number((await h.one<{ s: string }>("select coalesce(sum(quantity), 0) as s from public.stock_moves where item_id = $1", [steel]))!.s);
  assert.equal(after - before, 2, "2 kg returned to stock");
  await h.as(MEMBER, async () => {
    const active = (await h.one<{ id: string }>("select id from public.active_operations where order_id = $1", [j.order]))!.id;
    await db.query("select public.end_operation($1, 2, 0, '')", [active]);
  });
});

/* ---------- N11, P9 ---------- */

test("N11: the heat number from goods receipt follows to the job and locks when the job closes", async () => {
  const j = await job("LOT-1");
  await h.as(MEMBER, async () => {
    const active = (await h.one<{ id: string }>("select public.start_operation($1, $2, null) as id", [j.order, ben]))!.id;
    await db.query("select public.end_operation($1, 2, 0, '')", [active]);
  });
  const lot = await h.one<{ heat: string; certificate: string }>("select heat, certificate from public.material_lots where order_id = $1", [j.order]);
  assert.deepEqual(lot, { heat: "H-777", certificate: "CERT-777" });
  await h.as(MEMBER, () => h.refuses("update public.material_lots set heat = 'H-000' where order_id = $1", [j.order], /closed job are locked/));
  await h.as(MEMBER, () => h.refuses("select public.correct_material_lot($1, 'STEEL', 'H-778', 'CERT-777', 'typo')", [j.order], /owner or admin/));
  await h.as(OWNER, () => db.query("select public.correct_material_lot($1, 'STEEL', 'H-778', 'CERT-777', 'Typo in heat number on the receipt')", [j.order]));
  const old = await h.one<{ old_heat: string }>("select old_data ->> 'heat' as old_heat from public.audit_history where table_name = 'material_lots' and action = 'update' order by id desc limit 1");
  assert.equal(old!.old_heat, "H-777", "the old value is kept");
});

test("P9: a closed job's material, labour, overhead and rates do not change after later edits", async () => {
  await db.query("update public.companies set settings = settings || '{\"overhead_per_hour\": 15, \"fx\": {\"EUR\": 1, \"USD\": 0.9}}'::jsonb where id = $1", [company]);
  const j = await job("COST-1");
  await h.as(MEMBER, async () => {
    const active = (await h.one<{ id: string }>("select public.start_operation($1, $2, null) as id", [j.order, ben]))!.id;
    await db.query("select public.end_operation($1, 2, 0, '')", [active]);
  });
  const snap = (await h.one<{ c: Record<string, unknown> }>("select cost_snapshot as c from public.production_orders where id = $1", [j.order]))!.c;
  assert.equal(Number(snap.material), 10, "5 kg × 2");
  assert.ok("overhead" in snap && "labour" in snap && "fx" in snap);
  await db.query("update public.items set cost = 99 where id = $1", [steel]);
  await db.query("update public.people_pay set hourly_rate = 999 where person_id = $1", [ben]);
  await db.query("update public.companies set settings = settings || '{\"overhead_per_hour\": 500, \"fx\": {\"EUR\": 1, \"USD\": 5}}'::jsonb where id = $1", [company]);
  const later = (await h.one<{ c: Record<string, unknown> }>("select cost_snapshot as c from public.production_orders where id = $1", [j.order]))!.c;
  assert.deepEqual(later, snap);
});

/* ---------- N14 ---------- */

test("N14: booking as another person needs their PIN; wrong PINs are counted and lock the PIN", async () => {
  const j = await job("PIN-1");
  await h.as(MEMBER, () => h.refuses("select public.start_operation($1, $2, null)", [j.order, lena], /PIN/));
  await h.as(MEMBER, () => h.refuses("update public.people set user_id = $2 where id = $1", [lena, MEMBER], /owner or admin links/));
  const wrong = await h.as(MEMBER, () => h.one<{ id: string | null }>("select public.start_operation_pin($1, $2, null, '0000') as id", [j.order, lena]));
  assert.equal(wrong!.id, null, "wrong PIN: no booking");
  const right = await h.as(MEMBER, () => h.one<{ id: string | null }>("select public.start_operation_pin($1, $2, null, '4321') as id", [j.order, lena]));
  assert.ok(right!.id);
  await h.as(MEMBER, () => h.refuses("select public.end_operation($1, 2, 0, '')", [right!.id], /PIN/));
  assert.equal((await h.as(MEMBER, () => h.one<{ s: string | null }>("select public.end_operation_pin($1, 2, 0, '', '9999') as s", [right!.id])))!.s, null);
  assert.equal((await h.as(MEMBER, () => h.one<{ s: string }>("select public.end_operation_pin($1, 2, 0, '', '4321') as s", [right!.id])))!.s, "Completed");
  for (let i = 0; i < 5; i += 1) await h.as(MEMBER, () => db.query("select public.start_operation_pin($1, $2, null, '1111')", [j.order, lena]));
  const locked = await h.one<{ locked: boolean }>("select locked_until > now() as locked from public.people_pins where person_id = $1", [lena]);
  assert.equal(locked!.locked, true, "five wrong PINs lock it");
  await h.as(MEMBER, () => h.refuses("select * from public.people_pins", [], /permission denied/));
  await h.as(OUTSIDER, () => h.refuses("select public.start_operation_pin($1, $2, null, '4321')", [j.order, lena], /not allowed/));
});

test("N14: activity cannot be forged from the app; contacts still appear in the activity log", async () => {
  await h.as(MEMBER, () => h.refuses("insert into public.activity_log (company_id, module, action, summary) values ($1, 'finance', 'pay', 'Invoice paid')", [company], /permission denied|row-level security/));
  await h.as(MEMBER, () => db.query("insert into public.contacts (company_id, name, is_supplier) values ($1, 'Northline Metals', true)", [company]));
  const row = await h.one<{ summary: string; actor: string }>("select summary, actor from public.activity_log where company_id = $1 and module = 'contacts' order by id desc limit 1", [company]);
  assert.match(row!.summary, /Northline Metals/);
  assert.equal(row!.actor, MEMBER);
});
