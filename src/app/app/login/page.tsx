import Link from "next/link";
import { Suspense } from "react";
import { BohMark } from "@/components/brand/boh-logo";
import { SignInForm } from "@/components/app/forms";
import { missingSupabaseSettings, supabaseConfigured } from "@/lib/supabase/config";

export default function LoginPage() {
  return <div className="app-panel">
    <div className="app-narrow erp-stack">
      <Link className="erp-brand" href="/" style={{ color: "var(--e-ink)" }}><BohMark size={36} /><span><b>BOH</b> ERP</span></Link>
      <div className="erp-card erp-card-pad erp-stack">
        <div><h1 style={{ fontSize: 28 }}>Sign in</h1><p className="erp-muted" style={{ marginTop: 6 }}>We’ll email you a link. New here? The same link creates your account.</p></div>
        {supabaseConfigured()
          ? <Suspense fallback={null}><SignInForm /></Suspense>
          : <p className="erp-hint">Sign-in isn’t connected yet. Missing settings: {missingSupabaseSettings().join(", ")}.</p>}
      </div>
      <p className="erp-faint">Just looking? <Link className="erp-link" href="/demo">Try the demo</Link>. No account needed.</p>
    </div>
  </div>;
}
