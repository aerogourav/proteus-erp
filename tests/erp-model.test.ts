import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState, newDraft, validateStep, firstInvalidStep, createProjectFromDraft, draftFlow, readiness, projectStage, isActiveOrder,
  loadSample, resolve, approveDocument, advanceProcurement, createProductionOrder, advanceProduction, generateInspectionReport, dispatchProject,
  generateInvoice, addDrawingForLine, setLineItemQuantity, setLineItemPrice, reuseCatalog, setProductionStatus, isProductionComplete, updateCustomer, updatePurchaseOrder, updateDocument, updateMaterial, updateProductionOrder, updateInspectionRequirement, removeInspectionRequirement, saveRawMaterial, saveSupplier, rawMaterialRows, rawMaterialStats, supplierRows, supplierStats, financeSummary, markInvoicePaid, addCustomField, setCustomValues, addDocType, removeDocType, docTypes, updateTab, moveTab, updateWidget, moveWidget, updateUi, upsertSupplier, addDocumentToProject, addInspectionRequirement, addMaterialRequirement, suggestProjectCode, parseStoredState, projectRecords, parseAmount, recentActivity, log, SAMPLE_PROJECT_CODE, DEFAULT_WIDGETS, type ErpState, type ProjectDraft,
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
  assert.equal(ready.engineering.state, "incomplete", "drawing exists, approval can come later");
  assert.equal(ready.materials.state, "incomplete");
  assert.equal(ready.dispatch.state, "blocked");
  assert.equal(projectStage(state, projectId), "Engineering");
  const line = state.lineItems[0];
  assert.match(ready.production.reasons[0].text, /drawing not approved yet/, "approval is a warning, not a block");
  assert.equal(ready.production.reasons[0].action?.kind, "create-production-order");

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

test("guided demo: one project moves from order to invoice step by step", () => {
  let state = createInitialState();
  assert.deepEqual(state.guide, { step: 0, projectId: null, v: 2 });
  const draft = { ...validDraft(state), documents: [], inspections: [], materials: [] };
  const created = createProjectFromDraft(state, draft, NOW);
  state = created.state;
  const id = created.projectId;
  const line = projectRecords(state, id).lineItems[0];
  state = addDocumentToProject(state, id, { name: "Bracket drawing", type: "Drawing", number: "DRW-TB-1", revision: "A", partId: line.partId, status: "In review" }, NOW);
  const drawing = projectRecords(state, id).documents[0];
  assert.equal(drawing.status, "In review");
  state = approveDocument(state, drawing.id, NOW);
  state = addInspectionRequirement(state, id, { partId: line.partId, name: "Length", spec: "100 ± 0.1", unit: "mm", acceptance: "Within requirement" }, NOW);
  state = addMaterialRequirement(state, id, { lineItemId: line.id, material: "Steel bar", quantity: 5, unit: "kg", supplier: "" }, NOW);
  const purchase = projectRecords(state, id).procurement[0];
  state = advanceProcurement(advanceProcurement(state, purchase.id, NOW), purchase.id, NOW);
  assert.equal(projectRecords(state, id).procurement[0].status, "Received");
  state = createProductionOrder(state, line.id, NOW);
  const order = projectRecords(state, id).productionOrders[0];
  assert.equal(dispatchProject(state, id, NOW), state, "cannot dispatch before production and inspection");
  state = advanceProduction(advanceProduction(state, order.id, NOW), order.id, NOW);
  state = generateInspectionReport(state, id, NOW);
  state = dispatchProject(state, id, NOW);
  state = generateInvoice(state, id, NOW);
  const records = projectRecords(state, id);
  assert.equal(records.dispatches.length, 1);
  assert.equal(records.invoices.length, 1);
  assert.equal(records.invoices[0].subtotal, 125);
});

test("multi-part order: production details, inspection results, editable quantity and reuse catalog", () => {
  let state = createInitialState();
  const draft: ProjectDraft = {
    ...newDraft(state, "2026-10-26"),
    projectName: "Two Part Run", projectCode: "BOH-PRJ-2026-060", poNumber: "PO-MP-1", customerName: "Multi GmbH",
    lines: [
      { key: "a", partNumber: "MP-1", description: "Bracket", quantity: "10", unit: "pcs", unitPrice: "5", revision: "A" },
      { key: "b", partNumber: "MP-2", description: "Shaft", quantity: "4", unit: "pcs", unitPrice: "20", revision: "B" },
    ],
    documents: [
      { key: "da", name: "Bracket drawing", type: "Drawing", number: "DRW-MP-1", revision: "A", partKey: "a", status: "In review", source: "upload", file: { name: "mp1.pdf", size: 1200, type: "application/pdf", data: "data:application/pdf;base64,AA==" } },
      { key: "db", name: "Shaft drawing", type: "Drawing", number: "DRW-MP-2", revision: "B", partKey: "b", status: "In review", source: "metadata" },
    ],
    inspections: [
      { key: "i1", name: "Length", spec: "100 ± 0.1", unit: "mm", acceptance: "", partKey: "a" },
      { key: "i2", name: "Hole", spec: "Ø8 H7", unit: "", acceptance: "", partKey: "a" },
      { key: "i3", name: "Diameter", spec: "20 h6", unit: "mm", acceptance: "", partKey: "b" },
    ],
    materials: [
      { key: "ma", material: "Steel plate", quantity: "3", unit: "kg", supplier: "Northline", status: "Not ordered", lineKey: "a" },
      { key: "mb", material: "Steel bar", quantity: "2", unit: "kg", supplier: "", status: "Not ordered", lineKey: "b" },
    ],
  };
  const created = createProjectFromDraft(state, draft, NOW);
  state = created.state;
  const id = created.projectId;
  const records = projectRecords(state, id);
  assert.equal(records.lineItems.length, 2);
  assert.equal(records.purchaseOrders[0].value, 130);
  assert.equal(records.documents.find((doc) => doc.number === "DRW-MP-1")?.file?.name, "mp1.pdf", "uploaded file is kept on the document");

  // Quantity and price can change later; the order value follows.
  state = setLineItemQuantity(state, records.lineItems[0].id, 12, NOW);
  state = setLineItemPrice(state, records.lineItems[1].id, 25, NOW);
  assert.equal(projectRecords(state, id).purchaseOrders[0].value, 160);

  // Production orders without approvals, with details.
  for (const line of projectRecords(state, id).lineItems) state = createProductionOrder(state, line.id, NOW, { quantity: line.quantity + 1, startDate: "2026-11-02", notes: "Cell 2" });
  const orders = projectRecords(state, id).productionOrders;
  assert.equal(orders.length, 2);
  assert.equal(orders[0].quantity, 13);
  assert.equal(orders[0].notes, "Cell 2");
  assert.equal(createProductionOrder(state, projectRecords(state, id).lineItems[0].id, NOW), state, "one order per part");
  for (const order of orders) state = advanceProduction(advanceProduction(state, order.id, NOW), order.id, NOW);

  // A failed result blocks dispatch until inspected again.
  const reqs = projectRecords(state, id).inspectionRequirements;
  state = generateInspectionReport(state, id, NOW, { [reqs[0].id]: { observed: "100.3", pass: false } });
  assert.equal(projectRecords(state, id).inspectionReports[0].passed, false);
  assert.equal(dispatchProject(state, id, NOW), state);
  state = generateInspectionReport(state, id, NOW, { [reqs[0].id]: { observed: "100.02", pass: true } });
  assert.equal(projectRecords(state, id).inspectionReports[0].results[0].observed, "100.02 mm");
  state = generateInvoice(dispatchProject(state, id, NOW), id, NOW);
  assert.equal(projectRecords(state, id).invoices[0].subtotal, 160);
  assert.equal(setLineItemQuantity(state, projectRecords(state, id).lineItems[0].id, 20, NOW), state, "quantity locked after dispatch");

  // Everything used before is offered for reuse.
  const catalog = reuseCatalog(state, null);
  assert.deepEqual(catalog.parts.map((part) => part.number).sort(), ["MP-1", "MP-2"]);
  assert.ok(catalog.drawings.some((doc) => doc.number === "DRW-MP-1" && doc.file === "mp1.pdf"));
  assert.deepEqual(catalog.materials.map((item) => item.material).sort(), ["Steel bar", "Steel plate"]);
  assert.equal(catalog.parameters.length, 3);
  assert.deepEqual(catalog.suppliers, ["Northline"]);
});

test("records can be edited later from their tabs; production status is free-form", () => {
  const base = createInitialState();
  let { state, projectId } = createProjectFromDraft(base, validDraft(base), NOW);
  const r = () => projectRecords(state, projectId);
  state = updateCustomer(state, r().customer!.id, { name: "Renamed Customer AG", contact: "buyer@renamed.example" }, NOW);
  assert.equal(r().customer?.name, "Renamed Customer AG");
  state = updatePurchaseOrder(state, r().purchaseOrders[0].id, { number: "po-t-2", deliveryDate: "2026-12-20" }, NOW);
  assert.equal(r().purchaseOrders[0].number, "PO-T-2");
  assert.equal(updatePurchaseOrder(state, r().purchaseOrders[0].id, { number: "PO-T-2", deliveryDate: "2020-01-01" }, NOW), state, "delivery before PO date refused");

  const doc = r().documents[0];
  state = approveDocument(state, doc.id, NOW);
  state = updateDocument(state, doc.id, { name: doc.name, number: doc.number, revision: doc.revision, file: { name: "new.pdf", size: 10, type: "application/pdf" } }, NOW);
  assert.equal(r().documents[0].file?.name, "new.pdf");
  assert.equal(r().documents[0].status, "In review", "a changed file goes back to review");

  state = updateMaterial(state, r().materialRequirements[0].id, { material: "Aluminium bar", quantity: 7, unit: "kg", supplier: "Metals Co" }, NOW);
  assert.equal(r().materialRequirements[0].material, "Aluminium bar");
  assert.equal(r().procurement[0].supplier, "Metals Co");

  const req = r().inspectionRequirements[0];
  state = updateInspectionRequirement(state, req.id, { name: "Overall length", spec: "100 ± 0.2", unit: "mm" }, NOW);
  assert.equal(r().inspectionRequirements[0].name, "Overall length");

  state = createProductionOrder(state, r().lineItems[0].id, NOW);
  const order = r().productionOrders[0];
  state = setProductionStatus(state, order.id, "Waiting for heat treatment", NOW);
  assert.equal(r().productionOrders[0].status, "Waiting for heat treatment");
  assert.equal(readiness(state, projectId).production.state, "incomplete");
  state = updateProductionOrder(state, order.id, { quantity: 11, startDate: "2026-11-03", notes: "Night shift", status: "Completed" }, NOW);
  assert.ok(isProductionComplete(r().productionOrders[0].status));
  assert.equal(r().productionOrders[0].quantity, 11);
  assert.equal(readiness(state, projectId).production.state, "complete");

  state = removeInspectionRequirement(state, req.id, NOW);
  assert.equal(r().inspectionRequirements.length, 0);
});

test("raw materials, suppliers and finance are connected to the same records", () => {
  const base = createInitialState();
  let { state, projectId } = createProjectFromDraft(base, validDraft(base), NOW);
  // Material named on the project shows up as a raw material before it is saved.
  assert.deepEqual(rawMaterialRows(state).map((item) => item.name), ["Steel bar"]);
  state = upsertSupplier(state, "Northline Metals");
  const supplierId = state.suppliers[0].id;
  state = saveRawMaterial(state, rawMaterialRows(state)[0].id, { name: "Steel bar", unit: "kg", stock: 1, reorderLevel: 4, unitCost: 3, supplierId }, NOW);
  const material = state.rawMaterials[0];
  assert.equal(rawMaterialStats(state, material).lowStock, true);
  assert.equal(rawMaterialStats(state, material).toBuy, 5);

  // A purchase with this supplier: ordering creates spend, receiving adds stock.
  const record = projectRecords(state, projectId).procurement[0];
  state = { ...state, procurement: state.procurement.map((item) => item.id === record.id ? { ...item, supplier: "Northline Metals" } : item) };
  state = advanceProcurement(state, record.id, NOW);
  assert.equal(supplierStats(state, supplierRows(state)[0]).spend, 15);
  state = advanceProcurement(state, record.id, NOW);
  assert.equal(state.rawMaterials[0].stock, 6, "received 5 kg on top of 1 kg");
  assert.equal(rawMaterialStats(state, state.rawMaterials[0]).lowStock, false);

  // Supplier edits rename the purchase records too.
  state = saveSupplier(state, supplierId, { name: "Northline Metals GmbH", contact: "Ana", email: "", leadTimeDays: 7 }, NOW);
  assert.equal(projectRecords(state, projectId).procurement[0].supplier, "Northline Metals GmbH");

  // Finance: order value 125, material cost 5 kg × 3 = 15.
  let summary = financeSummary(state, "2026-10-26");
  assert.equal(summary.projects[0].orderValue, 125);
  assert.equal(summary.projects[0].materialCost, 15);
  assert.equal(summary.projects[0].margin, 110);
  assert.equal(summary.orderBook, 125);

  state = approveDocument(state, projectRecords(state, projectId).documents[0].id, NOW);
  state = createProductionOrder(state, projectRecords(state, projectId).lineItems[0].id, NOW);
  const order = projectRecords(state, projectId).productionOrders[0];
  state = advanceProduction(advanceProduction(state, order.id, NOW), order.id, NOW);
  state = generateInvoice(dispatchProject(generateInspectionReport(state, projectId, NOW), projectId, NOW), projectId, NOW);
  const invoice = projectRecords(state, projectId).invoices[0];
  summary = financeSummary(state, "2027-06-01");
  assert.equal(summary.receivable, invoice.total);
  assert.equal(summary.overdue, invoice.total, "past the due date");
  assert.equal(summary.projects[0].status, "Overdue");
  state = markInvoicePaid(state, invoice.id, true, NOW);
  summary = financeSummary(state, "2027-06-01");
  assert.equal(summary.paid, invoice.total);
  assert.equal(summary.receivable, 0);
});

test("configuration: custom fields, document types, tabs and dashboard", () => {
  let state = createInitialState();
  state = addCustomField(state, { entity: "rawMaterial", label: "Heat number", type: "text", options: [] });
  state = addCustomField(state, { entity: "project", label: "Priority", type: "select", options: ["Low", " High", ""] });
  assert.equal(state.settings.customFields.length, 2);
  assert.deepEqual(state.settings.customFields[1].options, ["Low", "High"]);
  assert.equal(addCustomField(state, { entity: "project", label: "priority", type: "text", options: [] }), state, "no duplicate field names");
  assert.equal(addCustomField(state, { entity: "project", label: "Region", type: "select", options: [] }), state, "dropdown needs options");

  const created = createProjectFromDraft(state, validDraft(state), NOW);
  state = setCustomValues(created.state, "project", created.projectId, { [state.settings.customFields[1].id]: "High", other: " " });
  assert.deepEqual(state.projects[0].custom, { [state.settings.customFields[1].id]: "High" });

  state = addDocType(state, "Heat treatment certificate");
  assert.ok(docTypes(state).includes("Heat treatment certificate"));
  assert.equal(addDocType(state, "drawing"), state, "built-in types are not duplicated");
  state = removeDocType(state, "Heat treatment certificate");
  assert.ok(!docTypes(state).includes("Heat treatment certificate"));

  state = updateTab(state, "crm", { label: "Customers", visible: false });
  assert.equal(state.settings.tabs.find((tab) => tab.key === "crm")?.label, "Customers");
  assert.equal(updateTab(state, "configuration", { visible: false }), state, "configuration cannot be hidden");
  state = moveTab(state, "finance", -1);
  const keys = state.settings.tabs.map((tab) => tab.key);
  assert.ok(keys.indexOf("finance") < keys.indexOf("dispatch"));
  state = updateWidget(moveWidget(state, "activity", -1), "pipeline", false);
  assert.equal(state.settings.widgets.find((widget) => widget.key === "pipeline")?.visible, false);
  state = updateUi(state, { nav: "top", accent: "green" });
  assert.equal(state.settings.ui.nav, "top");

  // Settings survive storage and pick up new defaults.
  const stored = JSON.parse(JSON.stringify(state));
  delete stored.settings.widgets;
  const restored = parseStoredState(JSON.stringify(stored));
  assert.equal(restored.settings.ui.accent, "green");
  assert.equal(restored.settings.widgets.length, DEFAULT_WIDGETS.length);
  assert.equal(restored.settings.customFields.length, 2);
});

test("amounts typed in English or German format", () => {
  assert.equal(parseAmount("12.50"), 12.5);
  assert.equal(parseAmount("12,50"), 12.5);
  assert.equal(parseAmount("1,234.50"), 1234.5);
  assert.equal(parseAmount("1.234,50"), 1234.5);
  assert.equal(parseAmount("1,234"), 1234);
  assert.equal(parseAmount("0.125"), 0.125);
  assert.equal(parseAmount(" "), null);
  assert.ok(Number.isNaN(parseAmount("abc")));
});

test("recent activity is newest first even when events were stored out of order", () => {
  let state = createInitialState();
  state = log(state, "2026-10-20T10:00:00.000Z", "projects", "older", "p1");
  state = log(state, "2026-11-01T10:00:00.000Z", "projects", "newest", "p1");
  state = log(state, "2026-10-25T10:00:00.000Z", "projects", "middle", "p1");
  state = log(state, "2026-10-30T10:00:00.000Z", "projects", "other project", "p2");
  assert.deepEqual(recentActivity(state, "p1").map((event) => event.text), ["newest", "middle", "older"]);
  assert.equal(recentActivity(state, null, 2)[1].text, "other project");
});
