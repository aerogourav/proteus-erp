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

- Supabase: run migration `supabase/migrations/20261103000000_lead_offer.sql` (additive: adds the `offer` column and `submit_lead_with_offer`).
  Until it runs, inquiries still arrive; the chosen offer is written at the top of the message instead.
- Email: `RESEND_API_KEY`, `CONTACT_TO_EMAIL` (your inbox) and, once your domain is verified in Resend, `CONTACT_FROM_EMAIL`.

### Sending one test inquiry (do this yourself)

1. Open `/contact?offer=pilot` on the live site.
2. Choose "Free 2-week pilot run", fill in your own name and email, company "TEST – please ignore", and a short message.
3. Wait at least 3 seconds after the page loads, then press "Send message".
4. Expected: a green "Thank you, your message was received" message.
5. Check Supabase → Table Editor → `leads` (newest row; `offer` = `pilot` after the migration) and/or your inbox.
6. Delete the test row afterwards.

A red message means nothing was stored or sent; it says why (rate limit, missing fields, delivery not connected, or a server problem).

## Invite-only workspace (/app)

The sign-in form no longer creates accounts. To make that binding on the server too:

1. Supabase → Authentication → Sign In / Providers → turn off "Allow new users to sign up".
2. Invite pilot users from Supabase → Authentication → Users → "Invite user".

## Gmail in the demo inbox

Hidden unless `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set. See `docs/GMAIL-SETUP.md`.
