import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { BohMark } from "@/components/brand/boh-logo";
import { AddContactForm, CreateCompanyForm } from "@/components/app/forms";
import { signOutAction } from "@/app/app/actions";
import { industryLabel, missingSupabaseSettings, supabaseConfigured } from "@/lib/supabase/config";
import { currentUser } from "@/lib/supabase/server";

type Company = { id: string; name: string; industry: string; is_demo: boolean };
type Contact = { id: string; name: string; email: string; is_customer: boolean; is_supplier: boolean };
type Activity = { id: number; at: string; summary: string };

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" };

export default function AppHome() {
  // The session is read per request, so the workspace streams in behind this boundary.
  return <div className="app-panel"><Suspense fallback={<p className="erp-faint">Loading your workspace…</p>}><Workspace /></Suspense></div>;
}

function Top({ email, company, role }: { email?: string; company?: Company; role?: string }) {
  return <header className="app-top">
    <Link className="erp-brand" href="/app"><BohMark size={32} /><span><b>BOH</b> ERP</span></Link>
    {company && <span className="erp-badge erp-badge-info">{industryLabel(company.industry)}</span>}
    {email && <div className="app-top-user">
      <span>{email}{role ? ` · ${ROLE_LABEL[role] ?? role}` : ""}</span>
      <form action={signOutAction}><button type="submit" className="erp-btn erp-btn-sm"><LogOut size={14} /> Sign out</button></form>
    </div>}
  </header>;
}

async function Workspace() {
  if (!supabaseConfigured()) return <>
    <Top />
    <div className="app-narrow erp-card erp-card-pad erp-stack">
      <h1 style={{ fontSize: 26 }}>Supabase isn’t connected yet</h1>
      <p className="erp-muted">Add these settings to <code>.env.local</code> (and to Vercel later), then restart the app: {missingSupabaseSettings().join(", ")}.</p>
      <p className="erp-faint">The demo keeps working without them: <Link className="erp-link" href="/demo">open the demo</Link>.</p>
    </div>
  </>;

  const { supabase, user } = await currentUser();
  if (!user) redirect("/app/login");

  const { data: memberships, error } = await supabase.from("memberships").select("role, company:companies(id, name, industry, is_demo)").eq("user_id", user.id).order("created_at");
  if (error) return <><Top email={user.email} /><p className="erp-error" role="alert">Your companies could not be loaded. If the database schema hasn’t been applied yet, run the migration in Supabase first.</p></>;

  const first = (memberships ?? [])[0] as unknown as { role: string; company: Company } | undefined;
  if (!first) return <>
    <Top email={user.email} />
    <div className="app-narrow erp-card erp-card-pad erp-stack">
      <div><span className="erp-eyebrow">Welcome</span><h1 style={{ fontSize: 28 }}>Set up your company</h1><p className="erp-muted" style={{ marginTop: 6 }}>You’ll be its owner. The industry decides which modules and sample terms you start with; you can change everything later.</p></div>
      <CreateCompanyForm />
    </div>
  </>;

  const { company, role } = first;
  const tally = (table: string) => supabase.from(table).select("id", { count: "exact", head: true }).eq("company_id", company.id);
  const [customerCount, supplierCount, itemCount, contactsResult, activityResult] = await Promise.all([
    tally("contacts").eq("is_customer", true),
    tally("contacts").eq("is_supplier", true),
    tally("items"),
    supabase.from("contacts").select("id, name, email, is_customer, is_supplier").eq("company_id", company.id).order("created_at", { ascending: false }).limit(25),
    supabase.from("activity_log").select("id, at, summary").eq("company_id", company.id).order("at", { ascending: false }).limit(8),
  ]);
  const [customers, suppliers, items] = [customerCount.count ?? 0, supplierCount.count ?? 0, itemCount.count ?? 0];
  const contacts = (contactsResult.data ?? []) as Contact[];
  const activity = (activityResult.data ?? []) as Activity[];
  const canWrite = role !== "viewer";

  return <>
    <Top email={user.email} company={company} role={role} />
    <div className="erp-head"><div><span className="erp-eyebrow">Workspace</span><h1>{company.name}</h1><p>Your real company data, stored in your database and visible only to your team.</p></div></div>
    <section className="erp-kpis" aria-label="Key figures">
      <article className="erp-card erp-kpi"><small>Customers</small><strong>{customers}</strong></article>
      <article className="erp-card erp-kpi"><small>Suppliers</small><strong>{suppliers}</strong></article>
      <article className="erp-card erp-kpi"><small>Items</small><strong>{items}</strong><span>Parts, products or plans</span></article>
      <article className="erp-card erp-kpi"><small>Your role</small><strong>{ROLE_LABEL[role] ?? role}</strong></article>
    </section>
    <div className="erp-grid-2" style={{ marginTop: 18, gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)" }}>
      <section className="erp-card app-contacts" aria-labelledby="contacts-title">
        <div className="erp-card-head"><div><h2 id="contacts-title">Customers and suppliers</h2><p>Entered once, reused by quotes, orders, purchasing and invoices.</p></div></div>
        {canWrite && <AddContactForm companyId={company.id} />}
        <div className="erp-rows">
          {contacts.length > 0 && <div className="erp-row erp-row-head"><span>Name</span><span>Email</span><span>Type</span></div>}
          {contacts.map((contact) => <div key={contact.id} className="erp-row">
            <strong>{contact.name}</strong>
            <span className="erp-muted">{contact.email || "—"}</span>
            <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{contact.is_customer && <span className="erp-badge erp-badge-info">Customer</span>}{contact.is_supplier && <span className="erp-badge erp-badge-warn">Supplier</span>}</span>
          </div>)}
          {contacts.length === 0 && <div className="erp-empty"><p>No customers or suppliers yet. Add your first one above.</p></div>}
        </div>
      </section>
      <section className="erp-card" aria-labelledby="activity-title">
        <div className="erp-card-head"><div><h2 id="activity-title">Activity</h2><p>Every change, with who made it. It can’t be edited or deleted.</p></div></div>
        <ol className="erp-activity">{activity.map((event) => <li key={event.id}><time dateTime={event.at}>{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(event.at))}</time><span>{event.summary}</span></li>)}</ol>
        {activity.length === 0 && <p className="erp-faint" style={{ padding: "0 20px 20px" }}>Nothing yet.</p>}
      </section>
    </div>
  </>;
}
