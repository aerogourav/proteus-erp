import { documentsToCsv, type ExportDocument } from "@/lib/accounting-export";
import { loadWorkspace } from "@/lib/supabase/workspace";

/**
 * Issued invoices and credit notes of the signed-in user's company as CSV, for a tax adviser or an accounting
 * import. Row-level security limits the rows to the user's own company. Optional ?year=2027.
 */
export async function GET(request: Request) {
  const ws = await loadWorkspace();
  if (ws.state !== "ready") return new Response("Sign in to export.", { status: 401 });
  const year = new URL(request.url).searchParams.get("year");
  let query = ws.supabase.from("sales_documents")
    .select("id, kind, number, issue_date, due_date, status, currency, subtotal, tax, total, source_id, contact:contacts(name, tax_id, address)")
    .eq("company_id", ws.company.id).in("kind", ["invoice", "credit_note"]).neq("status", "Draft").order("issue_date").order("number");
  if (year && /^\d{4}$/.test(year)) query = query.gte("issue_date", `${year}-01-01`).lte("issue_date", `${year}-12-31`);
  const { data, error } = await query;
  if (error) return new Response("The export could not be created.", { status: 500 });
  type Row = { id: string; kind: string; number: string; issue_date: string; due_date: string | null; status: string; currency: string; subtotal: number; tax: number; total: number; source_id: string | null; contact: { name: string; tax_id: string; address: ExportDocument["address"] } | null };
  const rows = (data ?? []) as unknown as Row[];
  const numbers = new Map(rows.map((row) => [row.id, row.number]));
  const csv = documentsToCsv(rows.map((row) => ({
    ...row, customer: row.contact?.name ?? "", tax_id: row.contact?.tax_id ?? "", address: row.contact?.address ?? null,
    cancels: row.kind === "credit_note" && row.source_id ? numbers.get(row.source_id) ?? "" : "",
  })));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="boh-erp-invoices${year && /^\d{4}$/.test(year) ? `-${year}` : ""}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
