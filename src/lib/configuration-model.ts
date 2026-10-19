import type { RecordStatus, EngineeringDocument } from "@/lib/demo-data";

export const FIELD_TYPES = ["short-text", "number", "date", "dropdown", "checkbox", "reference"] as const;
export type CustomFieldType = (typeof FIELD_TYPES)[number];

export type ConfiguredField = {
  id: string;
  label: string;
  key: string;
  type: CustomFieldType;
  required: boolean;
  helpText: string;
  defaultValue: string;
  options: string[];
};

export type ConfiguredDocumentType = {
  id: string;
  identifier: string;
  name: string;
  description: string;
  active: boolean;
  fields: ConfiguredField[];
};

export type WorkflowStage = { id: string; name: string; role: string; description: string };
export type ConfiguredWorkflow = { id: string; name: string; documentTypeId: string | null; active: boolean; stages: WorkflowStage[] };
export type RuleApplicability = "part" | "production-order" | "both";
export type ConfiguredDocumentRule = {
  id: string;
  name: string;
  documentTypeId: string;
  applicability: RuleApplicability;
  acceptableStatuses: RecordStatus[];
  requireCurrentRevision: boolean;
  active: boolean;
  previewOnly: boolean;
  scopeNote: string;
};

export type DemoDocumentRecord = EngineeringDocument & {
  typeId: string;
  customFieldValues: Record<string, string | number | boolean>;
};

export type DemoConfigurationState = {
  version: 1;
  documentTypes: ConfiguredDocumentType[];
  workflows: ConfiguredWorkflow[];
  rules: ConfiguredDocumentRule[];
  createdDocuments: DemoDocumentRecord[];
};

export const CONFIG_STORAGE_KEY = "proteus-demo-configuration-v1";

export const LEGACY_TYPE_ID_BY_NAME: Record<string, string> = {
  "Engineering drawing": "engineering-drawing",
  "Work instruction": "work-instruction",
  "Setup sheet": "setup-sheet",
  "Inspection plan": "inspection-plan",
  "Material certificate": "material-certificate",
  "CNC program reference": "cnc-program-reference",
};

export function createSeedConfiguration(): DemoConfigurationState {
  const documentTypes: ConfiguredDocumentType[] = [
    { id: "engineering-drawing", identifier: "engineering-drawing", name: "Engineering Drawing", description: "Controlled drawing and general arrangement records.", active: true, fields: [] },
    { id: "work-instruction", identifier: "work-instruction", name: "Work Instruction", description: "Step-by-step instructions associated with a part or order.", active: true, fields: [] },
    { id: "setup-sheet", identifier: "setup-sheet", name: "Setup Sheet", description: "Synthetic setup and fixture reference records.", active: true, fields: [] },
    { id: "inspection-plan", identifier: "inspection-plan", name: "Inspection Plan", description: "Inspection characteristic and method records.", active: true, fields: [] },
    { id: "material-certificate", identifier: "material-certificate", name: "Material Certificate", description: "Reference metadata for material certification records.", active: true, fields: [] },
    { id: "cnc-program-reference", identifier: "cnc-program-reference", name: "CNC Program Reference", description: "Reference metadata only; executable programs are not stored in this demo.", active: true, fields: [] },
  ];
  const stage = (id: string, name: string, role: string, description: string): WorkflowStage => ({ id, name, role, description });
  return {
    version: 1,
    documentTypes,
    workflows: [{ id: "engineering-approval", name: "Engineering document approval", documentTypeId: "engineering-drawing", active: true, stages: [stage("draft", "Draft", "Document owner", "Prepare the record for review."), stage("engineering-review", "Engineering Review", "Engineering", "Review technical context and revision."), stage("quality-review", "Quality Review", "Quality", "Review the configured quality record."), stage("approved", "Approved", "Approver", "Mark the record approved in the configured process.")] }],
    rules: [
      { id: "current-drawing", name: "Current approved drawing", documentTypeId: "engineering-drawing", applicability: "both", acceptableStatuses: ["Approved"], requireCurrentRevision: true, active: true, previewOnly: false, scopeNote: "Compare the linked drawing with the part and order revision." },
      { id: "inspection-plan-order", name: "Inspection plan for production orders", documentTypeId: "inspection-plan", applicability: "production-order", acceptableStatuses: ["Approved"], requireCurrentRevision: false, active: true, previewOnly: false, scopeNote: "Every production order needs an approved inspection plan record." },
      { id: "setup-sheet-order", name: "Approved setup sheet for production orders", documentTypeId: "setup-sheet", applicability: "production-order", acceptableStatuses: ["Approved"], requireCurrentRevision: false, active: true, previewOnly: false, scopeNote: "Every production order needs an approved setup sheet record." },
      { id: "material-certificate-category", name: "Material certificate for selected part categories", documentTypeId: "material-certificate", applicability: "part", acceptableStatuses: ["Approved"], requireCurrentRevision: false, active: true, previewOnly: true, scopeNote: "Category targeting is a preview because the sample part model has no category field." },
    ],
    createdDocuments: [],
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string { return typeof value === "string"; }
function isBoolean(value: unknown): value is boolean { return typeof value === "boolean"; }
const statuses: RecordStatus[] = ["Approved", "In review", "Draft", "Outdated"];

function isField(value: unknown): value is ConfiguredField {
  if (!isObject(value)) return false;
  return isString(value.id) && isString(value.label) && isString(value.key) && FIELD_TYPES.includes(value.type as CustomFieldType) && isBoolean(value.required) && isString(value.helpText) && isString(value.defaultValue) && Array.isArray(value.options) && value.options.every(isString);
}

function isDocumentType(value: unknown): value is ConfiguredDocumentType {
  if (!isObject(value)) return false;
  return isString(value.id) && isString(value.identifier) && isString(value.name) && isString(value.description) && isBoolean(value.active) && Array.isArray(value.fields) && value.fields.every(isField);
}

function isWorkflow(value: unknown): value is ConfiguredWorkflow {
  if (!isObject(value) || !Array.isArray(value.stages)) return false;
  return isString(value.id) && isString(value.name) && (value.documentTypeId === null || isString(value.documentTypeId)) && isBoolean(value.active) && value.stages.every((stage) => isObject(stage) && isString(stage.id) && isString(stage.name) && isString(stage.role) && isString(stage.description));
}

function isRule(value: unknown): value is ConfiguredDocumentRule {
  if (!isObject(value)) return false;
  return isString(value.id) && isString(value.name) && isString(value.documentTypeId) && ["part", "production-order", "both"].includes(String(value.applicability)) && Array.isArray(value.acceptableStatuses) && value.acceptableStatuses.every((status) => statuses.includes(status as RecordStatus)) && isBoolean(value.requireCurrentRevision) && isBoolean(value.active) && isBoolean(value.previewOnly) && isString(value.scopeNote);
}

function isCreatedDocument(value: unknown): value is DemoDocumentRecord {
  if (!isObject(value) || !isObject(value.customFieldValues) || !Array.isArray(value.orderIds) || !Array.isArray(value.history)) return false;
  return isString(value.id) && isString(value.number) && isString(value.title) && isString(value.type) && isString(value.typeId) && isString(value.partId) && isString(value.revision) && statuses.includes(value.status as RecordStatus) && isString(value.owner) && isString(value.updated) && isString(value.summary) && value.orderIds.every(isString) && value.history.every((entry) => isObject(entry) && isString(entry.revision) && isString(entry.date) && isString(entry.note) && statuses.includes(entry.status as RecordStatus)) && Object.values(value.customFieldValues).every((fieldValue) => typeof fieldValue === "string" || typeof fieldValue === "number" || typeof fieldValue === "boolean");
}

export function isDemoConfigurationState(value: unknown): value is DemoConfigurationState {
  return isObject(value) && value.version === 1 && Array.isArray(value.documentTypes) && value.documentTypes.every(isDocumentType) && Array.isArray(value.workflows) && value.workflows.every(isWorkflow) && Array.isArray(value.rules) && value.rules.every(isRule) && Array.isArray(value.createdDocuments) && value.createdDocuments.every(isCreatedDocument);
}
