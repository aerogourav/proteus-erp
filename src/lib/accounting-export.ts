/**
 * CSV of issued invoices and credit notes for a tax adviser or an accounting import (for example into DATEV or an
 * e-invoicing provider through their own CSV import). It is a plain list, not a DATEV-certified format and not an
 * e-invoice (XRechnung/ZUGFeRD): the specialist tool creates those.
 */
export type ExportDocument = {
  kind: string; number: string; issue_date: string; due_date: string | null; status: string; currency: string;
  subtotal: number | string; tax: number | string; total: number | string;
  customer: string; tax_id: string; address: { street?: string; postal_code?: string; city?: string; country?: string } | null; cancels: string;
};

export const EXPORT_COLUMNS = ["Document type", "Number", "Issue date", "Due date", "Status", "Customer", "Customer VAT ID", "Street", "Postal code", "City", "Country", "Currency", "Net", "Tax", "Total", "Cancels invoice"] as const;

const cell = (value: string) => (/[",;\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const amount = (value: number | string) => Number(value).toFixed(2);

/** UTF-8 with a byte-order mark so spreadsheet programs open umlauts correctly. Drafts are never exported. */
export function documentsToCsv(documents: ExportDocument[]) {
  const rows = documents
    .filter((doc) => (doc.kind === "invoice" || doc.kind === "credit_note") && doc.status !== "Draft")
    .map((doc) => [
      doc.kind === "credit_note" ? "Credit note" : "Invoice", doc.number, doc.issue_date, doc.due_date ?? "", doc.status, doc.customer, doc.tax_id,
      doc.address?.street ?? "", doc.address?.postal_code ?? "", doc.address?.city ?? "", doc.address?.country ?? "", doc.currency,
      amount(doc.subtotal), amount(doc.tax), amount(doc.total), doc.cancels,
    ]);
  return "﻿" + [EXPORT_COLUMNS as readonly string[], ...rows].map((row) => row.map((value) => cell(String(value))).join(",")).join("\r\n");
}
