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

## Demonstration limits

The homepage product preview and `/demo` workspace use synthetic records. The fictional manufacturing workspace is Apex Precision Components GmbH. The demo includes overview, documents, parts and revisions, production orders, CRM, suppliers, raw materials, finance, workflows, browser-local configuration, revision links, activity, and an optional walkthrough. Sample companies, contacts, supplier records, opportunities, material lots, and finance entries are in `src/lib/business-data.ts`; engineering, parts, and orders are in `src/lib/demo-data.ts`. Explicit IDs connect customers to orders, lots to suppliers and certificate-reference records, and financial entries to companies or suppliers. Charts and summary totals derive from the listed entries.

Configuration, synthetic documents, and CRM opportunities created in the demo persist in this browser's `localStorage`. This storage is not encrypted by the application, shared, or intended for confidential data. Reset restores sample configuration and removes browser-created documents and opportunities. Completeness checks do not inspect files and do not establish manufacturing readiness or compliance. Material-certificate entries are reference metadata only; no files are included and conformity is not verified. Approval workflows are definitions and visual examples; the demo does not assign work or execute approvals. Technical illustrations are original schematic SVGs, labeled illustrative and not to scale or for manufacture.

No real customer drawings or confidential manufacturing information are included. There is no authentication, server-side authorization, shared backend, external integration, contact-message delivery, or production security review. Until a verified address is configured, the contact page explains that inquiry delivery is unavailable. With an address configured, it opens a visitor-side email draft and the site cannot verify whether it is sent. No server-side contact endpoint exists. No QR code is shown because no verified destination is configured. No AI model or AI provider is connected; AI assistance is a concept direction, while current completeness checks are deterministic rules. Do not enter confidential information into the demonstration.

## Available scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the local development server |
| `pnpm build` | Create a production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Check TypeScript without emitting files |
