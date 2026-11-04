import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * Runs the Supabase migrations in an in-memory Postgres (PGlite) and checks the security rules:
 * company isolation, roles, numbering and the append-only activity log.
 * The `auth` schema and `authenticated` role are minimal stand-ins for what Supabase provides.
 */

const SUPABASE_STANDIN = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated nologin;
  create role anon nologin;
  -- Like Supabase: API roles get execute on every new function in public, granted explicitly.
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`;
// Like a Supabase project with "Automatically expose new tables" off: only the auth schema is reachable;
// all table access must come from the migration's own grants.
const GRANTS = `
  grant usage on schema auth to authenticated, anon;
`;

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const C = "00000000-0000-4000-8000-00000000000c";
const db = new PGlite();

async function as<T>(user: string, run: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  try { return await run(); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}
const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
const count = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows.length;
async function fails(sql: string, params: unknown[] = []) {
  await assert.rejects(db.query(sql, params));
}

let companyA = "";
let companyB = "";

before(async () => {
  await db.exec(SUPABASE_STANDIN);
  const dir = new URL("../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()) await db.exec(readFileSync(new URL(file, dir), "utf8"));
  await db.exec(GRANTS);
  await db.query("insert into auth.users (id) values ($1), ($2), ($3)", [A, B, C]);
  companyA = (await as(A, () => one<{ id: string }>("select public.create_company('Precision Works', 'manufacturing') as id")))!.id;
  companyB = (await as(B, () => one<{ id: string }>("select public.create_company('Cloudly', 'saas') as id")))!.id;
});

test("a company's records are invisible and unwritable to other companies", async () => {
  await as(A, () => db.query("insert into public.contacts (company_id, name, is_customer) values ($1, 'Kessler Maschinenbau', true)", [companyA]));
  await as(B, () => db.query("insert into public.contacts (company_id, name, is_customer) values ($1, 'Globex', true)", [companyB]));

  assert.equal(await as(A, () => count("select * from public.contacts")), 1);
  assert.equal(await as(B, () => count("select * from public.contacts where company_id = $1", [companyA])), 0);
  assert.equal(await as(B, () => count("select * from public.companies")), 1);
  await as(B, () => fails("insert into public.contacts (company_id, name) values ($1, 'Sneaky')", [companyA]));
  const changed = await as(B, async () => (await db.query("update public.contacts set name = 'Hacked' where company_id = $1", [companyA])).affectedRows);
  assert.equal(changed, 0);
});

test("a record cannot point at another company's record, even with a known id", async () => {
  const globex = (await as(B, () => one<{ id: string }>("select id from public.contacts where name = 'Globex'")))!.id;
  await as(A, () => fails("insert into public.sales_documents (company_id, kind, number, contact_id) values ($1, 'quote', 'Q-1', $2)", [companyA, globex]));
});

test("signed-out visitors (anon) see nothing and cannot create companies", async () => {
  await db.exec("set role anon; select set_config('request.jwt.claim.sub', '', false);");
  try {
    await fails("select * from public.companies");
    await fails("select * from public.contacts");
    await fails("select public.create_company('Anon Ltd', 'saas')");
    await fails("select public.purge_expired_demos()");
  } finally { await db.exec("reset role;"); }
});

test("companies are only created through create_company, never by direct insert", async () => {
  await as(A, () => fails("insert into public.companies (name, industry) values ('Shadow', 'saas')"));
});

test("viewers read but cannot write; admins cannot hand out the owner role", async () => {
  await as(A, () => db.query("insert into public.memberships (company_id, user_id, role) values ($1, $2, 'viewer')", [companyA, C]));
  assert.equal(await as(C, () => count("select * from public.contacts")), 1);
  await as(C, () => fails("insert into public.contacts (company_id, name) values ($1, 'Viewer write')", [companyA]));
  await as(A, () => fails("update public.memberships set role = 'owner' where user_id = $1", [C]));
  await as(C, () => fails("insert into public.memberships (company_id, user_id, role) values ($1, $2, 'admin')", [companyA, B]));
});

test("pay data is visible to admins only", async () => {
  const person = (await as(A, () => one<{ id: string }>("insert into public.people (company_id, code, name) values ($1, 'E-1001', 'Lena Hoffmann') returning id", [companyA])))!.id;
  await as(A, () => db.query("insert into public.people_pay (person_id, company_id, pay_type, monthly_salary) values ($1, $2, 'salary', 4800)", [person, companyA]));
  assert.equal(await as(A, () => count("select * from public.people_pay")), 1);
  assert.equal(await as(C, () => count("select * from public.people")), 1);
  assert.equal(await as(C, () => count("select * from public.people_pay")), 0);
});

test("document numbers are sequential per company and kind", async () => {
  const year = new Date().getFullYear();
  const first = await as(A, () => one<{ n: string }>("select public.next_number($1, 'quote', 'QT') as n", [companyA]));
  const second = await as(A, () => one<{ n: string }>("select public.next_number($1, 'quote', 'QT') as n", [companyA]));
  const otherCompany = await as(B, () => one<{ n: string }>("select public.next_number($1, 'quote', 'QT') as n", [companyB]));
  assert.equal(first!.n, `QT-${year}-0001`);
  assert.equal(second!.n, `QT-${year}-0002`);
  assert.equal(otherCompany!.n, `QT-${year}-0001`);
  await as(B, () => fails("select public.next_number($1, 'quote', 'QT')", [companyA]));
});

test("the activity log is append-only and always names the real user", async () => {
  await as(A, () => db.query("insert into public.activity_log (company_id, module, action, summary, actor) values ($1, 'sales', 'create', 'Quote created', $2)", [companyA, B]));
  const row = await as(A, () => one<{ actor: string }>("select actor from public.activity_log where company_id = $1", [companyA]));
  assert.equal(row!.actor, A);
  // Refused at the privilege level, before row-level security is even consulted.
  await as(A, () => fails("update public.activity_log set summary = 'rewritten'"));
  await as(A, () => fails("delete from public.activity_log"));
  assert.equal(await count("select * from public.activity_log where summary = 'Quote created'"), 1);
});

test("stock is a ledger and stock levels respect company isolation", async () => {
  await as(A, async () => {
    const item = (await one<{ id: string }>("insert into public.items (company_id, kind, sku, name, unit, track_stock) values ($1, 'material', 'AL-7075-70', 'EN AW-7075 bar Ø70', 'm', true) returning id", [companyA]))!.id;
    const wh = (await one<{ id: string }>("insert into public.warehouses (company_id, code, name) values ($1, 'MAIN', 'Main store') returning id", [companyA]))!.id;
    await db.query("insert into public.stock_moves (company_id, item_id, warehouse_id, quantity, reason) values ($1, $2, $3, 12, 'receipt'), ($1, $2, $3, -4.5, 'issue')", [companyA, item, wh]);
    const level = await one<{ on_hand: string }>("select on_hand from public.stock_levels where item_id = $1", [item]);
    assert.equal(Number(level!.on_hand), 7.5);
    await fails("update public.stock_moves set quantity = 100");
  });
  assert.equal(await as(B, () => count("select * from public.stock_levels")), 0);
});

test("expired demo companies are purged with all their data; users cannot trigger the purge", async () => {
  // Demo sandboxes are created by the server only (since migration 20261106000000).
  await as(A, () => fails("select public.create_company('Demo Shop', 'commerce', true)"));
  const demo = (await one<{ id: string }>("insert into public.companies (name, industry, is_demo, expires_at) values ('Demo Shop', 'commerce', true, now() + interval '7 days') returning id"))!.id;
  await db.query("insert into public.memberships (company_id, user_id, role) values ($1, $2, 'owner')", [demo, A]);
  await as(A, () => db.query("insert into public.contacts (company_id, name) values ($1, 'Demo customer')", [demo]));
  await as(A, () => fails("select public.purge_expired_demos()"));
  await db.query("update public.companies set expires_at = now() - interval '1 minute' where id = $1", [demo]);
  const purged = await one<{ n: number }>("select public.purge_expired_demos() as n");
  assert.equal(purged!.n, 1);
  assert.equal(await count("select * from public.contacts where company_id = $1", [demo]), 0);
  assert.equal(await count("select * from public.companies where id = $1", [companyA]), 1);
});

test("website leads: visitors can submit but nobody can read them through the API; repeats are limited", async () => {
  const submit = (email: string) => db.query<{ ok: boolean }>("select public.submit_lead('Ada', $1, 'Analytical Engines', 'Owner', 'Our orders live in spreadsheets.') as ok", [email]);
  await db.exec("set role anon; select set_config('request.jwt.claim.sub', '', false);");
  try {
    assert.equal((await submit("ada@example.com")).rows[0]!.ok, true);
    assert.equal((await submit("ADA@example.com")).rows[0]!.ok, true);
    assert.equal((await submit("ada@example.com")).rows[0]!.ok, true);
    assert.equal((await submit("ada@example.com")).rows[0]!.ok, false, "4th from the same address within an hour is refused");
    await assert.rejects(submit("not-an-email"));
    await fails("select * from public.leads");
    await fails("delete from public.leads");
  } finally { await db.exec("reset role;"); }
  assert.equal(await as(A, () => count("select * from public.leads").catch(() => -1)), -1, "signed-in users cannot read leads either");
  assert.equal(await count("select * from public.leads"), 3, "the owner sees them in the dashboard (as admin)");
});

test("website leads record the chosen free offer; an unknown offer is refused", async () => {
  const submit = (email: string, offer: string) => db.query<{ ok: boolean }>("select public.submit_lead_with_offer('Lin', $1, 'Werkstatt Lin', '', 'One cell, job release on paper.', $2) as ok", [email, offer]);
  await db.exec("set role anon; select set_config('request.jwt.claim.sub', '', false);");
  try {
    assert.equal((await submit("lin@example.com", "pilot")).rows[0]!.ok, true);
    assert.equal((await submit("lin2@example.com", "walkthrough")).rows[0]!.ok, true);
    await assert.rejects(submit("lin3@example.com", "free-erp"));
    await fails("select offer from public.leads");
  } finally { await db.exec("reset role;"); }
  const rows = (await db.query<{ email: string; offer: string }>("select email, offer from public.leads order by created_at")).rows;
  assert.deepEqual(rows.filter((row) => row.email.startsWith("lin")).map((row) => row.offer), ["pilot", "walkthrough"]);
  assert.ok(rows.filter((row) => row.email.startsWith("ada")).every((row) => row.offer === "call"), "older leads default to the workflow call");
});
