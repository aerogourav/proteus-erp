import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDocumentToProject, advanceProcurement, approveDocument, cancelInvoice, completionBlocker, createInitialState, createProductionOrder, createProjectFromDraft,
  deleteProject, deleteProjectBlocker, dispatchProject, generateInspectionReport, generateInvoice, linkMaterialLot, newDraft, overrideRelease, projectRecords,
  readiness, releaseBlockers, setProductionStatus, toleranceCheck, updateProductionOrder, jobCost,
  type ErpState, type ProjectDraft,
} from "../src/lib/erp/model.ts";
import { endBlocker, endOperation, kpiSummary, orderOperations, recordRemainingOperations, saveEmployee, setCurrentUser, startBlocker, startOperation } from "../src/lib/erp/shopfloor.ts";
import { billOrderMismatch, saveBill, saveQuotation } from "../src/lib/erp/finance.ts";
import { createSupplierOrder } from "../src/lib/erp/purchasing.ts";

const NOW = "2026-10-29T10:00:00.000Z";
const later = (minutes: number) => new Date(Date.parse(NOW) + minutes * 60000).toISOString();

/** One order of 10 brackets, drawing in review, 5 kg steel not ordered; an admin (Lena) and an operator (Ben). */
function setup(quantity = 10) {
  let state: ErpState = createInitialState();
  state = saveEmployee(state, null, { code: "E-1", name: "Lena Admin", role: "Production manager", access: "admin", department: "Production", email: "", hourlyRate: 40, monthlySalary: 0, pay: "hourly", active: true }, NOW);
  state = saveEmployee(state, null, { code: "E-2", name: "Ben Op", role: "Machinist", access: "member", department: "Production", email: "", hourlyRate: 30, monthlySalary: 0, pay: "hourly", active: true }, NOW);
  const [lena, ben] = state.employees;
  state = setCurrentUser(state, lena.id);
  const draft: ProjectDraft = {
    ...newDraft(state, "2026-10-29"), projectName: "Bracket run", projectCode: "BOH-PRJ-2026-090", poNumber: "PO-R-1", customerName: "Rules GmbH",
    lines: [{ key: "a", partNumber: "BR-1", description: "Bracket", quantity: String(quantity), unit: "pcs", unitPrice: "20", revision: "A" }],
    documents: [{ key: "d", name: "Bracket drawing", type: "Drawing", number: "DRW-BR-1", revision: "A", partKey: "a", status: "In review", source: "metadata" }],
    inspections: [{ key: "i", name: "Outer width", spec: "120.00 ± 0.05", unit: "mm", acceptance: "", partKey: "a" }],
    materials: [{ key: "m", material: "Steel bar", quantity: "5", unit: "kg", supplier: "Metals Co", status: "Not ordered", lineKey: "a" }],
  };
  const created = createProjectFromDraft(state, draft, NOW);
  state = created.state;
  const line = projectRecords(state, created.projectId).lineItems[0];
  state = createProductionOrder(state, line.id, NOW);
  const order = projectRecords(state, created.projectId).productionOrders[0];
  return { state, projectId: created.projectId, orderId: order.id, lena: lena.id, ben: ben.id };
}

/** Approve the drawing (as admin) and receive the material, so the job may start. */
function release(input: ReturnType<typeof setup>) {
  let { state } = input;
  const records = projectRecords(state, input.projectId);
  for (const doc of records.documents) state = approveDocument(state, doc.id, NOW);
  for (const proc of records.procurement) { state = advanceProcurement(state, proc.id, NOW); state = advanceProcurement(state, proc.id, NOW); }
  return { ...input, state };
}

function book(state: ErpState, orderId: string, employeeId: string, good: number, scrap: number, at: number, seq?: number) {
  state = startOperation(state, orderId, employeeId, later(at), seq);
  const active = state.activeOps.find((item) => item.orderId === orderId && item.employeeId === employeeId);
  assert.ok(active, "operation started");
  return endOperation(state, active.id, { qtyGood: good, qtyScrap: scrap, notes: "" }, later(at + 30));
}

function finishAll(input: ReturnType<typeof setup>) {
  let { state } = input;
  for (const [index] of orderOperations(state, state.productionOrders.find((item) => item.id === input.orderId)!).entries()) state = book(state, input.orderId, input.ben, 10, 0, index * 60);
  return state;
}

const inspect = (state: ErpState, projectId: string, observed: string, result: "pass" | "fail", at = NOW) => {
  const req = projectRecords(state, projectId).inspectionRequirements[0];
  return generateInspectionReport(state, projectId, at, { [req.id]: { observed, result, sampleSize: 5, gaugeId: "MIC-07" } });
};

/* ---------- P1 release gate ---------- */

test("P1: a job cannot start on an unapproved drawing", () => {
  const job = setup();
  let { state } = job;
  // material received, drawing still in review
  for (const proc of projectRecords(state, job.projectId).procurement) { state = advanceProcurement(state, proc.id, NOW); state = advanceProcurement(state, proc.id, NOW); }
  assert.match(releaseBlockers(state, job.orderId).join(" "), /not approved/);
  assert.match(startBlocker(state, job.orderId, job.ben) ?? "", /not approved/);
  assert.equal(startOperation(state, job.orderId, job.ben, NOW), state, "start refused");
  assert.equal(setProductionStatus(state, job.orderId, "Running", NOW), state, "status cannot be forced to Running");
});

test("P1: a job cannot start with material short", () => {
  const job = setup();
  let { state } = job;
  for (const doc of projectRecords(state, job.projectId).documents) state = approveDocument(state, doc.id, NOW);
  assert.match(releaseBlockers(state, job.orderId).join(" "), /Steel bar/);
  assert.equal(startOperation(state, job.orderId, job.ben, NOW), state);
  const ready = release(job);
  assert.deepEqual(releaseBlockers(ready.state, job.orderId), []);
  assert.notEqual(startOperation(ready.state, job.orderId, job.ben, NOW), ready.state, "starts once released");
});

test("P1: a drawing revised mid-job stops further operations", () => {
  let { state, ...job } = release(setup());
  state = book(state, job.orderId, job.ben, 10, 0, 0);
  state = addDocumentToProject(state, job.projectId, { name: "Bracket drawing", type: "Drawing", number: "DRW-BR-1", revision: "B", partId: projectRecords(state, job.projectId).parts[0].id, status: "In review" }, later(40));
  assert.match(releaseBlockers(state, job.orderId).join(" "), /revision B/);
  assert.match(startBlocker(state, job.orderId, job.ben) ?? "", /revision B/);
});

test("P1: only an owner or admin can override the gate, with a reason, and it is logged", () => {
  const job = setup();
  let state = setCurrentUser(job.state, job.ben);
  assert.equal(overrideRelease(state, job.orderId, "Customer approved by phone", NOW), state, "member cannot override");
  state = setCurrentUser(state, job.lena);
  assert.equal(overrideRelease(state, job.orderId, "  ", NOW), state, "reason required");
  state = overrideRelease(state, job.orderId, "Customer approved rev A by phone, PO note 14", NOW);
  const order = state.productionOrders.find((item) => item.id === job.orderId)!;
  assert.equal(order.releaseOverride?.by, "Lena Admin (E-1)");
  assert.match(state.activity[0].text, /override/i);
  assert.equal(startBlocker(state, job.orderId, job.ben), null, "override lets the job start");
});

test("P1: a member cannot approve a drawing", () => {
  const job = setup();
  const state = setCurrentUser(job.state, job.ben);
  const doc = projectRecords(state, job.projectId).documents[0];
  assert.equal(approveDocument(state, doc.id, NOW), state);
  const approved = approveDocument(setCurrentUser(state, job.lena), doc.id, NOW);
  assert.equal(approved.documents.find((item) => item.id === doc.id)?.approvedBy, "Lena Admin (E-1)");
});

/* ---------- P2 completion ---------- */

test("P2: Completed is refused while an operation is open or unlogged", () => {
  let { state, ...job } = release(setup());
  assert.match(completionBlocker(state, job.orderId) ?? "", /not booked/);
  assert.equal(setProductionStatus(state, job.orderId, "Completed", NOW), state);
  assert.equal(updateProductionOrder(state, job.orderId, { quantity: 10, startDate: "", notes: "", status: "Completed" }, NOW).productionOrders.find((item) => item.id === job.orderId)?.status, "Planned");
  state = startOperation(state, job.orderId, job.ben, NOW);
  assert.match(completionBlocker(state, job.orderId) ?? "", /running|not booked/);
  assert.equal(setProductionStatus(state, job.orderId, "Completed", NOW), state, "Completed with an open operation is refused");
  assert.equal(setProductionStatus(state, job.orderId, "Done-ish", NOW), state, "no free-text statuses");
});

test("P2: the job completes only when every routing operation is booked", () => {
  const job = release(setup());
  const state = finishAll(job);
  const order = state.productionOrders.find((item) => item.id === job.orderId)!;
  assert.equal(order.status, "Completed");
  assert.equal(completionBlocker(state, job.orderId), null);
});

/* ---------- P3 quantities ---------- */

test("P3: 999 good on an order of 10 is rejected", () => {
  let { state, ...job } = release(setup());
  state = startOperation(state, job.orderId, job.ben, NOW);
  const active = state.activeOps[0];
  assert.match(endBlocker(state, active.id, { qtyGood: 999, qtyScrap: 0, notes: "" }) ?? "", /10/);
  assert.equal(endOperation(state, active.id, { qtyGood: 999, qtyScrap: 0, notes: "" }, later(10)), state);
  assert.match(endBlocker(state, active.id, { qtyGood: 9, qtyScrap: 2, notes: "" }) ?? "", /10/, "good + scrap counts");
});

test("P3: Op 10 with 4 good, then Op 20 reporting 10 is rejected", () => {
  let { state, ...job } = release(setup());
  state = book(state, job.orderId, job.ben, 4, 6, 0);
  state = startOperation(state, job.orderId, job.ben, later(60));
  const active = state.activeOps[0];
  assert.equal(active.seq, 20);
  assert.match(endBlocker(state, active.id, { qtyGood: 10, qtyScrap: 0, notes: "" }) ?? "", /4/);
  assert.equal(endBlocker(state, active.id, { qtyGood: 4, qtyScrap: 0, notes: "" }), null);
});

test("P3: dispatch cannot exceed good parts produced", () => {
  let { state, ...job } = release(setup());
  for (const [index] of orderOperations(state, state.productionOrders[0]).entries()) state = book(state, job.orderId, job.ben, index === 0 ? 8 : 8, index === 0 ? 2 : 0, index * 60);
  state = inspect(state, job.projectId, "120.01", "pass");
  assert.match(readiness(state, job.projectId).dispatch.reasons.map((reason) => reason.text).join(" "), /8 of 10/);
  assert.equal(dispatchProject(state, job.projectId, NOW), state);
});

/* ---------- P4 delete and invoices ---------- */

function invoiced() {
  let { state, ...job } = release(setup());
  state = finishAll({ state, ...job });
  state = inspect(state, job.projectId, "120.01", "pass");
  state = dispatchProject(state, job.projectId, NOW);
  state = generateInvoice(state, job.projectId, "2027-01-05T09:00:00.000Z");
  return { state, ...job };
}

test("P4: deleting an invoiced or dispatched project is blocked with a reason", () => {
  const { state, projectId } = invoiced();
  assert.match(deleteProjectBlocker(state, projectId) ?? "", /invoice/i);
  assert.equal(deleteProject(state, projectId, NOW), state);
});

test("P4: issued invoices are cancelled with a credit note, never deleted or reused", () => {
  const { state, projectId } = invoiced();
  const invoice = projectRecords(state, projectId).invoices[0];
  assert.equal(cancelInvoice(state, invoice.id, "", NOW), state, "reason required");
  const cancelled = cancelInvoice(state, invoice.id, "Wrong unit price", NOW);
  assert.equal(cancelled.invoices.length, state.invoices.length, "invoice kept");
  assert.ok(cancelled.invoices.find((item) => item.id === invoice.id)?.cancelledAt);
  const note = cancelled.creditNotes[0];
  assert.equal(note.invoiceId, invoice.id);
  assert.equal(note.total, -invoice.total);
  assert.match(note.number, /^CN-2026-/);
});

/* ---------- P5 numbering ---------- */

test("P5: an invoice dated 2027-01-05 is numbered in 2027", () => {
  const { state, projectId } = invoiced();
  const invoice = projectRecords(state, projectId).invoices[0];
  assert.match(invoice.number, /^INV-2027-/);
  assert.equal(invoice.issuedAt, "2027-01-05");
  const order = projectRecords(state, projectId).productionOrders[0];
  assert.match(order.number, /^MO-2026-/);
  const early = createProductionOrder(state, projectRecords(state, projectId).lineItems[0].id, "2028-02-01T08:00:00.000Z");
  assert.equal(early, state, "one production order per line still");
});

/* ---------- P6 inspection ---------- */

test("P6: 999 mm against 120.00 ± 0.05 mm fails, and a result must be explicit", () => {
  assert.equal(toleranceCheck("120.00 ± 0.05", "999"), "out");
  assert.equal(toleranceCheck("120.00 ± 0.05", "120.03"), "in");
  assert.equal(toleranceCheck("≤ 0.05", "0.07"), "out");
  assert.equal(toleranceCheck("8–12", "10"), "in");
  assert.equal(toleranceCheck("Ø40.00 H8", "40.01"), "unknown");
  let { state, ...job } = release(setup());
  state = finishAll({ state, ...job });
  const req = projectRecords(state, job.projectId).inspectionRequirements[0];
  assert.equal(generateInspectionReport(state, job.projectId, NOW), state, "no default pass");
  assert.equal(generateInspectionReport(state, job.projectId, NOW, { [req.id]: { observed: "120.01", result: "", sampleSize: 5, gaugeId: "" } }), state, "explicit result required");
  const failed = inspect(state, job.projectId, "999", "pass");
  const report = failed.inspectionReports[0];
  assert.equal(report.passed, false, "out of tolerance cannot pass");
  assert.equal(report.results[0].sampleSize, 5);
  assert.equal(report.results[0].gaugeId, "MIC-07");
  assert.equal(dispatchProject(failed, job.projectId, NOW), failed, "failed inspection blocks dispatch");
});

/* ---------- P7 partial bookings, shifts, parallel operators ---------- */

test("P7: partial bookings across shifts and parallel operators on one operation", () => {
  let { state, ...job } = release(setup());
  state = book(state, job.orderId, job.ben, 6, 0, 0);
  let ops = orderOperations(state, state.productionOrders[0]);
  assert.equal(ops[0].status, "partial", "op 10 still has 4 to do");
  assert.equal(ops[0].remaining, 4);
  // Op 20 can already work on the 6 good parts (split work)
  state = startOperation(state, job.orderId, job.ben, later(60), 20);
  state = startOperation(state, job.orderId, job.lena, later(61), 10);
  assert.equal(state.activeOps.length, 2, "two operators in parallel");
  const ben = state.activeOps.find((item) => item.employeeId === job.ben)!;
  assert.match(endBlocker(state, ben.id, { qtyGood: 7, qtyScrap: 0, notes: "" }) ?? "", /6/);
  state = endOperation(state, ben.id, { qtyGood: 6, qtyScrap: 0, notes: "" }, later(90));
  const lena = state.activeOps.find((item) => item.employeeId === job.lena)!;
  state = endOperation(state, lena.id, { qtyGood: 4, qtyScrap: 0, notes: "next shift" }, later(120));
  ops = orderOperations(state, state.productionOrders[0]);
  assert.equal(ops[0].status, "done");
  assert.equal(ops[1].remaining, 4);
});

/* ---------- P8 traceability ---------- */

test("P8: heat number and certificate are linked to the job", () => {
  const job = setup();
  assert.equal(linkMaterialLot(job.state, job.orderId, { material: "Steel bar", heat: " ", certificate: "CERT-1" }, NOW), job.state, "heat or batch required");
  const state = linkMaterialLot(job.state, job.orderId, { material: "Steel bar", heat: "H24117", certificate: "CERT-H24117" }, NOW);
  assert.deepEqual(state.productionOrders.find((item) => item.id === job.orderId)?.materialLots, [{ material: "Steel bar", heat: "H24117", certificate: "CERT-H24117", linkedAt: NOW }]);
});

/* ---------- P9 frozen costs ---------- */

test("P9: job costs are frozen when the job closes", () => {
  const job = release(setup());
  let state = finishAll(job);
  const frozen = jobCost(state, job.orderId);
  assert.ok(frozen.frozen && frozen.labour > 0);
  state = saveEmployee(state, job.ben, { ...state.employees.find((item) => item.id === job.ben)!, hourlyRate: 300 }, NOW);
  assert.equal(jobCost(state, job.orderId).labour, frozen.labour, "wage change does not rewrite a closed job");
});

/* ---------- P15 supplier bill vs order ---------- */

test("P15: a supplier bill that differs from the order on price or quantity is flagged", () => {
  let state = createInitialState();
  const created = createSupplierOrder(state, { supplier: "Metals Co", email: "", currency: "EUR", expectedAt: "2026-11-05", notes: "", lines: [{ material: "Steel bar", quantity: 5, unit: "kg", unitPrice: 4, requirementIds: [] }] }, NOW);
  state = created.state;
  state = saveBill(state, null, { number: "MC-1", supplier: "Metals Co", category: "Raw material", date: "2026-11-01", dueDate: "2026-12-01", currency: "EUR", net: 26, taxRate: 19, description: "Steel bar 6 kg", supplierOrderId: created.id, quantity: 6 }, NOW);
  const warnings = billOrderMismatch(state, state.bills[0]);
  assert.match(warnings.join(" "), /26/);
  assert.match(warnings.join(" "), /6/);
  state = saveBill(state, null, { number: "MC-2", supplier: "Metals Co", category: "Raw material", date: "2026-11-01", dueDate: "2026-12-01", currency: "EUR", net: 20, taxRate: 19, description: "", supplierOrderId: created.id, quantity: 5 }, NOW);
  assert.deepEqual(billOrderMismatch(state, state.bills.find((bill) => bill.number === "MC-2")!), []);
});

/* ---------- P16 ---------- */

test("P16: the shop-floor figure is called performance × quality, not OEE", () => {
  const job = release(setup());
  const kpi = kpiSummary(finishAll(job), {}, "2026-10-29");
  assert.ok("performanceQuality" in kpi && !("oee" in kpi));
});

/* ---------- The full cheat attempt ---------- */

test("cheat attempt: force complete, fail a measurement, dispatch, invoice, delete — every step that should fail fails", () => {
  let { state, ...job } = release(setup());
  state = startOperation(state, job.orderId, job.ben, NOW);
  // 1. force an unfinished job complete
  assert.equal(setProductionStatus(state, job.orderId, "Completed", NOW), state);
  assert.equal(recordRemainingOperations(setCurrentUser(state, job.ben), job.orderId, NOW).productionOrders[0].status === "Completed", false, "cannot skip a running operation");
  state = endOperation(state, state.activeOps[0].id, { qtyGood: 10, qtyScrap: 0, notes: "" }, later(30));
  for (let i = 1; i < 4; i += 1) state = book(state, job.orderId, job.ben, 10, 0, 60 * i);
  assert.equal(state.productionOrders[0].status, "Completed");
  // 2. record a failing measurement and claim it passed
  state = inspect(state, job.projectId, "999", "pass");
  assert.equal(state.inspectionReports[0].passed, false);
  // 3. dispatch
  const afterDispatch = dispatchProject(state, job.projectId, NOW);
  assert.equal(afterDispatch, state, "dispatch refused after a failed inspection");
  // 4. invoice
  assert.equal(generateInvoice(state, job.projectId, NOW), state, "invoice refused without dispatch");
  // 5. delete the project: allowed only because nothing was dispatched or invoiced; with them it is refused
  const legit = dispatchProject(inspect(state, job.projectId, "120.02", "pass", later(500)), job.projectId, later(501));
  const billed = generateInvoice(legit, job.projectId, later(502));
  assert.equal(deleteProject(billed, job.projectId, later(503)), billed);
});

test("P5: production, purchasing, quotation and supplier order numbers follow the document year", () => {
  let state: ErpState = createInitialState();
  const draft: ProjectDraft = {
    ...newDraft(state, "2027-02-01"), projectName: "Next year", poNumber: "PO-Y-1", customerName: "Year GmbH",
    lines: [{ key: "a", partNumber: "YR-1", description: "Part", quantity: "5", unit: "pcs", unitPrice: "10", revision: "A" }],
    documents: [], inspections: [],
    materials: [{ key: "m", material: "Bar", quantity: "1", unit: "kg", supplier: "", status: "Not ordered", lineKey: "a" }],
  };
  assert.match(draft.projectCode, /^BOH-PRJ-2027-/);
  const created = createProjectFromDraft(state, draft, "2027-02-01T08:00:00.000Z");
  state = createProductionOrder(created.state, projectRecords(created.state, created.projectId).lineItems[0].id, "2027-02-02T08:00:00.000Z");
  assert.match(projectRecords(state, created.projectId).procurement[0].number, /^PUR-2027-/);
  assert.match(projectRecords(state, created.projectId).productionOrders[0].number, /^MO-2027-/);
  const quote = saveQuotation(state, null, { customerName: "Year GmbH", contact: "", date: "2027-03-01", validUntil: "2027-03-31", currency: "EUR", lines: [{ partNumber: "YR-1", description: "Part", quantity: 5, unit: "pcs", unitPrice: 10, revision: "A" }], notes: "", leadTimeWeeks: 2 }, "2027-03-01T08:00:00.000Z");
  assert.match(quote.state.quotations[0].number, /^QT-2027-/);
  const order = createSupplierOrder(state, { supplier: "Bar Co", email: "", currency: "EUR", expectedAt: "2027-03-10", notes: "", lines: [{ material: "Bar", quantity: 1, unit: "kg", unitPrice: 5, requirementIds: [] }] }, "2027-03-01T08:00:00.000Z");
  assert.match(order.state.supplierOrders[0].number, /^SPO-2027-/);
});
