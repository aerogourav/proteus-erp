import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * Shared PGlite setup for the database tests: minimal stand-ins for Supabase's auth and storage schemas,
 * then every migration in supabase/migrations in order.
 */
export const SUPABASE_STANDIN = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated nologin;
  create role anon nologin;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text not null, owner uuid default auth.uid(), created_at timestamptz not null default now(), unique (bucket_id, name));
  alter table storage.objects enable row level security;
`;

export async function freshDatabase(users: string[]) {
  const db = new PGlite();
  await db.exec(SUPABASE_STANDIN);
  const dir = new URL("../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()) await db.exec(readFileSync(new URL(file, dir), "utf8"));
  await db.exec(`
    grant usage on schema auth to authenticated, anon;
    grant usage on schema storage to authenticated;
    grant select, insert, update, delete on storage.objects to authenticated;
  `);
  for (const user of users) await db.query("insert into auth.users (id) values ($1)", [user]);
  return db;
}

export function helpers(db: PGlite) {
  async function as<T>(user: string, run: () => Promise<T>): Promise<T> {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
    try { return await run(); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
  }
  const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
  const rows = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
  async function refuses(sql: string, params: unknown[], pattern: RegExp) {
    await assert.rejects(db.query(sql, params), (error: Error) => { assert.match(error.message, pattern); return true; });
  }
  return { as, one, rows, refuses };
}

export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
