"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";

type Mode = "api" | "mailto";
type Status = "idle" | "sending" | "sent" | "error";
type Inquiry = { name: string; email: string; company: string; role: string; message: string; website: string };

const empty: Inquiry = { name: "", email: "", company: "", role: "", message: "", website: "" };

export function ContactForm({ mode, contactEmail = "" }: { mode: Mode; contactEmail?: string }) {
  const [values, setValues] = useState<Inquiry>(empty);
  const [status, setStatus] = useState<Status>("idle");
  const [limited, setLimited] = useState(false);
  // When the form was shown (set in the browser, not during prerender): very fast submissions are treated as bots.
  const startedAt = useRef(0);
  useEffect(() => { startedAt.current = Date.now(); }, []);

  function update(field: keyof Inquiry, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function openMailDraft() {
    const subject = encodeURIComponent(`BOH ERP inquiry — ${values.company.trim()}`);
    const body = encodeURIComponent([`Name: ${values.name.trim()}`, `Email: ${values.email.trim()}`, `Company: ${values.company.trim()}`, `Role: ${values.role.trim()}`, "", values.message.trim()].join("\n"));
    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    if (mode === "mailto") {
      openMailDraft();
      setStatus("sent");
      return;
    }
    setStatus("sending");
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, startedAt: startedAt.current }) });
      setLimited(response.status === 429);
      if (!response.ok) throw new Error(String(response.status));
      setValues(empty);
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return <form className="b-form" onSubmit={submit} noValidate={false}>
    <div className="b-form-row">
      <label htmlFor="inquiry-name">Name<input id="inquiry-name" autoComplete="name" value={values.name} onChange={(event) => update("name", event.target.value)} required maxLength={120} /></label>
      <label htmlFor="inquiry-email">Work email<input id="inquiry-email" type="email" autoComplete="email" value={values.email} onChange={(event) => update("email", event.target.value)} required maxLength={200} /></label>
    </div>
    <div className="b-form-row">
      <label htmlFor="inquiry-company">Company<input id="inquiry-company" autoComplete="organization" value={values.company} onChange={(event) => update("company", event.target.value)} required maxLength={160} /></label>
      <label htmlFor="inquiry-role">Your role (optional)<input id="inquiry-role" autoComplete="organization-title" value={values.role} onChange={(event) => update("role", event.target.value)} maxLength={120} /></label>
    </div>
    <label htmlFor="inquiry-message">Which workflow would you like to improve?<textarea id="inquiry-message" value={values.message} onChange={(event) => update("message", event.target.value)} required maxLength={4000} placeholder="For example: we track orders and drawing revisions in spreadsheets and sometimes start jobs with outdated documents." /></label>
    <div className="b-hp" aria-hidden="true"><label htmlFor="inquiry-website">Website<input id="inquiry-website" tabIndex={-1} autoComplete="off" value={values.website} onChange={(event) => update("website", event.target.value)} /></label></div>
    <p className="b-form-note">{mode === "api" ? "We use your details only to reply to this inquiry. Please don’t include confidential drawings or data." : "Your email app will open with a prepared message for you to send. Please don’t include confidential drawings or data."} See our <a href="/privacy">privacy notice</a>.</p>
    <div><button className="b-btn b-btn-dark" type="submit" disabled={status === "sending"}>{status === "sending" ? "Sending…" : mode === "api" ? "Send message" : "Open email draft"} <ArrowRight size={18} /></button></div>
    {status === "sent" && <p role="status" className="b-form-status ok">{mode === "api" ? "Thank you. Your message has been sent and we’ll reply by email." : "Your email app should now be open. Please send the message from there."}</p>}
    {status === "error" && <p role="alert" className="b-form-status err">{limited ? "We already received several messages from you. Please wait an hour or email us directly." : "Sorry, the message could not be sent. Please try again in a moment."}</p>}
  </form>;
}
