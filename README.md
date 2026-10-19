# PROTEUS

**Business software shaped around your work.**

PROTEUS is an early configurable business-software concept for startups and small companies. Precision manufacturing is the first detailed demonstration scenario. This repository contains the public marketing website and an interactive ERP demonstration workspace. It does not connect to a production system or provide backend services.

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

## Project structure

```text
src/
  app/
    globals.css
    layout.tsx
    page.tsx
    product/
    about/
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

No real customer drawings or confidential manufacturing information are included. There is no authentication, server-side authorization, shared backend, external integration, contact-message delivery, or production security review. The contact form validates entries in the browser only and transmits or stores nothing; connect and review a server-side endpoint before publication. Replace the empty, editable `contactEmail`, `publicUrl`, and `qrDestination` fields in `src/lib/site-config.ts` only after verifying real project contact details and a deployed destination. No QR code is shown because no verified destination is configured. No AI model or AI provider is connected; AI assistance is a concept direction, while current completeness checks are deterministic rules. Do not enter confidential information into the demonstration.

## Available scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the local development server |
| `pnpm build` | Create a production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Check TypeScript without emitting files |
