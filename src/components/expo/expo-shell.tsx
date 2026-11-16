"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { supabaseConfigured, supabaseUrl } from "@/lib/supabase/config";

type Row = { id: string; data: Record<string, unknown> };
type Store = { userId: string; email: string; list: () => Promise<Row[]>; save: (id: string, data: unknown) => Promise<void>; signOut: () => void };
type ExpoApp = { mount: (root: HTMLElement, store: Store | null) => () => void };
type Phase = "checking" | "signed-out" | "ready" | "local";

const expoApp = () => (window as unknown as { BohExpo?: ExpoApp }).BohExpo;

/** Loads the plain-script field app once. */
function loadApp() {
  return new Promise<ExpoApp>((resolve, reject) => {
    const ready = expoApp();
    if (ready) { resolve(ready); return; }
    const script = document.createElement("script");
    script.src = "/expo/expo-app.js";
    script.onload = () => { const app = expoApp(); if (app) resolve(app); else reject(new Error("app missing")); };
    script.onerror = () => reject(new Error("app failed to load"));
    document.head.appendChild(script);
  });
}

/**
 * The /expo phone app: sign-in gate plus the bridge between the field app and Supabase.
 * Notes are stored per signed-in user in expo_contacts (row-level security); without a session they stay on the phone.
 */
export function ExpoShell() {
  const root = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("checking");
  const [account, setAccount] = useState<{ id: string; email: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    if (!supabaseConfigured()) { Promise.resolve().then(() => { if (live) setPhase("local"); }); return () => { live = false; }; }
    supabaseBrowser().auth.getSession().then((result: { data: { session: { user: { id: string; email?: string } } | null } }) => {
      if (!live) return;
      const user = result.data.session?.user;
      if (user) { setAccount({ id: user.id, email: user.email ?? "" }); setPhase("ready"); } else setPhase("signed-out");
    }, () => { if (live) setPhase("signed-out"); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (phase !== "ready" && phase !== "local") return;
    const node = root.current;
    if (!node) return;
    let unmount: (() => void) | null = null;
    let live = true;
    const store: Store | null = phase === "ready" && account ? {
      userId: account.id,
      email: account.email,
      list: async () => {
        const { data, error } = await supabaseBrowser().from("expo_contacts").select("id, data").eq("user_id", account.id);
        if (error) throw new Error(error.code === "42P01" || error.code === "PGRST205" ? "the expo_contacts table is not set up in Supabase yet" : error.message);
        return (data ?? []) as Row[];
      },
      save: async (id, data) => {
        const { error } = await supabaseBrowser().from("expo_contacts").upsert({ user_id: account.id, id, data, updated_at: new Date().toISOString() }, { onConflict: "user_id,id" });
        if (error) throw new Error(error.code === "42P01" || error.code === "PGRST205" ? "the expo_contacts table is not set up in Supabase yet" : error.message);
      },
      signOut: () => { supabaseBrowser().auth.signOut().then(() => { setAccount(null); setPhase("signed-out"); }, () => { setAccount(null); setPhase("signed-out"); }); },
    } : null;
    loadApp().then((app) => { if (live) unmount = app.mount(node, store); }, () => { if (live) setFailed(true); });
    return () => { live = false; if (unmount) unmount(); };
  }, [phase, account]);

  if (failed) return <div className="gate"><h1>BOH Expo CRM</h1><p className="err" role="alert">The app could not load. Check your connection and reload the page.</p></div>;
  if (phase === "checking") return <div className="gate"><h1>BOH Expo CRM</h1><p className="muted">Loading…</p></div>;
  if (phase === "signed-out") return <SignIn onLocal={() => setPhase("local")} onSignedIn={(user) => { setAccount(user); setPhase("ready"); }} />;
  return <div ref={root} />;
}

function SignIn({ onLocal, onSignedIn }: { onLocal: () => void; onSignedIn: (user: { id: string; email: string }) => void }) {
  const [code, setCode] = useState("");
  const [codeState, setCodeState] = useState<"idle" | "checking" | "wrong">("idle");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [link, setLink] = useState("");
  const [badLink, setBadLink] = useState(false);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    setState("sending");
    // The sign-in link returns through /auth/callback, which reads this short-lived cookie to come back here.
    document.cookie = "boh_next=/expo; path=/; max-age=1800; samesite=lax";
    const { error } = await supabaseBrowser().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback?next=/app` } });
    setState(error && error.status !== 422 && error.code !== "otp_disabled" && error.code !== "signup_disabled" ? "error" : "sent");
  };
  // The code from the email signs in right here, with no redirect, so it works from the home screen and on any address.
  const useCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setCodeState("checking");
    const { data, error } = await supabaseBrowser().auth.verifyOtp({ email: email.trim(), token: code.replace(/\s/g, ""), type: "email" });
    if (error || !data.user) { setCodeState("wrong"); return; }
    onSignedIn({ id: data.user.id, email: data.user.email ?? email.trim() });
  };
  const openLink = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const target = new URL(link.trim());
      if (target.protocol === "https:" && target.hostname === new URL(supabaseUrl).hostname && target.pathname.startsWith("/auth/v1/verify")) {
        document.cookie = "boh_next=/expo; path=/; max-age=1800; samesite=lax";
        window.location.href = target.toString();
        return;
      }
    } catch { /* not a link */ }
    setBadLink(true);
  };

  return <div className="gate">
    <h1>BOH Expo CRM</h1>
    <p className="muted">Sign in with your BOH ERP email so your notes are saved to your account and survive a lost or dead phone.</p>
    {state === "sent"
      ? <>
        <p className="ok" role="status">If {email} has access, an email with a sign-in code is on its way.</p>
        <form onSubmit={useCode}>
          <label className="f" htmlFor="expo-code">Code from the email<input id="expo-code" className="t" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(event) => { setCode(event.target.value); setCodeState("idle"); }} /></label>
          {codeState === "wrong" && <p className="err" role="alert">That code did not work. Check it, or request a new email.</p>}
          <button type="submit" className="btn" disabled={codeState === "checking"}>{codeState === "checking" ? "Checking…" : "Sign in"}</button>
        </form>
        <form onSubmit={openLink}>
          <label className="f" htmlFor="expo-link">No code in the email? Paste the sign-in link here instead<input id="expo-link" className="t" value={link} onChange={(event) => { setLink(event.target.value); setBadLink(false); }} autoComplete="off" /></label>
          {badLink && <p className="err" role="alert">That is not the sign-in link from the email.</p>}
          <button type="submit" className="btn ghost">Sign in with this link</button>
        </form>
      </>
      : <form onSubmit={send}>
        <label className="f" htmlFor="expo-email">Email<input id="expo-email" className="t" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <button type="submit" className="btn" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Email me a sign-in link"}</button>
        {state === "error" && <p className="err" role="alert">The link could not be sent. Check the address, wait a minute and try again.</p>}
      </form>}
    <button type="button" className="btn ghost" onClick={onLocal}>Use without signing in (notes stay on this phone)</button>
  </div>;
}
