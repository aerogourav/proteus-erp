# Database review (P12 / P13)

Review of every table and function in `supabase/migrations/` after the hardening migrations
`20261106000000_pilot_blockers.sql`, `20261107000000_finance_material.sql` and `20261108000000_dispatch_review.sql`.
It was produced from the schema as built by the PGlite tests (row-level security, policies, triggers, grants and
function rights were read from the catalogue), not from memory. Date: 2026-11-04.

This is an internal review by the developer, **not an independent security review**.

Columns: **Tenant** = rows are limited to the user's company by row-level security · **Write** = who can change rows
through the API · **Audit** = changes are written to `audit_history` by a trigger · **Retention** = what protects records from deletion.

## Tables

| Table | Tenant | Write through the API | Audit | Retention | Gap found → status |
|---|---|---|---|---|---|
| companies | own memberships | owner/admin update; owner delete; `is_demo`, `expires_at`, `books_closed_until` locked | yes | `companies_keep_records` blocks deleting companies with history | — |
| memberships | member read | owner/admin; owners cannot be removed | yes | — | — |
| company_closures | owner/admin read | none (functions only) | no: the table is itself the closure log (who, when, reason, counts) | kept after the company is deleted | accepted: an audit trigger here would re-create history for a deleted company and break the documented deletion process |
| people | member read | member insert/update; only admins link `user_id` | yes | FK from bookings | — |
| people_pay | owner/admin only | owner/admin | yes | — | — |
| people_pins | none (no API access) | `set_person_pin` (admin) | no (hash only, never shown) | — | accepted: PIN hashes are not audited on purpose |
| contacts | member | member; delete admin | yes + activity | FKs from documents | — |
| items, warehouses | member | member; delete admin | yes | FKs | — |
| projects | member | member; delete admin | yes | FKs | — |
| sales_documents, sales_lines | member | drafts only; issue/cancel by function; credit notes only by function | yes | issued documents locked | — |
| purchase_documents, purchase_lines | member | member; delete admin | yes | numbering by definer trigger | **open**: received bills stay editable after entry. Accounting is not part of `/app` (your decision), so this is recorded, not changed. Add a lock before accounting moves into `/app`. |
| payments | member | insert only | yes | **update and delete blocked in 20261108** | payments could be edited or deleted by admins → fixed (correct with a counter-payment) |
| stock_moves | member | receipts > 0 only; everything else by function | yes | no update/delete | — |
| stock_levels (view) | `security_invoker`, so RLS of stock_moves applies | read only | — | — | checked: no cross-tenant leak |
| files | member, folder-scoped storage | metadata; approve/supersede by function | yes | drawings never deleted; non-draft files kept | — |
| inspection_plans | member read | owner/admin | yes | — | — |
| inspections | member read | `record_inspection`, `resolve_inspection` only | yes | no update/delete | — |
| routing_operations | member | member; delete admin | yes | — | — |
| production_orders | member | insert as Planned; status/release/cost/dispatch fields only by function | yes | orders with work are kept | `dispatch_release` added and protected in 20261108 |
| order_materials | member | until release; then `change_order_material` (admin + reason) | yes | — | — |
| material_lots | member | until the job closes; then `correct_material_lot` (admin + reason) | yes | — | — |
| active_operations | member read | functions only | no | transient; the finished booking is audited in operation_logs | accepted |
| operation_logs | member read | functions only | yes | no update/delete | — |
| dispatches | member read | `dispatch_order` only | yes | no update/delete | new in 20261108 |
| activity_log | member read | functions and triggers only | no (it is itself a log) | no update/delete | — |
| audit_history | member read (pay rows: admin) | none | — | no update/delete | — |
| counters | none | functions only | no | — | — |
| leads | none (service only) | `submit_lead*` functions | no | operator deletes on request | — |

## Functions

All functions use `set search_path = ''`. Security-definer functions check membership or role themselves.

| Group | Functions | API | Notes |
|---|---|---|---|
| Role checks | `has_role`, `is_member`, `can_write`, `is_admin`, `is_api_role` | authenticated | read-only helpers |
| Company | `create_company` (demo only for the server), `request_company_closure` (owner), `close_books` (admin + reason) | authenticated | app layer also checks `BOH_COMPANY_CREATORS` |
| Operator only | `operator_close_access`, `operator_delete_company`, `delete_company_records`, `purge_expired_demos` | **revoked** | run from the SQL editor by the operator |
| Numbering | `document_number`, `next_number`, `assign_document_number`, `purchase_documents_number` | revoked (triggers only) | — |
| Sales | `issue_sales_document` (2 overloads), `cancel_sales_document` | authenticated | dates, backdating and closed periods checked in `issue_document_internal` (revoked) |
| Files | `approve_file(id, sha256)`, `supersede_file` | authenticated | one-argument `approve_file` raises and is revoked |
| Production | `release_gate`, `release_blockers`, `override_release`, `set_order_status`, `order_progress`, `completion_blocker`, `complete_order`, `item_routing`, `revision_newer` | authenticated | — |
| Shop floor | `start_operation`, `end_operation` (linked user), `*_pin` variants; `*_as` internal | `*_as` and `pin_ok` revoked | — |
| Material | `adjust_stock`, `change_order_material`, `correct_material_lot` | authenticated | admin + reason |
| Quality | `record_inspection`, `resolve_inspection`, `inspection_status`, `inspection_outcome`, `plan_spec`, `tolerance_check` | authenticated | resolver cannot be the inspector when another admin exists |
| Dispatch | `dispatch_order`, `release_dispatch`, `dispatch_blockers`, `dispatch_drawing_blockers`, `dispatchable_quantity` | authenticated | new in 20261108 |
| Triggers | `*_guard`, `stamp_*`, `audit_row`, `contacts_activity` | trigger functions cannot be called directly | — |
| Website | `submit_lead`, `submit_lead_with_offer` | anon + authenticated | rate-limited in the route |

## Remaining gaps (not fixed here)

1. Received purchase bills can be edited after entry (see table). Needs a decision when accounting moves into `/app`.
2. App-user MFA is planned, not built (`docs/SECURITY-CHECKLIST.md`).
3. No virus scanning; confidential files stay blocked for the pilot.
4. These checks run on PGlite (Postgres 17 in WebAssembly) with stand-ins for Supabase's `auth` and `storage` schemas.
   On 2026-11-04, after the migrations were applied, a read-only check on the hosted project confirmed the grants, row-level
   security and Storage settings listed here. Behaviour (for example a full dispatch) has not yet been exercised there.
