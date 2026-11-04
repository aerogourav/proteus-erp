# Pilot gate

The website says "Join the pilot waitlist" until every gate below is **pass**. A gate is passed only with evidence:
a named automated test, a recorded manual check, or a signed document. Status as of 2026-11-04 on branch
`hardening/pilot-readiness` (not yet merged or deployed).

Legend: **pass** = evidence exists · **fail** = known not to hold · **manual** = needs a step or decision by the owner.

## 1. No false approvals

| Gate | Status | Evidence |
|---|---|---|
| A drawing approval is bound to the file's SHA-256; a changed or replaced file loses it | pass (code) | `tests/db-pilot.test.ts` — approval with hash, storage overwrite blocked |
| Superseded drawings and newer revisions stop release and dispatch | pass (code) | `tests/db-pilot.test.ts`, `tests/db-dispatch.test.ts`, `tests/erp-phase2.test.ts` (N12) |
| Inspection limits come from a server-stored plan; every characteristic exactly once | pass (code) | `tests/db-pilot.test.ts`, `tests/erp-inspection.test.ts`, shared `tests/fixtures/limit-cases.json` |
| Unclear results need review by an owner/admin other than the inspector | pass (code) | `tests/db-pilot.test.ts`, `tests/erp-inspection.test.ts` |
| Dispatch needs a completed job, a passed inspection and a still-approved drawing | pass (code) | `tests/db-dispatch.test.ts`, `tests/erp-phase2.test.ts` |

## 2. No bad parts or false records

| Gate | Status | Evidence |
|---|---|---|
| Bookings only by the linked user or with the operator's PIN; PIN lockout | pass (code) | `tests/db-finance.test.ts` |
| Released material and closed lots change only by owner/admin with a reason | pass (code) | `tests/db-finance.test.ts`, `tests/erp-phase2.test.ts` (N10, N11) |
| Stock changes only by receipt or reasoned adjustment | pass (code) | `tests/db-finance.test.ts`, `tests/erp-phase2.test.ts` |
| Closed job costs are frozen (labour, overhead, material, exchange rate) | pass (code) | `tests/db-finance.test.ts`, `tests/erp-phase2.test.ts` (P9/N11) |
| Demo shortcut bookings are marked synthetic | pass (code) | `tests/erp-phase2.test.ts` (N13) |

## 3. Records are protected

| Gate | Status | Evidence |
|---|---|---|
| Issued invoices locked; numbering gap-free per year; no future or closed-period dates | pass (code) | `tests/db-controls.test.ts`, `tests/db-finance.test.ts` |
| Payments cannot be edited or deleted from the app | pass (code) | `tests/db-dispatch.test.ts` |
| Audit history written by the database and not editable | pass (code) | `tests/db-controls.test.ts` |
| Pilot closure and deletion follow a documented operator process | pass (code) / manual (legal and tax advice on retention) | `tests/db-pilot.test.ts` (N6), `docs/OPERATIONS.md` |
| Backup taken and restore drill done once | **manual** | `docs/OPERATIONS.md` — not done yet |

## 4. Access

| Gate | Status | Evidence |
|---|---|---|
| Tenants isolated by row-level security | pass (code) | `tests/db-security.test.ts` and all `tests/db-*.test.ts` outsider checks |
| Supabase sign-ups off | pass (manual, verified 2026-11-03) | `docs/LAUNCH-SETTINGS.md` |
| Company creation invite-only in the app | pass (code) / **manual**: set `BOH_COMPANY_CREATORS` | `tests/access.test.ts` |
| Two-factor sign-in for owners and admins | **fail** (planned) | plan in `docs/SECURITY-CHECKLIST.md` |

## 5. Hosted environment

| Gate | Status | Evidence |
|---|---|---|
| Hardening migrations 20261106–20261108 applied on hosted Supabase | pass (2026-11-04) | backup taken first; SHA-256 checked; `docs/LAUNCH-SETTINGS.md` |
| Read-only checks after applying them | pass (2026-11-04) | functions, grants, RLS, bucket limits and row counts confirmed; `docs/LAUNCH-SETTINGS.md` |
| Hardening branch reviewed, merged and deployed | **manual** | not merged |
| `/app` job flow tested end to end on the hosted project with a test company | **manual** | after the migrations |

## 6. Legal and claims

| Gate | Status | Evidence |
|---|---|---|
| Impressum: legal form, address, register, VAT | **manual** | "To be confirmed" on `/impressum` |
| Impressum and privacy notice reviewed by a lawyer | **manual** | draft notice shown on both pages |
| Data processing agreement for pilot customers | **manual** | not drafted |
| Website claims match tested behaviour (English and German) | pass | browser checks in the hardening report |
| Confidential files blocked (no virus scanning yet) | pass (policy) | `/app` page notice, `docs/SECURITY-CHECKLIST.md` |

## Switching the website from waitlist to pilot

Only when sections 1–6 have no **fail** or open **manual** row: change "Join the pilot waitlist" back to an
application wording in `src/app/page.tsx` and `src/lib/de-site.ts` together, and record the date here.
