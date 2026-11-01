import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "../src/lib/supabase/config.ts";

test("after sign-in, only same-site paths are followed", () => {
  assert.equal(safeNextPath("/app"), "/app");
  assert.equal(safeNextPath("/app/settings?tab=team"), "/app/settings?tab=team");
  assert.equal(safeNextPath(null), "/app");
  assert.equal(safeNextPath("https://evil.example"), "/app");
  assert.equal(safeNextPath("//evil.example"), "/app");
  assert.equal(safeNextPath("/\\evil.example"), "/app");
  assert.equal(safeNextPath("/app\r\nSet-Cookie: x"), "/app");
});
