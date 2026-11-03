import { test } from "node:test";
import assert from "node:assert/strict";
import { OFFERS, inquiryText, parseInquiry } from "../src/lib/offers.ts";

const valid = { name: " Lin ", email: "lin@example.com", company: "Werkstatt Lin", role: "", message: "Job release on paper.", offer: "pilot" };

test("an inquiry must name one of the three free offers", () => {
  assert.deepEqual(OFFERS.map((offer) => offer.key), ["call", "walkthrough", "pilot"]);
  assert.equal(parseInquiry({ ...valid, offer: undefined }).ok, false);
  assert.equal(parseInquiry({ ...valid, offer: "free-erp" }).ok, false);
  const parsed = parseInquiry(valid);
  assert.ok(parsed.ok);
  assert.equal(parsed.inquiry.offer, "pilot");
  assert.equal(parsed.inquiry.name, "Lin");
});

test("an inquiry needs name, company, workflow and a valid email", () => {
  assert.equal(parseInquiry({ ...valid, email: "nope" }).ok, false);
  assert.equal(parseInquiry({ ...valid, company: " " }).ok, false);
  assert.equal(parseInquiry({ ...valid, message: "" }).ok, false);
});

test("the team email names the chosen offer", () => {
  const parsed = parseInquiry({ ...valid, offer: "walkthrough" });
  assert.ok(parsed.ok);
  assert.match(inquiryText(parsed.inquiry), /^Offer: Free demo walkthrough/);
});

test("accounting export: issued invoices and credit notes only, with tax data, quoted safely", async () => {
  const { documentsToCsv, EXPORT_COLUMNS } = await import("../src/lib/accounting-export.ts");
  const base = { due_date: "2027-02-04", currency: "EUR", customer: "Kessler Maschinenbau GmbH", tax_id: "DE123456789", address: { street: "Werkstr. 1", postal_code: "28195", city: "Bremen", country: "DE" } };
  const csv = documentsToCsv([
    { ...base, kind: "invoice", number: "INV-2027-0001", issue_date: "2027-01-05", status: "Cancelled", subtotal: 200, tax: 38, total: 238, cancels: "" },
    { ...base, kind: "credit_note", number: "CN-2027-0001", issue_date: "2027-01-06", status: "Issued", subtotal: -200, tax: -38, total: -238, cancels: "INV-2027-0001" },
    { ...base, kind: "invoice", number: "DRAFT-1", issue_date: "2027-01-07", status: "Draft", subtotal: 1, tax: 0, total: 1, cancels: "" },
    { ...base, kind: "invoice", number: "INV-2027-0002", issue_date: "2027-01-08", status: "Issued", subtotal: "10", tax: "1.9", total: "11.9", cancels: "", customer: 'Müller "Präzision", GmbH' },
  ]);
  const lines = csv.replace(/^\uFEFF/, "").split("\r\n");
  assert.equal(lines.length, 4, "header + 3 issued documents; the draft is left out");
  assert.equal(lines[0].split(",").length, EXPORT_COLUMNS.length);
  assert.match(lines[2], /^Credit note,CN-2027-0001,2027-01-06,.*,-200\.00,-38\.00,-238\.00,INV-2027-0001$/);
  assert.match(lines[3], /"Müller ""Präzision"", GmbH",DE123456789/);
});
