import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

test("restricted and control fallback profiles preserve targets, allergens, recipe variety and swaps", () => {
  const require = createRequire(import.meta.url);
  assert.doesNotThrow(() => require("../../scripts/fallback-regression-test.cjs"));
});
