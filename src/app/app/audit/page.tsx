import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { BohMark } from "@/components/brand/boh-logo";
import { pageMetadata } from "@/lib/seo";
import { loadWorkspace } from "@/lib/supabase/workspace";

export const metadata = pageMetadata("Audit history", "Every change in your BOH ERP workspace, written by the database.", "/app/audit", { indexable: false });

type Row = { id: number; at: string; actor: string | null; table_name: string; row_id: string | null; action: string; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null };

const TABLE_LABEL: Record<string, string> = {
  companies: "Company", memberships: "Member", people: "Person", people_pay: "Pay", contacts: "Customer or supplier", items: "Part or material", warehouses: "Store",
  projects: "Project", sales_documents: "Sales document", sales_lines: "Sales line", purchase_documents: "Purchase document", purchase_lines: "Purchase line", payments: "Payment",
  files: "File", routing_operations: "Routing", production_orders: "Production order", order_materials: "Order material", material_lots: "Material lot",
  operation_logs: "Shop-floor booking", inspections: "Inspection", inspection_plans: "Inspection plan", stock_moves: "Stock move", dispatches: "Dispatch", company_closures: "Closure request",
};
const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(iso));

/** The fields that changed between the old and new version of a row (ignoring timestamps). */
function changes(row: Row) {
  if (row.action !== "update" || !row.old_data || !row.new_data) return [];
  return Object.keys(row.new_data).filter((key) => !["updated_at"].includes(key) && JSON.stringify(row.old_data?.[key]) !== JSON.stringify(row.new_data?.[key]))
    .slice(0, 6).map((key) => `${key}: ${JSON.stringify(row.old_data?.[key] ?? null)} → ${JSON.stringify(row.new_data?.[key] ?? null)}`);
}

export default function AuditPage() {
  return <div className="app-panel"><Suspense fallback={<p className="erp-faint">Loading the audit history…</p>}><Audit /></Suspense></div>;
}

async function Audit() {
  await connection();
  const ws = await loadWorkspace();
  if (ws.state === "signed-out") redirect("/app/login");
  if (ws.state !== "ready") redirect("/app");
  const { supabase, company, user } = ws;
  // Row-level security limits this to the user's company; pay changes are visible to owners and admins only.
  const { data, error } = await supabase.from("audit_history").select("id, at, actor, table_name, row_id, action, old_data, new_data").eq("company_id", company.id).order("id", { ascending: false }).limit(150);
  const rows = (data ?? []) as Row[];
  return <>
    <header className="app-top">
      <Link className="erp-brand" href="/app"><BohMark size={32} /><span><b>BOH</b> ERP</span></Link>
      <Link className="erp-btn erp-btn-sm erp-btn-ghost" href="/app/production"><ArrowLeft size={14} /> Job release</Link>
    </header>
    <div className="erp-head"><div><span className="erp-eyebrow">{company.name}</span><h1>Audit history</h1>
      <p>Every insert, update and delete, written by the database itself. Nobody can change or delete these entries from the app. The latest 150 are shown.</p></div></div>
    {error && <p className="erp-error" role="alert">The audit history could not be loaded.</p>}
    <section className="erp-card">
      <div className="erp-rows">
        <div className="erp-row erp-row-head app-audit-row"><span>When</span><span>What</span><span>Who</span><span>Change</span></div>
        {rows.map((row) => <div key={row.id} className="erp-row app-audit-row">
          <span>{time(row.at)}</span>
          <span><b>{TABLE_LABEL[row.table_name] ?? row.table_name}</b> {row.action === "insert" ? "added" : row.action === "update" ? "changed" : "removed"}</span>
          <span className="erp-muted">{row.actor === user.id ? "You" : row.actor ? `User ${row.actor.slice(0, 8)}` : "System"}</span>
          <span className="erp-muted">{changes(row).join(" · ") || "—"}</span>
        </div>)}
        {!rows.length && !error && <div className="erp-empty"><p>No changes recorded yet.</p></div>}
      </div>
    </section>
  </>;
}
