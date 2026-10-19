export type RecordStatus = "Approved" | "In review" | "Draft" | "Outdated";
export type OrderStatus = "In progress" | "On hold" | "Queued" | "Complete";

export const DEMO_COMPANY = {
  name: "Apex Precision Components GmbH",
  label: "Fictional demonstration company",
  timezone: "Europe/Berlin",
} as const;

export type EngineeringDocument = {
  id: string;
  number: string;
  title: string;
  type: string;
  partId: string;
  revision: string;
  status: RecordStatus;
  owner: string;
  updated: string;
  summary: string;
  orderIds: string[];
  history: { revision: string; status: RecordStatus; date: string; note: string }[];
  typeId?: string;
  customFieldValues?: Record<string, string | number | boolean>;
  materialLotId?: string;
  supplierId?: string;
};

export type Part = {
  id: string;
  number: string;
  name: string;
  material: string;
  currentRevision: string;
  status: "Released" | "In development" | "On hold";
  description: string;
  revisionHistory: { revision: string; date: string; note: string; status: string }[];
};

export type ProductionOrder = {
  id: string;
  number: string;
  partId: string;
  partRevision: string;
  quantity: number;
  status: OrderStatus;
  plannedStart: string;
  plannedDue: string;
  workflow: string;
  documentIds: string[];
  activity: string;
  customerCompanyId?: string;
  materialLotIds?: string[];
};

export const parts: Part[] = [
  { id: "ap-1001", number: "AP-1001", name: "Actuator Mounting Bracket", material: "Aluminium 6082-T6", currentRevision: "C", status: "Released", description: "Synthetic precision-milled bracket for an aerospace-style actuator assembly.", revisionHistory: [{ revision: "C", date: "14 Oct 2026", note: "Updated counterbore depth", status: "Released" }, { revision: "B", date: "03 Jun 2026", note: "Added edge-break callout", status: "Superseded" }, { revision: "A", date: "12 Feb 2026", note: "Initial release", status: "Superseded" }] },
  { id: "ap-1024", number: "AP-1024", name: "Actuator Valve Housing", material: "316L stainless steel", currentRevision: "B", status: "Released", description: "Synthetic turned and milled housing for a compact fluid-control assembly.", revisionHistory: [{ revision: "B", date: "11 Oct 2026", note: "Added inspection datum", status: "Released" }, { revision: "A", date: "22 Apr 2026", note: "Initial release", status: "Superseded" }] },
  { id: "ap-1088", number: "AP-1088", name: "Actuator Drive Shaft", material: "4140 alloy steel", currentRevision: "D", status: "Released", description: "Synthetic ground shaft with two bearing journals and a keyed drive end.", revisionHistory: [{ revision: "D", date: "09 Oct 2026", note: "Adjusted journal tolerance", status: "Released" }, { revision: "C", date: "17 Jul 2026", note: "Added finish requirement", status: "Superseded" }] },
  { id: "ap-1102", number: "AP-1102", name: "Sensor Mounting Plate", material: "Aluminium 7075-T6", currentRevision: "A", status: "In development", description: "Synthetic lightweight mounting plate for an aerospace-style sensor package.", revisionHistory: [{ revision: "A", date: "16 Oct 2026", note: "Prototype issue for review", status: "In review" }] },
  { id: "ap-1170", number: "AP-1170", name: "Spindle Collar", material: "4140 pre-hardened steel", currentRevision: "B", status: "Released", description: "Split collar locating a spindle assembly on its drive shaft.", revisionHistory: [{ revision: "B", date: "02 Oct 2026", note: "Clarified clamp torque note", status: "Released" }, { revision: "A", date: "08 May 2026", note: "Initial release", status: "Superseded" }] },
  { id: "ap-1215", number: "AP-1215", name: "Bearing Retainer", material: "Aluminium 6082-T6", currentRevision: "A", status: "On hold", description: "Circular retainer plate for a sealed actuator bearing cartridge.", revisionHistory: [{ revision: "A", date: "29 Sep 2026", note: "Released pending supplier material review", status: "On hold" }] },
];

export const documents: EngineeringDocument[] = [
  { id: "dwg-ap-1001", number: "DWG-AP-1001", title: "Actuator Mounting Bracket — General Arrangement", type: "Engineering drawing", partId: "ap-1001", revision: "C", status: "Approved", owner: "M. Keller", updated: "14 Oct 2026", summary: "Synthetic controlled drawing record for the actuator mounting bracket. No drawing file is included.", orderIds: ["mo-2026-0142"], history: [{ revision: "C", status: "Approved", date: "14 Oct 2026", note: "Counterbore depth updated" }, { revision: "B", status: "Outdated", date: "03 Jun 2026", note: "Edge-break callout added" }, { revision: "A", status: "Outdated", date: "12 Feb 2026", note: "Initial release" }] },
  { id: "set-ap-1001", number: "SET-AP-1001", title: "Mounting Bracket — Setup Sheet", type: "Setup sheet", partId: "ap-1001", revision: "B", status: "Approved", owner: "J. Novak", updated: "15 Oct 2026", summary: "Synthetic setup record for the 3-axis milling route.", orderIds: ["mo-2026-0142"], history: [{ revision: "B", status: "Approved", date: "15 Oct 2026", note: "Fixture orientation clarified" }, { revision: "A", status: "Outdated", date: "01 Jun 2026", note: "Initial issue" }] },
  { id: "insp-ap-1001", number: "INSP-AP-1001", title: "Mounting Bracket — Inspection Plan", type: "Inspection plan", partId: "ap-1001", revision: "A", status: "Outdated", owner: "S. Weber", updated: "20 May 2026", summary: "Previous synthetic inspection-plan record. A current approved revision is not linked.", orderIds: ["mo-2026-0142"], history: [{ revision: "A", status: "Outdated", date: "20 May 2026", note: "Superseded by planned revision B; replacement not yet recorded" }] },
  { id: "mat-ap-1001", number: "MAT-AP-1001", title: "Mounting Bracket — Material Certificate Reference", type: "Material certificate", partId: "ap-1001", revision: "A", status: "Approved", owner: "Demo records", updated: "08 Oct 2026", summary: "Synthetic reference metadata only; no certificate file is included and no material conformity is verified.", orderIds: ["mo-2026-0142"], materialLotId: "lot-al6082-2409", supplierId: "sup-northstar", history: [{ revision: "A", status: "Approved", date: "08 Oct 2026", note: "Synthetic reference record created" }] },
  { id: "wi-ap-1001", number: "WI-AP-1001", title: "Actuator Mounting Bracket — Deburr Work Instruction", type: "Work instruction", partId: "ap-1001", revision: "A", status: "In review", owner: "R. Fischer", updated: "16 Oct 2026", summary: "Synthetic work-instruction record currently in review.", orderIds: ["mo-2026-0142"], history: [{ revision: "A", status: "In review", date: "16 Oct 2026", note: "Submitted for engineering review" }] },
  { id: "dwg-ap-1024", number: "DWG-AP-1024", title: "Valve Housing — General Arrangement", type: "Engineering drawing", partId: "ap-1024", revision: "B", status: "Approved", owner: "M. Keller", updated: "11 Oct 2026", summary: "Controlled drawing record for the valve housing. Synthetic record; no drawing file is included.", orderIds: ["mo-2026-0143"], history: [{ revision: "B", status: "Approved", date: "11 Oct 2026", note: "Inspection datum added" }, { revision: "A", status: "Outdated", date: "22 Apr 2026", note: "Initial release" }] },
  { id: "set-ap-1024", number: "SET-AP-1024", title: "Valve Housing — Turning Setup", type: "Setup sheet", partId: "ap-1024", revision: "A", status: "Approved", owner: "J. Novak", updated: "12 Oct 2026", summary: "Synthetic setup record for the turning and milling route.", orderIds: ["mo-2026-0143"], history: [{ revision: "A", status: "Approved", date: "12 Oct 2026", note: "Initial release" }] },
  { id: "insp-ap-1024", number: "INSP-AP-1024", title: "Valve Housing — Inspection Plan", type: "Inspection plan", partId: "ap-1024", revision: "A", status: "In review", owner: "S. Weber", updated: "17 Oct 2026", summary: "Synthetic inspection-plan record in quality review.", orderIds: ["mo-2026-0143"], history: [{ revision: "A", status: "In review", date: "17 Oct 2026", note: "Quality review in progress" }] },
  { id: "mat-ap-1024", number: "MAT-AP-1024", title: "Valve Housing — Material Certificate Reference", type: "Material certificate", partId: "ap-1024", revision: "A", status: "Approved", owner: "L. Brandt", updated: "10 Oct 2026", summary: "Synthetic material-certificate reference record; certificate file not included.", orderIds: ["mo-2026-0143"], history: [{ revision: "A", status: "Approved", date: "10 Oct 2026", note: "Reference record approved" }] },
  { id: "dwg-ap-1088", number: "DWG-AP-1088", title: "Drive Shaft — General Arrangement", type: "Engineering drawing", partId: "ap-1088", revision: "D", status: "Approved", owner: "T. Hahn", updated: "09 Oct 2026", summary: "Controlled drawing record for the drive shaft. Synthetic record; no drawing file is included.", orderIds: ["mo-2026-0144"], history: [{ revision: "D", status: "Approved", date: "09 Oct 2026", note: "Journal tolerance adjusted" }, { revision: "C", status: "Outdated", date: "17 Jul 2026", note: "Finish requirement added" }] },
  { id: "wi-ap-1088", number: "WI-AP-1088", title: "Drive Shaft — Grinding Sequence", type: "Work instruction", partId: "ap-1088", revision: "B", status: "Approved", owner: "R. Fischer", updated: "10 Oct 2026", summary: "Synthetic work-instruction record for the finish grinding sequence.", orderIds: ["mo-2026-0144"], history: [{ revision: "B", status: "Approved", date: "10 Oct 2026", note: "Sequence reviewed" }] },
  { id: "insp-ap-1088", number: "INSP-AP-1088", title: "Drive Shaft — Journal Inspection Plan", type: "Inspection plan", partId: "ap-1088", revision: "C", status: "Approved", owner: "S. Weber", updated: "12 Oct 2026", summary: "Synthetic inspection-plan record for the journal features.", orderIds: ["mo-2026-0144"], history: [{ revision: "C", status: "Approved", date: "12 Oct 2026", note: "Approved inspection method record" }] },
  { id: "mat-ap-1088", number: "MAT-AP-1088", title: "Drive Shaft — Material Certificate Reference", type: "Material certificate", partId: "ap-1088", revision: "A", status: "In review", owner: "Demo records", updated: "03 Oct 2026", summary: "Synthetic reference metadata only; no certificate file is included and no material conformity is verified.", orderIds: ["mo-2026-0144"], materialLotId: "lot-4140-2246", supplierId: "sup-baltic", history: [{ revision: "A", status: "In review", date: "03 Oct 2026", note: "Synthetic reference awaits sample review" }] },
  { id: "set-ap-1088", number: "SET-AP-1088", title: "Actuator Drive Shaft — Turning Setup", type: "Setup sheet", partId: "ap-1088", revision: "D", status: "Approved", owner: "J. Novak", updated: "11 Oct 2026", summary: "Synthetic setup-sheet reference for the shaft turning route.", orderIds: ["mo-2026-0144"], history: [{ revision: "D", status: "Approved", date: "11 Oct 2026", note: "Setup record approved for the sample route" }] },
  { id: "cnc-ap-1088", number: "CNC-AP-1088", title: "Drive Shaft — Turning Program Reference", type: "CNC program reference", partId: "ap-1088", revision: "D", status: "Draft", owner: "J. Novak", updated: "18 Oct 2026", summary: "Synthetic reference record only; no executable CNC program is stored here.", orderIds: ["mo-2026-0144"], history: [{ revision: "D", status: "Draft", date: "18 Oct 2026", note: "Reference updated for review" }] },
  { id: "dwg-ap-1102", number: "DWG-AP-1102", title: "Sensor Plate — Prototype Drawing", type: "Engineering drawing", partId: "ap-1102", revision: "A", status: "In review", owner: "T. Hahn", updated: "16 Oct 2026", summary: "Prototype drawing metadata for the sensor plate; synthetic record only.", orderIds: [], history: [{ revision: "A", status: "In review", date: "16 Oct 2026", note: "Prototype drawing submitted for review" }] },
  { id: "set-ap-1102", number: "SET-AP-1102", title: "Sensor Plate — Prototype Setup", type: "Setup sheet", partId: "ap-1102", revision: "A", status: "Draft", owner: "J. Novak", updated: "17 Oct 2026", summary: "Draft synthetic setup record for a prototype operation.", orderIds: [], history: [{ revision: "A", status: "Draft", date: "17 Oct 2026", note: "Draft created" }] },
  { id: "dwg-ap-1170", number: "DWG-AP-1170", title: "Spindle Collar — General Arrangement", type: "Engineering drawing", partId: "ap-1170", revision: "B", status: "Approved", owner: "M. Keller", updated: "02 Oct 2026", summary: "Controlled drawing record for the spindle collar. Synthetic record; no drawing file is included.", orderIds: ["mo-2026-0145"], history: [{ revision: "B", status: "Approved", date: "02 Oct 2026", note: "Clamp torque note clarified" }, { revision: "A", status: "Outdated", date: "08 May 2026", note: "Initial release" }] },
  { id: "wi-ap-1170", number: "WI-AP-1170", title: "Spindle Collar — Assembly Instruction", type: "Work instruction", partId: "ap-1170", revision: "A", status: "Approved", owner: "R. Fischer", updated: "03 Oct 2026", summary: "Synthetic assembly instruction record.", orderIds: ["mo-2026-0145"], history: [{ revision: "A", status: "Approved", date: "03 Oct 2026", note: "Initial release" }] },
  { id: "mat-ap-1170", number: "MAT-AP-1170", title: "Spindle Collar — Material Certificate Reference", type: "Material certificate", partId: "ap-1170", revision: "A", status: "Approved", owner: "L. Brandt", updated: "01 Oct 2026", summary: "Synthetic material-certificate reference record; certificate file not included.", orderIds: ["mo-2026-0145"], history: [{ revision: "A", status: "Approved", date: "01 Oct 2026", note: "Reference record approved" }] },
  { id: "set-ap-1170", number: "SET-AP-1170", title: "Spindle Collar — Setup Sheet", type: "Setup sheet", partId: "ap-1170", revision: "B", status: "Approved", owner: "J. Novak", updated: "05 Oct 2026", summary: "Synthetic setup-sheet reference for the collar milling route.", orderIds: ["mo-2026-0145"], history: [{ revision: "B", status: "Approved", date: "05 Oct 2026", note: "Setup record approved" }] },
  { id: "insp-ap-1170", number: "INSP-AP-1170", title: "Spindle Collar — Inspection Plan", type: "Inspection plan", partId: "ap-1170", revision: "B", status: "Approved", owner: "S. Weber", updated: "06 Oct 2026", summary: "Synthetic inspection-plan reference for the spindle collar.", orderIds: ["mo-2026-0145"], history: [{ revision: "B", status: "Approved", date: "06 Oct 2026", note: "Inspection record approved" }] },
  { id: "dwg-ap-1215", number: "DWG-AP-1215", title: "Bearing Retainer — General Arrangement", type: "Engineering drawing", partId: "ap-1215", revision: "A", status: "Approved", owner: "T. Hahn", updated: "29 Sep 2026", summary: "Controlled drawing record for the bearing retainer. Synthetic record; no drawing file is included.", orderIds: ["mo-2026-0146"], history: [{ revision: "A", status: "Approved", date: "29 Sep 2026", note: "Initial release" }] },
  { id: "set-ap-1215", number: "SET-AP-1215", title: "Bearing Retainer — Setup Sheet", type: "Setup sheet", partId: "ap-1215", revision: "A", status: "Outdated", owner: "J. Novak", updated: "30 Sep 2026", summary: "Previous synthetic setup record. Current approved revision not recorded.", orderIds: ["mo-2026-0146"], history: [{ revision: "A", status: "Outdated", date: "30 Sep 2026", note: "Superseded during fixture review" }] },
  { id: "insp-ap-1215", number: "INSP-AP-1215", title: "Bearing Retainer — Inspection Plan", type: "Inspection plan", partId: "ap-1215", revision: "A", status: "Approved", owner: "S. Weber", updated: "30 Sep 2026", summary: "Synthetic inspection-plan reference; the order remains on hold because the setup sheet is outdated.", orderIds: ["mo-2026-0146"], history: [{ revision: "A", status: "Approved", date: "30 Sep 2026", note: "Initial inspection record approved" }] },
  { id: "mat-ap-1215", number: "MAT-AP-1215", title: "Bearing Retainer — Material Certificate Reference", type: "Material certificate", partId: "ap-1215", revision: "A", status: "Outdated", owner: "Demo records", updated: "25 Sep 2026", summary: "Synthetic reference metadata only; no certificate file is included and no material conformity is verified.", orderIds: ["mo-2026-0146"], materialLotId: "lot-al6082-2411", supplierId: "sup-northstar", history: [{ revision: "A", status: "Outdated", date: "25 Sep 2026", note: "Sample reference needs review" }] },
];

export const productionOrders: ProductionOrder[] = [
  { id: "mo-2026-0142", number: "MO-2026-0142", partId: "ap-1001", partRevision: "C", quantity: 48, status: "On hold", plannedStart: "19 Oct 2026", plannedDue: "23 Oct 2026", workflow: "3-axis milling · Standard", documentIds: ["dwg-ap-1001", "set-ap-1001", "insp-ap-1001", "mat-ap-1001"], activity: "Flagged: inspection plan is outdated", customerCompanyId: "co-helix", materialLotIds: ["lot-al6082-2409"] },
  { id: "mo-2026-0143", number: "MO-2026-0143", partId: "ap-1024", partRevision: "B", quantity: 24, status: "In progress", plannedStart: "16 Oct 2026", plannedDue: "22 Oct 2026", workflow: "Turn + mill · Standard", documentIds: ["dwg-ap-1024", "set-ap-1024", "insp-ap-1024", "mat-ap-1024"], activity: "Quality review requested for inspection plan", customerCompanyId: "co-rivermark", materialLotIds: ["lot-ss316-1031"] },
  { id: "mo-2026-0144", number: "MO-2026-0144", partId: "ap-1088", partRevision: "D", quantity: 12, status: "In progress", plannedStart: "15 Oct 2026", plannedDue: "21 Oct 2026", workflow: "Turn + grind · Controlled", documentIds: ["dwg-ap-1088", "wi-ap-1088", "insp-ap-1088", "mat-ap-1088", "cnc-ap-1088"], activity: "CNC program reference is still a draft", customerCompanyId: "co-helix", materialLotIds: ["lot-4140-2246"] },
  { id: "mo-2026-0145", number: "MO-2026-0145", partId: "ap-1170", partRevision: "B", quantity: 36, status: "Queued", plannedStart: "21 Oct 2026", plannedDue: "27 Oct 2026", workflow: "Milling + assembly · Standard", documentIds: ["dwg-ap-1170", "wi-ap-1170", "mat-ap-1170"], activity: "Waiting for planned start", customerCompanyId: "co-helix", materialLotIds: ["lot-4140-2254"] },
  { id: "mo-2026-0146", number: "MO-2026-0146", partId: "ap-1215", partRevision: "A", quantity: 18, status: "On hold", plannedStart: "20 Oct 2026", plannedDue: "24 Oct 2026", workflow: "3-axis milling · Standard", documentIds: ["dwg-ap-1215", "set-ap-1215", "mat-ap-1215"], activity: "Setup sheet is outdated; inspection plan is missing", customerCompanyId: "co-asterion", materialLotIds: ["lot-al6082-2411"] },
];

export function getOrderDocuments(order: ProductionOrder, allDocuments: EngineeringDocument[] = documents) {
  return allDocuments.filter((document) => order.documentIds.includes(document.id) || document.orderIds.includes(order.id));
}

export const activity = [
  { id: "evt-01", date: "18 Oct 2026 · 14:42", title: "CNC program reference saved as draft", subject: "CNC-AP-1088", recordId: "cnc-ap-1088", kind: "Document", actor: "J. Novak" },
  { id: "evt-02", date: "17 Oct 2026 · 10:18", title: "Inspection plan submitted for quality review", subject: "INSP-AP-1024", recordId: "insp-ap-1024", kind: "Document", actor: "S. Weber" },
  { id: "evt-03", date: "16 Oct 2026 · 16:05", title: "Prototype drawing submitted for review", subject: "DWG-AP-1102", recordId: "dwg-ap-1102", kind: "Document", actor: "T. Hahn" },
  { id: "evt-04", date: "16 Oct 2026 · 09:32", title: "Production order held: inspection plan is outdated", subject: "MO-2026-0142", recordId: "mo-2026-0142", kind: "Production order", actor: "System rule · Demo" },
  { id: "evt-05", date: "15 Oct 2026 · 11:21", title: "Setup sheet revision B approved", subject: "SET-AP-1001", recordId: "set-ap-1001", kind: "Document", actor: "J. Novak" },
  { id: "evt-06", date: "14 Oct 2026 · 15:08", title: "Drawing revision C released", subject: "DWG-AP-1001", recordId: "dwg-ap-1001", kind: "Document", actor: "M. Keller" },
  { id: "evt-07", date: "12 Oct 2026 · 13:47", title: "Inspection plan approved", subject: "INSP-AP-1088", recordId: "insp-ap-1088", kind: "Document", actor: "S. Weber" },
];

export function getRecordHref(id: string) {
  if (id.startsWith("mo-")) return `/demo/production/${id}`;
  if (documents.some((document) => document.id === id)) return `/demo/documents/${id}`;
  return `/demo/parts/${id}`;
}
