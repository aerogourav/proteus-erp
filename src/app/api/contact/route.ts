import { NextResponse } from "next/server";
import { supabaseAnonKey, supabaseConfigured, supabaseUrl } from "@/lib/supabase/config";

/**
 * Website inquiries. Each one is saved as a lead in Supabase (when connected) and, when Resend is configured,
 * also emailed to the team. Either is enough for the visitor to see "sent".
 *
 * Optional environment variables (server-side only):
 *   RESEND_API_KEY      – API key from Resend (https://resend.com)
 *   CONTACT_TO_EMAIL    – inbox that receives inquiries
 *   CONTACT_FROM_EMAIL  – verified sender, e.g. "BOH ERP <hello@your-domain>"; defaults to Resend's test sender,
 *                         which only delivers to the Resend account's own email address
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

/** Best-effort burst limit per visitor (per server instance). The database adds a per-email limit on top. */
const recent = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
function tooMany(ip: string, now: number) {
  const hits = (recent.get(ip) ?? []).filter((at) => now - at < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 5000) recent.clear();
  return hits.length > MAX_PER_WINDOW;
}

const contactConfigured = () => supabaseConfigured() || Boolean(process.env.RESEND_API_KEY && process.env.CONTACT_TO_EMAIL);

async function saveLead(data: Record<Field, string>): Promise<"saved" | "limited" | "failed" | "off"> {
  if (!supabaseConfigured()) return "off";
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/submit_lead`, {
      method: "POST",
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ lead_name: data.name, lead_email: data.email, lead_company: data.company, lead_role: data.role, lead_message: data.message }),
    });
    if (!response.ok) { console.error("Lead not saved", response.status); return "failed"; }
    return (await response.json()) === true ? "saved" : "limited";
  } catch (error) {
    console.error("Lead not saved", error instanceof Error ? error.message : error);
    return "failed";
  }
}

async function emailTeam(data: Record<Field, string>): Promise<"sent" | "failed" | "off"> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !to) return "off";
  const text = [`Name: ${data.name}`, `Email: ${data.email}`, `Company: ${data.company}`, `Role: ${data.role || "–"}`, "", "Workflow / problem:", data.message].join("\n");
  try {
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
    if (!response.ok) { console.error("Contact email failed", response.status); return "failed"; }
    return "sent";
  } catch {
    return "failed";
  }
}

export async function POST(request: Request) {
  if (!contactConfigured()) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  // Bots: the hidden field must stay empty, and a person needs a few seconds to fill in the form.
  const startedAt = typeof payload.startedAt === "number" ? payload.startedAt : 0;
  const now = Date.now();
  if (clean(payload.website, 200) || now - startedAt < 3000 || now - startedAt > 24 * 3600 * 1000) return NextResponse.json({ ok: true });

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || "unknown";
  if (tooMany(ip, now)) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });

  const data = Object.fromEntries((Object.keys(limits) as Field[]).map((field) => [field, clean(payload[field], limits[field])])) as Record<Field, string>;
  if (!data.name || !data.company || !data.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return NextResponse.json({ ok: false, error: "invalid_fields" }, { status: 422 });
  }

  const [lead, mail] = await Promise.all([saveLead(data), emailTeam(data)]);
  if (lead === "limited" && mail !== "sent") return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  if (lead === "saved" || mail === "sent") return NextResponse.json({ ok: true });
  return NextResponse.json({ ok: false, error: "delivery_failed" }, { status: 502 });
}
