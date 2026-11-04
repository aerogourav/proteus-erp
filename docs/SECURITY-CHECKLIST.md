# Security checklist

A working list for the owner. It records what the code does and what must be checked or done by hand.
**No external security review or penetration test has taken place.** Do not tell customers otherwise.

Legend: **[code]** enforced in this repository and covered by tests · **[you]** a manual step or check for the owner · **[open]** not done yet.

## Access

- [code] Row-level security on every business table: a user only sees companies they are a member of (`tests/db-security.test.ts`, `tests/db-controls.test.ts`, `tests/db-production.test.ts`).
- [code] Roles owner / admin / member / viewer. Only owners and admins approve drawings, override the release check, cancel invoices and read pay data.
- [code] The sign-in form does not create accounts (invite-only).
- [code] Creating a company in `/app` is invite-only at the application layer too, independent of the Supabase sign-up setting: only emails in the server variable `BOH_COMPANY_CREATORS` may create one; with no list set, nobody can (`src/lib/erp/access.ts`, `tests/access.test.ts`). Demo companies can only be created by the server (`tests/db-pilot.test.ts`).
- [you] Set `BOH_COMPANY_CREATORS` in Vercel (Production) to the emails you invite as pilot owners, before deploying this branch. Changing Vercel variables needs your approval.
- [code] Shop-floor bookings need a signed-in user linked to the operator, or that operator's PIN; 5 wrong PINs lock it for 15 minutes (`tests/db-finance.test.ts`).
- [you] Supabase → Authentication → turn off "Allow new users to sign up". Without it, someone could still create an account through the Supabase API (they would see no company data).
- [you] Invite pilot users from Supabase → Authentication → Users → "Invite user", then add their membership.
- [you] Turn on two-factor authentication for your GitHub, Vercel, Supabase and email accounts.
- [open] Two-factor sign-in for app users. **Agreed plan** (not built yet):
  1. Turn on TOTP in Supabase → Authentication → Multi-factor (free, no new account).
  2. Add an "Set up authenticator app" page in `/app` using `supabase.auth.mfa.enroll` / `challenge` / `verify`.
  3. Require AAL2 for owners and admins: the `/app` layout redirects to the MFA step when `getAuthenticatorAssuranceLevel()` is below `aal2`,
     and a migration adds `(auth.jwt() ->> 'aal') = 'aal2'` to `is_admin()` so approvals, overrides and releases need it in the database too.
  4. Members and viewers: optional for the pilot, required before paying customers.
  Until then: pilot owners use a long unique password from a password manager, and only invited users can sign in.

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
- [code] Drawings are hashed (SHA-256) on upload; an approval is bound to that hash and re-checked before release and on the job page. Stored files cannot be overwritten, and drawings or non-draft files cannot be deleted (`tests/db-pilot.test.ts`).
- [code] File limits: the migration `20261106000000_pilot_blockers.sql` sets the bucket to 20 MB and an allowed list of types (PDF, PNG, JPG, SVG, DXF, DWG, STEP, IGES, STL); the upload form checks the same before sending.
- [open] Virus scanning. Not practical without a paid scanning service or a server process outside Vercel's limits. **Decision: confidential files stay blocked** — pilots use anonymised or non-confidential files only, and the app says so on the job release page. Revisit before paying customers (for example a Supabase Edge Function calling a scanning API, files kept in a quarantine folder until clean).

## Logging and monitoring

- [code] Server errors are logged without headers, cookies, query strings or form data (`src/instrumentation.ts`).
- [you] Check Vercel logs for `boh-error` after each pilot day.
- [code] Optional alerting: if the server variable `ALERT_WEBHOOK_URL` (https only) is set, each server error is also posted there as a short summary without query strings, headers or form data (`src/instrumentation.ts`, `tests/access.test.ts`). **[you]** Create an incoming webhook in Slack or Teams and add it in Vercel (needs your approval).

## Before any customer enters real data

- [you] Data processing agreement signed, privacy notice and Impressum completed and reviewed by a lawyer.
- [you] Migrations applied and tested on the hosted project; restore drill done once (`docs/OPERATIONS.md`).
- [you] Sign-ups switched off; only invited users.
- [open] An independent security review.
