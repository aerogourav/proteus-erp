export type DemoCompany = {
  id: string;
  name: string;
  industry: string;
  location: string;
  relationship: "Prospect" | "Customer";
};

export type DemoContact = {
  id: string;
  companyId: string;
  name: string;
  role: string;
  email: string;
};

export type OpportunityStage = "Lead" | "Qualified" | "Proposal" | "Won" | "Lost";
export type Opportunity = {
  id: string;
  companyId: string;
  name: string;
  stage: OpportunityStage;
  valueCents: number;
  currency: "EUR";
  expectedClose: string;
  owner: string;
  nextStep: string;
};

export const demoCompanies: DemoCompany[] = [
  { id: "co-helix", name: "Helix Motion Labs (Demo)", industry: "Industrial automation", location: "Stuttgart, Germany", relationship: "Customer" },
  { id: "co-rivermark", name: "Rivermark Robotics (Demo)", industry: "Robotics", location: "Utrecht, Netherlands", relationship: "Prospect" },
  { id: "co-asterion", name: "Asterion Controls Studio (Demo)", industry: "Engineering services", location: "Graz, Austria", relationship: "Prospect" },
  { id: "co-fieldwork", name: "Fieldwork Instruments (Demo)", industry: "Test equipment", location: "Bristol, United Kingdom", relationship: "Prospect" },
];

export const demoContacts: DemoContact[] = [
  { id: "contact-helix-01", companyId: "co-helix", name: "Mira König", role: "Operations lead · sample contact", email: "mira@example.invalid" },
  { id: "contact-rivermark-01", companyId: "co-rivermark", name: "Elias Noor", role: "Founder · sample contact", email: "elias@example.invalid" },
  { id: "contact-asterion-01", companyId: "co-asterion", name: "Nadia Varga", role: "Engineering manager · sample contact", email: "nadia@example.invalid" },
  { id: "contact-fieldwork-01", companyId: "co-fieldwork", name: "Jonah Price", role: "Systems lead · sample contact", email: "jonah@example.invalid" },
];

export const seedOpportunities: Opportunity[] = [
  { id: "opp-104", companyId: "co-rivermark", name: "Operations workspace pilot", stage: "Qualified", valueCents: 2400000, currency: "EUR", expectedClose: "2026-11-18", owner: "Demo team", nextStep: "Map current order handoffs" },
  { id: "opp-105", companyId: "co-asterion", name: "Engineering records evaluation", stage: "Proposal", valueCents: 1680000, currency: "EUR", expectedClose: "2026-12-04", owner: "Demo team", nextStep: "Review sample workflow" },
  { id: "opp-106", companyId: "co-fieldwork", name: "Configurable service workflow", stage: "Lead", valueCents: 920000, currency: "EUR", expectedClose: "2027-01-15", owner: "Demo team", nextStep: "Schedule discovery session" },
  { id: "opp-103", companyId: "co-helix", name: "Manufacturing demo workspace", stage: "Won", valueCents: 1250000, currency: "EUR", expectedClose: "2026-10-02", owner: "Demo team", nextStep: "Sample customer relationship only" },
];

export type DemoSupplier = {
  id: string;
  name: string;
  categories: string[];
  contact: string;
  email: string;
  status: "Active" | "Inactive";
  note: string;
};

export const demoSuppliers: DemoSupplier[] = [
  { id: "sup-northstar", name: "Northstar Alloy Supply (Demo)", categories: ["Aluminium bar", "Plate stock"], contact: "Sample supplier desk", email: "supply@example.invalid", status: "Active", note: "Fictional supplier record; no qualification evidence is represented." },
  { id: "sup-baltic", name: "Baltic Precision Metals (Demo)", categories: ["Stainless bar", "Alloy steel"], contact: "Sample materials desk", email: "metals@example.invalid", status: "Active", note: "Synthetic relationship used for lot traceability examples." },
  { id: "sup-vector", name: "Vector Barstock Works (Demo)", categories: ["Pre-hardened steel", "Ground bar"], contact: "Sample account desk", email: "orders@example.invalid", status: "Inactive", note: "Inactive demo supplier; not a verified vendor." },
];

export type MaterialLot = {
  id: string;
  code: string;
  name: string;
  specification: string;
  grade: string;
  unit: "kg";
  available: number;
  reserved: number;
  lotNumber: string;
  supplierId: string;
  certificateDocumentId: string;
  receivedOn: string;
  traceability: "Reference linked" | "Review required";
  partIds: string[];
  orderIds: string[];
};

export const demoMaterialLots: MaterialLot[] = [
  { id: "lot-al6082-2409", code: "RM-AL-6082", name: "Aluminium plate stock", specification: "EN AW-6082", grade: "6082-T6", unit: "kg", available: 186, reserved: 42, lotNumber: "LOT-DEMO-6082-2409", supplierId: "sup-northstar", certificateDocumentId: "mat-ap-1001", receivedOn: "2026-10-08", traceability: "Reference linked", partIds: ["ap-1001"], orderIds: ["mo-2026-0142"] },
  { id: "lot-ss316-1031", code: "RM-SS-316L", name: "Stainless round bar", specification: "EN 1.4404", grade: "316L", unit: "kg", available: 92, reserved: 18, lotNumber: "LOT-DEMO-316L-1031", supplierId: "sup-baltic", certificateDocumentId: "mat-ap-1024", receivedOn: "2026-10-05", traceability: "Reference linked", partIds: ["ap-1024"], orderIds: ["mo-2026-0143"] },
  { id: "lot-4140-2246", code: "RM-4140", name: "Alloy steel round bar", specification: "EN 1.7225", grade: "42CrMo4 / 4140", unit: "kg", available: 124, reserved: 36, lotNumber: "LOT-DEMO-4140-2246", supplierId: "sup-baltic", certificateDocumentId: "mat-ap-1088", receivedOn: "2026-10-03", traceability: "Review required", partIds: ["ap-1088"], orderIds: ["mo-2026-0144"] },
  { id: "lot-4140-2254", code: "RM-4140-PH", name: "Pre-hardened alloy bar", specification: "EN 1.7225", grade: "4140 pre-hardened", unit: "kg", available: 68, reserved: 20, lotNumber: "LOT-DEMO-4140-2254", supplierId: "sup-vector", certificateDocumentId: "mat-ap-1170", receivedOn: "2026-09-28", traceability: "Reference linked", partIds: ["ap-1170"], orderIds: ["mo-2026-0145"] },
  { id: "lot-al6082-2411", code: "RM-AL-6082", name: "Aluminium plate stock", specification: "EN AW-6082", grade: "6082-T6", unit: "kg", available: 54, reserved: 18, lotNumber: "LOT-DEMO-6082-2411", supplierId: "sup-northstar", certificateDocumentId: "mat-ap-1215", receivedOn: "2026-09-25", traceability: "Review required", partIds: ["ap-1215"], orderIds: ["mo-2026-0146"] },
];

export type FinanceStatus = "Paid" | "Open" | "Overdue";
export type FinanceEntry = {
  id: string;
  invoice: string;
  date: string;
  description: string;
  direction: "Receivable" | "Payable";
  amountCents: number;
  status: FinanceStatus;
  companyId?: string;
  supplierId?: string;
  invoiceGenerated?: boolean;
  billAttachment?: { name: string; type: string; size: number; uploadedAt: string };
};

export const demoFinanceEntries: FinanceEntry[] = [
  { id: "fin-01", invoice: "INV-DEMO-2608-04", date: "2026-08-15", description: "Engineering workflow evaluation", direction: "Receivable", amountCents: 1850000, status: "Paid", companyId: "co-helix" },
  { id: "fin-02", invoice: "BILL-DEMO-2608-02", date: "2026-08-20", description: "Aluminium sample stock", direction: "Payable", amountCents: 420000, status: "Paid", supplierId: "sup-northstar" },
  { id: "fin-03", invoice: "INV-DEMO-2609-01", date: "2026-09-05", description: "Process mapping workshop", direction: "Receivable", amountCents: 1280000, status: "Open", companyId: "co-rivermark" },
  { id: "fin-04", invoice: "BILL-DEMO-2609-06", date: "2026-09-10", description: "Sample inspection fixtures", direction: "Payable", amountCents: 160000, status: "Paid", supplierId: "sup-baltic" },
  { id: "fin-05", invoice: "BILL-DEMO-2609-09", date: "2026-09-25", description: "Stainless barstock lot", direction: "Payable", amountCents: 340000, status: "Open", supplierId: "sup-baltic" },
  { id: "fin-06", invoice: "INV-DEMO-2610-02", date: "2026-10-02", description: "Sample workspace pilot", direction: "Receivable", amountCents: 870000, status: "Paid", companyId: "co-helix" },
  { id: "fin-07", invoice: "INV-DEMO-2610-05", date: "2026-10-07", description: "Engineering records review", direction: "Receivable", amountCents: 520000, status: "Overdue", companyId: "co-asterion" },
  { id: "fin-08", invoice: "BILL-DEMO-2610-03", date: "2026-10-10", description: "Outside process sample service", direction: "Payable", amountCents: 210000, status: "Paid", supplierId: "sup-vector" },
  { id: "fin-09", invoice: "BILL-DEMO-2610-08", date: "2026-10-12", description: "Alloy steel sample lot", direction: "Payable", amountCents: 240000, status: "Overdue", supplierId: "sup-baltic" },
];

export function financeTotals(entries: FinanceEntry[]) {
  const total = (items: FinanceEntry[]) => items.reduce((sum, entry) => sum + entry.amountCents, 0);
  const receivables = entries.filter((entry) => entry.direction === "Receivable" && entry.status !== "Paid");
  const payables = entries.filter((entry) => entry.direction === "Payable" && entry.status !== "Paid");
  return {
    revenueCents: total(entries.filter((entry) => entry.direction === "Receivable")),
    expenseCents: total(entries.filter((entry) => entry.direction === "Payable")),
    receivablesCents: total(receivables),
    payablesCents: total(payables),
    overdueReceivableCents: total(receivables.filter((entry) => entry.status === "Overdue")),
    overduePayableCents: total(payables.filter((entry) => entry.status === "Overdue")),
    cashMovements: entries.filter((entry) => entry.status === "Paid"),
  };
}
