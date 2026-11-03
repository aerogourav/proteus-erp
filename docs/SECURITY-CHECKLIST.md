# Security checklist

A working list for the owner. It records what the code does and what must be checked or done by hand.
**No external security review or penetration test has taken place.** Do not tell customers otherwise.

Legend: **[code]** enforced in this repository and covered by tests · **[you]** a manual step or check for the owner · **[open]** not done yet.

## Access

- [code] Row-level security on every business table: a user only sees companies they are a member of (`tests/db-security.test.ts`, `tests/db-controls.test.ts`, `tests/db-production.test.ts`).
- [code] Roles owner / admin / member / viewer. Only owners and admins approve drawings, override the release check, cancel invoices and read pay data.
- [code] The sign-in form does not create accounts (invite-only).
- [you] Supabase → Authentication → turn off "Allow new users to sign up". Without it, someone could still create an account through the Supabase API (they would see no company data).
- [you] Invite pilot users from Supabase → Authentication → Users → "Invite user", then add their membership.
- [you] Turn on two-factor authentication for your GitHub, Vercel, Supabase and email accounts.
- [open] Two-factor sign-in for app users.

## Data integrity

- [code] Release gate, quantity limits, completion, inspections and overrides are enforced by database functions; operation logs and inspections cannot be written or changed directly.
- [code] Issued invoices are locked; cancellation creates a credit note; numbers are never reused.
- [code] Audit history written by triggers; it cannot be edited through the API.
- [code] Companies with issued documents or history cannot be deleted from the app (retention process in `docs/OPERATIONS.md`).

## Secrets and configuration

- [code] No secrets in the repository; server-only keys (`RESEND_API_KEY`) are never sent to the browser. Only `NEXT_PUBLIC_*` values reach the browser, and those are public by design (the Supabase anon key is meant to be public; row-level security protects the data).
- [you] Never put the Supabase service-role key or the database password into Vercel variables that start with `NEXT_PUBLIC_`.
- [you] Rotate the Supabase database password and the Resend key if they were ever pasted into a chat, ticket or screenshot.

## Files

- [code] Private Storage bucket `company-files`; policies allow access only inside the company's own folder.
- [open] Virus scanning of uploaded files. Until then: pilots use anonymised or non-confidential files only.
- [open] File size and type limits in the bucket settings. **[you]** Set a size limit (for example 20 MB) in Supabase → Storage → company-files.

## Logging and monitoring

- [code] Server errors are logged without headers, cookies, query strings or form data (`src/instrumentation.ts`).
- [you] Check Vercel logs for `boh-error` after each pilot day.
- [open] Alerting.

## Before any customer enters real data

- [you] Data processing agreement signed, privacy notice and Impressum completed and reviewed by a lawyer.
- [you] Migrations applied and tested on the hosted project; restore drill done once (`docs/OPERATIONS.md`).
- [you] Sign-ups switched off; only invited users.
- [open] An independent security review.
