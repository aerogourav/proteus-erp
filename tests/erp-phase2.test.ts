import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDocumentToProject, advanceProcurement, approveDocument, archiveProject, cancelInvoice, changeReleasedMaterial, correctMaterialLot, createInitialState,
  createProductionOrder, createProjectFromDraft, deleteProject, deleteProjectBlocker, dispatchProject, generateInspectionReport, generateInvoice, jobCost,
  linkMaterialLot, markInvoicePaid, newDraft, overrideDispatch, parseStoredState, projectRecords, saveRawMaterial, setDocumentStatus, stateProblems,
  updateMaterial, updateSettings, type ErpState, type ProjectDraft, RULES_VERSION,
} from "../src/lib/erp/model.ts";
import { recordRemainingOperations, saveEmployee, setCurrentUser, startOperation } from "../src/lib/erp/shopfloor.ts";
import { projectCosting } from "../src/lib/erp/finance.ts";

const NOW = "2026-11-04T10:00:00.000Z";

function job() {
  let state: ErpState = createInitialState();
  state = saveEmployee(state, null, { code: "E-1", name: "Lena Admin", role: "Production manager", access: "admin", department: "Production", email: "", hourlyRate: 40, monthlySalary: 0, pay: "hourly", active: true }, NOW);
  state = saveEmployee(state, null, { code: "E-2", name: "Ben Temp", role: "Machine operator (temporary)", access: "member", department: "Production", email: "", hourlyRate: 22, monthlySalary: 0, pay: "hourly", active: true }, NOW);
  const [lena, ben] = state.employees;
  state = setCurrentUser(state, lena.id);
  state = updateSettings(state, { overheadPerHour: 10 });
  const draft: ProjectDraft = {
    ...newDraft(state, "2026-11-04"), projectName: "Flanges", projectCode: "BOH-PRJ-2026-070", poNumber: "PO-F-1", customerName: "Finance GmbH",
    lines: [{ key: "a", partNumber: "FL-1", description: "Flange", quantity: "2", unit: "pcs", unitPrice: "50", revision: "A" }],
    documents: [{ key: "d", name: "Flange drawing", type: "Drawing", number: "DRW-FL-1", revision: "A", partKey: "a", status: "In review", source: "metadata" }],
    inspections: [{ key: "w", name: "Width", spec: "10 ± 0.1", unit: "mm", acceptance: "", partKey: "a" }],
    materials: [{ key: "m", material: "Plate", quantity: "4", unit: "kg", supplier: "Metals", status: "Not ordered", lineKey: "a" }],
  };
  const created = createProjectFromDraft(state, draft, NOW);
  state = created.state;
  state = saveRawMaterial(state, null, { name: "Plate", unit: "kg", stock: 0, reorderLevel: 0, unitCost: 5, supplierId: null }, NOW);
  for (const doc of projectRecords(state, created.projectId).documents) state = approveDocument(state, doc.id, NOW);
  for (const proc of projectRecords(state, created.projectId).procurement) state = advanceProcurement(advanceProcurement(state, proc.id, NOW), proc.id, NOW);
  state = createProductionOrder(state, projectRecords(state, created.projectId).lineItems[0].id, NOW);
  return { state, projectId: created.projectId, lena: lena.id, ben: ben.id, orderId: projectRecords(state, created.projectId).productionOrders[0].id };
}

const inspect = (state: ErpState, projectId: string) => {
  const req = projectRecords(state, projectId).inspectionRequirements[0];
  return generateInspectionReport(state, projectId, NOW, { [req.id]: { observed: "10.02", result: "pass", sampleSize: 1, gaugeId: "" } });
};

function invoiced() {
  const j = job();
  let state = recordRemainingOperations(j.state, j.orderId, NOW);
  state = inspect(state, j.projectId);
  state = dispatchProject(state, j.projectId, NOW);
  state = generateInvoice(state, j.projectId, NOW);
  return { ...j, state };
}

test("N9: a temporary operator cannot cancel an invoice; an owner or admin can", () => {
  const j = invoiced();
  const invoice = projectRecords(j.state, j.projectId).invoices[0];
  const asBen = setCurrentUser(j.state, j.ben);
  assert.equal(cancelInvoice(asBen, invoice.id, "Wrong price", NOW), asBen);
  assert.ok(cancelInvoice(j.state, invoice.id, "Wrong price", NOW).invoices[0].cancelledAt);
});

test("N9: a cancelled invoice cannot be marked paid", () => {
  const j = invoiced();
  const invoice = projectRecords(j.state, j.projectId).invoices[0];
  const cancelled = cancelInvoice(j.state, invoice.id, "Wrong price", NOW);
  assert.equal(markInvoicePaid(cancelled, invoice.id, true, NOW), cancelled);
});

test("N13: a project with booked work cannot be deleted; it can be archived", () => {
  const j = job();
  let state = startOperation(j.state, j.orderId, j.lena, NOW);
  assert.match(deleteProjectBlocker(state, j.projectId) ?? "", /production work|material/i);
  assert.equal(deleteProject(state, j.projectId, NOW), state);
  state = archiveProject(state, j.projectId, "Customer cancelled the order", NOW);
  assert.ok(state.projects.find((item) => item.id === j.projectId)?.archivedAt);
});

test("N13: the demo shortcut marks its bookings as synthetic", () => {
  const j = job();
  const state = recordRemainingOperations(j.state, j.orderId, NOW);
  assert.ok(state.opLogs.length > 0 && state.opLogs.every((entry) => entry.synthetic === true));
});

test("P9/N11: a closed job's costs do not change after price, wage, overhead or exchange-rate edits", () => {
  const j = job();
  let state = recordRemainingOperations(j.state, j.orderId, NOW);
  const frozen = jobCost(state, j.orderId);
  const costing = projectCosting(state, j.projectId);
  assert.ok(frozen.frozen && frozen.material > 0 && frozen.overhead > 0);
  state = saveRawMaterial(state, state.rawMaterials[0].id, { name: "Plate", unit: "kg", stock: state.rawMaterials[0].stock, reorderLevel: 0, unitCost: 500, supplierId: null }, NOW, "price change");
  state = saveEmployee(state, j.lena, { ...state.employees.find((item) => item.id === j.lena)!, hourlyRate: 400 }, NOW);
  state = updateSettings(state, { overheadPerHour: 99, fx: { EUR: 1, USD: 5, GBP: 5 } });
  assert.deepEqual(jobCost(state, j.orderId), frozen);
  const after = projectCosting(state, j.projectId);
  assert.equal(after.material, costing.material);
  assert.equal(after.labour, costing.labour);
});

test("N11: material lots are locked when the job closes; corrections need an owner or admin and keep the old value", () => {
  const j = job();
  let state = linkMaterialLot(j.state, j.orderId, { material: "Plate", heat: "H100", certificate: "C1" }, NOW);
  state = recordRemainingOperations(state, j.orderId, NOW);
  assert.equal(linkMaterialLot(state, j.orderId, { material: "Plate", heat: "H999", certificate: "C1" }, NOW), state, "locked after close");
  const asBen = setCurrentUser(state, j.ben);
  assert.equal(correctMaterialLot(asBen, j.orderId, { material: "Plate", heat: "H101", certificate: "C1" }, "Typo in heat number", NOW), asBen);
  state = correctMaterialLot(state, j.orderId, { material: "Plate", heat: "H101", certificate: "C1" }, "Typo in heat number", NOW);
  assert.equal(state.productionOrders.find((item) => item.id === j.orderId)?.materialLots?.[0].heat, "H101");
  assert.match(state.activity[0].text, /H100.*H101/);
});

test("N10: released material requirements change only by an owner or admin with a reason", () => {
  const j = job();
  let state = startOperation(j.state, j.orderId, j.lena, NOW);
  const req = projectRecords(state, j.projectId).materialRequirements[0];
  const asBen = setCurrentUser(state, j.ben);
  assert.equal(updateMaterial(asBen, req.id, { material: "Plate", quantity: 1, unit: "kg", supplier: "Metals" }, NOW), asBen, "member shrinks material: refused");
  assert.equal(changeReleasedMaterial(asBen, req.id, 1, "less needed", NOW), asBen);
  state = changeReleasedMaterial(state, req.id, 3, "Nesting saved 1 kg, confirmed by planning", NOW);
  assert.equal(state.materialRequirements.find((item) => item.id === req.id)?.quantity, 3);
});

test("N10: a member cannot change stock directly; an owner or admin adjusts with a reason", () => {
  const j = job();
  const raw = j.state.rawMaterials[0];
  const asBen = setCurrentUser(j.state, j.ben);
  assert.equal(saveRawMaterial(asBen, raw.id, { name: "Plate", unit: "kg", stock: 999, reorderLevel: 0, unitCost: 5, supplierId: null }, NOW), asBen, "fake stock refused");
  assert.equal(saveRawMaterial(j.state, raw.id, { name: "Plate", unit: "kg", stock: 999, reorderLevel: 0, unitCost: 5, supplierId: null }, NOW), j.state, "adjustment needs a reason");
  const adjusted = saveRawMaterial(j.state, raw.id, { name: "Plate", unit: "kg", stock: 6, reorderLevel: 0, unitCost: 5, supplierId: null }, NOW, "Stock count found 2 kg more");
  assert.equal(adjusted.rawMaterials[0].stock, 6);
});

test("N12: dispatch is blocked when the drawing went back to review or a newer revision exists, unless released with a reason", () => {
  const j = job();
  let state = recordRemainingOperations(j.state, j.orderId, NOW);
  state = inspect(state, j.projectId);
  const drawing = projectRecords(state, j.projectId).documents[0];
  const reviewed = setDocumentStatus(state, drawing.id, "In review", NOW);
  assert.equal(dispatchProject(reviewed, j.projectId, NOW), reviewed);
  const part = projectRecords(state, j.projectId).parts[0];
  const revised = addDocumentToProject(state, j.projectId, { name: "Flange drawing", type: "Drawing", number: "DRW-FL-1", revision: "B", partId: part.id, status: "In review" }, NOW);
  assert.equal(dispatchProject(revised, j.projectId, NOW), revised);
  const asBen = setCurrentUser(revised, j.ben);
  assert.equal(overrideDispatch(asBen, j.projectId, "Customer accepts rev A parts", NOW), asBen);
  const released = overrideDispatch(revised, j.projectId, "Customer accepts rev A parts in writing (mail 12.11.)", NOW);
  assert.notEqual(dispatchProject(released, j.projectId, NOW), released);
});

test("N13: imported or stored data that breaks the rules is detected; old browser data is migrated or reset", () => {
  const j = invoiced();
  assert.deepEqual(stateProblems(j.state), []);
  const forged = { ...j.state, productionOrders: j.state.productionOrders.map((order) => ({ ...order, status: "Completed" })), opLogs: [] };
  assert.ok(stateProblems(forged).some((problem) => /not booked/i.test(problem)));
  const overBooked = { ...j.state, opLogs: j.state.opLogs.map((entry) => ({ ...entry, qtyGood: 999 })) };
  assert.ok(stateProblems(overBooked).length > 0);
  const old = parseStoredState(JSON.stringify({ ...forged, rulesVersion: undefined }));
  assert.equal(old.rulesVersion, undefined, "parsing keeps what was stored; the store decides to reset");
  assert.equal(createInitialState().rulesVersion, RULES_VERSION);
});
