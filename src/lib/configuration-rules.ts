import type { EngineeringDocument, Part, ProductionOrder } from "@/lib/demo-data";
import type { ConfiguredDocumentRule, ConfiguredDocumentType, DemoConfigurationState } from "@/lib/configuration-model";
import { LEGACY_TYPE_ID_BY_NAME } from "@/lib/configuration-model";

export type CompletenessIssue = {
  ruleId: string;
  label: string;
  documentTypeId: string;
  reason: "Missing" | "Outdated" | "Not approved";
  document?: EngineeringDocument;
};

type Scope = "part" | "production-order";

function appliesToScope(rule: ConfiguredDocumentRule, scope: Scope) {
  return !rule.previewOnly && rule.active && (rule.applicability === "both" || rule.applicability === scope);
}

function matchesType(document: EngineeringDocument, documentTypeId: string, documentTypes: ConfiguredDocumentType[]) {
  const configured = documentTypes.find((type) => type.id === documentTypeId);
  if (!configured) return false;
  const typeId = "typeId" in document ? document.typeId : undefined;
  return (typeId ?? LEGACY_TYPE_ID_BY_NAME[document.type]) === documentTypeId || document.type === configured.name;
}

function evaluateRules({ rules, documentTypes, documents, part, scope, order }: {
  rules: ConfiguredDocumentRule[];
  documentTypes: ConfiguredDocumentType[];
  documents: EngineeringDocument[];
  part: Part;
  scope: Scope;
  order?: ProductionOrder;
}): CompletenessIssue[] {
  return rules.filter((rule) => appliesToScope(rule, scope)).flatMap<CompletenessIssue>((rule) => {
    const candidates = documents.filter((document) => document.partId === part.id && matchesType(document, rule.documentTypeId, documentTypes) && (!order || document.orderIds.includes(order.id) || order.documentIds.includes(document.id)));
    const acceptable = candidates.filter((document) => rule.acceptableStatuses.includes(document.status));
    const current = acceptable.filter((document) => !rule.requireCurrentRevision || (document.revision === part.currentRevision && (!order || order.partRevision === part.currentRevision)));
    if (current.length) return [];
    const typeName = documentTypes.find((type) => type.id === rule.documentTypeId)?.name ?? "Document";
    if (!candidates.length) return [{ ruleId: rule.id, label: `${rule.name} · ${typeName}`, documentTypeId: rule.documentTypeId, reason: "Missing" as const }];
    if (acceptable.length && rule.requireCurrentRevision) return [{ ruleId: rule.id, label: `${rule.name} · ${typeName}`, documentTypeId: rule.documentTypeId, reason: "Outdated" as const, document: acceptable[0] }];
    const old = candidates.find((document) => document.status === "Outdated");
    if (old) return [{ ruleId: rule.id, label: `${rule.name} · ${typeName}`, documentTypeId: rule.documentTypeId, reason: "Outdated" as const, document: old }];
    return [{ ruleId: rule.id, label: `${rule.name} · ${typeName}`, documentTypeId: rule.documentTypeId, reason: "Not approved" as const, document: candidates[0] }];
  });
}

export function evaluateOrderCompleteness(order: ProductionOrder, configuration: DemoConfigurationState, documents: EngineeringDocument[], parts: Part[]): CompletenessIssue[] {
  const part = parts.find((item) => item.id === order.partId);
  if (!part) return [];
  return evaluateRules({ rules: configuration.rules, documentTypes: configuration.documentTypes, documents, part, scope: "production-order", order });
}

export function evaluatePartCompleteness(part: Part, configuration: DemoConfigurationState, documents: EngineeringDocument[]): CompletenessIssue[] {
  return evaluateRules({ rules: configuration.rules, documentTypes: configuration.documentTypes, documents, part, scope: "part" });
}

export function describeRule(rule: ConfiguredDocumentRule, documentTypes: ConfiguredDocumentType[]) {
  const type = documentTypes.find((item) => item.id === rule.documentTypeId)?.name ?? "Unknown document type";
  const scope = rule.applicability === "both" ? "parts and production orders" : rule.applicability === "part" ? "parts" : "production orders";
  const statuses = rule.acceptableStatuses.length ? rule.acceptableStatuses.join(" or ").toLowerCase() : "no status";
  const revision = rule.requireCurrentRevision ? " and the current related part revision" : "";
  return `${type} is required for ${scope} with ${statuses} status${revision}.`;
}
