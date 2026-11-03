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
