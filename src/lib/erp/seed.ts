/**
 * The two demo projects every new visitor starts with, plus the people, suppliers, emails, quotations,
 * bills and shop-floor history around them. All fictional. Built with the same functions the screens use,
 * so every number is consistent.
 */
import {
  addDays, approveDocument, createInitialState, linkMaterialLot, createProductionOrder, createProjectFromDraft, dispatchProject, generateInspectionReport, generateInvoice,
  log, newDraft, projectRecords, saveRawMaterial, saveSupplier, suggestProjectCode,
  type EmailRecord, type ErpState, type ProjectDraft, type StoredFile,
} from "./model.ts";
import { endOperation, saveEmployee, saveRouting, setCurrentUser, startOperation } from "./shopfloor.ts";
import { createSupplierOrder, confirmSupplierOrder, markSupplierOrderSent, receiveSupplierOrder, supplierOrderEmail } from "./purchasing.ts";
import { markPayslipPaid, runPayroll, saveBill, saveQuotation, setQuoteStatus } from "./finance.ts";
import { addEmails } from "./mail.ts";

export const DEMO_PROJECT_NAMES = ["Hydraulic Actuator Assembly", "Pump Mounting Flange"];

/** Sample files shipped with the site (public/demo-files). */
export const SAMPLE_FILES: Record<string, StoredFile> = {
  drw204: { name: "DRW-ACT-204_A.pdf", size: 3519, type: "application/pdf", url: "/demo-files/DRW-ACT-204_A.pdf" },
  step204: { name: "ACT-204_A.step", size: 19416, type: "model/step", url: "/demo-files/ACT-204_A.step" },
  drw205: { name: "DRW-ACT-205_B.pdf", size: 2889, type: "application/pdf", url: "/demo-files/DRW-ACT-205_B.pdf" },
  step205: { name: "ACT-205_B.step", size: 7848, type: "model/step", url: "/demo-files/ACT-205_B.step" },
  drw118: { name: "DRW-PMF-118_A.pdf", size: 3693, type: "application/pdf", url: "/demo-files/DRW-PMF-118_A.pdf" },
  step118: { name: "PMF-118_A.step", size: 21864, type: "model/step", url: "/demo-files/PMF-118_A.step" },
  cert118: { name: "CERT-S355-H24117.pdf", size: 2817, type: "application/pdf", url: "/demo-files/CERT-S355-H24117.pdf" },
};

export function hasDemoProjects(state: ErpState) {
  return state.projects.some((project) => project.isSample && DEMO_PROJECT_NAMES.includes(project.name));
}

/** A fresh browser: the demo projects on an otherwise empty ERP. */
export function createDemoState(now: string): ErpState {
  return addDemoProjects(createInitialState(), now);
}

/** Adds the demo projects and their surroundings. Does nothing if they are already there. */
export function addDemoProjects(input: ErpState, now: string): ErpState {
  if (hasDemoProjects(input)) return input;
  const base = Date.parse(now);
  const dayIso = (daysAgo: number) => new Date(base - daysAgo * 86400000).toISOString().slice(0, 10);
  /** Time on a past working day (UTC). */
  const at = (daysAgo: number, time: string) => `${dayIso(daysAgo)}T${time}:00.000Z`;
  const ago = (minutes: number) => new Date(base - minutes * 60000).toISOString();
  const today = now.slice(0, 10);
  let state = input;

  /* ---------- People ---------- */
  const people = [
    { code: "E-1001", name: "Lena Hoffmann", role: "Production manager", access: "admin" as const, department: "Production", email: "lena.hoffmann@demo-company.example", hourlyRate: 42, monthlySalary: 5400, pay: "salary" as const },
    { code: "E-1002", name: "Murat Yilmaz", role: "CNC machinist", department: "Production", email: "murat.yilmaz@demo-company.example", hourlyRate: 31, monthlySalary: 3650, pay: "salary" as const },
    { code: "E-1003", name: "Jonas Becker", role: "CNC machinist", department: "Production", email: "jonas.becker@demo-company.example", hourlyRate: 30, monthlySalary: 3500, pay: "salary" as const },
    { code: "E-1004", name: "Sofia Marino", role: "Quality inspector", department: "Quality", email: "sofia.marino@demo-company.example", hourlyRate: 34, monthlySalary: 3900, pay: "salary" as const },
    { code: "E-1005", name: "Daniel Wright", role: "Purchasing and logistics", department: "Purchasing", email: "daniel.wright@demo-company.example", hourlyRate: 35, monthlySalary: 4100, pay: "salary" as const },
    { code: "E-1006", name: "Aylin Kaya", role: "Finance and office", department: "Finance", email: "aylin.kaya@demo-company.example", hourlyRate: 36, monthlySalary: 4300, pay: "salary" as const },
    { code: "E-1007", name: "Ben Krüger", role: "Machine operator (temporary)", department: "Production", email: "", hourlyRate: 22, monthlySalary: 0, pay: "hourly" as const },
  ];
  if (!state.employees.length) for (const person of people) state = saveEmployee(state, null, { ...person, active: true, joinedAt: "2025-03-01" }, at(60, "08:00"));
  const emp = (code: string) => state.employees.find((item) => item.code === code)?.id ?? state.employees[0]?.id ?? "";
  const as = (code: string) => { state = setCurrentUser(state, emp(code)); };
  as("E-1005");
  state = { ...state, settings: { ...state.settings, companyName: state.settings.companyName === "Your company (demo)" ? "Harmonie Präzisionstechnik GmbH (demo)" : state.settings.companyName } };

  /* ---------- Suppliers and raw materials ---------- */
  const suppliers = [
    { name: "Northline Metals GmbH", contact: "Petra Lang", email: "orders@northline-metals.example", leadTimeDays: 7 },
    { name: "Kestrel Alloys Ltd", contact: "Owen Price", email: "sales@kestrel-alloys.example", leadTimeDays: 10 },
    { name: "Brightcoat Surface GmbH", contact: "Jan Vogt", email: "service@brightcoat.example", leadTimeDays: 5 },
    { name: "Vektor Tools", contact: "Ines Roth", email: "shop@vektor-tools.example", leadTimeDays: 2 },
  ];
  for (const supplier of suppliers) state = saveSupplier(state, null, supplier, at(50, "09:00"));
  const supplierId = (name: string) => state.suppliers.find((item) => item.name === name)?.id ?? null;
  const materials = [
    { name: "EN AW-7075-T6 round bar Ø70 mm", unit: "kg", stock: 18, reorderLevel: 30, unitCost: 8.4, supplier: "Northline Metals GmbH" },
    { name: "42CrMo4 chrome-plated bar Ø25 mm", unit: "kg", stock: 9, reorderLevel: 12, unitCost: 5.9, supplier: "Kestrel Alloys Ltd" },
    { name: "S355 steel plate 20 mm", unit: "kg", stock: 40, reorderLevel: 30, unitCost: 1.35, supplier: "Northline Metals GmbH" },
    { name: "EN AW-6082-T6 block 120 × 80 mm", unit: "kg", stock: 8, reorderLevel: 25, unitCost: 6.1, supplier: "Northline Metals GmbH" },
  ];
  for (const material of materials) state = saveRawMaterial(state, null, { name: material.name, unit: material.unit, stock: material.stock, reorderLevel: material.reorderLevel, unitCost: material.unitCost, supplierId: supplierId(material.supplier) }, at(50, "09:30"));

  /* ---------- Project 2 first (it is older): pump flange, delivered and invoiced ---------- */
  const codeFor = (wanted: string) => (state.projects.some((project) => project.code === wanted) ? suggestProjectCode(state, today.slice(0, 4)) : wanted);
  const poFor = (wanted: string) => (state.purchaseOrders.some((order) => order.number === wanted) ? `${wanted}-D` : wanted);
  as("E-1001");
  const flangeQuote = saveQuotation(state, null, {
    customerName: "Nordwind Pumps AG", contact: "einkauf@nordwind-pumps.example", date: dayIso(46), validUntil: dayIso(16), currency: "EUR", leadTimeWeeks: 5, notes: "Zinc-nickel plated. Material certificate 3.1 included.",
    lines: [{ partNumber: "PMF-118", description: "Pump Mounting Flange", quantity: 120, unit: "pcs", unitPrice: 38.4, revision: "A" }],
  }, at(46, "10:15"));
  state = flangeQuote.state;
  if (flangeQuote.id) state = setQuoteStatus(state, flangeQuote.id, "Sent", at(46, "10:20"));

  const flangeDraft: ProjectDraft = {
    ...newDraft(state, dayIso(40)), projectName: "Pump Mounting Flange", projectCode: codeFor("BOH-PRJ-2026-002"), poNumber: poFor("PO-NW-77310"),
    description: "Demo project: 120 zinc-nickel plated flanges for Nordwind's PX pump series. Delivered, invoiced, payment advice in the inbox.",
    customerName: "Nordwind Pumps AG", contact: "einkauf@nordwind-pumps.example", poDate: dayIso(40), deliveryDate: dayIso(6), currency: "EUR", orderValue: "",
    lines: [{ key: "l1", partNumber: "PMF-118", description: "Pump Mounting Flange", quantity: "120", unit: "pcs", unitPrice: "38.40", revision: "A" }],
    documents: [
      { key: "d1", name: "Flange drawing", type: "Drawing", number: "DRW-PMF-118", revision: "A", partKey: "l1", status: "In review", source: "sample", file: SAMPLE_FILES.drw118 },
      { key: "d2", name: "Flange 3D model", type: "3D model", number: "CAD-PMF-118", revision: "A", partKey: "l1", status: "In review", source: "sample", file: SAMPLE_FILES.step118 },
      { key: "d3", name: "Mill certificate S355, heat H24117", type: "Material certificate", number: "CERT-H24117", revision: "A", partKey: "l1", status: "In review", source: "sample", file: SAMPLE_FILES.cert118 },
    ],
    inspections: [
      { key: "i1", name: "Flatness", spec: "≤ 0.05", unit: "mm", acceptance: "Surface plate, 3 points", partKey: "l1" },
      { key: "i2", name: "Bolt circle", spec: "Ø125 ± 0.1", unit: "mm", acceptance: "CMM, first and last part", partKey: "l1" },
      { key: "i3", name: "Coating thickness", spec: "8–12", unit: "µm", acceptance: "Supplier report", partKey: "l1" },
    ],
    materials: [{ key: "m1", material: "S355 steel plate 20 mm", quantity: "160", unit: "kg", supplier: "Northline Metals GmbH", status: "Not ordered", lineKey: "l1" }],
  };
  const flange = createProjectFromDraft(state, flangeDraft, at(40, "08:40"));
  state = flange.state;
  const flangeId = flange.projectId;
  if (flangeQuote.id) state = { ...state, quotations: state.quotations.map((quote) => quote.id === flangeQuote.id ? { ...quote, status: "Accepted", projectId: flangeId } : quote) };
  // Drawing approval: owner or admin only.
  as("E-1001");
  for (const doc of projectRecords(state, flangeId).documents) state = approveDocument(state, doc.id, at(39, "11:00"));

  // Purchasing: one supplier order, sent by email from the ERP, confirmed and received.
  as("E-1005");
  const sendOrder = (requirementProject: string, supplier: string, email: string, lines: { material: string; quantity: number; unit: string; unitPrice: number }[], daysCreated: number, daysConfirmed: number, daysReceived: number | null) => {
    const reqs = state.materialRequirements.filter((req) => req.projectId === requirementProject);
    const created = createSupplierOrder(state, {
      supplier, email, currency: "EUR", expectedAt: dayIso(daysCreated - 7), notes: "",
      lines: lines.map((line) => ({ ...line, requirementIds: reqs.filter((req) => req.material === line.material).map((req) => req.id) })),
    }, at(daysCreated, "09:10"));
    state = created.state;
    const order = state.supplierOrders.find((item) => item.id === created.id)!;
    const content = supplierOrderEmail(state, order);
    const mailId = `mail-sent-${order.id}`;
    state = addEmails(state, [{ id: mailId, folder: "sent", from: state.mail.address || "purchasing@demo-company.example", fromName: "Daniel Wright", to: email, subject: content.subject, body: content.body, date: at(daysCreated, "09:12"), read: true, source: "erp" }], at(daysCreated, "09:12"));
    state = markSupplierOrderSent(state, order.id, mailId, at(daysCreated, "09:12"));
    state = confirmSupplierOrder(state, order.id, dayIso(daysReceived ?? daysConfirmed - 7), null, at(daysConfirmed, "14:30"));
    if (daysReceived !== null) state = receiveSupplierOrder(state, order.id, at(daysReceived, "10:05"));
    return order;
  };
  const s355 = sendOrder(flangeId, "Northline Metals GmbH", "orders@northline-metals.example", [{ material: "S355 steel plate 20 mm", quantity: 160, unit: "kg", unitPrice: 1.35 }], 39, 38, 33);

  // Routing and shop-floor history.
  as("E-1001");
  const flangePart = projectRecords(state, flangeId).parts[0];
  state = saveRouting(state, flangePart.id, [
    { seq: 10, name: "Saw cutting", workCenter: "SAW-01", setupMin: 10, runMinPerPc: 1.2 },
    { seq: 20, name: "CNC turning", workCenter: "LATHE-02", setupMin: 35, runMinPerPc: 3.2 },
    { seq: 30, name: "Drilling and tapping", workCenter: "DRILL-01", setupMin: 15, runMinPerPc: 1.8 },
    { seq: 40, name: "Deburring", workCenter: "BENCH-01", setupMin: 5, runMinPerPc: 0.8 },
    { seq: 50, name: "Final inspection", workCenter: "QA-01", setupMin: 10, runMinPerPc: 0.6 },
  ], at(33, "07:30"));
  const flangeLine = projectRecords(state, flangeId).lineItems[0];
  state = createProductionOrder(state, flangeLine.id, at(32, "07:40"), { quantity: 122, startDate: dayIso(31), notes: "2 spare parts for setup. Zinc-nickel plating at Brightcoat after Op 40." });
  const flangeOrder = projectRecords(state, flangeId).productionOrders[0];
  state = linkMaterialLot(state, flangeOrder.id, { material: "S355 steel plate 20 mm", heat: "H24117", certificate: "CERT-H24117" }, at(32, "07:45"));
  const runOp = (orderId: string, code: string, start: string, end: string, good: number, scrap: number, notes = "") => {
    state = startOperation(state, orderId, emp(code), start);
    const active = state.activeOps.find((item) => item.orderId === orderId);
    if (active) state = endOperation(state, active.id, { qtyGood: good, qtyScrap: scrap, notes }, end);
  };
  runOp(flangeOrder.id, "E-1007", at(31, "06:05"), at(31, "09:31"), 122, 0);
  runOp(flangeOrder.id, "E-1002", at(30, "06:00"), at(30, "13:42"), 121, 1, "One part scrapped: chatter marks on face.");
  runOp(flangeOrder.id, "E-1003", at(29, "06:10"), at(29, "10:22"), 120, 1, "Thread M12 gauge failed on one part.");
  runOp(flangeOrder.id, "E-1007", at(28, "06:00"), at(28, "07:52"), 120, 0);
  runOp(flangeOrder.id, "E-1004", at(12, "07:00"), at(12, "08:31"), 120, 0, "After plating. Coating 9–11 µm.");

  as("E-1004");
  const flangeReqs = projectRecords(state, flangeId).inspectionRequirements;
  state = generateInspectionReport(state, flangeId, at(11, "09:20"), Object.fromEntries(flangeReqs.map((req, index) => [req.id, { observed: ["0.03", "125.04", "10"][index] ?? "OK", result: "pass" as const, sampleSize: [3, 5, 5][index] ?? 1, gaugeId: ["SP-02", "CMM-01", "Supplier report"][index] ?? "" }])));
  as("E-1005");
  state = dispatchProject(state, flangeId, at(7, "13:30"));
  as("E-1006");
  state = generateInvoice(state, flangeId, at(6, "10:00"));
  const flangeInvoice = projectRecords(state, flangeId).invoices[0];

  /* ---------- Project 1: hydraulic actuator, in production now ---------- */
  as("E-1001");
  const actuatorDraft: ProjectDraft = {
    ...newDraft(state, dayIso(24)), projectName: "Hydraulic Actuator Assembly", projectCode: codeFor("BOH-PRJ-2026-001"), poNumber: poFor("PO-2026-1042"),
    description: "Demo project: housings and piston rods for Kessler's press line. In production: follow it on the shop floor.",
    customerName: "Kessler Maschinenbau GmbH", contact: "procurement@kessler-maschinenbau.example", poDate: dayIso(24), deliveryDate: addDays(today, 18), currency: "EUR", orderValue: "",
    lines: [
      { key: "l1", partNumber: "ACT-204", description: "Hydraulic Actuator Housing", quantity: "50", unit: "pcs", unitPrice: "184.00", revision: "A" },
      { key: "l2", partNumber: "ACT-205", description: "Piston Rod", quantity: "50", unit: "pcs", unitPrice: "96.50", revision: "B" },
    ],
    documents: [
      { key: "d1", name: "Actuator housing drawing", type: "Drawing", number: "DRW-ACT-204", revision: "A", partKey: "l1", status: "In review", source: "sample", file: SAMPLE_FILES.drw204 },
      { key: "d2", name: "Actuator housing 3D model", type: "3D model", number: "CAD-ACT-204", revision: "A", partKey: "l1", status: "In review", source: "sample", file: SAMPLE_FILES.step204 },
      { key: "d3", name: "Piston rod drawing", type: "Drawing", number: "DRW-ACT-205", revision: "B", partKey: "l2", status: "In review", source: "sample", file: SAMPLE_FILES.drw205 },
      { key: "d4", name: "Piston rod 3D model", type: "3D model", number: "CAD-ACT-205", revision: "B", partKey: "l2", status: "In review", source: "sample", file: SAMPLE_FILES.step205 },
      { key: "d5", name: "Actuator assembly specification", type: "Specification", number: "SPEC-ACT-200", revision: "A", partKey: "", status: "In review", source: "sample" },
      { key: "d6", name: "Housing inspection plan", type: "Inspection plan", number: "IP-ACT-204", revision: "A", partKey: "l1", status: "In review", source: "sample" },
    ],
    inspections: [
      { key: "i1", name: "Outer width", spec: "120.00 ± 0.05", unit: "mm", acceptance: "All measured parts within tolerance", partKey: "l1" },
      { key: "i2", name: "Bore diameter", spec: "Ø40.00 H8", unit: "mm", acceptance: "Go / no-go gauge", partKey: "l1" },
      { key: "i3", name: "Surface finish", spec: "Ra ≤ 0.8", unit: "µm", acceptance: "Profilometer, 3 readings", partKey: "l2" },
      { key: "i4", name: "Rod diameter", spec: "Ø25 f7", unit: "mm", acceptance: "Micrometer, 100%", partKey: "l2" },
    ],
    materials: [
      { key: "m1", material: "EN AW-7075-T6 round bar Ø70 mm", quantity: "42", unit: "kg", supplier: "Northline Metals GmbH", status: "Not ordered", lineKey: "l1" },
      { key: "m2", material: "42CrMo4 chrome-plated bar Ø25 mm", quantity: "28", unit: "kg", supplier: "Kestrel Alloys Ltd", status: "Not ordered", lineKey: "l2" },
    ],
  };
  const actuator = createProjectFromDraft(state, actuatorDraft, at(24, "08:20"));
  state = actuator.state;
  const actuatorId = actuator.projectId;
  as("E-1001");
  for (const doc of projectRecords(state, actuatorId).documents) state = approveDocument(state, doc.id, at(23, "15:10"));
  as("E-1005");
  sendOrder(actuatorId, "Northline Metals GmbH", "orders@northline-metals.example", [{ material: "EN AW-7075-T6 round bar Ø70 mm", quantity: 42, unit: "kg", unitPrice: 8.4 }], 22, 21, 15);
  const rodOrder = sendOrder(actuatorId, "Kestrel Alloys Ltd", "sales@kestrel-alloys.example", [{ material: "42CrMo4 chrome-plated bar Ø25 mm", quantity: 28, unit: "kg", unitPrice: 5.9 }], 22, 20, 14);

  as("E-1001");
  const [housing, rod] = projectRecords(state, actuatorId).parts;
  state = saveRouting(state, housing.id, [
    { seq: 10, name: "Saw cutting", workCenter: "SAW-01", setupMin: 8, runMinPerPc: 1.2 },
    { seq: 20, name: "CNC milling", workCenter: "MILL-03", setupMin: 45, runMinPerPc: 7.5 },
    { seq: 30, name: "Deburring", workCenter: "BENCH-01", setupMin: 5, runMinPerPc: 2 },
    { seq: 40, name: "Final inspection", workCenter: "QA-01", setupMin: 10, runMinPerPc: 1.5 },
  ], at(15, "07:00"));
  state = saveRouting(state, rod.id, [
    { seq: 10, name: "Saw cutting", workCenter: "SAW-01", setupMin: 5, runMinPerPc: 0.8 },
    { seq: 20, name: "CNC turning", workCenter: "LATHE-02", setupMin: 35, runMinPerPc: 4.2 },
    { seq: 30, name: "Grinding", workCenter: "GRIND-01", setupMin: 20, runMinPerPc: 3 },
    { seq: 40, name: "Final inspection", workCenter: "QA-01", setupMin: 5, runMinPerPc: 1 },
  ], at(15, "07:05"));
  const [housingLine, rodLine] = projectRecords(state, actuatorId).lineItems;
  state = createProductionOrder(state, housingLine.id, at(14, "07:15"), { quantity: 52, startDate: dayIso(13), notes: "Clamp on soft jaws. 2 spare parts." });
  state = createProductionOrder(state, rodLine.id, at(14, "07:20"), { quantity: 52, startDate: dayIso(12), notes: "Grind after turning; protect chrome surface." });
  const [housingOrder, rodProdOrder] = projectRecords(state, actuatorId).productionOrders;
  runOp(housingOrder.id, "E-1007", at(13, "06:00"), at(13, "07:12"), 52, 0);
  runOp(housingOrder.id, "E-1002", at(10, "06:00"), at(10, "13:31"), 51, 1, "One bore oversize at start of batch; offset corrected.");
  runOp(rodProdOrder.id, "E-1003", at(12, "06:15"), at(12, "07:01"), 52, 0);
  // Op 30 deburring is running right now.
  state = startOperation(state, housingOrder.id, emp("E-1002"), ago(38));

  /* ---------- Finance around the projects ---------- */
  as("E-1006");
  state = saveBill(state, null, { number: "NM-2026-4471", supplier: "Northline Metals GmbH", category: "Raw material", date: dayIso(33), dueDate: dayIso(3), currency: "EUR", net: 216, taxRate: 19, description: "S355 steel plate 20 mm, 160 kg", supplierOrderId: s355.id, projectId: flangeId }, at(33, "12:00"));
  state = saveBill(state, null, { number: "NM-2026-4630", supplier: "Northline Metals GmbH", category: "Raw material", date: dayIso(15), dueDate: addDays(today, 15), currency: "EUR", net: 352.8, taxRate: 19, description: "EN AW-7075-T6 round bar Ø70 mm, 42 kg", projectId: actuatorId }, at(15, "12:00"));
  state = saveBill(state, null, { number: "BC-10982", supplier: "Brightcoat Surface GmbH", category: "Subcontracting", date: dayIso(14), dueDate: addDays(today, 16), currency: "EUR", net: 540, taxRate: 19, description: "Zinc-nickel plating PMF-118, 120 pcs", projectId: flangeId }, at(14, "16:00"));
  state = saveBill(state, null, { number: "GH-2026-10", supplier: "Gewerbepark Hannover GmbH", category: "Rent and utilities", date: dayIso(28), dueDate: dayIso(20), currency: "EUR", net: 3200, taxRate: 19, description: "Workshop rent, current month" }, at(28, "09:00"));
  state = saveBill(state, null, { number: "VT-55120", supplier: "Vektor Tools", category: "Tooling and consumables", date: dayIso(9), dueDate: addDays(today, 21), currency: "EUR", net: 412.5, taxRate: 19, description: "Milling inserts and taps" }, at(9, "11:00"));
  for (const bill of state.bills) if (["NM-2026-4471", "GH-2026-10"].includes(bill.number)) state = { ...state, bills: state.bills.map((item) => item.id === bill.id ? { ...item, paidAt: bill.number === "GH-2026-10" ? dayIso(21) : dayIso(5) } : item) };

  const lastMonth = (() => { const d = new Date(`${today.slice(0, 7)}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); })();
  state = runPayroll(state, lastMonth, `${lastMonth}-28T10:00:00.000Z`);
  for (const slip of state.payslips.filter((item) => item.period === lastMonth)) state = markPayslipPaid(state, slip.id, true, `${lastMonth}-30T09:00:00.000Z`);

  as("E-1001");
  const orbital = saveQuotation(state, null, {
    customerName: "Orbital Drives AG", contact: "m.berg@orbital-drives.example", date: dayIso(4), validUntil: addDays(today, 26), currency: "EUR", leadTimeWeeks: 6, notes: "Prices valid for the quoted quantity. Tooling included.",
    lines: [{ partNumber: "GC-410", description: "Gearbox cover, milled aluminium", quantity: 30, unit: "pcs", unitPrice: 212, revision: "A" }, { partNumber: "GC-411", description: "Gearbox cover gasket plate", quantity: 30, unit: "pcs", unitPrice: 18.5, revision: "A" }],
  }, at(4, "14:00"));
  state = orbital.state;
  if (orbital.id) state = setQuoteStatus(state, orbital.id, "Sent", at(4, "14:05"));

  /* ---------- Inbox ---------- */
  const me = state.mail.address || "info@demo-company.example";
  const inbox: EmailRecord[] = [
    {
      id: "demo-mail-apex-po", folder: "inbox", from: "procurement@kessler-maschinenbau.example", fromName: "Kessler Maschinenbau GmbH · Procurement", to: me, date: ago(70), read: false, source: "demo",
      subject: "Purchase order PO-2026-1088 – valve blocks",
      body: [
        "Dear team,", "", "please find our purchase order PO-2026-1088 for the following parts:", "",
        "1. 20 pcs VB-310 rev C Valve block @ EUR 142.00", "2. 40 pcs VB-311 rev A Valve block cover @ EUR 36.50", "",
        `Required delivery date: ${addDays(today, 45)}`, "Delivery to: Kessler Maschinenbau GmbH, Goods-in Gate 3, Bremen", "Payment terms: 30 days net", "",
        "Drawings follow from engineering. Please confirm receipt and delivery date.", "", "Best regards", "Clara Neumann", "Strategic Procurement, Kessler Maschinenbau GmbH",
      ].join("\n"),
    },
    {
      id: "demo-mail-helix-rfq", folder: "inbox", from: "engineering@helix-robotics.example", fromName: "Helix Robotics", to: me, date: ago(210), read: false, source: "demo",
      subject: "Request for quotation – gripper brackets",
      body: [
        "Hello,", "", "we are a robotics start-up in Hamburg. Could you quote the following parts in anodised aluminium (6082-T6):", "",
        "- 200 pcs GB-120 Gripper bracket", "- 200 pcs GB-121 Gripper bracket, mirrored", "", "Needed by 15 January 2027. Drawings attached as STEP and PDF.", "",
        "Thanks and regards", "Mika Sørensen", "Hardware Lead, Helix Robotics",
      ].join("\n"),
    },
    {
      id: "demo-mail-nordwind-payment", folder: "inbox", from: "accounts@nordwind-pumps.example", fromName: "Nordwind Pumps AG · Accounts payable", to: me, date: ago(60 * 26), read: false, source: "demo",
      subject: `Payment advice – invoice ${flangeInvoice?.number ?? "INV-2026-501"}`,
      body: [
        "Dear Sir or Madam,", "", `we have paid your invoice ${flangeInvoice?.number ?? "INV-2026-501"} for purchase order ${flangeDraft.poNumber}.`,
        `Amount transferred: EUR ${flangeInvoice ? flangeInvoice.total.toFixed(2) : "5483.52"}`, `Value date: ${dayIso(1)}`, "", "Kind regards", "Nordwind Pumps AG, Accounts payable",
      ].join("\n"),
    },
    {
      id: "demo-mail-northline-quote", folder: "inbox", from: "orders@northline-metals.example", fromName: "Northline Metals GmbH", to: me, date: ago(60 * 47), read: false, source: "demo",
      subject: "Quotation NM-Q-55821 – aluminium blocks",
      body: [
        "Dear Mr Wright,", "", "thank you for your enquiry. We are pleased to quote:", "",
        "EN AW-6082-T6 block 120 × 80 mm – 36 kg at EUR 6.35 per kg", "", "Lead time: 8 working days after order.", "Quotation valid for 30 days. Certificates 3.1 included.", "",
        "Best regards", "Petra Lang", "Northline Metals GmbH",
      ].join("\n"),
    },
    {
      id: "demo-mail-kestrel-invoice", folder: "inbox", from: "sales@kestrel-alloys.example", fromName: "Kestrel Alloys Ltd", to: me, date: ago(60 * 70), read: false, source: "demo",
      subject: `Invoice KA-24-3317 for your order ${rodOrder.number}`,
      body: [
        "Hello,", "", `please find our invoice KA-24-3317 for your order ${rodOrder.number}:`, "",
        "42CrMo4 chrome-plated bar Ø25 mm – 28 kg at EUR 5.90", "Net amount: EUR 165.20", "VAT 19%: EUR 31.39", "Total amount due: EUR 196.59", `Due date: ${addDays(today, 27)}`, "",
        "Bank: Demo Bank plc · IBAN on file", "", "Regards", "Owen Price", "Kestrel Alloys Ltd",
      ].join("\n"),
    },
  ];
  state = addEmails(state, inbox, now);
  state = { ...state, emails: state.emails.map((email) => email.folder === "inbox" ? { ...email, read: false } : email) };

  // Mark the demo projects and hand over to the visitor.
  state = { ...state, projects: state.projects.map((project) => project.id === flangeId || project.id === actuatorId ? { ...project, isSample: true } : project), guide: { step: 0, projectId: null, v: 2 }, draft: null };
  as("E-1001");
  return log(state, now, "projects", "Demo data loaded: 2 projects, 7 people, 4 suppliers, inbox, quotations, bills and shop-floor history", null);
}
