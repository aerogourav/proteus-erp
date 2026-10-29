"use client";

import { commit, getState, nowIso } from "@/components/erp/store";
import { fetchGmail, gmailProfile, hasToken, sendGmail } from "@/components/erp/gmail";
import { toast } from "@/components/erp/toast";
import { addEmails } from "@/lib/erp/mail";
import { currentUserName } from "@/lib/erp/model";
import { demoSupplierConfirmation } from "@/lib/erp/purchasing";

/**
 * Sends an email from inside the ERP. With Gmail connected it really goes out from the user's account;
 * in the sample inbox it is only recorded in "Sent" (and clearly labelled as such).
 */
export async function sendFromErp(input: { to: string; subject: string; body: string }): Promise<{ id: string; real: boolean; error?: string }> {
  const state = getState();
  let real = false;
  if (state.mail.provider === "gmail") {
    if (!hasToken()) return { id: "", real: false, error: "Your Gmail session expired. Connect Gmail again in the Inbox, then send." };
    try { await sendGmail(input); real = true; } catch (error) { return { id: "", real: false, error: error instanceof Error ? error.message : "Sending failed." }; }
  }
  const id = `mail-out-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const at = nowIso();
  commit((value) => addEmails(value, [{ id, folder: "sent", from: value.mail.address || "you@your-company.example", fromName: currentUserName(value) ?? "You", to: input.to, subject: input.subject, body: input.body, date: at, read: true, source: real ? "gmail" : "erp" }], at));
  return { id, real };
}

/** In the sample inbox, the supplier "answers" a few seconds after an order is sent, so the loop can be tried end to end. */
export function scheduleDemoSupplierReply(orderId: string) {
  if (getState().mail.provider === "gmail") return;
  window.setTimeout(() => {
    const state = getState();
    const order = state.supplierOrders.find((item) => item.id === orderId);
    if (!order || order.status !== "Sent") return;
    const reply = demoSupplierConfirmation(state, order, nowIso());
    commit((value) => addEmails(value, [reply], nowIso()));
    toast(`New email: ${reply.subject} (simulated supplier reply)`, { href: `/demo/inbox?mail=${reply.id}`, action: "Open", tone: "info" });
  }, 4500);
}

let syncing = false;

/** Pulls new Gmail messages into the inbox. Returns how many arrived. */
export async function syncGmail(): Promise<{ added: number; error?: string }> {
  if (syncing) return { added: 0 };
  const state = getState();
  if (state.mail.provider !== "gmail") return { added: 0 };
  if (!hasToken()) return { added: 0, error: "Connect Gmail to check for new mail." };
  syncing = true;
  try {
    const after = state.mail.lastSync ? Math.floor(Date.parse(state.mail.lastSync) / 1000) - 120 : null;
    const messages = await fetchGmail(after);
    const before = getState().emails.length;
    const at = nowIso();
    let address = state.mail.address;
    if (!address) { try { address = await gmailProfile(); } catch { /* optional */ } }
    commit((value) => ({ ...addEmails(value, messages, at), mail: { ...value.mail, lastSync: at, address: address || value.mail.address } }));
    const added = Math.max(0, getState().emails.length - before);
    return { added };
  } catch (error) {
    return { added: 0, error: error instanceof Error ? error.message : "Could not reach Gmail." };
  } finally {
    syncing = false;
  }
}
