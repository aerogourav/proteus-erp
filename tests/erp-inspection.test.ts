import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  advanceProcurement, approveDocument, createInitialState, createProductionOrder, createProjectFromDraft, dispatchProject, generateInspectionReport,
  limitOutcome, newDraft, parseSpec, projectRecords, readiness, resolveInspection, type ErpState, type ProjectDraft,
} from "../src/lib/erp/model.ts";
import { recordRemainingOperations, saveEmployee, setCurrentUser } from "../src/lib/erp/shopfloor.ts";

/** Shared with tests/db-pilot.test.ts: the database must give the same outcome for the same limits. */
export const LIMIT_CASES = JSON.parse(readFileSync(new URL("./fixtures/limit-cases.json", import.meta.url), "utf8")) as { observed: string; lower: number | null; upper: number | null; outcome: string }[];

const NOW = "2026-11-04T10:00:00.000Z";

test("entry helper: specifications become explicit limits; ISO fits are never guessed", () => {
  assert.deepEqual(parseSpec("120.00 ± 0.05"), { nominal: 120, lower: 119.95, upper: 120.05 });
  assert.deepEqual(parseSpec("min 3, max 5"), { nominal: null, lower: 3, upper: 5 });
  assert.deepEqual(parseSpec("0.05 max"), { nominal: null, lower: null, upper: 0.05 });
  assert.deepEqual(parseSpec("Ø20 +0.1 -0.2"), { nominal: 20, lower: 19.8, upper: 20.1 });
  assert.deepEqual(parseSpec("20 +0.1/-0.05"), { nominal: 20, lower: 19.95, upper: 20.1 });
  assert.deepEqual(parseSpec("Ra ≤ 0.8"), { nominal: null, lower: null, upper: 0.8 });
  assert.deepEqual(parseSpec("min 3"), { nominal: null, lower: 3, upper: null });
  assert.deepEqual(parseSpec("8–12"), { nominal: null, lower: 8, upper: 12 });
  assert.equal(parseSpec("Ø40.00 H8"), null);
  assert.equal(parseSpec("Ø25 f7"), null);
  assert.equal(parseSpec("EN AW-7075-T6"), null);
  assert.equal(parseSpec("No burrs"), null);
});

test("shared limit cases: pass, fail, needs review or invalid", () => {
  for (const item of LIMIT_CASES) assert.equal(limitOutcome(item.observed, item.lower, item.upper), item.outcome, `${item.observed} in [${item.lower}, ${item.upper}]`);
});

/** A finished job with three requirements: an explicit tolerance, an ISO fit (no usable limits) and a visual check. */
function finishedJob() {
  let state: ErpState = createInitialState();
  state = saveEmployee(state, null, { code: "E-1", name: "Lena Admin", role: "Production manager", access: "admin", department: "Production", email: "", hourlyRate: 40, monthlySalary: 0, pay: "hourly", active: true }, NOW);
  state = saveEmployee(state, null, { code: "E-2", name: "Omar Owner", role: "Managing director", access: "owner", department: "Management", email: "", hourlyRate: 60, monthlySalary: 0, pay: "hourly", active: true }, NOW);
  state = saveEmployee(state, null, { code: "E-3", name: "Ben Op", role: "Machinist", access: "member", department: "Production", email: "", hourlyRate: 30, monthlySalary: 0, pay: "hourly", active: true }, NOW);
  const [lena, omar, ben] = state.employees;
  state = setCurrentUser(state, lena.id);
  const draft: ProjectDraft = {
    ...newDraft(state, "2026-11-04"), projectName: "Housings", projectCode: "BOH-PRJ-2026-080", poNumber: "PO-I-1", customerName: "Inspect GmbH",
    lines: [{ key: "a", partNumber: "HS-1", description: "Housing", quantity: "2", unit: "pcs", unitPrice: "50", revision: "A" }],
    documents: [{ key: "d", name: "Housing drawing", type: "Drawing", number: "DRW-HS-1", revision: "A", partKey: "a", status: "In review", source: "metadata" }],
    inspections: [
      { key: "w", name: "Outer width", spec: "120.00 ± 0.05", unit: "mm", acceptance: "", partKey: "a" },
      { key: "b", name: "Bore", spec: "Ø40.00 H8", unit: "mm", acceptance: "", partKey: "a" },
      { key: "v", name: "Visual", spec: "No burrs", unit: "", acceptance: "", partKey: "a" },
    ],
    materials: [{ key: "m", material: "Bar", quantity: "1", unit: "kg", supplier: "Metals", status: "Not ordered", lineKey: "a" }],
  };
  const created = createProjectFromDraft(state, draft, NOW);
  state = created.state;
  for (const doc of projectRecords(state, created.projectId).documents) state = approveDocument(state, doc.id, NOW);
  for (const proc of projectRecords(state, created.projectId).procurement) state = advanceProcurement(advanceProcurement(state, proc.id, NOW), proc.id, NOW);
  state = createProductionOrder(state, projectRecords(state, created.projectId).lineItems[0].id, NOW);
  state = recordRemainingOperations(state, projectRecords(state, created.projectId).productionOrders[0].id, NOW);
  return { state, projectId: created.projectId, lena: lena.id, omar: omar.id, ben: ben.id };
}

const entries = (state: ErpState, projectId: string, values: Record<string, { observed: string; result?: "pass" | "fail" | ""; sampleSize?: number; gaugeId?: string }>) =>
  Object.fromEntries(projectRecords(state, projectId).inspectionRequirements.map((req) => {
    const value = values[req.name] ?? { observed: "OK" };
    return [req.id, { observed: value.observed, result: value.result ?? "pass", sampleSize: value.sampleSize ?? 2, gaugeId: value.gaugeId ?? "" }];
  }));

test("demo: 999 mm against Ø40.00 H8 needs review and cannot ship; unreadable numbers are refused", () => {
  const job = finishedJob();
  let { state } = job;
  const refused = generateInspectionReport(state, job.projectId, NOW, entries(state, job.projectId, { "Outer width": { observed: "120.01" }, Bore: { observed: "abc" }, Visual: { observed: "OK" } }));
  assert.equal(refused, state, "a numeric characteristic needs a number");
  state = generateInspectionReport(state, job.projectId, NOW, entries(state, job.projectId, { "Outer width": { observed: "120.01" }, Bore: { observed: "999" }, Visual: { observed: "OK" } }));
  const report = state.inspectionReports[0];
  assert.equal(report.results.find((result) => result.observed.startsWith("999"))?.outcome, "needs_review");
  assert.equal(report.passed, false);
  assert.match(readiness(state, job.projectId).quality.summary, /review/i);
  assert.equal(dispatchProject(state, job.projectId, NOW), state, "no dispatch while a result needs review");
});

test("demo: the required sample size is enforced", () => {
  const job = finishedJob();
  const { state } = job;
  const req = projectRecords(state, job.projectId).inspectionRequirements[0];
  const withPlan = { ...state, inspectionRequirements: state.inspectionRequirements.map((item) => item.id === req.id ? { ...item, sampleSize: 5 } : item) };
  assert.equal(generateInspectionReport(withPlan, job.projectId, NOW, entries(withPlan, job.projectId, { "Outer width": { observed: "120.01", sampleSize: 2 }, Bore: { observed: "40.01" } })), withPlan);
});

test("demo: a review is resolved by an owner or admin with a reason, not by the inspector, and the original result stays", () => {
  const job = finishedJob();
  let { state } = job;
  state = generateInspectionReport(state, job.projectId, NOW, entries(state, job.projectId, { "Outer width": { observed: "120.01" }, Bore: { observed: "40.02" } }));
  const report = state.inspectionReports[0];
  const bore = projectRecords(state, job.projectId).inspectionRequirements.find((req) => req.name === "Bore")!;
  const asBen = setCurrentUser(state, job.ben);
  assert.equal(resolveInspection(asBen, report.id, bore.id, "pass", "Gauge says fine", NOW), asBen, "member refused");
  assert.equal(resolveInspection(state, report.id, bore.id, "pass", "I measured it myself", NOW), state, "the inspector may not resolve their own review");
  state = setCurrentUser(state, job.omar);
  assert.equal(resolveInspection(state, report.id, bore.id, "pass", " ", NOW), state, "reason required");
  state = resolveInspection(state, report.id, bore.id, "pass", "H8 plug gauge go/no-go checked, within fit", NOW);
  const result = state.inspectionReports[0].results.find((item) => item.requirementId === bore.id)!;
  assert.equal(result.outcome, "needs_review", "original outcome kept");
  assert.equal(result.resolution?.decision, "pass");
  assert.match(result.resolution?.by ?? "", /Omar/);
  assert.equal(state.inspectionReports[0].passed, true);
  assert.notEqual(dispatchProject(state, job.projectId, NOW), state, "ships once resolved");
});
