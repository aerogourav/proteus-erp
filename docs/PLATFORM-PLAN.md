# BOH ERP platform plan

Agreed 1 November 2026. This replaces "browser-only demo" as the target; the current demo keeps working until each module is moved over.

## Decisions

| Topic | Decision |
|---|---|
| Industries | Precision manufacturing (existing), **E-commerce / wholesale**, **Software / SaaS startup** |
| Backend | Supabase: Postgres, Auth, Storage, row-level security per company |
| Supabase setup | Owner creates the hosted project and puts keys in `.env.local` / Vercel. Code never prints or commits keys |
| Public demo | Sandbox per visitor: pick an industry, get a temporary demo company with sample data, deleted after 7 days. No sign-up |
| Email | Keep the rule-based reader with honest labels now; AI extraction (Claude) is a later phase |
| Design | Choose between the canvas options (C/D from the reference, A/B earlier) before any UI rework |
| `/demo/classic` | Port its useful ideas (workflows, community board, lead-to-dispatch journey) into the new ERP, then retire it only after sign-off |

## One core, three industry packs

Every company shares the same core records. An industry pack only decides which modules are switched on, what things are called, which fields and stages are preset, and which sample data a sandbox gets. Packs are configuration, not forks of the code.

**Core (all packs)**: company, people and roles, contacts (customers and suppliers are one table with flags), items, sales documents (quote → order → invoice), purchasing (supplier order → receipt → bill), payments, documents and files, tasks and alerts, inbox, activity log, settings.

| | Manufacturing | E-commerce / wholesale | SaaS startup |
|---|---|---|---|
| Items are | Parts with revisions, raw materials | Products with variants (size, colour), bundles | Plans and add-ons (services) |
| Sales flow | RFQ → quote → customer PO → production → inspection → dispatch → invoice | Order (manual, CSV or channel) → pick → pack → ship → invoice; returns | Quote → contract → subscription → recurring invoice; renewals, churn |
| Stock | Raw materials, reorder levels | Multi-warehouse stock, reorder, stock value | None |
| Pack modules | Drawings and approvals, production orders, routing, shop floor KPIs, quality | Warehouses, fulfilment queue, channels, returns | Subscriptions, MRR/ARR dashboard, support tickets, time tracking |
| Key numbers | On-time delivery, efficiency, scrap, OEE, job margin | Orders to ship today, stock value, sell-through, return rate | MRR, net revenue retention, churn, cash runway |

## Target architecture

```
Next.js on Vercel
  ├─ marketing site (unchanged)
  ├─ /app/*            signed-in product (real data, Supabase)
  ├─ /demo/*           sandbox: same /app screens, demo company, auto-expiry
  └─ server actions    call the same pure rules as today (src/lib/erp/*)
Supabase
  ├─ Postgres          every business table has company_id; RLS on all of them
  ├─ Auth              email magic link + Google; membership table gives the role
  ├─ Storage           files per company folder, private buckets, signed URLs
  └─ scheduled job     deletes expired demo companies
```

Rules stay in plain TypeScript (`src/lib/erp`) so they are unit-tested without a database. The database enforces what must never be wrong regardless of UI: company isolation, roles, unique document numbers, an append-only activity log, stock as a ledger of movements (not a number that gets overwritten).

### Roles

`owner` (billing, delete company), `admin` (settings, users), `member` (daily work), `viewer` (read only). Finer permissions (who may approve drawings, see salaries) come as a later step on top of these.

## Phases

1. **Foundation**: Supabase schema with RLS, auth, company creation, membership; data access layer; migration path from the browser store. Tests for isolation (user of company A cannot read company B).
2. **Design system**: tokens, components, light and dark, applied to the shell and the overview, from the chosen canvas option.
3. **Core modules on the database**: contacts, items, quotes/orders/invoices, purchasing, payments, documents, activity.
4. **Manufacturing pack** moved onto the database (current demo features preserved one by one).
5. **E-commerce / wholesale pack**.
6. **SaaS pack**.
7. **Sandbox demo**: industry picker, seeded demo companies, expiry job; port `/demo/classic` ideas; retire classic after sign-off.
8. **Production readiness**: PDF output for quotes, invoices and delivery notes; backups; error monitoring; security review; Vercel preview and production setup with the owner.

Each phase ends with a report: what changed, why, what was affected, what was tested, what is left.
