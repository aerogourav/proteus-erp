# Launch settings and manual steps

Everything below is switched off or empty until the owner sets it. Nothing here is changed by code deploys.

## Legal identity (Impressum, privacy notice, "Who we are")

Set these in Vercel → Project → Settings → Environment Variables, then redeploy. Empty values show "To be confirmed".

| Variable | Example meaning |
| --- | --- |
| `NEXT_PUBLIC_LEGAL_COMPANY` | Registered company name |
| `NEXT_PUBLIC_LEGAL_FORM` | Legal form, e.g. UG (haftungsbeschränkt) |
| `NEXT_PUBLIC_LEGAL_REPRESENTATIVE` | Managing director / owner |
| `NEXT_PUBLIC_LEGAL_STREET`, `NEXT_PUBLIC_LEGAL_POSTAL_CITY`, `NEXT_PUBLIC_LEGAL_COUNTRY` | Postal address |
| `NEXT_PUBLIC_LEGAL_EMAIL`, `NEXT_PUBLIC_LEGAL_PHONE` | Public contact |
| `NEXT_PUBLIC_LEGAL_REGISTER`, `NEXT_PUBLIC_LEGAL_VAT_ID` | Register court and number, VAT ID |

Both pages show a "Draft: not yet reviewed by a lawyer" notice. Remove it only after a lawyer has reviewed them.

## Domain and search indexing (off until you confirm)

1. Add the domain in Vercel → Domains (only after the name has been cleared).
2. Set `NEXT_PUBLIC_SITE_URL=https://your-domain` (canonical links, Open Graph, sitemap).
3. Only when you want search engines to index the site: set `BOH_INDEXING_ENABLED=true`.
   Without both, `robots.txt` disallows everything and every page is `noindex`.

## Analytics (Vercel Web Analytics, cookie-free)

1. Vercel → Project → Analytics → Enable.
2. Set `NEXT_PUBLIC_VERCEL_ANALYTICS=true` and redeploy. The privacy notice switches its "Analytics" section automatically.

## Website inquiries

The form stores a lead in Supabase and/or emails it through Resend. Either one is enough.

- Supabase: run migrations `supabase/migrations/20261103000000_lead_offer.sql` and `20261104000000_controls.sql` (approvals, invoice lock, audit history, yearly numbering, Storage bucket and policies; see `docs/OPERATIONS.md`). Both are additive; the first adds the `offer` column and `submit_lead_with_offer`.
  Until it runs, inquiries still arrive; the chosen offer is written at the top of the message instead.
- Email: `RESEND_API_KEY`, `CONTACT_TO_EMAIL` (your inbox) and, once your domain is verified in Resend, `CONTACT_FROM_EMAIL`.

### Sending one test inquiry (do this yourself)

1. Open `/contact?offer=pilot` on the live site.
2. Choose "Free 2-week pilot run" (the "Join the pilot waitlist" buttons open it), fill in your own name and email, company "TEST – please ignore", and a short message.
3. Wait at least 3 seconds after the page loads, then press "Send message".
4. Expected: a green "Thank you, your message was received" message.
5. Check Supabase → Table Editor → `leads` (newest row; `offer` = `pilot` after the migration) and/or your inbox.
6. Delete the test row afterwards.

A red message means nothing was stored or sent; it says why (rate limit, missing fields, delivery not connected, or a server problem).

## Invite-only workspace (/app)

The sign-in form no longer creates accounts. To make that binding on the server too:

1. Supabase → Authentication → Sign In / Providers → turn off "Allow new users to sign up". **Done and verified on 2026-11-03.**
2. Invite pilot users from Supabase → Authentication → Users → "Invite user".
3. Set `BOH_COMPANY_CREATORS` (server-only, comma-separated emails) in Vercel → Production before deploying the hardening branch.
   Only these people can create a company in `/app`; everyone else is added to an existing company by its owner or admin.
   With the variable empty, nobody can create a company (it fails closed), even if sign-ups are switched on by mistake.
4. Optional: `ALERT_WEBHOOK_URL` (https, a Slack or Teams incoming webhook) to receive a short note for each server error.

## Gmail in the demo inbox

Hidden unless `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set. See `docs/GMAIL-SETUP.md`.

## Applied on the hosted project

On 2026-11-03 the three migrations `20261103000000_lead_offer.sql`, `20261104000000_controls.sql` and `20261105000000_production.sql`
were run on the `boh-erp` Supabase project (each checked against the repository file by SHA-256 before running). A read-only
check afterwards confirmed all three, the private `company-files` bucket and its 4 policies. No existing rows were changed.

The hardening migrations `20261106000000_pilot_blockers.sql`, `20261107000000_finance_material.sql` and
`20261108000000_dispatch_review.sql` are **not** applied on the hosted project. They need a backup first and your approval
(plan, risks, rollback and read-only checks are in the hardening report). Deploying the hardening branch before they run
would break `/app` pages that call the new functions; the website and demo are not affected.
