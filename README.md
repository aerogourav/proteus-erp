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

The demo shows one principle: **enter project information once, connect it across the business, and generate outputs from the same data.**

- The sidebar works like a real ERP: **Overview** (`/demo/overview`, KPIs, lifecycle and department tiles for the visitor's project), **Guided demo** (`/demo`), Projects, CRM, Sales orders, Parts, Documents, Purchasing, Production, Quality, Dispatch, Invoices and Configuration. Department views are read-only and show the data entered in the guided demo; their action buttons open the matching guided step.
- `/demo` is a guided journey for **one project the visitor creates** (no pre-filled sample). Sales asks how many parts are on the PO (1–8); each part then gets five short steps: details, technical drawing (upload or reuse), inspection parameters (add more), quantity and price, and material. Values used before (parts, drawings, materials, parameters, suppliers) are offered as dropdowns. After a review the project is created, followed by purchase recommendations, production orders (part, quantity, start date, shop-floor details), running production, final inspection with results per parameter, dispatch and invoice. Steps live in `src/components/erp/guide-steps.ts`, the UI in `guided.tsx`.
- Approvals are not part of the flow. Every record can be edited later in its tab: customers (CRM), purchase order number, delivery date, quantity and price (Sales), project name (Projects), part description (Parts), document number, revision, file and approval (Documents), material, quantity, supplier, order and receipt (Purchasing), production orders (create, quantity, start, notes, status), inspection parameters (add, edit, remove) and the final inspection (Quality), dispatch and invoice. Documents are printed from the tabs, not from the flow.
- Production status is a dropdown: Planned, Running, In process, Completed, or custom text. Only "Completed" counts as finished. Final inspection, dispatch and invoice can be done later; the finish screen lists what is still open.
- Several projects can be created ("New project" keeps earlier ones). Overview has a project switcher; Projects can reopen any project in the guided demo.
- **Raw materials** (`/demo/raw-materials`): stock, reorder level, unit cost and preferred supplier per material; demand (to buy / on order / received) comes from parts; receiving a purchase adds stock. **Suppliers** (`/demo/suppliers`): contact, lead time, materials, purchases and spend. **Finance** (`/demo/finance`): order book, invoices, paid/receivable/overdue, material cost and margin per project, with charts.
- **Overview** is a configurable dashboard (current project, key figures, pipeline, order value, production status, revenue and receivables, raw material demand, departments, activity).
- **Configuration** lets visitors change accent colour, density, corners, menu colour, font and menu position (left, right, top); rename, hide and reorder tabs; choose and order dashboard widgets; add custom fields (text, number, date, dropdown) to projects, customers, sales orders, parts, production orders, suppliers and raw materials; and add document types. Charts are dependency-free SVG/HTML in `src/components/erp/charts.tsx` using a colour order validated for colour-vision deficiency.
- Uploaded drawings stay in the visitor's browser; files over 1 MB keep only their name and size.
- Business rules: unapproved drawings and missing material are warnings for production; dispatch needs completed production and a passed final inspection; the invoice comes after dispatch.
- `/demo/projects/[id]` shows the full project record with readiness rules. The old wizard URL `/demo/new` redirects to `/demo`.
- Module views: `/demo/projects`, `/crm`, `/sales` (purchase orders vs active orders), `/parts`, `/documents`, `/materials`, `/production`, `/quality`, `/dispatch`, `/finance`, `/configuration`. Add `?project=<id>` to filter a module to one project.
- The data model, rules and actions live in `src/lib/erp/model.ts` (no React; unit-tested in `tests/`). UI components are in `src/components/erp/`; styles in `src/app/demo/(erp)/erp.css`.
- The earlier workspace and the order-journey simulation are preserved at `/demo/classic` and `/demo/classic/journey`. Old `/demo/...` detail URLs redirect there.

### Demonstration limits

All companies, people, parts and values are fictional. Demo data is stored only in the visitor's browser (`localStorage` key `boh-erp-demo-v2`); it is not encrypted, shared, or a production database. "Restart demo" clears it. Documents are metadata only; no files are uploaded. Inspection results and invoices are illustrative and not real measurements or tax-compliant invoices. There is no authentication, server-side authorization, shared backend or AI model. Do not enter confidential information.

## Available scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the local development server |
| `pnpm build` | Create a production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Check TypeScript without emitting files |
| `pnpm test` | Run the demo data-model tests (Node 22.6+, uses built-in type stripping) |
