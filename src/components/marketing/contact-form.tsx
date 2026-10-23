"use client";

import { useState, type FormEvent } from "react";

type Inquiry = { name: string; email: string; company: string; industry: string; workflow: string };

export function ContactForm({ contactEmail }: { contactEmail: string }) {
  const [values, setValues] = useState<Inquiry>({ name: "", email: "", company: "", industry: "", workflow: "" });
  const [draftOpened, setDraftOpened] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contactEmail) return;
    if (!event.currentTarget.reportValidity()) return;
    const subject = encodeURIComponent(`PROTEUS workflow inquiry — ${values.company.trim()}`);
    const body = encodeURIComponent([
      `Name: ${values.name.trim()}`,
      `Business email: ${values.email.trim()}`,
      `Company: ${values.company.trim()}`,
      `Industry: ${values.industry.trim()}`,
      "",
      "Workflow or operational challenge:",
      values.workflow.trim(),
    ].join("\n"));
    setDraftOpened(true);
    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
  }

  function update(field: keyof Inquiry, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return <form className="contact-form" onSubmit={submit}>
    <p>Your email app will open a draft for you to review and send. This website does not receive or store the inquiry. Please do not include confidential information or attach drawings.</p>
    <label htmlFor="inquiry-name">Name<input id="inquiry-name" autoComplete="name" value={values.name} onChange={(event) => update("name", event.target.value)} required /></label>
    <label htmlFor="inquiry-email">Business email<input id="inquiry-email" type="email" autoComplete="email" value={values.email} onChange={(event) => update("email", event.target.value)} required /></label>
    <label htmlFor="inquiry-company">Company or startup<input id="inquiry-company" autoComplete="organization" value={values.company} onChange={(event) => update("company", event.target.value)} required /></label>
    <label htmlFor="inquiry-industry">Industry<input id="inquiry-industry" value={values.industry} onChange={(event) => update("industry", event.target.value)} placeholder="For example, manufacturing or services" required /></label>
    <label htmlFor="inquiry-workflow">What workflow or operational problem would you like to discuss?<textarea id="inquiry-workflow" rows={5} value={values.workflow} onChange={(event) => update("workflow", event.target.value)} required /></label>
    <button className="button button-primary" type="submit">Open inquiry draft</button>
    {draftOpened && <p role="status" className="contact-form-success">Your email app should open with a draft. Review it and send it there; this site cannot confirm delivery.</p>}
  </form>;
}
