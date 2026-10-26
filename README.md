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

- `/demo` explains the concept and offers **Create a Project** or **Explore Sample Project**.
- `/demo/new` is a 7-step wizard (project, customer and order, line items, documents, inspection, materials, review). A live panel shows where each value will be stored. Progress is saved in the browser.
- `/demo/projects/[id]` is the project workspace. Readiness is calculated from linked records with transparent rules; blocked items show the reason and a fix. Five illustrative printable outputs come from the same data: PO summary, production order, inspection report, dispatch note and invoice.
- Module views: `/demo/projects`, `/crm`, `/sales` (purchase orders vs active orders), `/parts`, `/documents`, `/materials`, `/production`, `/quality`, `/dispatch`, `/finance`, `/configuration`. Add `?project=<id>` to filter a module to one project.
- The data model, rules and actions live in `src/lib/erp/model.ts` (no React; unit-tested in `tests/`). UI components are in `src/components/erp/`; styles in `src/app/demo/(erp)/erp.css`.
- The earlier workspace and the order-journey simulation are preserved at `/demo/classic` and `/demo/classic/journey`. Old `/demo/...` detail URLs redirect there.

### Demonstration limits

All companies, people, parts and values are fictional. Demo data is stored only in the visitor's browser (`localStorage` key `boh-erp-demo-v2`); it is not encrypted, shared, or a production database. "Reset demo" clears it. Documents are metadata only; no files are uploaded. Inspection results and invoices are illustrative and not real measurements or tax-compliant invoices. There is no authentication, server-side authorization, shared backend or AI model. Do not enter confidential information.

## Available scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the local development server |
| `pnpm build` | Create a production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Check TypeScript without emitting files |
| `pnpm test` | Run the demo data-model tests (Node 22.6+, uses built-in type stripping) |
