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

## Retention process: closing a company account

Because deletion is blocked once records exist, an account is closed like this:

1. The customer asks in writing to close the account.
2. Export their data for them (Supabase dashboard → Table Editor → filter by `company_id`, or a SQL export).
3. Remove the members (`memberships`) so nobody can sign in to the company any more. The records stay.
4. Keep issued invoices, credit notes and the audit history for the legal retention period your tax adviser confirms
   (in Germany commonly up to 10 years for accounting records).
5. After that period, an operator deletes the company in the Supabase SQL editor as the database owner, where the app's guard does not apply.
   Write down who did it, when and why.

## Not yet in place (Phase 4)

Error monitoring, backup and restore drills, a security checklist and the support process are added in Phase 4.
No external security review has taken place.
