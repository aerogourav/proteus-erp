"use client";

import { useState } from "react";
import { commit, nowIso } from "@/components/erp/store";
import { toast } from "@/components/erp/toast";
import { Field, Modal } from "@/components/erp/ui";
import { approver, overrideRelease, releaseBlockers, type ErpState, type ProductionOrder } from "@/lib/erp/model";

/** Release despite open blockers: owner or admin only, with a reason that is logged with their name. */
export function OverrideDialog({ state, order, onClose }: { state: ErpState; order: ProductionOrder; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const blockers = releaseBlockers(state, order.id);
  const who = approver(state);
  const submit = () => {
    if (!who) { setError("Only an owner or admin can override the release check."); return; }
    if (reason.trim().length < 5) { setError("Give a reason of at least a few words. It is saved in the activity log."); return; }
    commit((value) => overrideRelease(value, order.id, reason, nowIso()));
    toast(`${order.number} released by override.`, { tone: "info" });
    onClose();
  };
  return <Modal label={`Override release check for ${order.number}`} onClose={onClose}>
    <form className="erp-stack" style={{ gap: 12 }} onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <h2>Override release check · {order.number}</h2>
      <ul className="erp-reasons">{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
      <Field id="override-reason" label="Reason (required)" help={`Saved with your name${who ? ` (${who.name})` : ""} and the time. Covers only the issues listed here; a new issue stops the job again.`}><textarea className="erp-input" id="override-reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
      {error && <p className="erp-error" role="alert">{error}</p>}
      <div className="erp-head-actions" style={{ justifyContent: "flex-end" }}><button type="button" className="erp-btn erp-btn-ghost" onClick={onClose}>Cancel</button><button type="submit" className="erp-btn erp-btn-danger">Override and release</button></div>
    </form>
  </Modal>;
}
