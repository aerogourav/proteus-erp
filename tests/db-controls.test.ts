import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * Phase 3 database controls, run against all migrations in an in-memory Postgres (PGlite):
 * controlled approvals, stamped authors, locked invoices with credit notes, trigger-written audit history,
 * protected company deletion, yearly document numbering inside a transaction, and Storage policies per company.
 * The auth and storage schemas are minimal stand-ins for what Supabase provides.
 */

const SUPABASE_STANDIN = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated nologin;
  create role anon nologin;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean not null default false);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text not null, owner uuid default auth.uid(), created_at timestamptz not null default now());
  alter table storage.objects enable row level security;
`;
const GRANTS = `
  grant usage on schema auth to authenticated, anon;
  grant usage on schema storage to authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
`;

const OWNER = "00000000-0000-4000-8000-0000000000a1";
const OUTSIDER = "00000000-0000-4000-8000-0000000000b1";
const MEMBER = "00000000-0000-4000-8000-0000000000c1";
const db = new PGlite();
let companyA = "";
let companyB = "";
let customerA = "";

async function as<T>(user: string, run: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  try { return await run(); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}
const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
const count = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows.length;
const fails = (sql: string, params: unknown[] = []) => assert.rejects(db.query(sql, params));

before(async () => {
  await db.exec(SUPABASE_STANDIN);
  const dir = new URL("../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()) await db.exec(readFileSync(new URL(file, dir), "utf8"));
  await db.exec(GRANTS);
  await db.query("insert into auth.users (id) values ($1), ($2), ($3)", [OWNER, OUTSIDER, MEMBER]);
  companyA = (await as(OWNER, () => one<{ id: string }>("select public.create_company('Precision Works', 'manufacturing') as id")))!.id;
  companyB = (await as(OUTSIDER, () => one<{ id: string }>("select public.create_company('Other Shop', 'manufacturing') as id")))!.id;
  await as(OWNER, () => db.query("insert into public.memberships (company_id, user_id, role) values ($1, $2, 'member')", [companyA, MEMBER]));
  customerA = (await as(OWNER, () => one<{ id: string }>("insert into public.contacts (company_id, name, is_customer) values ($1, 'Kessler Maschinenbau', true) returning id", [companyA])))!.id;
});

/** A draft invoice with one line, as the member who writes it. */
async function draftInvoice(user: string, issueDate = "2026-11-03") {
  return as(user, async () => {
    const doc = (await one<{ id: string; number: string }>("insert into public.sales_documents (company_id, kind, number, contact_id, issue_date) values ($1, 'invoice', '', $2, $3) returning id, number", [companyA, customerA, issueDate]))!;
    await db.query("insert into public.sales_lines (company_id, document_id, description, quantity, unit_price, tax_rate) values ($1, $2, 'Bracket', 10, 20, 19)", [companyA, doc.id]);
    return doc;
  });
}

test("P12: a member cannot approve a drawing; approve_file(file, verified fingerprint) is the only way and stamps the approver", async () => {
  const file = (await as(MEMBER, () => one<{ id: string; created_by: string }>(
    "insert into public.files (company_id, storage_path, name, doc_type, number, revision, status, created_by, content_sha256) values ($1::uuid, $1::text || '/DRW-1_A.pdf', 'DRW-1_A.pdf', 'Drawing', 'DRW-1', 'A', 'In review', $2, encode(sha256(convert_to($3::text, 'UTF8')), 'hex')) returning id, created_by", [companyA, OWNER, 'DRW-1 A bytes'])))!;
  const fingerprint = (await one<{ h: string }>("select content_sha256 as h from public.files where id = $1", [file.id]))!.h;
  assert.equal(file.created_by, MEMBER, "created_by comes from the signed-in user, not the client");
  await as(MEMBER, () => fails("insert into public.files (company_id, storage_path, name, status, approved_at) values ($1::uuid, $1::text || '/x.pdf', 'x.pdf', 'Approved', now())", [companyA]));
  await as(MEMBER, () => fails("select public.approve_file($1, $2)", [file.id, fingerprint]));
  await as(MEMBER, () => fails("update public.files set status = 'Approved', approved_at = now(), approved_by = $2 where id = $1", [file.id, OWNER]));
  await as(OWNER, () => fails("update public.files set status = 'Approved', approved_at = now() where id = $1", [file.id]));
  await as(OUTSIDER, () => fails("select public.approve_file($1, $2)", [file.id, fingerprint]));
  await as(OWNER, () => db.query("select public.approve_file($1, $2)", [file.id, fingerprint]));
  const approved = await one<{ status: string; approved_by: string }>("select status, approved_by from public.files where id = $1", [file.id]);
  assert.deepEqual(approved, { status: "Approved", approved_by: OWNER });
  await as(MEMBER, () => fails("update public.files set approved_by = $2 where id = $1", [file.id, MEMBER]));
  // A file version is immutable: a new revision is a new record (since migration 20261106000000).
  await as(MEMBER, () => fails("update public.files set revision = 'B' where id = $1", [file.id]));
  assert.equal((await one<{ status: string }>("select status from public.files where id = $1", [file.id]))!.status, "Approved");
});

test("P12: issued invoices are numbered at issue, locked, and cancelled only with a credit note", async () => {
  const draft = await draftInvoice(MEMBER);
  assert.match(draft.number, /^DRAFT-/, "drafts do not use up invoice numbers");
  await as(MEMBER, () => fails("update public.sales_documents set status = 'Issued' where id = $1", [draft.id]));
  await as(MEMBER, () => db.query("select public.issue_sales_document($1)", [draft.id]));
  const issued = await one<{ number: string; status: string; total: string; created_by: string }>("select number, status, total, created_by from public.sales_documents where id = $1", [draft.id]);
  assert.match(issued!.number, /^INV-2026-\d{4}$/);
  assert.equal(issued!.status, "Issued");
  assert.equal(Number(issued!.total), 238, "totals are computed from the lines at issue");
  assert.equal(issued!.created_by, MEMBER);

  await as(OWNER, () => fails("update public.sales_documents set total = 1 where id = $1", [draft.id]));
  await as(OWNER, () => fails("update public.sales_documents set number = 'INV-2026-9999' where id = $1", [draft.id]));
  await as(OWNER, () => fails("update public.sales_lines set unit_price = 1 where document_id = $1", [draft.id]));
  await as(OWNER, () => fails("insert into public.sales_lines (company_id, document_id, description, quantity, unit_price) values ($1, $2, 'Extra', 1, 1)", [companyA, draft.id]));
  await as(OWNER, () => fails("delete from public.sales_documents where id = $1", [draft.id]));
  await as(MEMBER, () => db.query("update public.sales_documents set status = 'Paid' where id = $1", [draft.id]));
  await as(MEMBER, () => db.query("update public.sales_documents set status = 'Issued' where id = $1", [draft.id]));
  await as(MEMBER, () => fails("update public.sales_documents set status = 'Cancelled' where id = $1", [draft.id]));

  await as(MEMBER, () => fails("select public.cancel_sales_document($1, 'Wrong price')", [draft.id]));
  await as(OWNER, () => fails("select public.cancel_sales_document($1, '  ')", [draft.id]));
  await as(OWNER, () => db.query("select public.cancel_sales_document($1, 'Wrong unit price')", [draft.id]));
  const after = await one<{ status: string; number: string }>("select status, number from public.sales_documents where id = $1", [draft.id]);
  assert.deepEqual(after, { status: "Cancelled", number: issued!.number }, "the invoice and its number are kept");
  const note = await one<{ number: string; total: string; status: string; notes: string }>("select number, total, status, notes from public.sales_documents where kind = 'credit_note' and source_id = $1", [draft.id]);
  assert.match(note!.number, /^CN-\d{4}-\d{4}$/);
  assert.equal(Number(note!.total), -238);
  assert.equal(note!.status, "Issued");
  assert.equal(note!.notes, "Wrong unit price");
});

test("numbering: yearly sequences from the document date, inside the transaction, gap-free on rollback", async () => {
  const next = await draftInvoice(MEMBER, "2027-01-05");
  await as(MEMBER, () => db.query("select public.issue_sales_document($1)", [next.id]));
  assert.equal((await one<{ number: string }>("select number from public.sales_documents where id = $1", [next.id]))!.number, "INV-2027-0001", "a new year starts at 0001");

  const second = await draftInvoice(MEMBER, "2027-01-06");
  const third = await draftInvoice(MEMBER, "2027-01-06");
  await as(MEMBER, async () => {
    await db.exec("begin");
    await db.query("select public.issue_sales_document($1)", [second.id]);
    await db.exec("rollback");
  });
  await as(MEMBER, async () => {
    await db.exec("begin");
    await db.query("select public.issue_sales_document($1)", [third.id]);
    await db.query("select public.issue_sales_document($1)", [second.id]);
    await db.exec("commit");
  });
  const numbers = (await db.query<{ number: string }>("select number from public.sales_documents where id in ($1, $2) order by number", [second.id, third.id])).rows.map((row) => row.number);
  assert.deepEqual(numbers, ["INV-2027-0002", "INV-2027-0003"], "the rolled-back issue did not use up a number");
  const quote = await as(MEMBER, () => one<{ n: string }>("select public.document_number($1, 'quote', 'QT', '2028-02-01') as n", [companyA]));
  assert.equal(quote!.n, "QT-2028-0001");
  await as(OUTSIDER, () => fails("select public.document_number($1, 'quote', 'QT', '2028-02-01')", [companyA]));
});

test("P13: audit history is written by triggers, cannot be changed, and stays inside the company", async () => {
  const contact = (await as(MEMBER, () => one<{ id: string }>("insert into public.contacts (company_id, name, is_supplier) values ($1, 'Northline Metals', true) returning id", [companyA])))!.id;
  await as(MEMBER, () => db.query("update public.contacts set email = 'orders@northline.example' where id = $1", [contact]));
  const rows = await as(MEMBER, async () => (await db.query<{ action: string; actor: string; old_data: { email: string } | null; new_data: { email: string } }>(
    "select action, actor, old_data, new_data from public.audit_history where table_name = 'contacts' and row_id = $1 order by id", [contact])).rows);
  assert.deepEqual(rows.map((row) => row.action), ["insert", "update"]);
  assert.ok(rows.every((row) => row.actor === MEMBER));
  assert.equal(rows[1].old_data?.email, "");
  assert.equal(rows[1].new_data.email, "orders@northline.example");
  await as(MEMBER, () => fails("update public.audit_history set actor = null"));
  await as(OWNER, () => fails("delete from public.audit_history"));
  await as(OWNER, () => fails("insert into public.audit_history (company_id, table_name, action) values ($1, 'contacts', 'insert')", [companyA]));
  assert.equal(await as(OUTSIDER, () => count("select * from public.audit_history where company_id = $1", [companyA])), 0, "company B cannot read company A's history");
  // Pay changes are audited, but only admins can read them.
  const person = (await as(OWNER, () => one<{ id: string }>("insert into public.people (company_id, code, name) values ($1, 'E-1', 'Lena') returning id", [companyA])))!.id;
  await as(OWNER, () => db.query("insert into public.people_pay (person_id, company_id, pay_type, hourly_rate) values ($1, $2, 'hourly', 40)", [person, companyA]));
  assert.equal(await as(OWNER, () => count("select * from public.audit_history where table_name = 'people_pay'")), 1);
  assert.equal(await as(MEMBER, () => count("select * from public.audit_history where table_name = 'people_pay'")), 0);
});

test("P13: a company with issued records or history cannot be deleted; demo sandboxes still can", async () => {
  await as(OWNER, () => fails("delete from public.companies where id = $1", [companyA]));
  assert.equal(await count("select * from public.companies where id = $1", [companyA]), 1);
  assert.ok(await count("select * from public.audit_history where company_id = $1", [companyA]) > 0);
  // Demo sandboxes are created by the server only (since migration 20261106000000).
  await as(OWNER, () => fails("select public.create_company('Demo', 'manufacturing', true)"));
  const demo = (await one<{ id: string }>("insert into public.companies (name, industry, is_demo, expires_at) values ('Demo', 'manufacturing', true, now() + interval '7 days') returning id"))!.id;
  await db.query("insert into public.memberships (company_id, user_id, role) values ($1, $2, 'owner')", [demo, OWNER]);
  await as(OWNER, () => db.query("insert into public.contacts (company_id, name) values ($1, 'Demo customer')", [demo]));
  await db.query("update public.companies set expires_at = now() - interval '1 minute' where id = $1", [demo]);
  assert.equal((await one<{ n: number }>("select public.purge_expired_demos() as n"))!.n, 1);
  assert.equal(await count("select * from public.audit_history where company_id = $1", [demo]), 0, "a purged sandbox leaves no history behind (since migration 20261106000000)");
});

test("Storage: company files are readable and writable only inside the company's own folder", async () => {
  assert.equal(await count("select * from storage.buckets where id = 'company-files' and not public"), 1, "private bucket exists");
  await as(MEMBER, () => db.query("insert into storage.objects (bucket_id, name) values ('company-files', $1 || '/drawings/DRW-1_A.pdf')", [companyA]));
  assert.equal(await as(OWNER, () => count("select * from storage.objects")), 1);
  assert.equal(await as(OUTSIDER, () => count("select * from storage.objects")), 0, "company B cannot list company A's files");
  await as(OUTSIDER, () => fails("insert into storage.objects (bucket_id, name) values ('company-files', $1 || '/sneaky.pdf')", [companyA]));
  await as(MEMBER, () => fails("insert into storage.objects (bucket_id, name) values ('company-files', 'no-company-folder.pdf')"));
  const removedByMember = await as(MEMBER, async () => (await db.query("delete from storage.objects")).affectedRows);
  assert.equal(removedByMember, 0, "only admins delete files");
  const removedByOutsider = await as(OUTSIDER, async () => (await db.query("delete from storage.objects")).affectedRows);
  assert.equal(removedByOutsider, 0);
});

test("isolation: company B cannot read company A's invoices, credit notes, files or history", async () => {
  assert.equal(await as(OUTSIDER, () => count("select * from public.sales_documents where company_id = $1", [companyA])), 0);
  assert.equal(await as(OUTSIDER, () => count("select * from public.sales_lines where company_id = $1", [companyA])), 0);
  assert.equal(await as(OUTSIDER, () => count("select * from public.files where company_id = $1", [companyA])), 0);
  const invoice = (await one<{ id: string }>("select id from public.sales_documents where company_id = $1 and kind = 'invoice' and status = 'Issued' limit 1", [companyA]))!.id;
  await as(OUTSIDER, () => fails("select public.cancel_sales_document($1, 'not mine')", [invoice]));
  await as(OUTSIDER, () => fails("select public.issue_sales_document($1)", [invoice]));
  assert.equal(await as(OUTSIDER, () => count("select * from public.companies")), 1);
  void companyB;
});
