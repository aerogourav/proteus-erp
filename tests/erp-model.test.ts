import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState, newDraft, validateStep, firstInvalidStep, createProjectFromDraft, draftFlow, readiness, projectStage, isActiveOrder,
  loadSample, resolve, approveDocument, advanceProcurement, createProductionOrder, advanceProduction, generateInspectionReport, dispatchProject,
  generateInvoice, addDrawingForLine, suggestProjectCode, parseStoredState, projectRecords, SAMPLE_PROJECT_CODE, type ErpState, type ProjectDraft,
} from "../src/lib/erp/model.ts";

const NOW = "2026-10-26T10:00:00.000Z";

function validDraft(state: ErpState): ProjectDraft {
  return {
    ...newDraft(state, "2026-10-26"),
    projectName: "Test Bracket Run", projectCode: "BOH-PRJ-2026-050", poNumber: "PO-T-1", customerName: "Test Customer GmbH",
    lines: [{ key: "a", partNumber: "TB-1", description: "Test bracket", quantity: "10", unit: "pcs", unitPrice: "12.50", revision: "A" }],
    documents: [{ key: "d", name: "Bracket drawing", type: "Drawing", number: "DRW-TB-1", revision: "A", partKey: "a", status: "In review", source: "metadata" }],
    inspections: [{ key: "i", name: "Length", spec: "100 ± 0.1", unit: "mm", acceptance: "", partKey: "a" }],
    materials: [{ key: "m", material: "Steel bar", quantity: "5", unit: "kg", supplier: "", status: "Not ordered", lineKey: "a" }],
  };
}

test("required fields are validated per step", () => {
  const state = createInitialState();
  const draft = newDraft(state, "2026-10-26");
  const errors = validateStep(state, draft, 0);
  assert.ok(errors.projectName && errors.customerName && errors.poNumber);
  assert.equal(errors.projectCode, undefined, "suggested project ID is valid");
  assert.ok(validateStep(state, draft, 2).lines, "at least one line item is required");
  assert.equal(firstInvalidStep(state, draft), 0);
});

test("project ID suggestion is unique and duplicates are rejected", () => {
  const { state } = loadSample(createInitialState(), NOW);
  assert.equal(suggestProjectCode(state), "BOH-PRJ-2026-004");
  const draft = { ...validDraft(state), projectCode: SAMPLE_PROJECT_CODE.toLowerCase() };
  assert.match(validateStep(state, draft, 0).projectCode ?? "", /already used/);
  const dupPo = { ...validDraft(state), poNumber: "po-2026-1042" };
  assert.match(validateStep(state, dupPo, 0).poNumber ?? "", /already registered/);
});

test("duplicate part numbers on the same order are rejected, invalid quantities flagged", () => {
  const state = createInitialState();
  const draft = validDraft(state);
  draft.lines.push({ key: "b", partNumber: "tb-1", description: "Copy", quantity: "0", unit: "pcs", unitPrice: "", revision: "A" });
  const errors = validateStep(state, draft, 2);
  assert.ok(errors["lines.b.partNumber"]);
  assert.ok(errors["lines.b.quantity"]);
});

test("live data flow reflects actual draft values and removals", () => {
  const state = createInitialState();
  const draft = validDraft(state);
  let flow = draftFlow(state, draft);
  assert.deepEqual(flow.map((group) => group.module), ["projects", "crm", "sales", "parts", "documents", "quality", "materials", "procurement"]);
  assert.equal(flow.find((group) => group.module === "parts")?.records[0].label, "TB-1 rev A");
  draft.documents = [];
  draft.customerName = "Renamed Ltd";
  flow = draftFlow(state, draft);
  assert.equal(flow.find((group) => group.module === "documents"), undefined);
  assert.equal(flow.find((group) => group.module === "crm")?.records[0].label, "Renamed Ltd");
  assert.equal(state.projects.length, 0, "previewing never creates records");
});

test("creating a project links records and reuses existing customers and parts", () => {
  const sample = loadSample(createInitialState(), NOW).state;
  const draft = { ...validDraft(sample), customerName: "  apex aerospace gmbh ", lines: [{ key: "a", partNumber: "act-204", description: "Housing", quantity: "5", unit: "pcs", unitPrice: "", revision: "B" }] };
  draft.documents = [{ key: "d", name: "Housing drawing", type: "Drawing", number: "DRW-ACT-204", revision: "A", partKey: "a", status: "Approved", source: "metadata" }];
  const { state, projectId } = createProjectFromDraft(sample, draft, NOW);
  assert.equal(state.customers.length, sample.customers.length, "customer not duplicated");
  assert.equal(state.parts.length, sample.parts.length, "part not duplicated");
  assert.equal(state.revisions.length, sample.revisions.length + 1, "new revision B created for ACT-204");
  assert.equal(state.documents.length, sample.documents.length, "existing document linked, not duplicated");
  const records = projectRecords(state, projectId);
  assert.equal(records.lineItems.length, 1);
  assert.equal(records.purchaseOrders[0].customerId, records.customer?.id);
  assert.equal(records.lineItems[0].purchaseOrderId, records.purchaseOrders[0].id);
  assert.equal(state.draft, null);
});

test("readiness rules block and unblock with the underlying records", () => {
  const base = createInitialState();
  let { state, projectId } = createProjectFromDraft(base, validDraft(base), NOW);
  let ready = readiness(state, projectId);
  assert.equal(ready.engineering.state, "blocked");
  assert.equal(ready.materials.state, "incomplete");
  assert.equal(ready.dispatch.state, "blocked");
  assert.equal(projectStage(state, projectId), "Engineering");
  const line = state.lineItems[0];
  assert.equal(createProductionOrder(state, line.id, NOW), state, "production order refused before drawing approval");

  state = approveDocument(state, state.documents[0].id, NOW);
  state = advanceProcurement(state, state.procurement[0].id, NOW);
  assert.equal(readiness(state, projectId).materials.state, "incomplete", "ordered is not received");
  state = advanceProcurement(state, state.procurement[0].id, NOW);
  ready = readiness(state, projectId);
  assert.equal(ready.engineering.state, "complete");
  assert.equal(ready.materials.state, "complete");
  const create = ready.production.reasons[0].action;
  assert.equal(create?.kind, "create-production-order");
  state = resolve(state, projectId, create!, NOW);
  assert.equal(state.productionOrders.length, 1);
  assert.equal(createProductionOrder(state, line.id, NOW), state, "no duplicate production orders");

  assert.equal(generateInspectionReport(state, projectId, NOW), state, "no report before production completes");
  assert.equal(dispatchProject(state, projectId, NOW), state, "no dispatch before production completes");
  state = advanceProduction(state, state.productionOrders[0].id, NOW);
  state = advanceProduction(state, state.productionOrders[0].id, NOW);
  assert.equal(dispatchProject(state, projectId, NOW), state, "no dispatch before inspection report");
  state = generateInspectionReport(state, projectId, NOW);
  assert.equal(readiness(state, projectId).quality.state, "complete");
  assert.equal(generateInvoice(state, projectId, NOW), state, "no invoice before dispatch");
  state = dispatchProject(state, projectId, NOW);
  assert.equal(projectStage(state, projectId), "Dispatched");
  state = generateInvoice(state, projectId, NOW);
  const invoice = state.invoices[0];
  assert.equal(invoice.subtotal, 125);
  assert.equal(invoice.tax, 23.75);
  assert.equal(invoice.total, 148.75);
  assert.equal(projectStage(state, projectId), "Invoiced");
});

test("missing drawing can be added and then approved", () => {
  const base = createInitialState();
  const draft = { ...validDraft(base), documents: [] };
  let { state, projectId } = createProjectFromDraft(base, draft, NOW);
  const reason = readiness(state, projectId).engineering.reasons[0];
  assert.equal(reason.action?.kind, "add-drawing");
  state = addDrawingForLine(state, state.lineItems[0].id, NOW);
  const next = readiness(state, projectId).engineering.reasons[0];
  assert.equal(next.action?.kind, "approve-document");
  state = resolve(state, projectId, next.action!, NOW);
  assert.equal(readiness(state, projectId).engineering.state, "complete");
});

test("sample: one customer, three purchase orders, only one active", () => {
  const { state, projectId } = loadSample(createInitialState(), NOW);
  assert.equal(state.customers.length, 1);
  assert.equal(state.purchaseOrders.length, 3);
  assert.deepEqual(state.purchaseOrders.map((order) => isActiveOrder(state, order)), [true, false, false]);
  assert.equal(projectStage(state, projectId), "In production");
  assert.equal(projectStage(state, state.projects[1].id), "Engineering");
  assert.equal(projectStage(state, state.projects[2].id), "Procurement");
  assert.equal(loadSample(state, NOW).state, state, "loading the sample twice changes nothing");
  assert.equal(readiness(state, projectId).dispatch.state, "blocked");
});

test("stored state survives a round-trip and bad data falls back to empty", () => {
  const { state } = loadSample(createInitialState(), NOW);
  assert.deepEqual(parseStoredState(JSON.stringify(state)), state);
  assert.equal(parseStoredState("{broken").projects.length, 0);
  assert.equal(parseStoredState(JSON.stringify({ version: 1 })).projects.length, 0);
});

test("sample never collides with a visitor project that reused its IDs", () => {
  const base = createInitialState();
  const own = createProjectFromDraft(base, { ...validDraft(base), projectCode: SAMPLE_PROJECT_CODE, poNumber: "PO-2026-1042" }, NOW);
  const { state, projectId } = loadSample(own.state, NOW);
  assert.notEqual(projectId, own.projectId, "the visitor's project is not treated as the sample");
  assert.equal(state.projects.length, 4);
  assert.equal(new Set(state.projects.map((project) => project.code)).size, 4, "project IDs stay unique");
  assert.equal(new Set(state.purchaseOrders.map((order) => order.number)).size, 4, "PO numbers stay unique");
  assert.equal(loadSample(state, NOW).projectId, projectId, "loading again returns the same sample");
});
