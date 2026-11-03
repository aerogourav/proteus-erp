import Link from "next/link";
import { Suspense } from "react";
import { BohMark } from "@/components/brand/boh-logo";
import { SignInForm } from "@/components/app/forms";
import { supabaseConfigured } from "@/lib/supabase/config";

export default function LoginPage() {
  return <div className="app-panel">
    <div className="app-narrow erp-stack">
      <Link className="erp-brand" href="/" style={{ color: "var(--e-ink)" }}><BohMark size={36} /><span><b>BOH</b> ERP</span></Link>
      <div className="erp-card erp-card-pad erp-stack">
        <div><h1 style={{ fontSize: 28 }}>Sign in</h1><p className="erp-muted" style={{ marginTop: 6 }}>The workspace is invite-only for now. Enter the email address you were invited with and we’ll send you a sign-in link.</p></div>
        {supabaseConfigured()
          ? <Suspense fallback={null}><SignInForm /></Suspense>
          : <p className="erp-hint">Sign-in isn’t available yet.</p>}
      </div>
      <p className="erp-faint">Not invited yet? <Link className="erp-link" href="/contact?offer=pilot">Ask about the free 2-week pilot</Link> or <Link className="erp-link" href="/demo">try the demo</Link>. No account needed.</p>
    </div>
  </div>;
}
