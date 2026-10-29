# BOH ERP

**BUILD. OPERATE. HARMONISE.**

BOH ERP is an early configurable ERP for startups and small companies. Precision manufacturing is the first detailed demonstration scenario. This repository contains the public marketing website and an interactive ERP demonstration workspace. It does not connect to a production system or provide backend services.

## Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS 4 with the official PostCSS plugin and custom responsive styles
- Lucide React icons
- pnpm

## Run locally

Use Node.js 20.9 or newer and pnpm 11. From the project directory:

```powershell
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. `pnpm build`, `pnpm start`, `pnpm lint`, and `pnpm typecheck` are also available.

## Public-site configuration

The website is prepared to generate canonical links, social preview metadata, a sitemap, and crawler rules after a real HTTPS domain has been verified. Until then, the site remains `noindex`, `robots.txt` disallows crawling, and the sitemap is empty by default.

Copy `.env.example` to `.env.local` for local configuration. Set `NEXT_PUBLIC_SITE_URL` to the verified HTTPS origin (for example, `https://example.com`) and `NEXT_PUBLIC_CONTACT_EMAIL` only to a verified address controlled by the project. Set `BOH_INDEXING_ENABLED=true` only after the domain and public content have been reviewed and indexing is intended. These public variables are embedded at build time; rebuild and redeploy after changing them. Do not put secrets in `NEXT_PUBLIC_*` variables.

The contact form posts to `/api/contact`, which delivers inquiries by email through Resend when `RESEND_API_KEY` and `CONTACT_TO_EMAIL` are set (server-side only). Without them it falls back to a visitor-side email draft if `NEXT_PUBLIC_CONTACT_EMAIL` is set, and otherwise states that inquiry delivery is not configured. Impressum details come from the `NEXT_PUBLIC_LEGAL_*` variables. No deployment provider or public destination is configured in this repository. Choose and configure a hosting destination, then verify the built site, public routes, contact details, legal identity and privacy disclosures before publishing. This repository does not claim legal compliance or production security readiness.

## Project structure

```text
src/
  app/
    globals.css
    layout.tsx
    page.tsx
    impressum/
    api/contact/
    contact/
    privacy/
    demo/
      layout.tsx
      page.tsx
      documents/
      parts/
      production/
      crm/
      suppliers/
      materials/
      finance/
      workflows/
      configuration/
      activity/
  components/
    marketing/
      product-preview.tsx
      contact-form.tsx
      site-header.tsx
    demo/
      demo-workspace.tsx
      demo-ui.tsx
      record-browsers.tsx
      configuration-context.tsx
      configuration-workspace.tsx
      business-modules.tsx
      guided-demo.tsx
      record-visualizations.tsx
      document-create-dialog.tsx
      demo.module.css
  lib/
    demo-data.ts
    business-data.ts
    site-config.ts
    configuration-model.ts
    configuration-rules.ts
```

## Interactive demo (`/demo`)

The demo shows one principle: **enter information once, connect it across the business, and generate outputs from the same data.**

- **First visit:** two demo projects are already there (`src/lib/erp/seed.ts`): *Hydraulic Actuator Assembly* (in production, one operation running on the shop floor) and *Pump Mounting Flange* (delivered and invoiced, payment advice waiting in the inbox), with 7 people, 4 suppliers, supplier orders, bills, a payroll month, quotations and sample STEP/PDF files in `public/demo-files/`. Configuration → Reset restores them or starts empty; Projects can add them to existing data.
- **Guided demo** (`/demo`): one project from order to invoice in small steps (unchanged flow; final inspection now requires a measured value per parameter).
- **Inbox** (`/demo/inbox`): sample inbox, or Gmail when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set (token in tab memory, read + send scopes, polled every minute while open). Rule-based extraction (`src/lib/erp/mail.ts`) classifies customer orders, RFQs, supplier quotes, confirmations, supplier invoices, payment advice and shipping notices, and offers the next step: create project, draft quotation, update prices, order from supplier, record bill, mark invoice paid, confirm/receive supplier order.
- **Purchasing** (`/demo/materials`): reorder suggestions per supplier, supplier orders (`SPO-…`) written and sent by email from the ERP, confirmation, goods receipt into stock, bill. In the sample inbox, suppliers send a simulated confirmation.
- **Documents** (`/demo/documents`): list + preview pane (PDF, images, text, and STEP/IGES/STL in a 3D viewer loaded from jsDelivr: three.js + occt-import-js). Files live in IndexedDB (`src/components/erp/file-store.ts`, 50 MB per file).
- **Shop floor KPI** (`/demo/shop-floor`): operator terminal (start/end operations in routing order; the next operation takes the finished one's place), operation log with CSV/JSON log file, KPI dashboard (efficiency, scrap, OEE as performance × quality, labour cost), routing editor. Logic in `src/lib/erp/shopfloor.ts`.
- **Quotations** (`/demo/quotations`), **People** (`/demo/people`, employee IDs, "sign in as" for the audit trail), **Finance** (`/demo/finance`: overview/P&L, customer invoices, supplier bills, payroll with salary slips, project costing; logic in `src/lib/erp/finance.ts`).
- **Overview**: alerts (late deliveries, approvals, low stock, overdue invoices and bills, unread mail, idle orders), shop-floor widget, configurable dashboard. Global search (Ctrl K) across all records.
- Rules added in this version: production start issues material from stock; dispatch is blocked when fewer good parts were produced than ordered; approvals and activity record the signed-in person; projects can be deleted; JSON backup export/import.
- Module views accept `?project=<id>` to filter to one project. The earlier workspace remains at `/demo/classic`.
- Data model and rules: `src/lib/erp/*.ts` (no React; unit-tested in `tests/`). UI: `src/components/erp/`; styles: `src/app/demo/(erp)/erp.css`.

## Available scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the local development server |
| `pnpm build` | Create a production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Check TypeScript without emitting files |
| `pnpm test` | Run the demo data-model tests (Node 22.6+, uses built-in type stripping) |
