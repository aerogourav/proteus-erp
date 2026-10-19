"use client";
import { useState, type FormEvent } from "react";

const fields = ["Name", "Work email", "Company or startup", "Industry", "Role", "What would you like to manage?", "Message"] as const;
type Field = typeof fields[number];

export function ContactForm() {
  const [values, setValues] = useState<Record<Field, string>>({ Name: "", "Work email": "", "Company or startup": "", Industry: "", Role: "", "What would you like to manage?": "", Message: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [attempted, setAttempted] = useState(false);
  const [cleared, setCleared] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    const next: Partial<Record<Field, string>> = {};
    for (const key of fields) if (!values[key].trim()) next[key] = "This field is required.";
    if (values["Work email"] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values["Work email"])) next["Work email"] = "Enter a valid email address.";
    setErrors(next);
    if (Object.keys(next).length === 0) setCleared(true);
  }
  return <form className="contact-form" onSubmit={submit} noValidate>
    <p>This form is a local interface preview. Nothing is sent or stored. Please do not enter confidential information.</p>
    {fields.map((field) => <label key={field}>{field}{field === "Message" || field === "What would you like to manage?" ? <textarea required rows={field === "Message" ? 5 : 2} value={values[field]} aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `contact-${field}` : undefined} onChange={(event) => setValues({ ...values, [field]: event.target.value })} /> : <input required type={field === "Work email" ? "email" : "text"} value={values[field]} aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `contact-${field}` : undefined} onChange={(event) => setValues({ ...values, [field]: event.target.value })} />}{errors[field] && <small id={`contact-${field}`} role="alert">{errors[field]}</small>}</label>)}
    {attempted && Object.keys(errors).length > 0 && <p role="alert" className="contact-form-error">Review the highlighted fields to continue.</p>}
    <button className="button button-primary" type="submit">Preview form validation</button>
    {cleared && <p role="status" className="contact-form-success">All fields are valid in this local preview. No message was sent or transmitted.</p>}
  </form>;
}
