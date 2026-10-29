"use client";

import { rawMime } from "@/lib/erp/mail";
import type { EmailRecord } from "@/lib/erp/model";

/**
 * Gmail in the browser with Google Identity Services: the visitor signs in with Google, the access token
 * stays in this tab's memory (never stored, never sent to BOH ERP servers), and messages are read and sent
 * directly with the Gmail API. Needs NEXT_PUBLIC_GOOGLE_CLIENT_ID (a Google Cloud OAuth web client).
 */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
export const gmailAvailable = () => Boolean(GOOGLE_CLIENT_ID);
const SCOPES = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

/* eslint-disable @typescript-eslint/no-explicit-any */
let token: { value: string; expires: number } | null = null;
let gisPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { gisPromise = null; reject(new Error("Google sign-in could not be loaded.")); };
    document.head.appendChild(script);
  });
  return gisPromise;
}

export const hasToken = () => Boolean(token && token.expires > Date.now() + 30000);

/** Opens Google's consent popup (must be called from a click). */
export async function connectGmail(prompt: "consent" | "" = "consent"): Promise<string> {
  if (!GOOGLE_CLIENT_ID) throw new Error("Gmail is not configured for this site yet.");
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID, scope: SCOPES, prompt,
      callback: (response: any) => {
        if (response.error || !response.access_token) { reject(new Error(response.error_description || response.error || "Google sign-in was cancelled.")); return; }
        token = { value: response.access_token, expires: Date.now() + Number(response.expires_in ?? 3600) * 1000 };
        resolve(response.access_token);
      },
      error_callback: (error: any) => reject(new Error(error?.message || "Google sign-in was cancelled.")),
    });
    client.requestAccessToken();
  });
}

export function disconnectGmail() {
  const google = (window as any).google;
  if (token && google?.accounts?.oauth2) google.accounts.oauth2.revoke(token.value, () => {});
  token = null;
}

async function api(path: string, init?: RequestInit) {
  if (!hasToken()) throw new Error("Gmail session expired. Connect again.");
  const response = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token!.value}`, "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (response.status === 401) { token = null; throw new Error("Gmail session expired. Connect again."); }
  if (!response.ok) throw new Error(`Gmail returned ${response.status}.`);
  return response.json();
}

export async function gmailProfile(): Promise<string> {
  const profile = await api("/profile");
  return profile.emailAddress ?? "";
}

function decode(data: string) {
  const binary = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function bodyOf(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return decode(payload.body.data);
  for (const part of payload.parts ?? []) { const text = bodyOf(part); if (text) return text; }
  if (payload.mimeType === "text/html" && payload.body?.data) return decode(payload.body.data).replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  return "";
}

/** Fetches recent inbox messages (newest first). `afterSeconds` limits it to mail newer than the last sync. */
export async function fetchGmail(afterSeconds: number | null, max = 25): Promise<EmailRecord[]> {
  const query = encodeURIComponent(`in:inbox${afterSeconds ? ` after:${afterSeconds}` : " newer_than:14d"}`);
  const list = await api(`/messages?maxResults=${max}&q=${query}`);
  const ids: string[] = (list.messages ?? []).map((item: any) => item.id);
  const messages = await Promise.all(ids.map((id) => api(`/messages/${id}?format=full`)));
  return messages.map((message: any) => {
    const headers: Record<string, string> = Object.fromEntries((message.payload?.headers ?? []).map((header: any) => [String(header.name).toLowerCase(), String(header.value)]));
    const from = headers.from ?? "";
    const match = from.match(/^(.*?)\s*<([^>]+)>$/);
    return {
      id: `gmail-${message.id}`, externalId: message.id, folder: "inbox" as const, source: "gmail" as const,
      from: (match ? match[2] : from).trim(), fromName: (match ? match[1] : from).replace(/^"|"$/g, "").trim(), to: headers.to ?? "",
      subject: headers.subject ?? "(no subject)", date: new Date(Number(message.internalDate) || Date.now()).toISOString(),
      body: bodyOf(message.payload) || message.snippet || "", read: !(message.labelIds ?? []).includes("UNREAD"),
    };
  });
}

export async function sendGmail(input: { to: string; subject: string; body: string }): Promise<string> {
  const result = await api("/messages/send", { method: "POST", body: JSON.stringify({ raw: rawMime({ from: "", ...input }) }) });
  return result.id ?? "";
}
/* eslint-enable @typescript-eslint/no-explicit-any */
