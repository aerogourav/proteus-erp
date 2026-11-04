# Operations

How BOH ERP data is kept, corrected and closed. This describes what the database does today and what the owner must do by hand.
It is not a legal opinion: retention periods must be confirmed with your tax adviser.

## What the database enforces (migration `20261104000000_controls.sql`)

- **Approvals** of files (for example drawing revisions) happen only through `approve_file()`, by an owner or admin of the company.
  The approver and time are stamped by the database. A new number, revision or file sends an approved file back to "In review".
- **Authors** (`created_by`) on documents, payments, stock moves and files are taken from the signed-in user, never from the client.
- **Invoices and credit notes** get their number when issued (`issue_sales_document()`), from a yearly sequence based on the
  document date (`INV-2027-0001`). After issue they are locked: only the payment state (Issued ↔ Paid) can change.
  Mistakes are corrected with `cancel_sales_document()` (owner or admin, reason required), which issues a credit note.
  Issued documents are never deleted and numbers are never reused. A rolled-back transaction gives its number back.
- **Audit history** (`audit_history`) is written by database triggers for every insert, update and delete on business tables.
  Nobody can change or delete it through the API. Members can read their company's history; pay changes are visible to admins only.
- **Companies** that have issued invoices, activity or history cannot be deleted from the app. Expired demo sandboxes are still purged.
- **Files in Storage** live in the private bucket `company-files` under `<company_id>/…`. Members read, members (not viewers) upload,
  admins delete. Other companies cannot list or read them.

## Pilot closure and deletion (operator process)

Decided 2026-11-04: pilot companies are deleted through this documented operator process, including their audit history,
after legal and tax advice. Deletion is promised only for records with no legal duty to keep them.

1. **Request.** The company owner asks in writing, or in the app with `request_company_closure(company, reason)`.
   This writes a `company_closures` row (state `requested`) and an activity entry. Nothing is deleted.
2. **Export.** Give the customer their data (Supabase → Table Editor, filter by `company_id`, or a SQL export).
3. **Close access.** In the Supabase SQL editor, as the database owner:
   `select public.operator_close_access('<company-id>', '<why, on whose request>');`
   This removes every membership. Records stay. Logged as `access_closed`.
4. **Delete what has no legal duty to be kept.** If the company has no issued invoices or credit notes:
   `select public.operator_delete_company('<company-id>', '<exact company name>', false, '<reason and advice>');`
   It deletes all records and the company's audit history and logs `deleted` with record counts.
   With issued invoices this call is refused: those records stay for the legal retention period (in Germany commonly up to
   10 years for accounting records; confirm with your tax adviser).
5. **After the retention period**, on written advice:
   `select public.operator_delete_company('<company-id>', '<exact company name>', true, '<advice reference>');`
6. The `company_closures` rows (company name, reason, counts, no business data) are kept as evidence.

These operator functions cannot be called from the app or the API. From the app, a company with issued documents or
history can never be deleted, whether or not it is flagged as a demo. Demo sandboxes are created only by the server
(service role) and purged by `purge_expired_demos()`.

## Error monitoring

- `src/instrumentation.ts` writes every server error Next.js catches as one JSON line tagged `boh-error`
  (path without query, method, route, error message and digest). Headers, cookies, query strings and form data are never logged.
- Where to look: Vercel → Project → Logs, search `boh-error`. Vercel keeps runtime logs only for a short time on the free plan,
  so check them after every pilot day or when a user reports a problem.
- Database errors raised by the rule functions (for example "Only 4 parts can be booked at Op 20") are expected answers,
  shown to the user, not incidents.
- Not in place: alerting. Add an error-reporting service (for example Sentry) when a paying customer uses the app; that needs an account you create.

## Backup and restore (manual steps for the owner)

Check your plan in Supabase → Database → Backups. Do not rely on Supabase backups on the free plan.

Weekly, and before every migration:

```bash
npx supabase db dump --db-url "$SUPABASE_DB_URL" -f backup/schema.sql
npx supabase db dump --db-url "$SUPABASE_DB_URL" --data-only -f backup/data.sql
```

- `supabase db dump` may need Docker Desktop running; if it is not installed, export each table as CSV from Supabase → Table Editor → Export, or use `pg_dump` with the same connection string.
- `SUPABASE_DB_URL` is the connection string from Supabase → Project Settings → Database. It contains the database password:
  keep it in your password manager, never in the repository or in chat.
- Store the files encrypted (for example an encrypted disk or a password-protected archive) outside the repository.
- Files in Storage (`company-files`) are not part of the dump. Download them from Supabase → Storage when a pilot uses real files.

Restore drill (once before the first pilot, then every quarter):

1. Create a new, empty Supabase project (a test project, not production).
2. `psql "$TEST_DB_URL" -f backup/schema.sql` then `psql "$TEST_DB_URL" -f backup/data.sql`.
3. Point a local copy of the app at the test project (`.env.local`) and check that you can sign in and see the pilot company's orders.
4. Write down the date, how long it took and anything that failed. Delete the test project afterwards.

## Support process (proposal, to be confirmed by you)

1. Pilot users report problems to the contact address in the Impressum or the address agreed in the pilot letter.
2. Within one working day: confirm receipt, ask for the order number, the time and a screenshot. Do not ask for passwords.
3. Look up `boh-error` lines and the company's activity log for that time.
4. Fix in a branch, run `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm build`, deploy, and tell the user what changed.
5. Data corrections are never made by editing logs or issued documents: use the app's own functions
   (cancel with a credit note, override with a reason) so the audit history stays true.
6. Response times are not promised until they are written into a signed agreement.

See also `docs/SECURITY-CHECKLIST.md`. No external security review has taken place.
