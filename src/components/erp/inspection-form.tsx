"use client";

import { useState } from "react";
import { commit, nowIso, useErp } from "@/components/erp/store";
import { generateInspectionReport, partNumber, projectRecords, readiness, revisionLabel } from "@/lib/erp/model";

/** Records the final inspection: a measured value and pass/fail per parameter. Used in the guided demo and the Quality tab. */
export function InspectionForm({ projectId, onSaved }: { projectId: string; onSaved?: () => void }) {
  const state = useErp();
  const [results, setResults] = useState<Record<string, { observed: string; pass: boolean }>>({});
  const r = projectRecords(state, projectId);
  const ready = readiness(state, projectId);
  const productionDone = ready.production.state === "complete";
  const [error, setError] = useState("");
  const save = () => {
    const missing = r.inspectionRequirements.filter((req) => !results[req.id]?.observed.trim());
    if (missing.length) { setError(`Enter a measured value for ${missing.map((req) => req.name).join(", ")}. An inspection without a measurement cannot pass.`); return; }
    setError("");
    commit((value) => generateInspectionReport(value, projectId, nowIso(), Object.fromEntries(r.inspectionRequirements.map((req) => [req.id, results[req.id]!]))));
    setResults({});
    onSaved?.();
  };
  return <div className="erp-stack" style={{ gap: 12 }}>
    {r.lineItems.map((line) => {
      const reqs = r.inspectionRequirements.filter((req) => req.partId === line.partId || (req.partId === null && req.projectId === projectId));
      return <div key={line.id} className="erp-param">
        <div className="erp-param-head"><b>{partNumber(state, line.partId)} rev {revisionLabel(state, line.revisionId)}</b><span className="erp-faint">{line.quantity} {line.unit}</span></div>
        {reqs.length ? reqs.map((req) => {
          const value = results[req.id] ?? { observed: "", pass: true };
          return <div key={req.id} className="erp-inspect-row">
            <span><b>{req.name}</b><small>{req.spec}{req.unit ? ` ${req.unit}` : ""}</small></span>
            <input className="erp-input" aria-label={`Measured ${req.name}`} placeholder="Measured value" value={value.observed} onChange={(event) => setResults({ ...results, [req.id]: { ...value, observed: event.target.value } })} />
            <select className="erp-select" aria-label={`Result for ${req.name}`} value={value.pass ? "pass" : "fail"} onChange={(event) => setResults({ ...results, [req.id]: { ...value, pass: event.target.value === "pass" } })}><option value="pass">Pass</option><option value="fail">Fail</option></select>
          </div>;
        }) : <p className="erp-faint">No parameters for this part. Add them in the Quality tab.</p>}
      </div>;
    })}
    {!productionDone && <p className="erp-faint">Set every production order to “Completed” first.</p>}
    {error && <p className="erp-error" role="alert">{error}</p>}
    <div><button type="button" className="erp-btn erp-btn-dark" disabled={!productionDone || !r.inspectionRequirements.length} onClick={save}>Save inspection result</button></div>
    <p className="erp-faint">Use fictional measurements. Every parameter needs a measured value; the inspector is recorded from “Signed in as”.</p>
  </div>;
}
