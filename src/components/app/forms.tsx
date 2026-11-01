"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, Plus } from "lucide-react";
import { addContactAction, createCompanyAction, type FormState } from "@/app/app/actions";
import { INDUSTRIES } from "@/lib/supabase/config";
import { supabaseBrowser } from "@/lib/supabase/browser";

const initial: FormState = {};

function Status({ state }: { state: FormState }) {
  if (state.error) return <p className="erp-error" role="alert">{state.error}</p>;
  if (state.ok) return <p className="erp-ok-text" role="status">{state.ok}</p>;
  return null;
}

/** Email sign-in link (no password to remember or leak). */
export function SignInForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const linkError = params.get("error") === "link";
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    setState("sending");
    const { error } = await supabaseBrowser().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/app` } });
    setState(error ? "error" : "sent");
  };
  if (state === "sent") return <div className="erp-done" role="status"><Mail size={18} /><span>Check <b>{email}</b> for your sign-in link. You can close this tab.</span></div>;
  return <form className="erp-stack" onSubmit={send}>
    {linkError && <p className="erp-error" role="alert">That sign-in link has expired or was already used. Request a new one.</p>}
    <div className="erp-field">
      <label htmlFor="email">Work email</label>
      <input id="email" className="erp-input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
    </div>
    <button type="submit" className="erp-btn erp-btn-primary erp-btn-lg" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Email me a sign-in link"}</button>
    {state === "error" && <p className="erp-error" role="alert">The link could not be sent. Check the address, wait a minute and try again.</p>}
  </form>;
}

export function CreateCompanyForm() {
  const [state, action, pending] = useActionState(createCompanyAction, initial);
  return <form className="erp-stack" action={action}>
    <div className="erp-field">
      <label htmlFor="company-name">Company name</label>
      <input id="company-name" name="name" className="erp-input" required maxLength={160} autoComplete="organization" />
    </div>
    <fieldset className="erp-field" style={{ border: 0, margin: 0, padding: 0 }}>
      <legend className="erp-label" style={{ marginBottom: 6 }}>Industry</legend>
      <div className="erp-choice">
        {INDUSTRIES.map((item, index) => <label key={item.key} className="app-choice">
          <input type="radio" name="industry" value={item.key} defaultChecked={index === 0} />
          <span><b>{item.label}</b><small>{item.hint}</small></span>
        </label>)}
      </div>
    </fieldset>
    <Status state={state} />
    <button type="submit" className="erp-btn erp-btn-primary erp-btn-lg" disabled={pending}>{pending ? "Creating…" : "Create company"}</button>
  </form>;
}

export function AddContactForm({ companyId }: { companyId: string }) {
  const [state, action, pending] = useActionState(addContactAction, initial);
  return <form className="app-inline-form" action={action}>
    <input type="hidden" name="companyId" value={companyId} />
    <div className="erp-field"><label htmlFor="contact-name">Name</label><input id="contact-name" name="name" className="erp-input" required maxLength={200} /></div>
    <div className="erp-field"><label htmlFor="contact-email">Email <span className="erp-faint">(optional)</span></label><input id="contact-email" name="email" type="email" className="erp-input" maxLength={200} /></div>
    <div className="erp-field"><label htmlFor="contact-kind">Type</label>
      <select id="contact-kind" name="kind" className="erp-select" defaultValue="customer"><option value="customer">Customer</option><option value="supplier">Supplier</option><option value="both">Both</option></select></div>
    <button type="submit" className="erp-btn erp-btn-primary" disabled={pending}><Plus size={16} /> {pending ? "Saving…" : "Add"}</button>
    <div className="app-form-status"><Status state={state} /></div>
  </form>;
}
