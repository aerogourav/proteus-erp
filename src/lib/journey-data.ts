/**
 * Synthetic end-to-end order journey for the fictional precision manufacturer
 * Apex Precision Components GmbH — from inbound enquiry to dispatch and invoice.
 * All companies, people, numbers and dates are fictional. Figures are computed here so they stay consistent.
 */

export const JOURNEY_STORAGE_KEY = "boh-demo-journey-v1";

export const journeyOrder = {
  customer: "Helix Motion Labs (Demo)",
  customerLocation: "Stuttgart, Germany",
  contact: "Mira König",
  contactRole: "Operations lead",
  partNumber: "AP-2040",
  partName: "Linear Guide Carriage Plate",
  revision: "A",
  material: "EN AW-6082-T6 plate, 25 mm",
  finish: "Black anodised (Type II)",
  quantity: 120,
  enquiryId: "ENQ-2026-0217",
  quoteId: "QT-2026-0318",
  customerPo: "PO-HX-77821",
  salesOrder: "SO-2026-0412",
  productionOrder: "MO-2026-0151",
  purchaseOrder: "PUR-2026-0093",
  supplier: "Northstar Alloy Supply (Demo)",
  deliveryNote: "DN-2026-0587",
  invoice: "INV-2026-0612",
  requestedDelivery: "27 Nov 2026",
} as const;

/* ---------- Costing (quote) ---------- */
const rates = { fiveAxis: 95, saw: 55, deburr: 48, inspection: 70 } as const; // EUR per hour
const blankKg = 0.648; // 120 × 80 × 25 mm blank × 2.70 g/cm³
const scrapAllowance = 0.05;
export const materialPricePerKg = 6.4;

export const materialRequiredKg = round(journeyOrder.quantity * blankKg * (1 + scrapAllowance), 1);
export const materialFreeStockKg = 36.0;
export const materialShortageKg = round(Math.max(0, materialRequiredKg - materialFreeStockKg), 1);
export const purchaseQuantityKg = Math.ceil(materialShortageKg / 10) * 10;

export const operations = [
  { op: "10", name: "Saw blanks", resource: "Band saw BS-1", setupH: 0.3, cycleMin: 1.2, rate: rates.saw, window: "9 Nov" },
  { op: "20", name: "5-axis milling", resource: "DMU 50 (5-axis)", setupH: 2.5, cycleMin: 9.5, rate: rates.fiveAxis, window: "10–12 Nov" },
  { op: "30", name: "Deburr & clean", resource: "Bench D-2", setupH: 0, cycleMin: 2, rate: rates.deburr, window: "13 Nov" },
  { op: "40", name: "Black anodising", resource: "Outside process · subcontract", setupH: 0, cycleMin: 0, rate: 0, window: "16–19 Nov" },
  { op: "50", name: "Final inspection", resource: "CMM Q-1", setupH: 1.5, cycleMin: 6, rate: rates.inspection, window: "20 Nov" },
] as const;

const finalSample = 13; // pieces measured at final inspection (sampling plan)

function opHours(op: (typeof operations)[number]) {
  const pieces = op.op === "50" ? finalSample : journeyOrder.quantity;
  return round(op.setupH + (pieces * op.cycleMin) / 60, 2);
}

export const costLines = [
  ...operations.filter((op) => op.rate > 0).map((op) => ({ label: `Op ${op.op} · ${op.name}`, detail: `${opHours(op).toFixed(2)} h × €${op.rate}/h`, amount: round(opHours(op) * op.rate, 2) })),
  { label: "Material", detail: `${materialRequiredKg.toFixed(1)} kg × €${materialPricePerKg.toFixed(2)}/kg`, amount: round(materialRequiredKg * materialPricePerKg, 2) },
  { label: "Anodising (subcontract)", detail: `120 pcs × €2.10 + €85 lot charge`, amount: round(journeyOrder.quantity * 2.1 + 85, 2) },
  { label: "Packaging", detail: "Foam-lined crates", amount: 40 },
];

export const costTotal = round(costLines.reduce((sum, line) => sum + line.amount, 0), 2);
export const marginRate = 0.22;
export const unitPrice = round((costTotal * (1 + marginRate)) / journeyOrder.quantity, 2);
export const quoteTotal = round(unitPrice * journeyOrder.quantity, 2);

/* ---------- Inspection ---------- */
export const inspectionResults = [
  { feature: "Bore Ø12 H7", nominal: "12.000", tolerance: "+0.018 / 0", measured: "12.009", ok: true },
  { feature: "Flatness", nominal: "—", tolerance: "≤ 0.020", measured: "0.012", ok: true },
  { feature: "Hole pattern position", nominal: "—", tolerance: "≤ 0.050", measured: "0.031", ok: true },
  { feature: "Thickness", nominal: "20.00", tolerance: "± 0.05", measured: "19.98", ok: true },
  { feature: "Surface roughness Ra", nominal: "—", tolerance: "≤ 1.6 µm", measured: "0.9 µm", ok: true },
  { feature: "Anodise layer", nominal: "—", tolerance: "15–25 µm", measured: "19 µm", ok: true },
] as const;
export const inspectionSample = finalSample;

/* ---------- Stages & tasks ---------- */
export type JourneyRole = "Sales" | "Engineering" | "Purchasing" | "Planning" | "Production" | "Quality" | "Logistics" | "Finance" | "Customer";

export type JourneyTask = {
  id: string;
  label: string;
  action: string;
  role: JourneyRole;
  date: string;
  event: string;
};

export type JourneyStage = {
  id: "lead" | "feasibility" | "quote" | "order" | "engineering" | "material" | "planning" | "production" | "quality" | "dispatch" | "invoice";
  name: string;
  summary: string;
  tasks: JourneyTask[];
};

const eur = (value: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(value);

export const journeyStages: JourneyStage[] = [
  {
    id: "lead", name: "Lead", summary: "An enquiry arrives from the website and is qualified.",
    tasks: [
      { id: "lead-capture", label: "Capture the enquiry as a lead", action: "Create lead", role: "Sales", date: "2 Nov · 09:12", event: `Lead ${journeyOrder.enquiryId} created from website enquiry` },
      { id: "lead-qualify", label: "Qualify: material, quantity, tolerances and delivery date are known", action: "Qualify lead", role: "Sales", date: "2 Nov · 10:05", event: "Lead qualified · fits machining capability and capacity window" },
    ],
  },
  {
    id: "feasibility", name: "Feasibility", summary: "Engineering reviews the drawing against machines and inspection capability.",
    tasks: [
      { id: "feas-review", label: "Review drawing AP-2040 rev A and critical features", action: "Complete drawing review", role: "Engineering", date: "2 Nov · 14:30", event: "Drawing review done · Ø12 H7 bore and 0.02 flatness are critical" },
      { id: "feas-ok", label: "Confirm machine, outside process and CMM capability", action: "Mark as feasible", role: "Engineering", date: "2 Nov · 15:10", event: "Feasible on DMU 50 · anodising via approved subcontractor" },
    ],
  },
  {
    id: "quote", name: "Quote", summary: "Cost is built from routing, material and subcontract, and the quote is sent.",
    tasks: [
      { id: "quote-build", label: "Calculate cost from routing, material and subcontract", action: "Calculate cost", role: "Sales", date: "3 Nov · 11:20", event: `Cost calculated · ${eur(costTotal)} before margin` },
      { id: "quote-send", label: `Send quote ${journeyOrder.quoteId} to ${journeyOrder.contact}`, action: "Send quote", role: "Sales", date: "4 Nov · 09:00", event: `Quote ${journeyOrder.quoteId} sent · ${eur(quoteTotal)} (${eur(unitPrice)} / pc)` },
      { id: "quote-accept", label: "Customer accepts the quote", action: "Simulate acceptance", role: "Customer", date: "5 Nov · 16:45", event: "Customer accepted the quote" },
    ],
  },
  {
    id: "order", name: "Order", summary: "The customer PO is checked against the quote before the order is confirmed.",
    tasks: [
      { id: "order-po", label: `Receive customer purchase order ${journeyOrder.customerPo}`, action: "Register customer PO", role: "Sales", date: "6 Nov · 08:40", event: `Customer PO ${journeyOrder.customerPo} registered` },
      { id: "order-fix", label: "Resolve mismatch: PO references drawing rev B, quote is for rev A", action: "Request corrected PO", role: "Sales", date: "6 Nov · 11:15", event: "PO mismatch resolved · corrected PO references rev A" },
      { id: "order-confirm", label: `Confirm sales order ${journeyOrder.salesOrder}`, action: "Confirm order", role: "Sales", date: "6 Nov · 11:30", event: `Sales order ${journeyOrder.salesOrder} confirmed · production order ${journeyOrder.productionOrder} created` },
    ],
  },
  {
    id: "engineering", name: "Engineering", summary: "The part and its controlled documents are released.",
    tasks: [
      { id: "eng-drawing", label: "Approve drawing AP-2040 rev A", action: "Approve drawing", role: "Engineering", date: "6 Nov · 14:00", event: "Drawing DWG-AP-2040 rev A approved" },
      { id: "eng-cam", label: "Approve CAM program and setup sheet", action: "Approve CAM & setup", role: "Engineering", date: "7 Nov · 10:20", event: "CAM program CNC-AP-2040 and setup sheet SET-AP-2040 approved" },
      { id: "eng-insp", label: "Approve inspection plan (FAI + sampling of 13 pcs)", action: "Approve inspection plan", role: "Quality", date: "7 Nov · 13:05", event: "Inspection plan INSP-AP-2040 rev A approved" },
    ],
  },
  {
    id: "material", name: "Material", summary: "Stock is checked, the shortage is purchased and certified material is reserved.",
    tasks: [
      { id: "mat-po", label: `Raise purchase order for ${purchaseQuantityKg} kg to ${journeyOrder.supplier}`, action: "Raise purchase order", role: "Purchasing", date: "7 Nov · 09:30", event: `Purchase order ${journeyOrder.purchaseOrder} raised · ${purchaseQuantityKg} kg EN AW-6082-T6` },
      { id: "mat-receive", label: "Receive goods and EN 10204 3.1 material certificate", action: "Receive goods", role: "Purchasing", date: "8 Nov · 14:10", event: "Goods received · lot LOT-DEMO-6082-2611 with 3.1 certificate" },
      { id: "mat-reserve", label: `Reserve ${materialRequiredKg.toFixed(1)} kg for ${journeyOrder.productionOrder}`, action: "Reserve material", role: "Planning", date: "8 Nov · 15:00", event: `${materialRequiredKg.toFixed(1)} kg reserved for ${journeyOrder.productionOrder}` },
    ],
  },
  {
    id: "planning", name: "Planning", summary: "Operations are scheduled and the order is released to the shop floor.",
    tasks: [
      { id: "plan-schedule", label: "Schedule operations on available capacity", action: "Schedule operations", role: "Planning", date: "8 Nov · 16:20", event: "Operations scheduled 9–20 Nov · dispatch planned 23 Nov" },
      { id: "plan-release", label: `Release ${journeyOrder.productionOrder} to the shop floor`, action: "Release to shop floor", role: "Planning", date: "9 Nov · 06:00", event: `${journeyOrder.productionOrder} released with approved documents` },
    ],
  },
  {
    id: "production", name: "Production", summary: "Operations are completed in sequence, with a first-article check before the series.",
    tasks: [
      { id: "prod-10", label: "Op 10 · Saw blanks", action: "Complete Op 10", role: "Production", date: "9 Nov · 13:40", event: "Op 10 complete · 126 blanks cut (incl. allowance)" },
      { id: "prod-fai", label: "First article inspection on Op 20", action: "Approve first article", role: "Quality", date: "10 Nov · 10:15", event: "First article approved · all critical features in tolerance" },
      { id: "prod-20", label: "Op 20 · 5-axis milling (series)", action: "Complete Op 20", role: "Production", date: "12 Nov · 17:30", event: "Op 20 complete · 122 machined: 121 good, 1 scrap (first-off setup piece)" },
      { id: "prod-30", label: "Op 30 · Deburr & clean", action: "Complete Op 30", role: "Production", date: "13 Nov · 15:00", event: "Op 30 complete · 121 pcs" },
      { id: "prod-40", label: "Op 40 · Black anodising (outside process)", action: "Receive from subcontractor", role: "Purchasing", date: "19 Nov · 11:20", event: "Anodised parts received with process certificate" },
    ],
  },
  {
    id: "quality", name: "Quality", summary: "Final inspection is recorded and the certificate of conformity is issued.",
    tasks: [
      { id: "qa-inspect", label: `Final inspection · ${finalSample} pcs measured on CMM`, action: "Record inspection", role: "Quality", date: "20 Nov · 10:40", event: `Final inspection passed · ${finalSample}/${finalSample} pcs in tolerance` },
      { id: "qa-coc", label: "Issue certificate of conformity", action: "Issue CoC", role: "Quality", date: "20 Nov · 11:05", event: "Certificate of conformity CoC-2026-0412 issued" },
    ],
  },
  {
    id: "dispatch", name: "Dispatch", summary: "Goods are packed with their documents and shipped.",
    tasks: [
      { id: "disp-pack", label: "Pack 120 pcs and print packing list", action: "Pack order", role: "Logistics", date: "23 Nov · 08:30", event: "120 pcs packed in 2 crates · 1 spare retained" },
      { id: "disp-ship", label: `Create delivery note ${journeyOrder.deliveryNote} and hand over to carrier`, action: "Dispatch", role: "Logistics", date: "23 Nov · 14:00", event: `Dispatched with ${journeyOrder.deliveryNote}, CoC and 3.1 certificate · 4 days before due date` },
    ],
  },
  {
    id: "invoice", name: "Invoice", summary: "The invoice is created from the delivered quantity and quoted price.",
    tasks: [
      { id: "inv-create", label: `Create invoice ${journeyOrder.invoice} from the delivery note`, action: "Create invoice", role: "Finance", date: "23 Nov · 16:00", event: `Invoice ${journeyOrder.invoice} issued · ${eur(quoteTotal)} · due 23 Dec 2026` },
    ],
  },
];

export const allJourneyTaskIds = journeyStages.flatMap((stage) => stage.tasks.map((task) => task.id));

export function formatEur(value: number) {
  return eur(value);
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
