import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

test("legacy fallback and swaps preserve allergies and variety, with fail-closed nutrition validation", () => {
  const require = createRequire(import.meta.url);
  assert.doesNotThrow(() => require("../../scripts/fallback-regression-test.cjs"));
});
