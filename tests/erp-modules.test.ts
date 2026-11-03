import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState, createProjectFromDraft, createProductionOrder, deleteProject, dispatchProject, generateInspectionReport, generateInvoice, newDraft,
  parseStoredState, projectRecords, readiness, saveRawMaterial, setDocumentStatus, setProductionStatus, approveDocument,
  type ErpState, type ProjectDraft,
} from "../src/lib/erp/model.ts";
import {
  cancelOperation, currentOperation, endBlocker, endOperation, kpiSummary, logsToCsv, orderOperations, routingError, saveEmployee, saveRouting, setCurrentUser,
  startBlocker, startOperation, LOG_COLUMNS,
} from "../src/lib/erp/shopfloor.ts";
import { cancelSupplierOrder, createSupplierOrder, markSupplierOrderSent, receiveSupplierOrder, reorderSuggestions, supplierOrderEmail } from "../src/lib/erp/purchasing.ts";
import { billError, companyFinance, convertQuote, markBillPaid, projectCosting, runPayroll, saveBill, saveQuotation, toBase } from "../src/lib/erp/finance.ts";
import { addEmails, draftFromEmail, extractEmail, extractLines, parseDate, parseMoney, rawMime } from "../src/lib/erp/mail.ts";
import { addDemoProjects, createDemoState, hasDemoProjects } from "../src/lib/erp/seed.ts";

const NOW = "2026-10-29T10:00:00.000Z";

function project(state: ErpState): { state: ErpState; projectId: string } {
  const draft: ProjectDraft = {
    ...newDraft(state, "2026-10-29"), projectName: "Bracket run", projectCode: "BOH-PRJ-2026-090", poNumber: "PO-SF-1", customerName: "Shop Floor GmbH",
    lines: [{ key: "a", partNumber: "SF-1", description: "Bracket", quantity: "10", unit: "pcs", unitPrice: "20", revision: "A" }],
    documents: [{ key: "d", name: "Bracket drawing", type: "Drawing", number: "DRW-SF-1", revision: "A", partKey: "a", status: "In review", source: "metadata" }],
    inspections: [{ key: "i", name: "Length", spec: "100 ± 0.1", unit: "mm", acceptance: "", partKey: "a" }],
    materials: [{ key: "m", material: "Steel bar", quantity: "5", unit: "kg", supplier: "Metals Co", status: "Not ordered", lineKey: "a" }],
  };
  return createProjectFromDraft(state, draft, NOW);
}

function withPeople(state: ErpState) {
  state = saveEmployee(state, null, { code: "E-1", name: "Ana Op", role: "Machinist", access: "admin", department: "Production", email: "", hourlyRate: 30, monthlySalary: 3000, pay: "salary", active: true }, NOW);
  state = saveEmployee(state, null, { code: "E-2", name: "Ben Op", role: "Machinist", department: "Production", email: "", hourlyRate: 24, monthlySalary: 0, pay: "hourly", active: true }, NOW);
  return state;
}

test("shop floor: operations start and end in sequence and write a complete log", () => {
  let { state, projectId } = project(withPeople(createInitialState()));
  const [ana, ben] = state.employees;
  const part = projectRecords(state, projectId).parts[0];
  assert.ok(routingError([]), "empty routing refused");
  assert.ok(routingError([{ seq: 10, name: "A", workCenter: "", setupMin: 0, runMinPerPc: 1 }, { seq: 10, name: "B", workCenter: "", setupMin: 0, runMinPerPc: 1 }]), "duplicate operation refused");
  state = saveRouting(state, part.id, [
    { seq: 20, name: "Milling", workCenter: "mill-1", setupMin: 30, runMinPerPc: 3 },
    { seq: 10, name: "Sawing", workCenter: "saw-1", setupMin: 10, runMinPerPc: 1 },
  ], NOW);
  state = createProductionOrder(state, projectRecords(state, projectId).lineItems[0].id, NOW);
  const order = projectRecords(state, projectId).productionOrders[0];
  assert.equal(currentOperation(state, order)?.seq, 10, "routing sorted, first operation offered");
  assert.equal(startBlocker(state, order.id, null), "Choose who you are first.");
  assert.match(startBlocker(state, order.id, ana.id) ?? "", /not approved/, "release gate");
  state = setCurrentUser(state, ana.id);
  state = approveDocument(state, projectRecords(state, projectId).documents[0].id, NOW);
  state = saveRawMaterial(state, null, { name: "Steel bar", unit: "kg", stock: 5, reorderLevel: 0, unitCost: 2, supplierId: null }, NOW);

  state = startOperation(state, order.id, ana.id, "2026-10-29T06:00:00.000Z");
  assert.equal(state.productionOrders[0].status, "Running");
  assert.equal(startBlocker(state, order.id, ben.id, 20), "No parts are waiting at Op 20 Milling yet.");
  assert.equal(startBlocker(state, order.id, ben.id), null, "a second operator may join the same operation");
  assert.ok(endBlocker(state, state.activeOps[0].id, { qtyGood: 0, qtyScrap: 0, notes: "" }), "quantities required");
  state = endOperation(state, state.activeOps[0].id, { qtyGood: 10, qtyScrap: 0, notes: "" }, "2026-10-29T06:25:00.000Z");
  assert.equal(state.opLogs[0].minutes, 25);
  assert.equal(state.opLogs[0].plannedMinutes, 20);
  assert.equal(currentOperation(state, state.productionOrders[0])?.seq, 20, "the next operation takes its place");

  state = startOperation(state, order.id, ben.id, "2026-10-29T07:00:00.000Z");
  const cancelled = cancelOperation(state, state.activeOps[0].id, NOW);
  assert.equal(cancelled.activeOps.length, 0);
  state = endOperation(state, state.activeOps[0].id, { qtyGood: 9, qtyScrap: 1, notes: "chatter" }, "2026-10-29T07:50:00.000Z");
  assert.equal(state.productionOrders[0].status, "Completed", "last operation completes the order");
  assert.deepEqual(orderOperations(state, state.productionOrders[0]).map((op) => op.status), ["done", "done"]);
  assert.equal(startBlocker(state, order.id, ana.id), `${order.number} is already completed.`);

  const kpi = kpiSummary(state, {}, "2026-10-29");
  assert.equal(kpi.operations, 2);
  assert.equal(kpi.minutes, 75);
  assert.equal(kpi.scrapRate, 5);
  assert.equal(kpi.labourCost, 32.5, "25 min × 30/h + 50 min × 24/h");
  const csv = logsToCsv(state, state.opLogs).split("\r\n");
  assert.equal(csv.length, 3);
  assert.equal(csv[0].split(",").length, LOG_COLUMNS.length);
  assert.ok(csv[2].includes("E-2") && csv[2].includes("Ben Op") && csv[2].includes("SF-1") && csv[2].includes("Milling") && csv[2].includes(order.number));

  // Short quantity blocks dispatch: 9 good of 10 ordered.
  const req = projectRecords(state, projectId).inspectionRequirements[0];
  state = generateInspectionReport(state, projectId, NOW, { [req.id]: { observed: "100.05", result: "pass", sampleSize: 3, gaugeId: "CAL-2" } });
  assert.ok(readiness(state, projectId).dispatch.reasons.some((reason) => reason.text.startsWith("Short quantity")));
  assert.equal(dispatchProject(state, projectId, NOW), state);
});

test("production cannot start with material short; once stocked, start issues material once", () => {
  let { state, projectId } = project(createInitialState());
  state = approveDocument(state, projectRecords(state, projectId).documents[0].id, NOW);
  state = saveRawMaterial(state, null, { name: "Steel bar", unit: "kg", stock: 3, reorderLevel: 0, unitCost: 2, supplierId: null }, NOW);
  state = createProductionOrder(state, projectRecords(state, projectId).lineItems[0].id, NOW);
  const order = projectRecords(state, projectId).productionOrders[0];
  assert.equal(setProductionStatus(state, order.id, "Running", NOW), state, "3 of 5 kg is not enough");
  state = saveRawMaterial(state, state.rawMaterials[0].id, { name: "Steel bar", unit: "kg", stock: 6, reorderLevel: 0, unitCost: 2, supplierId: null }, NOW);
  state = setProductionStatus(state, order.id, "Running", NOW);
  assert.equal(state.rawMaterials[0].stock, 1);
  state = setProductionStatus(state, order.id, "On hold", NOW);
  state = setProductionStatus(state, order.id, "Running", NOW);
  assert.equal(state.rawMaterials[0].stock, 1, "issued only once");
});

test("activity and approvals record who did it; delete project removes its records", () => {
  let { state, projectId } = project(withPeople(createInitialState()));
  state = setCurrentUser(state, state.employees[0].id);
  const doc = projectRecords(state, projectId).documents[0];
  state = setDocumentStatus(state, doc.id, "Approved", NOW);
  assert.equal(state.documents[0].approvedBy, "Ana Op (E-1)");
  assert.equal(state.activity[0].user, "Ana Op (E-1)");
  state = setDocumentStatus(state, doc.id, "In review", NOW);
  assert.equal(state.documents[0].approvedBy, undefined);
  state = deleteProject(state, projectId, NOW);
  assert.equal(state.projects.length, 0);
  assert.equal(state.lineItems.length + state.documents.length + state.materialRequirements.length + state.procurement.length, 0);
  assert.equal(state.customers.length, 1, "customer stays");
});

test("supplier order: drafted, emailed, received into stock with prices", () => {
  let { state, projectId } = project(createInitialState());
  assert.deepEqual(reorderSuggestions(state).map((item) => [item.material, item.quantity]), [["Steel bar", 5]]);
  const req = projectRecords(state, projectId).materialRequirements[0];
  assert.equal(createSupplierOrder(state, { supplier: "", email: "", currency: "EUR", expectedAt: "2026-11-05", notes: "", lines: [] }, NOW).id, null);
  const created = createSupplierOrder(state, { supplier: "Metals Co", email: "orders@metals.example", currency: "EUR", expectedAt: "2026-11-05", notes: "", lines: [{ material: "Steel bar", quantity: 8, unit: "kg", unitPrice: 2.5, requirementIds: [req.id] }] }, NOW);
  state = created.state;
  const order = state.supplierOrders[0];
  assert.equal(order.number, "SPO-2026-0001");
  assert.equal(state.suppliers[0].email, "orders@metals.example");
  const mail = supplierOrderEmail(state, order);
  assert.ok(mail.subject.includes(order.number) && mail.body.includes("8 kg Steel bar") && mail.body.includes("€2.50"));
  state = markSupplierOrderSent(state, order.id, "m1", NOW);
  assert.equal(projectRecords(state, projectId).procurement[0].status, "Ordered");
  assert.equal(reorderSuggestions(state).length, 0, "ordered demand is not suggested again");
  state = receiveSupplierOrder(state, order.id, NOW);
  assert.equal(projectRecords(state, projectId).procurement[0].status, "Received");
  assert.equal(state.rawMaterials[0].stock, 8, "the delivered quantity goes into stock");
  assert.equal(state.rawMaterials[0].unitCost, 2.5);
  assert.equal(cancelSupplierOrder(state, order.id, NOW), state, "received orders cannot be cancelled");
});

test("finance: quotation to project, bills, payroll, costing and currency conversion", () => {
  let state = withPeople(createInitialState());
  const quote = saveQuotation(state, null, { customerName: "Quote Co", contact: "buyer@quote.example", date: "2026-10-01", validUntil: "2026-10-31", currency: "USD", leadTimeWeeks: 4, notes: "", lines: [{ partNumber: "q-1", description: "Shaft", quantity: 10, unit: "pcs", unitPrice: 50, revision: "a" }] }, NOW);
  state = quote.state;
  assert.equal(state.quotations[0].lines[0].partNumber, "Q-1");
  assert.deepEqual(convertQuote(state, quote.id!, "", NOW), { error: "Enter the customer's PO number." });
  const converted = convertQuote(state, quote.id!, "po-q-1", NOW);
  assert.ok("projectId" in converted);
  state = converted.state;
  assert.equal(state.quotations[0].status, "Accepted");
  assert.equal(state.purchaseOrders[0].number, "PO-Q-1");
  assert.equal(state.purchaseOrders[0].value, 500);
  assert.equal(toBase(state, 100, "USD"), 92);

  const bill = { number: "B-1", supplier: "Metals Co", category: "Raw material" as const, date: "2026-10-02", dueDate: "2026-10-30", currency: "EUR" as const, net: 100, taxRate: 19, description: "" };
  state = saveBill(state, null, bill, NOW);
  assert.equal(state.bills[0].total, 119);
  assert.equal(billError(state, bill), "This supplier invoice is already recorded.");
  state = markBillPaid(state, state.bills[0].id, true, NOW);

  state = runPayroll(state, "2026-10", NOW);
  assert.equal(state.payslips.length, 1, "hourly employee without logged hours gets no slip");
  assert.equal(state.payslips[0].gross, 3000);
  assert.equal(state.payslips[0].net, 3000 - 480 - 600);
  assert.equal(runPayroll(state, "2026-10", NOW), state, "one slip per employee and month");

  const costing = projectCosting(state, converted.projectId);
  assert.equal(costing.orderValue, 460, "USD order value in EUR");
  const company = companyFinance(state, "2026-10-29", "2026-10");
  assert.equal(company.payroll, 3630);
  assert.equal(company.cashOut, 119);
});

test("email extraction: dates, money, order lines and classification", () => {
  assert.equal(parseDate("Required by 27.11.2026"), "2026-11-27");
  assert.equal(parseDate("delivery 15 January 2027"), "2027-01-15");
  assert.equal(parseDate("ETA December 3, 2026"), "2026-12-03");
  assert.equal(parseMoney("1.234,50"), 1234.5);
  assert.equal(parseMoney("1,234.50"), 1234.5);
  assert.deepEqual(extractLines("- 50 pcs ACT-204 rev A Hydraulic housing @ EUR 184.00\nACT-205 | Piston rod | 25 pcs | 96,50").map((line) => [line.partNumber, line.quantity, line.unitPrice, line.revision]), [["ACT-204", 50, 184, "A"], ["ACT-205", 25, 96.5, "A"]]);

  let state = createInitialState();
  const po = extractEmail(state, { from: "buyer@acme.example", fromName: "Acme GmbH", subject: "Purchase order PO-77-12", body: "Please find our order.\n2. 12 pcs AX-100 Axle @ EUR 10.00\nDelivery date: 2026-12-01" });
  assert.equal(po.kind, "customer-po");
  assert.equal(po.poNumber, "PO-77-12");
  assert.equal(po.deliveryDate, "2026-12-01");
  const draft = draftFromEmail(state, { id: "x", folder: "inbox", from: "buyer@acme.example", fromName: "Acme GmbH", to: "", subject: "Purchase order PO-77-12", body: "", date: NOW, read: false, source: "demo" }, po, "2026-10-29");
  assert.equal(draft.lines[0].partNumber, "AX-100");
  assert.equal(draft.customerName, "Acme GmbH");
  const created = createProjectFromDraft(state, draft, NOW);
  assert.equal(projectRecords(created.state, created.projectId).purchaseOrders[0].value, 120, "an email order becomes a valid project");

  state = addEmails(state, [{ id: "a", folder: "inbox", from: "x@y.example", fromName: "X", to: "", subject: "Hi", body: "Hello", date: NOW, read: false, source: "demo", externalId: "g1" }], NOW);
  assert.equal(addEmails(state, [{ id: "b", folder: "inbox", from: "x@y.example", fromName: "X", to: "", subject: "Hi", body: "Hello", date: NOW, read: false, source: "gmail", externalId: "g1" }], NOW), state, "no duplicates by provider id");
  const raw = rawMime({ from: "", to: "a@b.example", subject: "Grüße", body: "Hallo" });
  assert.ok(!/[+/=]/.test(raw), "base64url without padding");
});

test("demo data: two projects in different stages, consistent across modules", () => {
  const state = createDemoState(NOW);
  assert.equal(state.projects.length, 2);
  assert.ok(hasDemoProjects(state));
  assert.equal(addDemoProjects(state, NOW), state, "loading twice does nothing");
  const [flange, actuator] = state.projects;
  assert.equal(projectRecords(state, flange.id).invoices.length, 1);
  assert.equal(projectRecords(state, actuator.id).productionOrders.length, 2);
  assert.equal(state.activeOps.length, 1, "one operation is running on the shop floor");
  assert.ok(state.opLogs.length >= 8);
  assert.ok(state.documents.some((doc) => doc.file?.name.endsWith(".step")));
  assert.ok(state.documents.every((doc) => doc.status === "Approved" && doc.approvedBy));
  assert.equal(state.emails.filter((mail) => mail.folder === "inbox" && !mail.read).length, 5);
  const kinds = state.emails.filter((mail) => mail.folder === "inbox").map((mail) => extractEmail(state, mail).kind).sort();
  assert.deepEqual(kinds, ["customer-po", "payment", "rfq", "supplier-invoice", "supplier-quote"]);
  assert.ok(state.rawMaterials.every((item) => item.stock >= 0));
  // The visitor's data survives a reload.
  const restored = parseStoredState(JSON.stringify(state));
  assert.equal(restored.opLogs.length, state.opLogs.length);
  assert.equal(restored.emails.length, state.emails.length);

  // A visitor who already has data can add the demo projects without collisions.
  const own = project(createInitialState()).state;
  const merged = addDemoProjects(own, NOW);
  assert.equal(merged.projects.length, 3);
  assert.equal(new Set(merged.projects.map((item) => item.code)).size, 3);
  // The flange project can still be completed: it is already invoiced, nothing left to do.
  assert.equal(generateInvoice(state, flange.id, NOW), state);
  assert.equal(dispatchProject(state, flange.id, NOW), state);
});
