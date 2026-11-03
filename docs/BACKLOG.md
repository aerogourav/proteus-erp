# Backlog

Deliberately **not built yet**. Each item waits for evidence from real pilot shops, so we build what customers need,
not what an ERP brochure lists. When an item is picked up, its rules go into `src/lib/erp` as tested pure functions
and are enforced in the database, like the job release workflow.

| Item | What it would do | Evidence needed before building |
|---|---|---|
| Bills of material (BOM) | Multi-level part structures: assemblies, sub-assemblies and purchased parts, with quantities per parent. | At least two pilot shops that build assemblies (not single machined parts) and lose time today because component lists live in spreadsheets or drawings. Example BOMs (anonymised) showing depth and change frequency. |
| Capacity planning | Load per work center from planned operations against available hours; show overloaded weeks. | Pilot shops reporting missed delivery dates caused by overloaded machines, plus a few weeks of real operation logs from BOH ERP to base planned times on. Agreement on shift calendars and which work centers matter. |
| Material planning (MRP) | Suggest purchases from open orders, BOMs, stock and lead times. | BOMs in use (see above), reliable stock bookings for at least a month, supplier lead times from the shops, and a shop willing to compare suggestions against what they actually ordered. |
| Partial delivery | Dispatch part of an order now and the rest later, with several delivery notes and invoices per order. | Customers of pilot shops that call off orders in batches, and examples of how those shops invoice them today (per delivery or at the end). Tax adviser input on invoicing partial deliveries. |
| Corrective actions (CAPA / 8D) | Track non-conformities from failed inspections or customer complaints through cause, action and verification. | Pilot shops whose customers require 8D reports or ISO 9001 corrective action records, and examples of the forms they fill in today. Note: BOH ERP must not claim any certification or standard compliance. |

## Also waiting (from earlier phases)

- E-invoices (XRechnung / ZUGFeRD) and DATEV: by decision, BOH ERP exports a CSV for a specialist provider or tax adviser instead of generating e-invoices itself. Revisit only with a signed customer need and a chosen provider.
- Screens for roles, permissions and the audit history in `/app` (the database already records the history).
- German translation of the ERP demo screens (they are excluded from translation today).
- Virus scanning and size/type limits for uploaded files.
- Alerting for server errors.
