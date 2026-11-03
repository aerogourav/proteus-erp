/**
 * BOH ERP demo data model.
 *
 * One project is entered once; every module (CRM, sales, parts, documents, materials,
 * production, quality, dispatch, finance) reads from this single state.
 * All data is fictional and lives only in the visitor's browser.
 *
 * This file has no imports so it can be unit-tested directly with `node --test`.
 */

/* ============================== Types ============================== */

export type Currency = "EUR" | "USD" | "GBP";
/** Built-in types plus any the user adds in Configuration. */
export type DocType = string;
export type DocStatus = "Draft" | "In review" | "Approved";
export type DocSource = "sample" | "metadata" | "upload";
/** A file kept in this browser only. `data` (a data URL) is omitted for large files. */
/**
 * A file attached to a record. Small legacy files keep `data` (a data URL); new uploads live in this
 * browser's IndexedDB under `key`; bundled sample files are served from `url`.
 */
export type StoredFile = { name: string; size: number; type: string; data?: string; key?: string; url?: string };
export type ProcurementStatus = "Not ordered" | "Ordered" | "Received";
/** Preset statuses; any custom text is allowed too. "Completed" (or the older "Complete") counts as finished. */
export type ProductionStatus = string;
export const PRODUCTION_STATUSES = ["Planned", "Running", "In process", "Completed"] as const;
export const isProductionComplete = (status: string) => status === "Completed" || status === "Complete";

export const DOC_TYPES: DocType[] = ["Drawing", "3D model", "Specification", "Bill of materials", "Inspection plan", "Material certificate"];
export const DOC_STATUSES: DocStatus[] = ["Draft", "In review", "Approved"];
export const PROCUREMENT_STATUSES: ProcurementStatus[] = ["Not ordered", "Ordered", "Received"];
export const CURRENCIES: Currency[] = ["EUR", "USD", "GBP"];
export const UNITS = ["pcs", "set", "kg", "m"] as const;

export type CustomValues = Record<string, string>;
export type CustomEntity = "project" | "customer" | "purchaseOrder" | "part" | "productionOrder" | "supplier" | "rawMaterial";
export const CUSTOM_ENTITIES: { key: CustomEntity; label: string }[] = [
  { key: "project", label: "Projects" }, { key: "customer", label: "Customers" }, { key: "purchaseOrder", label: "Sales orders" }, { key: "part", label: "Parts" },
  { key: "productionOrder", label: "Production orders" }, { key: "supplier", label: "Suppliers" }, { key: "rawMaterial", label: "Raw materials" },
];
export type CustomFieldType = "text" | "number" | "date" | "select";
export type CustomField = { id: string; entity: CustomEntity; label: string; type: CustomFieldType; options: string[] };

export type TabKey = "overview" | "guided" | "inbox" | "projects" | "crm" | "quotations" | "sales" | "parts" | "documents" | "rawMaterials" | "purchasing" | "suppliers" | "production" | "shopFloor" | "quality" | "dispatch" | "finance" | "people" | "configuration"
  | "products" | "fulfilment" | "subscriptions" | "support";
/** Which industry pack the demo company runs. Decides the tabs, their default names and the sample data. */
export type Industry = "manufacturing" | "commerce" | "saas";
export const INDUSTRY_KEYS: Industry[] = ["manufacturing", "commerce", "saas"];
export type TabConfig = { key: TabKey; label: string; visible: boolean };
export type WidgetKey = "alerts" | "project" | "kpis" | "pipeline" | "orderValue" | "production" | "shopFloor" | "finance" | "stock" | "departments" | "activity";
export type WidgetConfig = { key: WidgetKey; visible: boolean };
export type UiSettings = {
  /** "studio": soft lavender (default since Nov 2026). "classic": the earlier plum and coral look. */
  theme: "studio" | "classic";
  accent: "lavender" | "coral" | "plum" | "green" | "blue" | "orange";
  density: "comfortable" | "compact";
  corners: "rounded" | "soft" | "sharp";
  sidebar: "lavender" | "dark" | "light";
  nav: "left" | "right" | "top";
  font: "brand" | "system";
};

export const DEFAULT_TABS: TabConfig[] = [
  { key: "overview", label: "Overview", visible: true }, { key: "guided", label: "Guided demo", visible: true }, { key: "inbox", label: "Inbox", visible: true },
  { key: "fulfilment", label: "Orders & shipping", visible: true }, { key: "products", label: "Products & stock", visible: true }, { key: "subscriptions", label: "Subscriptions", visible: true },
  { key: "projects", label: "Projects", visible: true }, { key: "crm", label: "CRM", visible: true }, { key: "support", label: "Support", visible: true }, { key: "quotations", label: "Quotations", visible: true },
  { key: "sales", label: "Sales orders", visible: true }, { key: "parts", label: "Parts", visible: true }, { key: "documents", label: "Documents", visible: true },
  { key: "rawMaterials", label: "Raw materials", visible: true }, { key: "purchasing", label: "Purchasing", visible: true }, { key: "suppliers", label: "Suppliers", visible: true },
  { key: "production", label: "Production", visible: true }, { key: "shopFloor", label: "Shop floor KPI", visible: true }, { key: "quality", label: "Quality", visible: true },
  { key: "dispatch", label: "Dispatch", visible: true }, { key: "finance", label: "Finance", visible: true }, { key: "people", label: "People", visible: true },
  { key: "configuration", label: "Configuration", visible: true },
];

/** Saved tabs plus any tabs added since, each inserted after its default predecessor (not dumped at the end). */
function mergeTabs(saved: TabConfig[]): TabConfig[] {
  const merged = [...saved];
  DEFAULT_TABS.forEach((tab, index) => {
    if (merged.some((item) => item.key === tab.key)) return;
    const before = DEFAULT_TABS.slice(0, index).reverse().find((item) => merged.some((entry) => entry.key === item.key));
    const at = before ? merged.findIndex((item) => item.key === before.key) + 1 : 0;
    merged.splice(at, 0, { ...tab });
  });
  return merged;
}
export const WIDGET_LABELS: Record<WidgetKey, string> = {
  alerts: "Alerts and to-dos", shopFloor: "Shop floor KPIs", project: "Current project", kpis: "Key figures", pipeline: "Project pipeline", orderValue: "Order value by project", production: "Production status",
  finance: "Revenue and receivables", stock: "Raw material stock", departments: "Departments", activity: "Recent activity",
};
export const DEFAULT_WIDGETS: WidgetConfig[] = (["alerts", "project", "kpis", "pipeline", "orderValue", "production", "shopFloor", "finance", "stock", "departments", "activity"] as WidgetKey[]).map((key) => ({ key, visible: true }));
export const DEFAULT_UI: UiSettings = { theme: "studio", accent: "lavender", density: "comfortable", corners: "rounded", sidebar: "lavender", nav: "left", font: "brand" };

/** Settings saved before the Studio theme existed: switch to it, unless the visitor had changed the old default colours. */
function migrateUi(stored: Partial<UiSettings> | undefined): UiSettings {
  if (!stored || stored.theme) return { ...DEFAULT_UI, ...(stored ?? {}) };
  return {
    ...DEFAULT_UI, ...stored, theme: "studio",
    accent: !stored.accent || stored.accent === "coral" ? "lavender" : stored.accent,
    sidebar: !stored.sidebar || stored.sidebar === "dark" ? "lavender" : stored.sidebar,
  };
}

/** Value of one unit of each currency in EUR. Used to add up amounts in different currencies. */
export type FxRates = Record<Currency, number>;
export const DEFAULT_FX: FxRates = { EUR: 1, USD: 0.92, GBP: 1.17 };
/** Illustrative payroll percentages. Real payroll needs a certified payroll system. */
export type PayrollSettings = { incomeTaxPct: number; socialPct: number; employerPct: number };
export const DEFAULT_PAYROLL: PayrollSettings = { incomeTaxPct: 16, socialPct: 20, employerPct: 21 };

export type Settings = {
  industry: Industry;
  taxRate: number; defaultCurrency: Currency; paymentTermsDays: number;
  ui: UiSettings; tabs: TabConfig[]; widgets: WidgetConfig[]; customFields: CustomField[]; docTypes: string[];
  fx: FxRates; payroll: PayrollSettings; companyName: string; overheadPerHour: number;
};
export type Supplier = { id: string; name: string; contact: string; email: string; leadTimeDays: number | null; createdAt: string; custom?: CustomValues };
export type RawMaterial = { id: string; name: string; unit: string; stock: number; reorderLevel: number; unitCost: number | null; supplierId: string | null; custom?: CustomValues };
export type Customer = { id: string; name: string; contact: string; createdAt: string; custom?: CustomValues };
export type PurchaseOrder = { id: string; number: string; customerId: string; projectId: string; poDate: string; deliveryDate: string; currency: Currency; value: number | null; receivedAt: string; custom?: CustomValues };
export type Project = { id: string; code: string; name: string; description: string; customerId: string; purchaseOrderIds: string[]; createdAt: string; isSample: boolean; custom?: CustomValues };
export type LineItem = { id: string; projectId: string; purchaseOrderId: string; partId: string; revisionId: string; quantity: number; unit: string; unitPrice: number | null };
export type Part = { id: string; number: string; description: string; custom?: CustomValues };
export type PartRevision = { id: string; partId: string; revision: string; createdAt: string };
export type DocumentRecord = { id: string; number: string; name: string; type: DocType; revision: string; status: DocStatus; source: DocSource; projectIds: string[]; partId: string | null; updatedAt: string; file?: StoredFile; approvedBy?: string; approvedAt?: string };
export type InspectionRequirement = { id: string; projectId: string; partId: string | null; name: string; spec: string; unit: string; acceptance: string };
export type MaterialRequirement = { id: string; projectId: string; lineItemId: string | null; material: string; quantity: number; unit: string };
export type ProcurementRecord = { id: string; number: string; requirementId: string; supplier: string; status: ProcurementStatus; updatedAt: string };
export type ProductionOrder = { id: string; number: string; projectId: string; lineItemId: string; partId: string; revisionId: string; quantity: number; status: ProductionStatus; createdAt: string; startDate?: string; notes?: string; custom?: CustomValues; routing?: OperationDef[]; materialIssuedAt?: string };
export type InspectionResult = { requirementId: string; observed: string; pass: boolean };
export type InspectionReport = { id: string; number: string; projectId: string; productionOrderIds: string[]; results: InspectionResult[]; passed: boolean; createdAt: string };
export type DispatchRecord = { id: string; number: string; projectId: string; purchaseOrderId: string; dispatchedAt: string };
export type InvoiceLine = { description: string; quantity: number; unit: string; unitPrice: number; amount: number };
export type Invoice = { id: string; number: string; projectId: string; purchaseOrderId: string; customerId: string; currency: Currency; lines: InvoiceLine[]; subtotal: number; taxRate: number; tax: number; total: number; issuedAt: string; dueAt: string; paidAt?: string };
export type ActivityEvent = { id: string; at: string; projectId: string | null; module: ModuleKey; text: string; user?: string };

export type ModuleKey = "projects" | "crm" | "sales" | "parts" | "documents" | "materials" | "procurement" | "production" | "quality" | "dispatch" | "finance" | "suppliers" | "settings" | "inbox" | "shopfloor" | "people"
  | "products" | "fulfilment" | "subscriptions" | "support";

/* ---------- E-commerce / wholesale pack ---------- */

export type Warehouse = { id: string; code: string; name: string };
export type SalesChannel = "Webshop" | "Marketplace" | "Wholesale" | "Retail store";
export const SALES_CHANNELS: SalesChannel[] = ["Webshop", "Marketplace", "Wholesale", "Retail store"];
/** A sellable product or one variant of it (e.g. "Linen shirt · Sand · M"). Stock is kept per warehouse. */
export type Product = {
  id: string; sku: string; name: string; variant: string; category: string; price: number; cost: number;
  stock: Record<string, number>; reorderLevel: number; supplierId: string | null; active: boolean;
};
export type ShopOrderStatus = "New" | "Picked" | "Packed" | "Shipped" | "Delivered" | "Returned" | "Cancelled";
export const SHOP_FLOW: ShopOrderStatus[] = ["New", "Picked", "Packed", "Shipped", "Delivered"];
export type ShopOrderLine = { productId: string; quantity: number; unitPrice: number };
export type ShopOrder = {
  id: string; number: string; channel: SalesChannel; customerId: string; country: string; warehouseId: string; lines: ShopOrderLine[];
  shipping: number; status: ShopOrderStatus; createdAt: string; pickedAt?: string; packedAt?: string; shippedAt?: string; deliveredAt?: string;
  carrier?: string; tracking?: string; returnedAt?: string; returnReason?: string; restocked?: boolean; invoiceId?: string;
};

/* ---------- Software / SaaS pack ---------- */

export type Plan = { id: string; name: string; pricePerSeat: number; interval: "month" | "year"; description: string };
export type SubscriptionStatus = "Trial" | "Active" | "Past due" | "Cancelled";
/** One change in monthly recurring revenue, kept so MRR history and movements can be shown honestly. */
export type MrrChange = { at: string; mrr: number; kind: "new" | "expansion" | "contraction" | "churn" | "reactivation"; note: string };
export type Subscription = {
  id: string; customerId: string; planId: string; seats: number; discountPct: number; status: SubscriptionStatus;
  startedAt: string; trialEndsAt?: string; renewsAt: string; cancelledAt?: string; history: MrrChange[];
  /** Billing periods (YYYY-MM) already invoiced, so a billing run never invoices twice. */
  billed: string[];
};
export type TicketPriority = "Low" | "Normal" | "High" | "Urgent";
export type TicketStatus = "Open" | "Waiting on customer" | "Solved";
export type Ticket = {
  id: string; number: string; customerId: string; subject: string; priority: TicketPriority; status: TicketStatus;
  createdAt: string; firstResponseAt?: string; solvedAt?: string; assigneeId: string | null;
};

/* ---------- People, shop floor, email, quotations, purchasing and finance records ---------- */

export type Employee = { id: string; code: string; name: string; role: string; department: string; email: string; hourlyRate: number; monthlySalary: number; pay: "salary" | "hourly"; active: boolean; joinedAt: string };
/** One step of a part's routing. Times are planned minutes. */
export type OperationDef = { seq: number; name: string; workCenter: string; setupMin: number; runMinPerPc: number };
export type Routing = { partId: string; operations: OperationDef[] };
/** One finished operation on the shop floor: who, what, when, how many. */
export type OpLog = {
  id: string; orderId: string; orderNumber: string; projectId: string; partId: string; partNumber: string; revision: string; partDescription: string;
  seq: number; operation: string; workCenter: string; employeeId: string; employeeCode: string; employeeName: string;
  start: string; end: string; minutes: number; plannedMinutes: number; qtyGood: number; qtyScrap: number; notes: string;
};
/** An operation that has been started and not yet ended. */
export type ActiveOp = { id: string; orderId: string; seq: number; employeeId: string; start: string };
export type EmailFolder = "inbox" | "sent";
export type EmailRecord = {
  id: string; folder: EmailFolder; from: string; fromName: string; to: string; subject: string; date: string; body: string; read: boolean;
  source: "demo" | "gmail" | "erp"; externalId?: string; links?: { kind: string; id: string; label: string }[]; dismissed?: boolean;
};
export type MailSettings = { provider: "demo" | "gmail"; address: string; lastSync: string; autoSync: boolean };
export type QuoteStatus = "Draft" | "Sent" | "Accepted" | "Rejected";
export type QuoteLine = { partNumber: string; description: string; quantity: number; unit: string; unitPrice: number; revision: string };
export type Quotation = {
  id: string; number: string; customerName: string; contact: string; date: string; validUntil: string; currency: Currency; lines: QuoteLine[];
  status: QuoteStatus; notes: string; leadTimeWeeks: number; projectId?: string; emailId?: string;
};
export type SupplierOrderStatus = "Draft" | "Sent" | "Confirmed" | "Received" | "Cancelled";
export type SupplierOrderLine = { material: string; quantity: number; unit: string; unitPrice: number | null; requirementIds: string[] };
export type SupplierOrder = {
  id: string; number: string; supplier: string; email: string; currency: Currency; lines: SupplierOrderLine[]; status: SupplierOrderStatus;
  createdAt: string; sentAt?: string; confirmedAt?: string; receivedAt?: string; expectedAt: string; notes: string; emailIds: string[];
};
export type BillCategory = "Raw material" | "Subcontracting" | "Tooling and consumables" | "Stock purchases" | "Shipping and fulfilment" | "Software and hosting" | "Marketing" | "Rent and utilities" | "Services" | "Other";
export const BILL_CATEGORIES: BillCategory[] = ["Raw material", "Subcontracting", "Tooling and consumables", "Stock purchases", "Shipping and fulfilment", "Software and hosting", "Marketing", "Rent and utilities", "Services", "Other"];
export type Bill = {
  id: string; number: string; supplier: string; category: BillCategory; date: string; dueDate: string; currency: Currency; net: number; taxRate: number; tax: number; total: number;
  paidAt?: string; supplierOrderId?: string; projectId?: string; description: string; file?: StoredFile; emailId?: string;
};
export type Payslip = {
  id: string; number: string; employeeId: string; period: string; hours: number; gross: number; incomeTax: number; social: number; net: number; employerCost: number;
  issuedAt: string; paidAt?: string;
};

export type DraftLine = { key: string; partNumber: string; description: string; quantity: string; unit: string; unitPrice: string; revision: string };
export type DraftDocument = { key: string; name: string; type: DocType; number: string; revision: string; partKey: string; status: DocStatus; source: DocSource; file?: StoredFile };
export type DraftInspection = { key: string; name: string; spec: string; unit: string; acceptance: string; partKey: string };
export type DraftMaterial = { key: string; material: string; quantity: string; unit: string; supplier: string; status: ProcurementStatus; lineKey: string };
export type ProjectDraft = {
  step: number;
  projectName: string; projectCode: string; poNumber: string; description: string;
  customerName: string; contact: string; poDate: string; deliveryDate: string; currency: Currency; orderValue: string;
  lines: DraftLine[]; documents: DraftDocument[]; inspections: DraftInspection[]; materials: DraftMaterial[];
};

export type ErpState = {
  version: 2;
  seq: number;
  settings: Settings;
  suppliers: Supplier[];
  rawMaterials: RawMaterial[];
  customers: Customer[];
  purchaseOrders: PurchaseOrder[];
  projects: Project[];
  lineItems: LineItem[];
  parts: Part[];
  revisions: PartRevision[];
  documents: DocumentRecord[];
  inspectionRequirements: InspectionRequirement[];
  materialRequirements: MaterialRequirement[];
  procurement: ProcurementRecord[];
  productionOrders: ProductionOrder[];
  inspectionReports: InspectionReport[];
  dispatches: DispatchRecord[];
  invoices: Invoice[];
  activity: ActivityEvent[];
  employees: Employee[];
  /** Who is using the demo right now. Used for the activity log and the shop floor. */
  currentUserId: string | null;
  routings: Routing[];
  opLogs: OpLog[];
  activeOps: ActiveOp[];
  emails: EmailRecord[];
  mail: MailSettings;
  quotations: Quotation[];
  supplierOrders: SupplierOrder[];
  bills: Bill[];
  payslips: Payslip[];
  warehouses: Warehouse[];
  products: Product[];
  shopOrders: ShopOrder[];
  plans: Plan[];
  subscriptions: Subscription[];
  tickets: Ticket[];
  draft: ProjectDraft | null;
  /** Guided demo position: the visitor's single project moves through every step. */
  guide: { step: number; projectId: string | null; furthest?: number; v?: number };
};

/* ============================== Helpers ============================== */

export const WIZARD_STEPS = ["Project", "Customer & order", "Line items", "Documents", "Inspection", "Materials", "Review"] as const;

export function createInitialState(): ErpState {
  return {
    version: 2, seq: 1, settings: { industry: "manufacturing", taxRate: 19, defaultCurrency: "EUR", paymentTermsDays: 30, ui: { ...DEFAULT_UI }, tabs: DEFAULT_TABS.map((tab) => ({ ...tab })), widgets: DEFAULT_WIDGETS.map((widget) => ({ ...widget })), customFields: [], docTypes: [], fx: { ...DEFAULT_FX }, payroll: { ...DEFAULT_PAYROLL }, companyName: "Your company (demo)", overheadPerHour: 0 },
    suppliers: [], rawMaterials: [],
    customers: [], purchaseOrders: [], projects: [], lineItems: [], parts: [], revisions: [], documents: [], inspectionRequirements: [],
    materialRequirements: [], procurement: [], productionOrders: [], inspectionReports: [], dispatches: [], invoices: [], activity: [], draft: null,
    employees: [], currentUserId: null, routings: [], opLogs: [], activeOps: [], emails: [], mail: { provider: "demo", address: "", lastSync: "", autoSync: true },
    quotations: [], supplierOrders: [], bills: [], payslips: [],
    warehouses: [], products: [], shopOrders: [], plans: [], subscriptions: [], tickets: [],
    guide: { step: 0, projectId: null, v: 2 },
  };
}

export const norm = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
export const normCode = (value: string) => value.trim().toUpperCase();
export const round2 = (value: number) => Math.round(value * 100) / 100;

export function nextId(state: ErpState, prefix: string): [string, ErpState] {
  return [`${prefix}-${state.seq}`, { ...state, seq: state.seq + 1 }];
}

export function numberFor(prefix: string, existing: string[], start = 1, width = 4) {
  let n = start;
  const used = new Set(existing.map(normCode));
  while (used.has(normCode(`${prefix}${String(n).padStart(width, "0")}`))) n += 1;
  return `${prefix}${String(n).padStart(width, "0")}`;
}

export const ACTIVITY_LIMIT = 600;

/** Name of the person currently using the demo, for the audit trail. */
export function currentUserName(state: ErpState) {
  const employee = state.currentUserId ? (state.employees ?? []).find((item) => item.id === state.currentUserId) : null;
  return employee ? `${employee.name} (${employee.code})` : undefined;
}

export function log(state: ErpState, at: string, module: ModuleKey, text: string, projectId: string | null): ErpState {
  const [id, next] = nextId(state, "evt");
  const user = currentUserName(state);
  return { ...next, activity: [{ id, at, projectId, module, text, ...(user ? { user } : {}) }, ...next.activity].slice(0, ACTIVITY_LIMIT) };
}

/** Accepts "1,234.50" and German "1.234,50" or "12,5"; "1,234" stays one thousand two hundred thirty-four. */
export function parseAmount(value: string): number | null {
  let trimmed = value.trim().replace(/\s/g, "");
  if (!trimmed) return null;
  if (/^-?[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(trimmed) || /^-?\d+,\d{1,2}$/.test(trimmed)) trimmed = trimmed.replace(/\./g, "").replace(",", ".");
  else trimmed = trimmed.replace(/,/g, "");
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/** Activity for one project (or all), newest first. Seeded and imported events are not stored in time order. */
export function recentActivity(state: ErpState, projectId: string | null = null, limit = 8) {
  return state.activity.filter((event) => projectId === null || event.projectId === projectId).sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export function formatMoney(value: number, currency: Currency) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value);
}

export function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Berlin" }).format(date);
}

export function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/* ============================== Draft (wizard) ============================== */

export function suggestProjectCode(state: ErpState, year = 2026) {
  return numberFor(`BOH-PRJ-${year}-`, state.projects.map((project) => project.code), 1, 3);
}

export function suggestPartNumber(state: ErpState, draft: ProjectDraft) {
  return numberFor("PRT-", [...state.parts.map((part) => part.number), ...draft.lines.map((line) => line.partNumber)], 100, 3);
}

export function newDraft(state: ErpState, today: string): ProjectDraft {
  return {
    step: 0, projectName: "", projectCode: suggestProjectCode(state), poNumber: "", description: "",
    customerName: "", contact: "", poDate: today, deliveryDate: addDays(today, 42), currency: state.settings.defaultCurrency, orderValue: "",
    lines: [], documents: [], inspections: [], materials: [],
  };
}

export type FieldErrors = Record<string, string>;

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,29}$/;
const REVISION_PATTERN = /^[A-Z0-9]{1,3}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates one wizard step. Keys are field names, or `lines.<key>.<field>` for repeated rows. */
export function validateStep(state: ErpState, draft: ProjectDraft, step: number): FieldErrors {
  const errors: FieldErrors = {};
  if (step === 0) {
    if (!draft.projectName.trim()) errors.projectName = "Enter a project name.";
    const code = normCode(draft.projectCode);
    if (!code) errors.projectCode = "Enter a project ID.";
    else if (!CODE_PATTERN.test(code)) errors.projectCode = "Use 3–30 letters, digits or hyphens.";
    else if (state.projects.some((project) => normCode(project.code) === code)) errors.projectCode = `${code} is already used by another project.`;
    if (!draft.customerName.trim()) errors.customerName = "Enter the customer.";
    const po = normCode(draft.poNumber);
    if (!po) errors.poNumber = "Enter the customer's purchase order number.";
    else if (!CODE_PATTERN.test(po)) errors.poNumber = "Use 3–30 letters, digits or hyphens.";
    else if (state.purchaseOrders.some((order) => normCode(order.number) === po)) errors.poNumber = `${po} is already registered.`;
  }
  if (step === 1) {
    if (!draft.customerName.trim()) errors.customerName = "Enter the customer.";
    if (draft.contact.includes("@") && !EMAIL_PATTERN.test(draft.contact.trim())) errors.contact = "This email address doesn't look complete.";
    if (!draft.poDate) errors.poDate = "Enter the PO date.";
    if (!draft.deliveryDate) errors.deliveryDate = "Enter the required delivery date.";
    else if (draft.poDate && draft.deliveryDate < draft.poDate) errors.deliveryDate = "Delivery must be on or after the PO date.";
    const value = parseAmount(draft.orderValue);
    if (Number.isNaN(value) || (value !== null && value < 0)) errors.orderValue = "Enter a positive amount, or leave it empty.";
  }
  if (step === 2) {
    if (!draft.lines.length) errors.lines = "Add at least one line item.";
    const seen = new Map<string, number>();
    for (const line of draft.lines) seen.set(normCode(line.partNumber), (seen.get(normCode(line.partNumber)) ?? 0) + 1);
    for (const line of draft.lines) {
      const prefix = `lines.${line.key}`;
      const number = normCode(line.partNumber);
      if (!number) errors[`${prefix}.partNumber`] = "Enter a part number.";
      else if (!CODE_PATTERN.test(number)) errors[`${prefix}.partNumber`] = "Use 3–30 letters, digits or hyphens.";
      else if ((seen.get(number) ?? 0) > 1) errors[`${prefix}.partNumber`] = "This part is already on the order. Change the quantity instead.";
      if (!line.description.trim()) errors[`${prefix}.description`] = "Describe the part.";
      const quantity = Number(line.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) errors[`${prefix}.quantity`] = "Enter a whole number above 0.";
      if (!line.unit.trim()) errors[`${prefix}.unit`] = "Choose a unit.";
      const price = parseAmount(line.unitPrice);
      if (Number.isNaN(price) || (price !== null && price < 0)) errors[`${prefix}.unitPrice`] = "Enter a positive price, or leave it empty.";
      if (!REVISION_PATTERN.test(normCode(line.revision))) errors[`${prefix}.revision`] = "Use 1–3 letters or digits, e.g. A.";
    }
  }
  if (step === 3) {
    const seen = new Map<string, number>();
    for (const doc of draft.documents) seen.set(`${normCode(doc.number)}|${normCode(doc.revision)}`, (seen.get(`${normCode(doc.number)}|${normCode(doc.revision)}`) ?? 0) + 1);
    for (const doc of draft.documents) {
      const prefix = `documents.${doc.key}`;
      if (!doc.name.trim()) errors[`${prefix}.name`] = "Enter a document name.";
      if (!normCode(doc.number)) errors[`${prefix}.number`] = "Enter a document number.";
      else if ((seen.get(`${normCode(doc.number)}|${normCode(doc.revision)}`) ?? 0) > 1) errors[`${prefix}.number`] = "This document and revision is listed twice.";
      if (!REVISION_PATTERN.test(normCode(doc.revision))) errors[`${prefix}.revision`] = "Use 1–3 letters or digits.";
      if (doc.partKey && !draft.lines.some((line) => line.key === doc.partKey)) errors[`${prefix}.partKey`] = "That line item was removed. Choose another part.";
    }
  }
  if (step === 4) {
    for (const item of draft.inspections) {
      const prefix = `inspections.${item.key}`;
      if (!item.name.trim()) errors[`${prefix}.name`] = "Name the parameter.";
      if (!item.spec.trim()) errors[`${prefix}.spec`] = "Enter the required value.";
    }
  }
  if (step === 5) {
    for (const item of draft.materials) {
      const prefix = `materials.${item.key}`;
      if (!item.material.trim()) errors[`${prefix}.material`] = "Name the material.";
      const quantity = Number(item.quantity);
      if (!(quantity > 0)) errors[`${prefix}.quantity`] = "Enter a quantity above 0.";
      if (!item.unit.trim()) errors[`${prefix}.unit`] = "Choose a unit.";
    }
  }
  if (step === 6) {
    for (let index = 0; index < 6; index += 1) Object.assign(errors, validateStep(state, draft, index));
  }
  return errors;
}

/** First step that still has errors, or -1. */
export function firstInvalidStep(state: ErpState, draft: ProjectDraft) {
  for (let index = 0; index < 6; index += 1) if (Object.keys(validateStep(state, draft, index)).length) return index;
  return -1;
}

export function existingCustomer(state: ErpState, name: string) {
  return state.customers.find((customer) => norm(customer.name) === norm(name)) ?? null;
}

export function existingPart(state: ErpState, number: string) {
  return state.parts.find((part) => normCode(part.number) === normCode(number)) ?? null;
}

/* ---------- Live data flow (derived from the draft, nothing is saved) ---------- */

export type FlowRecord = { key: string; label: string; detail?: string; status: "new" | "linked" };
export type FlowGroup = { module: ModuleKey; title: string; records: FlowRecord[] };

export function draftFlow(state: ErpState, draft: ProjectDraft): FlowGroup[] {
  const groups: FlowGroup[] = [];
  const partLabel = (key: string) => {
    const line = draft.lines.find((item) => item.key === key);
    return line ? `${normCode(line.partNumber) || "New part"} rev ${normCode(line.revision) || "?"}` : "";
  };
  if (draft.projectCode.trim() || draft.projectName.trim()) {
    groups.push({ module: "projects", title: "Projects", records: [{ key: "project", label: normCode(draft.projectCode) || "New project", detail: draft.projectName.trim() || "Name not set", status: "new" }] });
  }
  if (draft.customerName.trim()) {
    const existing = existingCustomer(state, draft.customerName);
    groups.push({ module: "crm", title: "CRM", records: [{ key: "customer", label: existing ? existing.name : draft.customerName.trim(), detail: existing ? "Existing customer · will be linked" : "New customer record", status: existing ? "linked" : "new" }] });
  }
  if (draft.poNumber.trim()) {
    const value = parseAmount(draft.orderValue);
    const detail = [draft.deliveryDate ? `Due ${formatDate(draft.deliveryDate)}` : "", value && !Number.isNaN(value) ? formatMoney(value, draft.currency) : ""].filter(Boolean).join(" · ");
    groups.push({ module: "sales", title: "Sales", records: [{ key: "po", label: normCode(draft.poNumber), detail: detail || "Purchase order", status: "new" }] });
  }
  const lines = draft.lines.filter((line) => line.partNumber.trim() || line.description.trim());
  if (lines.length) {
    groups.push({
      module: "parts", title: "Parts & revisions",
      records: lines.map((line) => {
        const existing = existingPart(state, line.partNumber);
        const revisionExists = existing && state.revisions.some((rev) => rev.partId === existing.id && normCode(rev.revision) === normCode(line.revision));
        return { key: line.key, label: `${normCode(line.partNumber) || "New part"} rev ${normCode(line.revision) || "?"}`, detail: `${line.description.trim() || "No description"} · ${line.quantity || 0} ${line.unit}${existing ? (revisionExists ? " · existing part" : " · new revision") : ""}`, status: existing ? "linked" : "new" };
      }),
    });
  }
  if (draft.documents.length) {
    groups.push({ module: "documents", title: "Documents", records: draft.documents.map((doc) => ({ key: doc.key, label: `${normCode(doc.number) || "Document"} rev ${normCode(doc.revision) || "?"}`, detail: [doc.type, doc.status, doc.partKey ? `→ ${partLabel(doc.partKey)}` : "→ Project"].join(" · "), status: "new" })) });
  }
  if (draft.inspections.length) {
    groups.push({ module: "quality", title: "Quality", records: draft.inspections.map((item) => ({ key: item.key, label: item.name.trim() || "Inspection parameter", detail: [item.spec.trim(), item.unit.trim(), item.partKey ? `→ ${partLabel(item.partKey)}` : "→ Project"].filter(Boolean).join(" · "), status: "new" })) });
  }
  if (draft.materials.length) {
    groups.push({ module: "materials", title: "Materials", records: draft.materials.map((item) => ({ key: item.key, label: item.material.trim() || "Material", detail: `${item.quantity || 0} ${item.unit}${item.lineKey ? ` → ${partLabel(item.lineKey)}` : ""}`, status: "new" })) });
    groups.push({ module: "procurement", title: "Procurement", records: draft.materials.map((item) => ({ key: `${item.key}-proc`, label: item.supplier.trim() || "Supplier to be chosen", detail: item.status, status: "new" })) });
  }
  return groups;
}

/* ---------- Commit the draft ---------- */

export function createProjectFromDraft(input: ErpState, draft: ProjectDraft, now: string): { state: ErpState; projectId: string } {
  const invalid = firstInvalidStep(input, draft);
  if (invalid !== -1) throw new Error(`Draft step ${invalid + 1} is incomplete.`);
  let state = input;
  let id: string;

  // Customer: reuse by name, never duplicate.
  let customer = existingCustomer(state, draft.customerName);
  if (!customer) {
    [id, state] = nextId(state, "cus");
    customer = { id, name: draft.customerName.trim().replace(/\s+/g, " "), contact: draft.contact.trim(), createdAt: now };
    state = { ...state, customers: [...state.customers, customer] };
    state = log(state, now, "crm", `Customer record created: ${customer.name}`, null);
  } else if (!customer.contact && draft.contact.trim()) {
    const updated = { ...customer, contact: draft.contact.trim() };
    state = { ...state, customers: state.customers.map((item) => item.id === updated.id ? updated : item) };
    customer = updated;
  }

  let projectId: string;
  [projectId, state] = nextId(state, "prj");
  let poId: string;
  [poId, state] = nextId(state, "po");
  const code = normCode(draft.projectCode);
  state = log(state, now, "projects", `Project ${code} created: ${draft.projectName.trim()}`, projectId);

  // Parts, revisions, line items.
  const lineIds = new Map<string, string>();
  const partIds = new Map<string, string>();
  const lineItems: LineItem[] = [];
  for (const line of draft.lines) {
    let part = existingPart(state, line.partNumber);
    if (!part) {
      [id, state] = nextId(state, "part");
      part = { id, number: normCode(line.partNumber), description: line.description.trim() };
      state = { ...state, parts: [...state.parts, part] };
      state = log(state, now, "parts", `Part ${part.number} created`, projectId);
    }
    const partId = part.id;
    let revision = state.revisions.find((rev) => rev.partId === partId && normCode(rev.revision) === normCode(line.revision));
    if (!revision) {
      [id, state] = nextId(state, "rev");
      revision = { id, partId, revision: normCode(line.revision), createdAt: now };
      state = { ...state, revisions: [...state.revisions, revision] };
      state = log(state, now, "parts", `Revision ${revision.revision} added to ${part.number}`, projectId);
    }
    [id, state] = nextId(state, "li");
    const price = parseAmount(line.unitPrice);
    lineItems.push({ id, projectId, purchaseOrderId: poId, partId, revisionId: revision.id, quantity: Number(line.quantity), unit: line.unit, unitPrice: price === null || Number.isNaN(price) ? null : round2(price) });
    lineIds.set(line.key, id);
    partIds.set(line.key, partId);
  }

  const lineTotal = lineItems.every((item) => item.unitPrice !== null) ? round2(lineItems.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.quantity, 0)) : null;
  const orderValue = parseAmount(draft.orderValue);
  const po: PurchaseOrder = { id: poId, number: normCode(draft.poNumber), customerId: customer.id, projectId, poDate: draft.poDate, deliveryDate: draft.deliveryDate, currency: draft.currency, value: orderValue !== null && !Number.isNaN(orderValue) ? round2(orderValue) : lineTotal, receivedAt: now };
  const project: Project = { id: projectId, code, name: draft.projectName.trim(), description: draft.description.trim(), customerId: customer.id, purchaseOrderIds: [poId], createdAt: now, isSample: false };
  state = { ...state, projects: [...state.projects, project], purchaseOrders: [...state.purchaseOrders, po], lineItems: [...state.lineItems, ...lineItems] };
  state = log(state, now, "sales", `Purchase order ${po.number} registered for ${customer.name}`, projectId);

  // Documents: link existing number+revision instead of duplicating.
  for (const doc of draft.documents) {
    const partId = doc.partKey ? partIds.get(doc.partKey) ?? null : null;
    const existing = state.documents.find((item) => normCode(item.number) === normCode(doc.number) && normCode(item.revision) === normCode(doc.revision));
    if (existing) {
      state = { ...state, documents: state.documents.map((item) => item.id === existing.id ? { ...item, projectIds: [...new Set([...item.projectIds, projectId])] } : item) };
      state = log(state, now, "documents", `Existing document ${existing.number} rev ${existing.revision} linked`, projectId);
      continue;
    }
    [id, state] = nextId(state, "doc");
    state = { ...state, documents: [...state.documents, { id, number: normCode(doc.number), name: doc.name.trim(), type: doc.type, revision: normCode(doc.revision), status: doc.status, source: doc.source, projectIds: [projectId], partId, updatedAt: now, ...(doc.file ? { file: doc.file } : {}) }] };
    state = log(state, now, "documents", `${doc.type} ${normCode(doc.number)} rev ${normCode(doc.revision)} added (${doc.status})`, projectId);
  }

  for (const item of draft.inspections) {
    [id, state] = nextId(state, "insp");
    state = { ...state, inspectionRequirements: [...state.inspectionRequirements, { id, projectId, partId: item.partKey ? partIds.get(item.partKey) ?? null : null, name: item.name.trim(), spec: item.spec.trim(), unit: item.unit.trim(), acceptance: item.acceptance.trim() }] };
  }
  if (draft.inspections.length) state = log(state, now, "quality", `${draft.inspections.length} inspection requirement${draft.inspections.length === 1 ? "" : "s"} defined`, projectId);

  for (const item of draft.materials) {
    let reqId: string;
    [reqId, state] = nextId(state, "mat");
    let procId: string;
    [procId, state] = nextId(state, "proc");
    state = {
      ...state,
      materialRequirements: [...state.materialRequirements, { id: reqId, projectId, lineItemId: item.lineKey ? lineIds.get(item.lineKey) ?? null : null, material: item.material.trim(), quantity: Number(item.quantity), unit: item.unit }],
      procurement: [...state.procurement, { id: procId, number: numberFor("PUR-2026-", state.procurement.map((record) => record.number), 101), requirementId: reqId, supplier: item.supplier.trim(), status: item.status, updatedAt: now }],
    };
    state = log(state, now, "materials", `Material requirement: ${Number(item.quantity)} ${item.unit} ${item.material.trim()} (${item.status})`, projectId);
  }

  return { state: { ...state, draft: null }, projectId };
}

/* ============================== Lookups ============================== */

export function projectRecords(state: ErpState, projectId: string) {
  const project = state.projects.find((item) => item.id === projectId) ?? null;
  const customer = project ? state.customers.find((item) => item.id === project.customerId) ?? null : null;
  const purchaseOrders = state.purchaseOrders.filter((item) => item.projectId === projectId);
  const lineItems = state.lineItems.filter((item) => item.projectId === projectId);
  const parts = lineItems.map((line) => state.parts.find((part) => part.id === line.partId)).filter((part): part is Part => Boolean(part));
  const documents = state.documents.filter((doc) => doc.projectIds.includes(projectId));
  const inspectionRequirements = state.inspectionRequirements.filter((item) => item.projectId === projectId);
  const materialRequirements = state.materialRequirements.filter((item) => item.projectId === projectId);
  const procurement = state.procurement.filter((record) => materialRequirements.some((req) => req.id === record.requirementId));
  const productionOrders = state.productionOrders.filter((item) => item.projectId === projectId);
  const inspectionReports = state.inspectionReports.filter((item) => item.projectId === projectId);
  const dispatches = state.dispatches.filter((item) => item.projectId === projectId);
  const invoices = state.invoices.filter((item) => item.projectId === projectId);
  return { project, customer, purchaseOrders, lineItems, parts, documents, inspectionRequirements, materialRequirements, procurement, productionOrders, inspectionReports, dispatches, invoices };
}

export function revisionLabel(state: ErpState, revisionId: string) {
  return state.revisions.find((rev) => rev.id === revisionId)?.revision ?? "?";
}

export function partNumber(state: ErpState, partId: string | null) {
  return partId ? state.parts.find((part) => part.id === partId)?.number ?? "?" : "";
}

/* ============================== Readiness rules ============================== */

export type ResolveAction =
  | { kind: "approve-document"; documentId: string; label: string }
  | { kind: "add-drawing"; lineItemId: string; label: string }
  | { kind: "advance-procurement"; procurementId: string; label: string }
  | { kind: "add-material"; lineItemId: string; label: string }
  | { kind: "add-inspection"; label: string }
  | { kind: "create-production-order"; lineItemId: string; label: string }
  | { kind: "advance-production"; productionOrderId: string; label: string }
  | { kind: "generate-inspection-report"; label: string }
  | { kind: "dispatch"; label: string }
  | { kind: "generate-invoice"; label: string };

export type ReadinessState = "complete" | "incomplete" | "blocked";
export type Reason = { text: string; action?: ResolveAction };
export type Readiness = { state: ReadinessState; summary: string; reasons: Reason[] };
export type ProjectReadiness = { engineering: Readiness; materials: Readiness; inspection: Readiness; production: Readiness; quality: Readiness; dispatch: Readiness; invoice: Readiness };

export const RULES = {
  engineering: "Every ordered part needs a drawing for the ordered revision. Approval can happen later, outside the guided flow.",
  materials: "Every ordered part needs a material requirement. Purchasing is a recommendation until the material is ordered and received.",
  inspection: "The project needs at least one inspection requirement.",
  production: "A production order can be created for any line item. A drawing that is not yet approved or material that is not yet received is shown as a warning.",
  quality: "An inspection report can be generated when all production orders are complete. It must pass.",
  dispatch: "An order can be dispatched only when production is complete and the inspection report has passed.",
  invoice: "The invoice is generated from the dispatched line items and their unit prices.",
} as const;

function drawingFor(state: ErpState, projectId: string, line: LineItem) {
  const revision = revisionLabel(state, line.revisionId);
  return state.documents.find((doc) => doc.type === "Drawing" && doc.partId === line.partId && normCode(doc.revision) === normCode(revision) && doc.projectIds.includes(projectId)) ?? null;
}

export function lineEngineeringReady(state: ErpState, projectId: string, line: LineItem) {
  return drawingFor(state, projectId, line)?.status === "Approved";
}

export function lineMaterialReady(state: ErpState, line: LineItem) {
  const requirements = state.materialRequirements.filter((req) => req.lineItemId === line.id || (req.lineItemId === null && req.projectId === line.projectId));
  if (!requirements.length) return false;
  return requirements.every((req) => state.procurement.find((record) => record.requirementId === req.id)?.status === "Received");
}

export function readiness(state: ErpState, projectId: string): ProjectReadiness {
  const records = projectRecords(state, projectId);
  const { lineItems } = records;

  // Engineering
  const engReasons: Reason[] = [];
  for (const line of lineItems) {
    const label = `${partNumber(state, line.partId)} rev ${revisionLabel(state, line.revisionId)}`;
    const drawing = drawingFor(state, projectId, line);
    if (!drawing) engReasons.push({ text: `No drawing linked to ${label}.`, action: { kind: "add-drawing", lineItemId: line.id, label: "Add drawing" } });
    else if (drawing.status !== "Approved") engReasons.push({ text: `Drawing ${drawing.number} rev ${drawing.revision} is ${drawing.status.toLowerCase()}.`, action: { kind: "approve-document", documentId: drawing.id, label: "Approve drawing" } });
  }
  const approvedDrawings = lineItems.length - engReasons.length;
  const engineering: Readiness = engReasons.length ? { state: engReasons.some((reason) => reason.action?.kind === "add-drawing") ? "blocked" : "incomplete", summary: `${approvedDrawings} of ${lineItems.length} drawings approved`, reasons: engReasons } : { state: "complete", summary: "All drawings approved", reasons: [] };

  // Materials
  const matReasons: Reason[] = [];
  for (const line of lineItems) {
    const requirements = state.materialRequirements.filter((req) => req.lineItemId === line.id || (req.lineItemId === null && req.projectId === projectId));
    if (!requirements.length) matReasons.push({ text: `No material requirement for ${partNumber(state, line.partId)}.`, action: { kind: "add-material", lineItemId: line.id, label: "Add material" } });
  }
  for (const req of records.materialRequirements) {
    const record = state.procurement.find((item) => item.requirementId === req.id);
    if (record && record.status !== "Received") matReasons.push({ text: `${req.material} is ${record.status.toLowerCase()}.`, action: { kind: "advance-procurement", procurementId: record.id, label: record.status === "Not ordered" ? "Place order" : "Mark received" } });
  }
  const materials: Readiness = matReasons.length ? { state: records.materialRequirements.length ? "incomplete" : "blocked", summary: `${records.procurement.filter((item) => item.status === "Received").length} of ${records.procurement.length} materials received`, reasons: matReasons } : { state: "complete", summary: "All material received", reasons: [] };

  // Inspection requirements
  const inspection: Readiness = records.inspectionRequirements.length
    ? { state: "complete", summary: `${records.inspectionRequirements.length} requirement${records.inspectionRequirements.length === 1 ? "" : "s"} defined`, reasons: [] }
    : { state: "incomplete", summary: "No requirements yet", reasons: [{ text: "Define at least one inspection requirement.", action: { kind: "add-inspection", label: "Add requirement" } }] };

  // Production
  const prodReasons: Reason[] = [];
  for (const line of lineItems) {
    const order = records.productionOrders.find((item) => item.lineItemId === line.id);
    const label = partNumber(state, line.partId);
    if (!order) {
      const warnings = [!lineEngineeringReady(state, projectId, line) ? "drawing not approved yet" : "", !lineMaterialReady(state, line) ? "material not received yet" : ""].filter(Boolean);
      prodReasons.push({ text: `${label} has no production order${warnings.length ? ` (${warnings.join(", ")})` : ""}.`, action: { kind: "create-production-order", lineItemId: line.id, label: "Create production order" } });
    } else if (!isProductionComplete(order.status)) {
      prodReasons.push({ text: `${order.number} (${label}) is ${order.status.toLowerCase()}.`, action: { kind: "advance-production", productionOrderId: order.id, label: "Update status" } });
    }
  }
  const completeOrders = records.productionOrders.filter((item) => isProductionComplete(item.status)).length;
  const productionDone = lineItems.length > 0 && !prodReasons.length;
  const production: Readiness = productionDone ? { state: "complete", summary: "All production complete", reasons: [] } : { state: records.productionOrders.length ? "incomplete" : "blocked", summary: `${completeOrders} of ${lineItems.length} complete`, reasons: prodReasons };

  // Quality
  const latestReport = records.inspectionReports[0] ?? null;
  let quality: Readiness;
  if (!records.inspectionRequirements.length) quality = { state: "blocked", summary: "No inspection requirements", reasons: [{ text: "Inspection requirements are needed before a report can be generated.", action: { kind: "add-inspection", label: "Add requirement" } }] };
  else if (!productionDone) quality = { state: "blocked", summary: "Waiting for production", reasons: [{ text: "The inspection report is generated after all production orders are complete." }] };
  else if (!latestReport) quality = { state: "incomplete", summary: "Report not generated", reasons: [{ text: "Production is complete. Generate the inspection report.", action: { kind: "generate-inspection-report", label: "Generate inspection report" } }] };
  else quality = latestReport.passed ? { state: "complete", summary: `${latestReport.number} passed`, reasons: [] } : { state: "blocked", summary: `${latestReport.number} failed`, reasons: [{ text: "The last inspection has a failed result. Inspect again after rework.", action: { kind: "generate-inspection-report", label: "Inspect again" } }] };

  // Dispatch
  const dispatched = records.dispatches[0] ?? null;
  let dispatch: Readiness;
  if (dispatched) dispatch = { state: "complete", summary: `Dispatched · ${dispatched.number}`, reasons: [] };
  else {
    const reasons: Reason[] = [];
    if (!productionDone) reasons.push({ text: "Production is not complete." });
    const short = lineItems.map((line) => {
      const order = records.productionOrders.find((item) => item.lineItemId === line.id);
      const produced = order ? producedQuantity(state, order) : line.quantity;
      return order && produced < line.quantity ? `${partNumber(state, line.partId)} ${produced} of ${line.quantity}` : "";
    }).filter(Boolean);
    if (short.length) reasons.push({ text: `Short quantity: ${short.join(", ")} produced. Produce the rest or change the ordered quantity first.` });
    if (quality.state !== "complete") reasons.push({ text: "The inspection report has not passed yet." });
    dispatch = reasons.length ? { state: "blocked", summary: "Not ready to dispatch", reasons } : { state: "incomplete", summary: "Ready to dispatch", reasons: [{ text: "All checks passed. The order can be dispatched.", action: { kind: "dispatch", label: "Dispatch order" } }] };
  }

  // Invoice
  const invoiceRecord = records.invoices[0] ?? null;
  let invoice: Readiness;
  if (invoiceRecord) invoice = { state: "complete", summary: `${invoiceRecord.number} issued`, reasons: [] };
  else if (!dispatched) invoice = { state: "blocked", summary: "After dispatch", reasons: [{ text: "The invoice is created after the order is dispatched." }] };
  else if (!canPrice(state, projectId)) invoice = { state: "blocked", summary: "Prices missing", reasons: [{ text: "Add unit prices on the line items, or an order value on the purchase order." }] };
  else invoice = { state: "incomplete", summary: "Ready to invoice", reasons: [{ text: "The order is dispatched. Generate the invoice.", action: { kind: "generate-invoice", label: "Generate invoice" } }] };

  return { engineering, materials, inspection, production, quality, dispatch, invoice };
}

export function documentCompleteness(state: ErpState, projectId: string) {
  const docs = state.documents.filter((doc) => doc.projectIds.includes(projectId));
  return { approved: docs.filter((doc) => doc.status === "Approved").length, total: docs.length };
}

export type ProjectStage = "Engineering" | "Procurement" | "Ready for production" | "In production" | "Quality" | "Ready to dispatch" | "Dispatched" | "Invoiced";

export function projectStage(state: ErpState, projectId: string): ProjectStage {
  const ready = readiness(state, projectId);
  if (ready.invoice.state === "complete") return "Invoiced";
  if (ready.dispatch.state === "complete") return "Dispatched";
  if (ready.production.state === "complete") return ready.quality.state === "complete" ? "Ready to dispatch" : "Quality";
  if (state.productionOrders.some((order) => order.projectId === projectId)) return "In production";
  if (ready.engineering.state !== "complete") return "Engineering";
  if (ready.materials.state !== "complete") return "Procurement";
  return "Ready for production";
}

export const STAGE_ORDER: ProjectStage[] = ["Engineering", "Procurement", "Ready for production", "In production", "Quality", "Ready to dispatch", "Dispatched", "Invoiced"];

/** A purchase order is "active" once operational work (production) has started and it has not shipped. */
export function isActiveOrder(state: ErpState, order: PurchaseOrder) {
  const stage = projectStage(state, order.projectId);
  return stage === "In production" || stage === "Quality" || stage === "Ready to dispatch";
}

export function orderOperationalState(state: ErpState, order: PurchaseOrder) {
  const stage = projectStage(state, order.projectId);
  const labels: Record<ProjectStage, string> = {
    Engineering: "Waiting for engineering approval", Procurement: "Scheduled · waiting for material", "Ready for production": "Scheduled · ready to start",
    "In production": "In production", Quality: "Final inspection", "Ready to dispatch": "Ready to dispatch", Dispatched: "Dispatched", Invoiced: "Dispatched · invoiced",
  };
  return labels[stage];
}

/* ============================== Actions ============================== */

export function touch<T extends { id: string }>(list: T[], id: string, change: (item: T) => T) {
  return list.map((item) => item.id === id ? change(item) : item);
}

export function approveDocument(state: ErpState, documentId: string, now: string): ErpState {
  const doc = state.documents.find((item) => item.id === documentId);
  if (!doc || doc.status === "Approved") return state;
  const approvedBy = currentUserName(state);
  const next = { ...state, documents: touch(state.documents, documentId, (item) => ({ ...item, status: "Approved" as DocStatus, updatedAt: now, approvedAt: now, ...(approvedBy ? { approvedBy } : {}) })) };
  return log(next, now, "documents", `${doc.type} ${doc.number} rev ${doc.revision} approved`, doc.projectIds[0] ?? null);
}

export function setDocumentStatus(state: ErpState, documentId: string, status: DocStatus, now: string): ErpState {
  const doc = state.documents.find((item) => item.id === documentId);
  if (!doc || doc.status === status) return state;
  if (status === "Approved") return approveDocument(state, documentId, now);
  const next = { ...state, documents: touch(state.documents, documentId, (item) => ({ ...item, status, updatedAt: now, approvedBy: undefined, approvedAt: undefined })) };
  return log(next, now, "documents", `${doc.number} rev ${doc.revision} set to ${status.toLowerCase()}`, doc.projectIds[0] ?? null);
}

export function addDrawingForLine(state: ErpState, lineItemId: string, now: string): ErpState {
  const line = state.lineItems.find((item) => item.id === lineItemId);
  if (!line) return state;
  const number = partNumber(state, line.partId);
  const revision = revisionLabel(state, line.revisionId);
  const existing = state.documents.find((doc) => doc.type === "Drawing" && doc.partId === line.partId && doc.revision === revision);
  if (existing) {
    if (existing.projectIds.includes(line.projectId)) return state;
    return log({ ...state, documents: touch(state.documents, existing.id, (doc) => ({ ...doc, projectIds: [...doc.projectIds, line.projectId] })) }, now, "documents", `Drawing ${existing.number} linked`, line.projectId);
  }
  let id: string;
  let next: ErpState;
  [id, next] = nextId(state, "doc");
  const docNumber = `DRW-${number}`;
  next = { ...next, documents: [...next.documents, { id, number: docNumber, name: `${state.parts.find((part) => part.id === line.partId)?.description ?? number} drawing`, type: "Drawing", revision, status: "In review", source: "metadata", projectIds: [line.projectId], partId: line.partId, updatedAt: now }] };
  return log(next, now, "documents", `Drawing ${docNumber} rev ${revision} added for review`, line.projectId);
}

export function addDocumentToProject(state: ErpState, projectId: string, input: { name: string; type: DocType; number: string; revision: string; partId: string | null; status: DocStatus; file?: StoredFile }, now: string): ErpState {
  const number = normCode(input.number);
  const revision = normCode(input.revision);
  if (!number || !input.name.trim() || !REVISION_PATTERN.test(revision)) return state;
  const existing = state.documents.find((doc) => normCode(doc.number) === number && normCode(doc.revision) === revision);
  if (existing) {
    if (existing.projectIds.includes(projectId)) return state;
    return log({ ...state, documents: touch(state.documents, existing.id, (doc) => ({ ...doc, projectIds: [...doc.projectIds, projectId] })) }, now, "documents", `Document ${existing.number} linked`, projectId);
  }
  let id: string;
  let next: ErpState;
  [id, next] = nextId(state, "doc");
  next = { ...next, documents: [...next.documents, { id, number, name: input.name.trim(), type: input.type, revision, status: input.status, source: input.file ? "upload" : "metadata", projectIds: [projectId], partId: input.partId, updatedAt: now, ...(input.file ? { file: input.file } : {}) }] };
  return log(next, now, "documents", `${input.type} ${number} rev ${revision} added (${input.status})`, projectId);
}

export function advanceProcurement(state: ErpState, procurementId: string, now: string): ErpState {
  const record = state.procurement.find((item) => item.id === procurementId);
  if (!record || record.status === "Received") return state;
  const status: ProcurementStatus = record.status === "Not ordered" ? "Ordered" : "Received";
  const req = state.materialRequirements.find((item) => item.id === record.requirementId);
  let next: ErpState = { ...state, procurement: touch(state.procurement, procurementId, (item) => ({ ...item, status, supplier: item.supplier || "Supplier (demo)", updatedAt: now })) };
  if (status === "Received" && req) {
    next = upsertRawMaterial(next, req.material, { unit: req.unit });
    next = { ...next, rawMaterials: next.rawMaterials.map((item) => norm(item.name) === norm(req.material) ? { ...item, stock: round2(item.stock + req.quantity) } : item) };
  }
  return log(next, now, "procurement", `${record.number}: ${req?.material ?? "material"} ${status === "Ordered" ? "ordered" : "received"}`, req?.projectId ?? null);
}

export function addMaterialRequirement(state: ErpState, projectId: string, input: { lineItemId: string | null; material: string; quantity: number; unit: string; supplier: string }, now: string): ErpState {
  if (!input.material.trim() || !(input.quantity > 0)) return state;
  let reqId: string;
  let procId: string;
  let next: ErpState;
  [reqId, next] = nextId(state, "mat");
  [procId, next] = nextId(next, "proc");
  next = {
    ...next,
    materialRequirements: [...next.materialRequirements, { id: reqId, projectId, lineItemId: input.lineItemId, material: input.material.trim(), quantity: input.quantity, unit: input.unit }],
    procurement: [...next.procurement, { id: procId, number: numberFor("PUR-2026-", next.procurement.map((record) => record.number), 101), requirementId: reqId, supplier: input.supplier.trim(), status: "Not ordered", updatedAt: now }],
  };
  return log(next, now, "materials", `Material requirement added: ${input.quantity} ${input.unit} ${input.material.trim()}`, projectId);
}

export function addInspectionRequirement(state: ErpState, projectId: string, input: { partId: string | null; name: string; spec: string; unit: string; acceptance: string }, now: string): ErpState {
  if (!input.name.trim() || !input.spec.trim()) return state;
  let id: string;
  let next: ErpState;
  [id, next] = nextId(state, "insp");
  next = { ...next, inspectionRequirements: [...next.inspectionRequirements, { id, projectId, partId: input.partId, name: input.name.trim(), spec: input.spec.trim(), unit: input.unit.trim(), acceptance: input.acceptance.trim() }] };
  return log(next, now, "quality", `Inspection requirement added: ${input.name.trim()}`, projectId);
}

export function createProductionOrder(state: ErpState, lineItemId: string, now: string, details: { quantity?: number; startDate?: string; notes?: string } = {}): ErpState {
  const line = state.lineItems.find((item) => item.id === lineItemId);
  if (!line) return state;
  if (state.productionOrders.some((order) => order.lineItemId === lineItemId)) return state;
  const quantity = details.quantity !== undefined ? details.quantity : line.quantity;
  if (!Number.isInteger(quantity) || quantity <= 0) return state;
  let id: string;
  let next: ErpState;
  [id, next] = nextId(state, "mo");
  const number = numberFor("MO-2026-", next.productionOrders.map((order) => order.number), 201);
  next = { ...next, productionOrders: [...next.productionOrders, { id, number, projectId: line.projectId, lineItemId, partId: line.partId, revisionId: line.revisionId, quantity, status: "Planned", createdAt: now, ...(details.startDate ? { startDate: details.startDate } : {}), ...(details.notes?.trim() ? { notes: details.notes.trim() } : {}) }] };
  return log(next, now, "production", `Production order ${number} created for ${quantity} × ${partNumber(state, line.partId)} rev ${revisionLabel(state, line.revisionId)}`, line.projectId);
}

export function advanceProduction(state: ErpState, productionOrderId: string, now: string): ErpState {
  const order = state.productionOrders.find((item) => item.id === productionOrderId);
  if (!order || isProductionComplete(order.status)) return state;
  const status: ProductionStatus = order.status === "Planned" ? "Running" : "Completed";
  const next = { ...state, productionOrders: touch(state.productionOrders, productionOrderId, (item) => ({ ...item, status })) };
  return issueMaterial(log(next, now, "production", `${order.number} ${isProductionComplete(status) ? "completed" : "started"}`, order.projectId), productionOrderId, now);
}

/** Good quantity at the last operation when the shop floor recorded it, otherwise the order quantity. */
export function producedQuantity(state: ErpState, order: ProductionOrder) {
  const routing = order.routing ?? [];
  if (!routing.length) return order.quantity;
  const last = Math.max(...routing.map((op) => op.seq));
  const logs = (state.opLogs ?? []).filter((entry) => entry.orderId === order.id && entry.seq === last);
  return logs.length ? logs.reduce((sum, entry) => sum + entry.qtyGood, 0) : order.quantity;
}

/**
 * Takes the order's material out of raw material stock once, when production starts.
 * Shortages are logged instead of driving stock below zero.
 */
export function issueMaterial(state: ErpState, orderId: string, now: string): ErpState {
  const order = state.productionOrders.find((item) => item.id === orderId);
  if (!order || order.materialIssuedAt || order.status === "Planned") return state;
  const reqs = state.materialRequirements.filter((req) => req.lineItemId === order.lineItemId);
  let next: ErpState = { ...state, productionOrders: touch(state.productionOrders, orderId, (item) => ({ ...item, materialIssuedAt: now })) };
  if (!reqs.length) return next;
  const notes: string[] = [];
  for (const req of reqs) {
    const raw = rawMaterialFor(next, req.material);
    const take = raw ? Math.min(raw.stock, req.quantity) : 0;
    if (raw && take > 0) next = { ...next, rawMaterials: touch(next.rawMaterials, raw.id, (item) => ({ ...item, stock: round2(item.stock - take) })) };
    if (take < req.quantity) notes.push(`${req.material} ${round2(req.quantity - take)} ${req.unit} short`);
  }
  return log(next, now, "materials", `Material issued to ${order.number}${notes.length ? ` · ${notes.join("; ")}` : ""}`, order.projectId);
}

export function generateInspectionReport(state: ErpState, projectId: string, now: string, measured: Record<string, { observed: string; pass: boolean }> = {}): ErpState {
  const ready = readiness(state, projectId);
  if (ready.production.state !== "complete" || ready.inspection.state !== "complete") return state;
  const records = projectRecords(state, projectId);
  let id: string;
  let next: ErpState;
  [id, next] = nextId(state, "rep");
  const number = numberFor("IR-2026-", next.inspectionReports.map((report) => report.number), 301);
  const results: InspectionResult[] = records.inspectionRequirements.map((req) => {
    const entry = measured[req.id];
    const observed = entry?.observed.trim() ? `${entry.observed.trim()}${req.unit && !entry.observed.includes(req.unit) ? ` ${req.unit}` : ""}` : `Within specification (${req.spec}${req.unit ? ` ${req.unit}` : ""})`;
    return { requirementId: req.id, observed, pass: entry ? entry.pass : true };
  });
  const report: InspectionReport = { id, number, projectId, productionOrderIds: records.productionOrders.map((order) => order.id), results, passed: results.every((result) => result.pass), createdAt: now };
  next = { ...next, inspectionReports: [report, ...next.inspectionReports] };
  return log(next, now, "quality", `Final inspection ${number} recorded · ${results.filter((result) => result.pass).length} of ${results.length} passed`, projectId);
}

export function dispatchProject(state: ErpState, projectId: string, now: string): ErpState {
  const ready = readiness(state, projectId);
  if (ready.dispatch.state !== "incomplete" || !ready.dispatch.reasons.some((reason) => reason.action?.kind === "dispatch")) return state;
  const order = state.purchaseOrders.find((item) => item.projectId === projectId);
  if (!order) return state;
  let id: string;
  let next: ErpState;
  [id, next] = nextId(state, "dsp");
  const number = numberFor("DN-2026-", next.dispatches.map((item) => item.number), 401);
  next = { ...next, dispatches: [...next.dispatches, { id, number, projectId, purchaseOrderId: order.id, dispatchedAt: now }] };
  return log(next, now, "dispatch", `Dispatched with delivery note ${number}`, projectId);
}

function canPrice(state: ErpState, projectId: string) {
  const lines = state.lineItems.filter((item) => item.projectId === projectId);
  const order = state.purchaseOrders.find((item) => item.projectId === projectId);
  return lines.every((line) => line.unitPrice !== null) || (order?.value ?? null) !== null;
}

export function invoiceLines(state: ErpState, projectId: string): InvoiceLine[] {
  const lines = state.lineItems.filter((item) => item.projectId === projectId);
  const order = state.purchaseOrders.find((item) => item.projectId === projectId);
  if (lines.length && lines.every((line) => line.unitPrice !== null)) {
    return lines.map((line) => {
      const part = state.parts.find((item) => item.id === line.partId);
      return { description: `${part?.number ?? ""} rev ${revisionLabel(state, line.revisionId)} · ${part?.description ?? ""}`, quantity: line.quantity, unit: line.unit, unitPrice: line.unitPrice ?? 0, amount: round2((line.unitPrice ?? 0) * line.quantity) };
    });
  }
  if (order && order.value !== null) return [{ description: `Purchase order ${order.number}`, quantity: 1, unit: "order", unitPrice: order.value, amount: order.value }];
  return [];
}

export function generateInvoice(state: ErpState, projectId: string, now: string): ErpState {
  const ready = readiness(state, projectId);
  if (ready.invoice.state !== "incomplete") return state;
  const project = state.projects.find((item) => item.id === projectId);
  const order = state.purchaseOrders.find((item) => item.projectId === projectId);
  if (!project || !order) return state;
  const lines = invoiceLines(state, projectId);
  const subtotal = round2(lines.reduce((sum, line) => sum + line.amount, 0));
  const tax = round2((subtotal * state.settings.taxRate) / 100);
  let id: string;
  let next: ErpState;
  [id, next] = nextId(state, "inv");
  const number = numberFor("INV-2026-", next.invoices.map((item) => item.number), 501);
  const issuedAt = now.slice(0, 10);
  next = { ...next, invoices: [...next.invoices, { id, number, projectId, purchaseOrderId: order.id, customerId: project.customerId, currency: order.currency, lines, subtotal, taxRate: state.settings.taxRate, tax, total: round2(subtotal + tax), issuedAt, dueAt: addDays(issuedAt, state.settings.paymentTermsDays) }] };
  return log(next, now, "finance", `Invoice ${number} generated · ${formatMoney(round2(subtotal + tax), order.currency)}`, projectId);
}

export function setLineItemPrice(state: ErpState, lineItemId: string, price: number, now: string): ErpState {
  const line = state.lineItems.find((item) => item.id === lineItemId);
  if (!line || !(price >= 0)) return state;
  const next = recalcOrderValue({ ...state, lineItems: touch(state.lineItems, lineItemId, (item) => ({ ...item, unitPrice: round2(price) })) }, line.projectId);
  return log(next, now, "sales", `Unit price set for ${partNumber(state, line.partId)}`, line.projectId);
}

/** Keeps the purchase order value in line with priced line items. */
function recalcOrderValue(state: ErpState, projectId: string): ErpState {
  const lines = state.lineItems.filter((item) => item.projectId === projectId);
  if (!lines.length || lines.some((item) => item.unitPrice === null)) return state;
  const value = round2(lines.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.quantity, 0));
  return { ...state, purchaseOrders: state.purchaseOrders.map((order) => order.projectId === projectId ? { ...order, value } : order) };
}

export function setLineItemQuantity(state: ErpState, lineItemId: string, quantity: number, now: string): ErpState {
  const line = state.lineItems.find((item) => item.id === lineItemId);
  if (!line || !Number.isInteger(quantity) || quantity <= 0 || line.quantity === quantity) return state;
  if (state.dispatches.some((item) => item.projectId === line.projectId)) return state;
  const next = recalcOrderValue({ ...state, lineItems: touch(state.lineItems, lineItemId, (item) => ({ ...item, quantity })) }, line.projectId);
  return log(next, now, "sales", `Quantity for ${partNumber(state, line.partId)} changed to ${quantity}`, line.projectId);
}

/* ---------- Editing records later, from their tabs ---------- */

const clean = (value: string | undefined) => (value ?? "").trim();

export function setProductionStatus(state: ErpState, orderId: string, status: string, now: string): ErpState {
  const order = state.productionOrders.find((item) => item.id === orderId);
  const value = clean(status).slice(0, 40);
  if (!order || !value || order.status === value) return state;
  const next = { ...state, productionOrders: touch(state.productionOrders, orderId, (item) => ({ ...item, status: value })) };
  return issueMaterial(log(next, now, "production", `${order.number} status: ${value}`, order.projectId), orderId, now);
}

export function updateProductionOrder(state: ErpState, orderId: string, input: { quantity: number; startDate: string; notes: string; status: string }, now: string): ErpState {
  const order = state.productionOrders.find((item) => item.id === orderId);
  if (!order || !Number.isInteger(input.quantity) || input.quantity <= 0 || !clean(input.status)) return state;
  const next = { ...state, productionOrders: touch(state.productionOrders, orderId, (item) => ({ ...item, quantity: input.quantity, startDate: input.startDate || undefined, notes: clean(input.notes) || undefined, status: clean(input.status).slice(0, 40) })) };
  return issueMaterial(log(next, now, "production", `${order.number} updated`, order.projectId), orderId, now);
}

export function updateCustomer(state: ErpState, customerId: string, input: { name: string; contact: string }, now: string): ErpState {
  const customer = state.customers.find((item) => item.id === customerId);
  const name = clean(input.name).replace(/\s+/g, " ");
  if (!customer || !name) return state;
  if (state.customers.some((item) => item.id !== customerId && norm(item.name) === norm(name))) return state;
  const next = { ...state, customers: touch(state.customers, customerId, (item) => ({ ...item, name, contact: clean(input.contact) })) };
  return log(next, now, "crm", `Customer ${name} updated`, state.projects.find((project) => project.customerId === customerId)?.id ?? null);
}

export function updateProject(state: ErpState, projectId: string, input: { name: string; description: string }, now: string): ErpState {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project || !clean(input.name)) return state;
  const next = { ...state, projects: touch(state.projects, projectId, (item) => ({ ...item, name: clean(input.name), description: clean(input.description) })) };
  return log(next, now, "projects", `Project ${project.code} updated`, projectId);
}

export function updatePurchaseOrder(state: ErpState, orderId: string, input: { number: string; deliveryDate: string }, now: string): ErpState {
  const order = state.purchaseOrders.find((item) => item.id === orderId);
  const number = normCode(input.number);
  if (!order || !CODE_PATTERN.test(number) || !input.deliveryDate || input.deliveryDate < order.poDate) return state;
  if (state.purchaseOrders.some((item) => item.id !== orderId && normCode(item.number) === number)) return state;
  const next = { ...state, purchaseOrders: touch(state.purchaseOrders, orderId, (item) => ({ ...item, number, deliveryDate: input.deliveryDate })) };
  return log(next, now, "sales", `Purchase order ${number} updated`, order.projectId);
}

export function updatePart(state: ErpState, partId: string, input: { description: string }, now: string): ErpState {
  const part = state.parts.find((item) => item.id === partId);
  if (!part || !clean(input.description)) return state;
  const next = { ...state, parts: touch(state.parts, partId, (item) => ({ ...item, description: clean(input.description) })) };
  return log(next, now, "parts", `Part ${part.number} updated`, null);
}

export function updateDocument(state: ErpState, documentId: string, input: { name: string; number: string; revision: string; file?: StoredFile | null }, now: string): ErpState {
  const doc = state.documents.find((item) => item.id === documentId);
  const number = normCode(input.number);
  const revision = normCode(input.revision);
  if (!doc || !clean(input.name) || !number || !REVISION_PATTERN.test(revision)) return state;
  if (state.documents.some((item) => item.id !== documentId && normCode(item.number) === number && normCode(item.revision) === revision)) return state;
  const fileChange = input.file === undefined ? {} : input.file === null ? { file: undefined } : { file: input.file, source: "upload" as DocSource };
  const changedContent = number !== doc.number || revision !== doc.revision || input.file !== undefined;
  const next = { ...state, documents: touch(state.documents, documentId, (item) => ({ ...item, name: clean(input.name), number, revision, ...fileChange, status: changedContent && item.status === "Approved" ? "In review" as DocStatus : item.status, updatedAt: now })) };
  return log(next, now, "documents", `${number} rev ${revision} updated${changedContent && doc.status === "Approved" ? " · back to review" : ""}`, doc.projectIds[0] ?? null);
}

export function updateMaterial(state: ErpState, requirementId: string, input: { material: string; quantity: number; unit: string; supplier: string }, now: string): ErpState {
  const req = state.materialRequirements.find((item) => item.id === requirementId);
  if (!req || !clean(input.material) || !(input.quantity > 0)) return state;
  const next = {
    ...state,
    materialRequirements: touch(state.materialRequirements, requirementId, (item) => ({ ...item, material: clean(input.material), quantity: input.quantity, unit: input.unit })),
    procurement: state.procurement.map((record) => record.requirementId === requirementId ? { ...record, supplier: clean(input.supplier), updatedAt: now } : record),
  };
  return log(next, now, "materials", `Material ${clean(input.material)} updated`, req.projectId);
}

export function updateInspectionRequirement(state: ErpState, requirementId: string, input: { name: string; spec: string; unit: string }, now: string): ErpState {
  const req = state.inspectionRequirements.find((item) => item.id === requirementId);
  if (!req || !clean(input.name) || !clean(input.spec)) return state;
  const next = { ...state, inspectionRequirements: touch(state.inspectionRequirements, requirementId, (item) => ({ ...item, name: clean(input.name), spec: clean(input.spec), unit: clean(input.unit) })) };
  return log(next, now, "quality", `Inspection parameter ${clean(input.name)} updated`, req.projectId);
}

export function removeInspectionRequirement(state: ErpState, requirementId: string, now: string): ErpState {
  const req = state.inspectionRequirements.find((item) => item.id === requirementId);
  if (!req) return state;
  const next = { ...state, inspectionRequirements: state.inspectionRequirements.filter((item) => item.id !== requirementId) };
  return log(next, now, "quality", `Inspection parameter ${req.name} removed`, req.projectId);
}

/** Values already used anywhere (other projects or earlier parts in the draft), offered as dropdowns for reuse. */
export function reuseCatalog(state: ErpState, draft: ProjectDraft | null) {
  const uniq = <T,>(items: T[], key: (item: T) => string) => { const seen = new Set<string>(); return items.filter((item) => { const k = key(item); if (!k || seen.has(k)) return false; seen.add(k); return true; }); };
  const lines = draft?.lines ?? [];
  const parts = uniq([
    ...state.parts.map((part) => ({ number: part.number, description: part.description, revision: state.revisions.filter((rev) => rev.partId === part.id).at(-1)?.revision ?? "A" })),
    ...lines.map((line) => ({ number: normCode(line.partNumber), description: line.description.trim(), revision: normCode(line.revision) })),
  ], (item) => item.number);
  const drawings = uniq([
    ...state.documents.filter((doc) => doc.type === "Drawing").map((doc) => ({ number: doc.number, revision: doc.revision, name: doc.name, file: doc.file?.name ?? "" })),
    ...(draft?.documents ?? []).filter((doc) => doc.type === "Drawing").map((doc) => ({ number: normCode(doc.number), revision: normCode(doc.revision), name: doc.name, file: doc.file?.name ?? "" })),
  ], (item) => `${item.number}|${item.revision}`);
  const supplierFor = (reqId: string) => state.procurement.find((record) => record.requirementId === reqId)?.supplier ?? "";
  const materials = uniq([
    ...state.materialRequirements.map((req) => ({ material: req.material, unit: req.unit, supplier: supplierFor(req.id) })),
    ...(draft?.materials ?? []).map((item) => ({ material: item.material.trim(), unit: item.unit, supplier: item.supplier.trim() })),
  ], (item) => item.material.toLowerCase());
  const parameters = uniq([
    ...state.inspectionRequirements.map((req) => ({ name: req.name, spec: req.spec, unit: req.unit })),
    ...(draft?.inspections ?? []).map((item) => ({ name: item.name.trim(), spec: item.spec.trim(), unit: item.unit.trim() })),
  ], (item) => `${item.name.toLowerCase()}|${item.spec}`);
  const suppliers = uniq(materials.map((item) => item.supplier).filter(Boolean).map((name) => ({ name })), (item) => item.name.toLowerCase()).map((item) => item.name);
  return { parts, drawings, materials, parameters, suppliers };
}

export function updateSettings(state: ErpState, settings: Partial<Settings>): ErpState {
  return { ...state, settings: { ...state.settings, ...settings } };
}

/** Runs a readiness "resolve" action. Returns the same state if the action is not allowed. */
export function resolve(state: ErpState, projectId: string, action: ResolveAction, now: string): ErpState {
  switch (action.kind) {
    case "approve-document": return approveDocument(state, action.documentId, now);
    case "add-drawing": return addDrawingForLine(state, action.lineItemId, now);
    case "advance-procurement": return advanceProcurement(state, action.procurementId, now);
    case "create-production-order": return createProductionOrder(state, action.lineItemId, now);
    case "advance-production": return advanceProduction(state, action.productionOrderId, now);
    case "generate-inspection-report": return generateInspectionReport(state, projectId, now);
    case "dispatch": return dispatchProject(state, projectId, now);
    case "generate-invoice": return generateInvoice(state, projectId, now);
    case "add-material":
    case "add-inspection":
      return state; // These open a small form in the UI instead.
  }
}

/* ============================== Sample data ============================== */

export const SAMPLE_PROJECT_CODE = "BOH-PRJ-2026-001";

/** Loads the fictional sample customer with three purchase orders in different states. Idempotent. */
export function loadSample(input: ErpState, now: string): { state: ErpState; projectId: string } {
  const existing = input.projects.find((project) => project.isSample && project.name === "Hydraulic Actuator Assembly");
  if (existing) return { state: input, projectId: existing.id };
  let state = input;
  const sampleDrafts: ProjectDraft[] = [
    {
      step: 6, projectName: "Hydraulic Actuator Assembly", projectCode: SAMPLE_PROJECT_CODE, poNumber: "PO-2026-1042", description: "Fictional sample: housings and piston rods for a hydraulic actuator assembly.",
      customerName: "Kessler Maschinenbau GmbH", contact: "procurement@kessler-maschinenbau.example", poDate: "2026-10-05", deliveryDate: "2026-11-27", currency: "EUR", orderValue: "",
      lines: [
        { key: "l1", partNumber: "ACT-204", description: "Hydraulic Actuator Housing", quantity: "50", unit: "pcs", unitPrice: "184.00", revision: "A" },
        { key: "l2", partNumber: "ACT-205", description: "Piston Rod", quantity: "50", unit: "pcs", unitPrice: "96.50", revision: "B" },
      ],
      documents: [
        { key: "d1", name: "Actuator housing drawing", type: "Drawing", number: "DRW-ACT-204", revision: "A", partKey: "l1", status: "Approved", source: "sample" },
        { key: "d2", name: "Piston rod drawing", type: "Drawing", number: "DRW-ACT-205", revision: "B", partKey: "l2", status: "Approved", source: "sample" },
        { key: "d3", name: "Actuator assembly specification", type: "Specification", number: "SPEC-ACT-200", revision: "A", partKey: "", status: "Approved", source: "sample" },
        { key: "d4", name: "Housing inspection plan", type: "Inspection plan", number: "IP-ACT-204", revision: "A", partKey: "l1", status: "Approved", source: "sample" },
      ],
      inspections: [
        { key: "i1", name: "Outer diameter", spec: "63.50 ± 0.05", unit: "mm", acceptance: "All measured parts within tolerance", partKey: "l1" },
        { key: "i2", name: "Bore diameter", spec: "40.00 H8", unit: "mm", acceptance: "Go / no-go gauge", partKey: "l1" },
        { key: "i3", name: "Surface finish", spec: "Ra ≤ 0.8", unit: "µm", acceptance: "Profilometer, 3 readings", partKey: "l2" },
        { key: "i4", name: "Material grade", spec: "EN AW-7075-T6", unit: "", acceptance: "Mill certificate 3.1 on file", partKey: "l1" },
      ],
      materials: [
        { key: "m1", material: "EN AW-7075-T6 round bar Ø70 mm", quantity: "42", unit: "kg", supplier: "Northline Metals (Demo)", status: "Received", lineKey: "l1" },
        { key: "m2", material: "42CrMo4 chrome-plated bar Ø25 mm", quantity: "28", unit: "kg", supplier: "Kestrel Alloys (Demo)", status: "Received", lineKey: "l2" },
      ],
    },
    {
      step: 6, projectName: "Valve Block Machining", projectCode: "BOH-PRJ-2026-002", poNumber: "PO-2026-1057", description: "Fictional sample: waiting for engineering approval.",
      customerName: "Kessler Maschinenbau GmbH", contact: "", poDate: "2026-10-19", deliveryDate: "2026-12-11", currency: "EUR", orderValue: "",
      lines: [{ key: "l1", partNumber: "VB-310", description: "Valve Block", quantity: "20", unit: "pcs", unitPrice: "142.00", revision: "C" }],
      documents: [{ key: "d1", name: "Valve block drawing", type: "Drawing", number: "DRW-VB-310", revision: "C", partKey: "l1", status: "In review", source: "sample" }],
      inspections: [{ key: "i1", name: "Port position", spec: "± 0.10", unit: "mm", acceptance: "CMM report", partKey: "l1" }],
      materials: [{ key: "m1", material: "EN AW-6082-T6 block 120 × 80 mm", quantity: "36", unit: "kg", supplier: "Northline Metals (Demo)", status: "Ordered", lineKey: "l1" }],
    },
    {
      step: 6, projectName: "Pump Mounting Flange", projectCode: "BOH-PRJ-2026-003", poNumber: "PO-2026-1063", description: "Fictional sample: scheduled for a later delivery.",
      customerName: "Kessler Maschinenbau GmbH", contact: "", poDate: "2026-10-23", deliveryDate: "2027-02-05", currency: "EUR", orderValue: "",
      lines: [{ key: "l1", partNumber: "PMF-118", description: "Pump Mounting Flange", quantity: "120", unit: "pcs", unitPrice: "38.40", revision: "A" }],
      documents: [{ key: "d1", name: "Flange drawing", type: "Drawing", number: "DRW-PMF-118", revision: "A", partKey: "l1", status: "Approved", source: "sample" }],
      inspections: [{ key: "i1", name: "Flatness", spec: "≤ 0.05", unit: "mm", acceptance: "Surface plate check", partKey: "l1" }],
      materials: [{ key: "m1", material: "S355 steel plate 20 mm", quantity: "160", unit: "kg", supplier: "", status: "Not ordered", lineKey: "l1" }],
    },
  ];
  const ids: string[] = [];
  for (const sample of sampleDrafts) {
    // Never collide with a visitor's own project ID or PO number.
    const draft = { ...sample };
    if (state.projects.some((project) => project.code === draft.projectCode)) draft.projectCode = suggestProjectCode(state);
    let poNumber = Number(draft.poNumber.slice(-4));
    while (state.purchaseOrders.some((order) => order.number === `PO-2026-${poNumber}`)) poNumber += 1;
    draft.poNumber = `PO-2026-${poNumber}`;
    const result = createProjectFromDraft(state, draft, now);
    state = result.state;
    ids.push(result.projectId);
  }
  // Mark them as sample and put the main project in production: housing complete, piston rod in progress.
  state = { ...state, projects: state.projects.map((project) => ids.includes(project.id) ? { ...project, isSample: true } : project) };
  const mainLines = state.lineItems.filter((line) => line.projectId === ids[0]);
  for (const line of mainLines) state = createProductionOrder(state, line.id, now);
  const [housingOrder, rodOrder] = state.productionOrders.filter((order) => order.projectId === ids[0]);
  if (housingOrder) { state = advanceProduction(state, housingOrder.id, now); state = advanceProduction(state, housingOrder.id, now); }
  if (rodOrder) state = advanceProduction(state, rodOrder.id, now);
  state = log(state, now, "projects", "Sample data loaded: Kessler Maschinenbau GmbH with three purchase orders", ids[0]);
  return { state, projectId: ids[0] };
}

/* ============================== Persistence ============================== */

export const STORAGE_KEY = "boh-erp-demo-v2";

export function parseStoredState(raw: string | null): ErpState {
  if (!raw) return createInitialState();
  try {
    const parsed = JSON.parse(raw) as Partial<ErpState>;
    if (parsed && parsed.version === 2 && Array.isArray(parsed.projects) && Array.isArray(parsed.activity) && typeof parsed.seq === "number") {
      const base = createInitialState();
      const stored = (parsed.settings ?? {}) as Partial<Settings>;
      const tabs = Array.isArray(stored.tabs) ? stored.tabs.filter((tab) => DEFAULT_TABS.some((item) => item.key === tab.key)) : [];
      const widgets = Array.isArray(stored.widgets) ? stored.widgets.filter((widget) => DEFAULT_WIDGETS.some((item) => item.key === widget.key)) : [];
      const settings: Settings = {
        ...base.settings, ...stored,
        ui: migrateUi(stored.ui),
        industry: INDUSTRY_KEYS.includes(stored.industry as Industry) ? stored.industry as Industry : "manufacturing",
        tabs: mergeTabs(tabs),
        widgets: [...widgets, ...DEFAULT_WIDGETS.filter((item) => !widgets.some((widget) => widget.key === item.key)).map((widget) => ({ ...widget }))],
        customFields: Array.isArray(stored.customFields) ? stored.customFields : [],
        docTypes: Array.isArray(stored.docTypes) ? stored.docTypes : [],
      };
      return { ...base, ...parsed, settings } as ErpState;
    }
  } catch {
    /* fall through */
  }
  return createInitialState();
}


/* ============================== Suppliers, raw materials, finance, configuration ============================== */

export function docTypes(state: ErpState): string[] {
  return [...DOC_TYPES, ...state.settings.docTypes.filter((type) => !DOC_TYPES.includes(type))];
}

/** Every supplier: saved records plus names used on purchases that have no record yet. */
export function supplierRows(state: ErpState): Supplier[] {
  const rows = [...state.suppliers];
  for (const record of state.procurement) {
    const name = record.supplier.trim();
    if (name && !rows.some((item) => norm(item.name) === norm(name))) rows.push({ id: `virtual:${name}`, name, contact: "", email: "", leadTimeDays: null, createdAt: record.updatedAt });
  }
  return rows;
}

/** Every raw material: saved records plus materials used on projects that have no record yet. */
export function rawMaterialRows(state: ErpState): RawMaterial[] {
  const rows = [...state.rawMaterials];
  for (const req of state.materialRequirements) {
    if (!rows.some((item) => norm(item.name) === norm(req.material))) rows.push({ id: `virtual:${req.material}`, name: req.material, unit: req.unit, stock: 0, reorderLevel: 0, unitCost: null, supplierId: null });
  }
  return rows;
}

export function upsertSupplier(state: ErpState, name: string, now = new Date().toISOString(), email = ""): ErpState {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean || state.suppliers.some((item) => norm(item.name) === norm(clean))) return state;
  const [id, next] = nextId(state, "sup");
  return { ...next, suppliers: [...next.suppliers, { id, name: clean, contact: "", email: email.trim(), leadTimeDays: null, createdAt: now }] };
}

/** Removes a project and everything that only belongs to it. Customers, parts and shared documents stay. */
export function deleteProject(state: ErpState, projectId: string, now: string): ErpState {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return state;
  const reqIds = new Set(state.materialRequirements.filter((req) => req.projectId === projectId).map((req) => req.id));
  const orderIds = new Set(state.productionOrders.filter((order) => order.projectId === projectId).map((order) => order.id));
  const documents = state.documents
    .map((doc) => doc.projectIds.includes(projectId) ? { ...doc, projectIds: doc.projectIds.filter((id) => id !== projectId) } : doc)
    .filter((doc) => doc.projectIds.length > 0 || !state.documents.find((item) => item.id === doc.id)?.projectIds.includes(projectId));
  const next: ErpState = {
    ...state,
    projects: state.projects.filter((item) => item.id !== projectId),
    purchaseOrders: state.purchaseOrders.filter((item) => item.projectId !== projectId),
    lineItems: state.lineItems.filter((item) => item.projectId !== projectId),
    documents,
    inspectionRequirements: state.inspectionRequirements.filter((item) => item.projectId !== projectId),
    materialRequirements: state.materialRequirements.filter((item) => item.projectId !== projectId),
    procurement: state.procurement.filter((item) => !reqIds.has(item.requirementId)),
    productionOrders: state.productionOrders.filter((item) => item.projectId !== projectId),
    activeOps: (state.activeOps ?? []).filter((item) => !orderIds.has(item.orderId)),
    inspectionReports: state.inspectionReports.filter((item) => item.projectId !== projectId),
    dispatches: state.dispatches.filter((item) => item.projectId !== projectId),
    invoices: state.invoices.filter((item) => item.projectId !== projectId),
    quotations: (state.quotations ?? []).map((quote) => quote.projectId === projectId ? { ...quote, projectId: undefined } : quote),
    supplierOrders: (state.supplierOrders ?? []).map((order) => ({ ...order, lines: order.lines.map((line) => ({ ...line, requirementIds: line.requirementIds.filter((id) => !reqIds.has(id)) })) })),
    guide: state.guide.projectId === projectId ? { step: 0, projectId: null, furthest: 0, v: 2 } : state.guide,
  };
  return log(next, now, "projects", `Project ${project.code} deleted`, null);
}

export function upsertRawMaterial(state: ErpState, name: string, defaults: Partial<RawMaterial> = {}): ErpState {
  const clean = name.trim();
  if (!clean || state.rawMaterials.some((item) => norm(item.name) === norm(clean))) return state;
  const [id, next] = nextId(state, "raw");
  return { ...next, rawMaterials: [...next.rawMaterials, { id, name: clean, unit: defaults.unit ?? "kg", stock: defaults.stock ?? 0, reorderLevel: defaults.reorderLevel ?? 0, unitCost: defaults.unitCost ?? null, supplierId: defaults.supplierId ?? null }] };
}

export function saveSupplier(state: ErpState, id: string | null, input: { name: string; contact: string; email: string; leadTimeDays: number | null; custom?: CustomValues }, now: string): ErpState {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name || (input.leadTimeDays !== null && !(input.leadTimeDays >= 0))) return state;
  const existing = id && !id.startsWith("virtual:") ? state.suppliers.find((item) => item.id === id) : null;
  if (state.suppliers.some((item) => item.id !== existing?.id && norm(item.name) === norm(name))) return state;
  let next = state;
  if (existing) {
    next = { ...state, suppliers: touch(state.suppliers, existing.id, (item) => ({ ...item, name, contact: input.contact.trim(), email: input.email.trim(), leadTimeDays: input.leadTimeDays, custom: input.custom ?? item.custom })) };
    if (norm(existing.name) !== norm(name)) next = { ...next, procurement: next.procurement.map((record) => norm(record.supplier) === norm(existing.name) ? { ...record, supplier: name } : record) };
  } else {
    let newId: string;
    [newId, next] = nextId(state, "sup");
    next = { ...next, suppliers: [...next.suppliers, { id: newId, name, contact: input.contact.trim(), email: input.email.trim(), leadTimeDays: input.leadTimeDays, createdAt: now, custom: input.custom }] };
    const oldName = id?.startsWith("virtual:") ? id.slice(8) : null;
    if (oldName && norm(oldName) !== norm(name)) next = { ...next, procurement: next.procurement.map((record) => norm(record.supplier) === norm(oldName) ? { ...record, supplier: name } : record) };
  }
  return log(next, now, "suppliers", `Supplier ${name} saved`, null);
}

export function saveRawMaterial(state: ErpState, id: string | null, input: { name: string; unit: string; stock: number; reorderLevel: number; unitCost: number | null; supplierId: string | null; custom?: CustomValues }, now: string): ErpState {
  const name = input.name.trim();
  if (!name || !(input.stock >= 0) || !(input.reorderLevel >= 0) || (input.unitCost !== null && !(input.unitCost >= 0))) return state;
  const existing = id && !id.startsWith("virtual:") ? state.rawMaterials.find((item) => item.id === id) : null;
  if (state.rawMaterials.some((item) => item.id !== existing?.id && norm(item.name) === norm(name))) return state;
  const record = { name, unit: input.unit, stock: round2(input.stock), reorderLevel: round2(input.reorderLevel), unitCost: input.unitCost === null ? null : round2(input.unitCost), supplierId: input.supplierId };
  let next = state;
  const oldName = existing?.name ?? (id?.startsWith("virtual:") ? id.slice(8) : null);
  if (existing) next = { ...state, rawMaterials: touch(state.rawMaterials, existing.id, (item) => ({ ...item, ...record, custom: input.custom ?? item.custom })) };
  else {
    let newId: string;
    [newId, next] = nextId(state, "raw");
    next = { ...next, rawMaterials: [...next.rawMaterials, { id: newId, ...record, custom: input.custom }] };
  }
  if (oldName && norm(oldName) !== norm(name)) next = { ...next, materialRequirements: next.materialRequirements.map((req) => norm(req.material) === norm(oldName) ? { ...req, material: name } : req) };
  return log(next, now, "materials", `Raw material ${name} saved`, null);
}

export function rawMaterialFor(state: ErpState, name: string) {
  return state.rawMaterials.find((item) => norm(item.name) === norm(name)) ?? null;
}

/** Cost of a material requirement from the raw material's unit cost, or null when unknown. */
export function requirementCost(state: ErpState, req: MaterialRequirement) {
  const cost = rawMaterialFor(state, req.material)?.unitCost;
  return cost === null || cost === undefined ? null : round2(cost * req.quantity);
}

export function rawMaterialStats(state: ErpState, material: RawMaterial) {
  const reqs = state.materialRequirements.filter((req) => norm(req.material) === norm(material.name));
  const statusOf = (req: MaterialRequirement) => state.procurement.find((record) => record.requirementId === req.id)?.status ?? "Not ordered";
  const sum = (list: MaterialRequirement[]) => round2(list.reduce((total, req) => total + req.quantity, 0));
  const toBuy = sum(reqs.filter((req) => statusOf(req) === "Not ordered"));
  const onOrder = sum(reqs.filter((req) => statusOf(req) === "Ordered"));
  const received = sum(reqs.filter((req) => statusOf(req) === "Received"));
  const projects = [...new Set(reqs.map((req) => req.projectId))];
  const supplier = material.supplierId ? state.suppliers.find((item) => item.id === material.supplierId)?.name ?? null : null;
  const lowStock = material.reorderLevel > 0 && material.stock < material.reorderLevel;
  return { toBuy, onOrder, received, projects, supplier, lowStock, value: material.unitCost === null ? null : round2(material.unitCost * material.stock) };
}

export function supplierStats(state: ErpState, supplier: Supplier) {
  const records = state.procurement.filter((record) => norm(record.supplier) === norm(supplier.name));
  const reqs = records.map((record) => ({ record, req: state.materialRequirements.find((item) => item.id === record.requirementId) })).filter((item): item is { record: ProcurementRecord; req: MaterialRequirement } => Boolean(item.req));
  const spend = round2(reqs.filter(({ record }) => record.status !== "Not ordered").reduce((total, { req }) => total + (requirementCost(state, req) ?? 0), 0));
  const materials = [...new Set([...reqs.map(({ req }) => req.material), ...state.rawMaterials.filter((item) => item.supplierId === supplier.id).map((item) => item.name)])];
  return { purchases: reqs, open: reqs.filter(({ record }) => record.status !== "Received").length, spend, materials, projects: [...new Set(reqs.map(({ req }) => req.projectId))] };
}

export function markInvoicePaid(state: ErpState, invoiceId: string, paid: boolean, now: string): ErpState {
  const invoice = state.invoices.find((item) => item.id === invoiceId);
  if (!invoice || Boolean(invoice.paidAt) === paid) return state;
  const next = { ...state, invoices: touch(state.invoices, invoiceId, (item) => ({ ...item, paidAt: paid ? now.slice(0, 10) : undefined })) };
  return log(next, now, "finance", `Invoice ${invoice.number} marked ${paid ? "paid" : "unpaid"}`, invoice.projectId);
}

/** Revenue, cost and receivables per project, derived from the same records. Illustrative, not accounting. */
export function financeSummary(state: ErpState, today: string) {
  const projects = state.projects.map((project) => {
    const lines = state.lineItems.filter((line) => line.projectId === project.id);
    const order = state.purchaseOrders.find((item) => item.projectId === project.id);
    const invoice = state.invoices.find((item) => item.projectId === project.id) ?? null;
    const orderValue = order?.value ?? round2(lines.reduce((total, line) => total + (line.unitPrice ?? 0) * line.quantity, 0));
    const reqs = state.materialRequirements.filter((req) => req.projectId === project.id);
    const costs = reqs.map((req) => requirementCost(state, req));
    const materialCost = round2(costs.reduce((total: number, cost) => total + (cost ?? 0), 0));
    const costKnown = costs.length > 0 && costs.every((cost) => cost !== null);
    const revenue = invoice ? invoice.subtotal : 0;
    const status = invoice ? (invoice.paidAt ? "Paid" : invoice.dueAt < today ? "Overdue" : "Unpaid") : state.dispatches.some((item) => item.projectId === project.id) ? "To invoice" : "Open order";
    return { project, customerId: project.customerId, currency: order?.currency ?? state.settings.defaultCurrency, orderValue, invoice, revenue, materialCost, costKnown, margin: round2(orderValue - materialCost), status };
  });
  const sum = (values: number[]) => round2(values.reduce((total, value) => total + value, 0));
  const unpaid = state.invoices.filter((item) => !item.paidAt);
  return {
    projects,
    orderBook: sum(projects.filter((row) => !row.invoice).map((row) => row.orderValue)),
    invoiced: sum(state.invoices.map((item) => item.total)),
    paid: sum(state.invoices.filter((item) => item.paidAt).map((item) => item.total)),
    receivable: sum(unpaid.map((item) => item.total)),
    overdue: sum(unpaid.filter((item) => item.dueAt < today).map((item) => item.total)),
    materialCost: sum(projects.map((row) => row.materialCost)),
    purchaseSpend: sum(state.procurement.filter((record) => record.status !== "Not ordered").map((record) => { const req = state.materialRequirements.find((item) => item.id === record.requirementId); return req ? requirementCost(state, req) ?? 0 : 0; })),
  };
}

/* ---------- Configuration ---------- */

export function setCustomValues(state: ErpState, entity: CustomEntity, id: string, values: CustomValues): ErpState {
  const clean = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value !== ""));
  const apply = <T extends { id: string; custom?: CustomValues }>(list: T[]) => list.map((item) => item.id === id ? { ...item, custom: clean } : item);
  switch (entity) {
    case "project": return { ...state, projects: apply(state.projects) };
    case "customer": return { ...state, customers: apply(state.customers) };
    case "purchaseOrder": return { ...state, purchaseOrders: apply(state.purchaseOrders) };
    case "part": return { ...state, parts: apply(state.parts) };
    case "productionOrder": return { ...state, productionOrders: apply(state.productionOrders) };
    case "supplier": return { ...state, suppliers: apply(state.suppliers) };
    case "rawMaterial": return { ...state, rawMaterials: apply(state.rawMaterials) };
  }
}

export function customFieldsFor(state: ErpState, entity: CustomEntity) {
  return state.settings.customFields.filter((field) => field.entity === entity);
}

export function addCustomField(state: ErpState, input: { entity: CustomEntity; label: string; type: CustomFieldType; options: string[] }): ErpState {
  const label = input.label.trim();
  if (!label || state.settings.customFields.some((field) => field.entity === input.entity && norm(field.label) === norm(label))) return state;
  const options = input.type === "select" ? [...new Set(input.options.map((option) => option.trim()).filter(Boolean))] : [];
  if (input.type === "select" && !options.length) return state;
  const [id, next] = nextId(state, "cf");
  return { ...next, settings: { ...next.settings, customFields: [...next.settings.customFields, { id, entity: input.entity, label, type: input.type, options }] } };
}

export function removeCustomField(state: ErpState, fieldId: string): ErpState {
  return { ...state, settings: { ...state.settings, customFields: state.settings.customFields.filter((field) => field.id !== fieldId) } };
}

export function addDocType(state: ErpState, name: string): ErpState {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean || docTypes(state).some((type) => norm(type) === norm(clean))) return state;
  return { ...state, settings: { ...state.settings, docTypes: [...state.settings.docTypes, clean] } };
}

export function removeDocType(state: ErpState, name: string): ErpState {
  if (state.documents.some((doc) => doc.type === name)) return state;
  return { ...state, settings: { ...state.settings, docTypes: state.settings.docTypes.filter((type) => type !== name) } };
}

export function updateUi(state: ErpState, patch: Partial<UiSettings>): ErpState {
  return { ...state, settings: { ...state.settings, ui: { ...state.settings.ui, ...patch } } };
}

export function updateTab(state: ErpState, key: TabKey, patch: Partial<Omit<TabConfig, "key">>): ErpState {
  if (patch.visible === false && (key === "configuration" || key === "guided")) return state;
  if (patch.label !== undefined && !patch.label.trim()) return state;
  return { ...state, settings: { ...state.settings, tabs: state.settings.tabs.map((tab) => tab.key === key ? { ...tab, ...patch, label: patch.label?.trim().slice(0, 30) ?? tab.label } : tab) } };
}

export function moveInList<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function moveTab(state: ErpState, key: TabKey, delta: number): ErpState {
  const index = state.settings.tabs.findIndex((tab) => tab.key === key);
  return index < 0 ? state : { ...state, settings: { ...state.settings, tabs: moveInList(state.settings.tabs, index, delta) } };
}

export function updateWidget(state: ErpState, key: WidgetKey, visible: boolean): ErpState {
  return { ...state, settings: { ...state.settings, widgets: state.settings.widgets.map((widget) => widget.key === key ? { ...widget, visible } : widget) } };
}

export function moveWidget(state: ErpState, key: WidgetKey, delta: number): ErpState {
  const index = state.settings.widgets.findIndex((widget) => widget.key === key);
  return index < 0 ? state : { ...state, settings: { ...state.settings, widgets: moveInList(state.settings.widgets, index, delta) } };
}

export function resetLayout(state: ErpState): ErpState {
  return { ...state, settings: { ...state.settings, ui: { ...DEFAULT_UI }, tabs: DEFAULT_TABS.map((tab) => ({ ...tab })), widgets: DEFAULT_WIDGETS.map((widget) => ({ ...widget })) } };
}
