import { NextResponse } from "next/server";

/**
 * Website inquiry delivery via Resend (https://resend.com).
 * Required environment variables (server-side only):
 *   RESEND_API_KEY      – API key from Resend
 *   CONTACT_TO_EMAIL    – inbox that receives inquiries
 * Optional:
 *   CONTACT_FROM_EMAIL  – verified sender, e.g. "BOH ERP <hello@your-domain>"; defaults to Resend's test sender
 */

const limits = { name: 120, email: 200, company: 160, role: 120, message: 4000 } as const;
type Field = keyof typeof limits;

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const htmlEscapes: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => htmlEscapes[char] ?? char);
}

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !to) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  // Honeypot: real visitors never fill this hidden field.
  if (clean(payload.website, 200)) return NextResponse.json({ ok: true });

  const data = Object.fromEntries((Object.keys(limits) as Field[]).map((field) => [field, clean(payload[field], limits[field])])) as Record<Field, string>;
  if (!data.name || !data.company || !data.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return NextResponse.json({ ok: false, error: "invalid_fields" }, { status: 422 });
  }

  const text = [
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Company: ${data.company}`,
    `Role: ${data.role || "–"}`,
    "",
    "Workflow / problem:",
    data.message,
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM_EMAIL || "BOH ERP Website <onboarding@resend.dev>",
      to: [to],
      reply_to: data.email,
      subject: `BOH ERP inquiry — ${data.company}`,
      text,
      html: `<pre style="font:14px/1.5 system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
    }),
  });

  if (!response.ok) {
    console.error("Contact delivery failed", response.status);
    return NextResponse.json({ ok: false, error: "delivery_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
