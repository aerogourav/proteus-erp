"use client";

import { useState } from "react";
import { commit, nowIso, useErp } from "@/components/erp/store";
import { generateInspectionReport, inspectionInputError, partNumber, projectRecords, readiness, revisionLabel, toleranceCheck, type Measurement } from "@/lib/erp/model";

const blank: Measurement = { observed: "", result: "", sampleSize: 0, gaugeId: "" };

/**
 * Records the final inspection: per parameter a measured value, an explicit pass or fail, the number of parts measured and the gauge.
 * Nothing is preselected. A number outside a tolerance the system can read is failed automatically. Used in the guided demo and the Quality tab.
 */
export function InspectionForm({ projectId, onSaved }: { projectId: string; onSaved?: () => void }) {
  const state = useErp();
  const [results, setResults] = useState<Record<string, Measurement>>({});
  const r = projectRecords(state, projectId);
  const ready = readiness(state, projectId);
  const productionDone = ready.production.state === "complete";
  const [error, setError] = useState("");
  const save = () => {
    const problem = inspectionInputError(state, projectId, results);
    if (problem) { setError(problem); return; }
    setError("");
    commit((value) => generateInspectionReport(value, projectId, nowIso(), results));
    setResults({});
    onSaved?.();
  };
  return <div className="erp-stack" style={{ gap: 12 }}>
    {r.lineItems.map((line) => {
      const reqs = r.inspectionRequirements.filter((req) => req.partId === line.partId || (req.partId === null && req.projectId === projectId));
      return <div key={line.id} className="erp-param">
        <div className="erp-param-head"><b>{partNumber(state, line.partId)} rev {revisionLabel(state, line.revisionId)}</b><span className="erp-faint">{line.quantity} {line.unit}</span></div>
        {reqs.length ? reqs.map((req) => {
          const value = results[req.id] ?? blank;
          const set = (patch: Partial<Measurement>) => setResults({ ...results, [req.id]: { ...value, ...patch } });
          const tolerance = value.observed.trim() ? toleranceCheck(req.spec, value.observed) : "unknown";
          return <div key={req.id} className="erp-inspect-block">
            <div className="erp-inspect-row">
              <span><b>{req.name}</b><small>{req.spec}{req.unit ? ` ${req.unit}` : ""}</small></span>
              <input className="erp-input" aria-label={`Measured ${req.name}`} placeholder="Measured value" value={value.observed} onChange={(event) => set({ observed: event.target.value })} />
              <select className="erp-select" aria-label={`Result for ${req.name}`} value={value.result} onChange={(event) => set({ result: event.target.value as Measurement["result"] })}><option value="">Choose result…</option><option value="pass">Pass</option><option value="fail">Fail</option></select>
            </div>
            <div className="erp-inspect-row erp-inspect-extra">
              <span />
              <input className="erp-input" aria-label={`Parts measured for ${req.name}`} inputMode="numeric" placeholder="Parts measured" value={value.sampleSize ? String(value.sampleSize) : ""} onChange={(event) => set({ sampleSize: Number(event.target.value.replace(/[^0-9]/g, "")) || 0 })} />
              <input className="erp-input" aria-label={`Gauge ID for ${req.name}`} placeholder="Gauge ID (optional)" value={value.gaugeId} onChange={(event) => set({ gaugeId: event.target.value })} />
            </div>
            {tolerance === "out" && <p className="erp-error" role="alert">{value.observed.trim()} is outside {req.spec}{req.unit ? ` ${req.unit}` : ""}. This parameter will be recorded as failed.</p>}
            {tolerance === "in" && value.result === "fail" && <p className="erp-faint">The value is inside the tolerance, but you chose Fail. The result will be recorded as failed.</p>}
          </div>;
        }) : <p className="erp-faint">No parameters for this part. Add them in the Quality tab.</p>}
      </div>;
    })}
    {!productionDone && <p className="erp-faint">Every routing operation must be booked on the shop floor first.</p>}
    {error && <p className="erp-error" role="alert">{error}</p>}
    <div><button type="button" className="erp-btn erp-btn-dark" disabled={!productionDone || !r.inspectionRequirements.length} onClick={save}>Save inspection result</button></div>
    <p className="erp-faint">Use fictional measurements. Every parameter needs a measured value, an explicit result and the number of parts measured; the inspector is recorded from “Signed in as”.</p>
  </div>;
}
