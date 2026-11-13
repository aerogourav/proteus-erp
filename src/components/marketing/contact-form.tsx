"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { OFFERS, inquiryText, offerByKey, type OfferKey } from "@/lib/offers";

type Mode = "api" | "mailto";
type Status = "idle" | "sending" | "sent" | "error";
type Values = { name: string; email: string; company: string; role: string; message: string; website: string; offer: OfferKey | "" };

const empty: Values = { name: "", email: "", company: "", role: "", message: "", website: "", offer: "" };

/** The form with the offer from the link (?offer=pilot) already chosen. Render inside <Suspense>. */
export function ContactFormFromLink(props: { mode: Mode; contactEmail?: string }) {
  const offer = offerByKey(useSearchParams().get("offer"))?.key ?? "";
  return <ContactForm key={offer} {...props} initialOffer={offer} />;
}

export function ContactForm({ mode, contactEmail = "", initialOffer = "" }: { mode: Mode; contactEmail?: string; initialOffer?: OfferKey | "" }) {
  const [values, setValues] = useState<Values>({ ...empty, offer: initialOffer });
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState("");
  // When the form was shown (set in the browser, not during prerender): very fast submissions are treated as bots.
  const startedAt = useRef(0);
  useEffect(() => { startedAt.current = Date.now(); }, []);

  function update(field: keyof Values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function openMailDraft() {
    const offer = OFFERS.find((item) => item.key === values.offer);
    const subject = encodeURIComponent(`BOH ERP ${offer?.title ?? "inquiry"} — ${values.company.trim()}`);
    const body = encodeURIComponent(inquiryText({ name: values.name.trim(), email: values.email.trim(), company: values.company.trim(), role: values.role.trim(), message: values.message.trim(), offer: offer?.key ?? "call" }));
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
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { message?: string };
        setFailure(response.status === 429 ? "We already received several messages from you. Please wait an hour before sending another." : response.status === 422 && result.message ? result.message : response.status === 503 ? "Message delivery is not connected yet, so nothing was sent." : "Your message was not sent because of a problem on our side. Please try again in a few minutes.");
        setStatus("error");
        return;
      }
      setValues({ ...empty, offer: values.offer });
      setStatus("sent");
    } catch {
      setFailure("Your message was not sent. Check your internet connection and try again.");
      setStatus("error");
    }
  }

  return <form className="b-form" onSubmit={submit} noValidate={false}>
    <fieldset className="b-offer-choice">
      <legend>What would you like to start with?</legend>
      {OFFERS.map((offer) => <label key={offer.key} className={values.offer === offer.key ? "on" : undefined}>
        <input type="radio" name="offer" value={offer.key} checked={values.offer === offer.key} onChange={() => update("offer", offer.key)} required />
        <span><strong>{offer.title}</strong><small>{offer.length}</small></span>
      </label>)}
    </fieldset>
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
    {status === "sent" && <p role="status" className="b-form-status ok">{mode === "api" ? "Thank you, your message was received. We’ll reply by email." : "Your email app should now be open. Your message is only sent once you press send there."}</p>}
    {status === "error" && <p role="alert" className="b-form-status err">{failure}{contactEmail ? <> You can also email <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</> : null}</p>}
  </form>;
}
