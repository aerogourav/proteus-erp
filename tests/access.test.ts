import { test } from "node:test";
import assert from "node:assert/strict";
import { alertPayload, canCreateCompany, creatorList } from "../src/lib/erp/access.ts";

test("P14: only invited emails may create a company, independent of the sign-up setting", () => {
  const list = creatorList(" Owner@Example.test, second@example.test ,, ");
  assert.deepEqual(list, ["owner@example.test", "second@example.test"]);
  assert.equal(canCreateCompany("owner@example.test", list), true);
  assert.equal(canCreateCompany("OWNER@example.test", list), true, "case does not matter");
  assert.equal(canCreateCompany("stranger@example.test", list), false);
  assert.equal(canCreateCompany(undefined, list), false);
  assert.equal(canCreateCompany("owner@example.test", creatorList(undefined)), false, "no list set: nobody creates companies (fails closed)");
  assert.equal(canCreateCompany("x@example.test.evil", creatorList("x@example.test")), false);
});

test("P14: alerts carry only the path, route and a short message, never query strings", () => {
  const body = alertPayload({ path: "/app/production?token=secret", method: "POST", route: "/app/production", message: "x".repeat(900), digest: "123" });
  assert.equal(body.path, "/app/production");
  assert.equal(body.message.length, 300);
  assert.ok(!JSON.stringify(body).includes("secret"));
  assert.match(body.text, /BOH ERP server error/);
});
