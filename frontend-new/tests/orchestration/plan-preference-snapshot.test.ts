import assert from "node:assert/strict";
import test from "node:test";
import { planForPreferenceSnapshot } from "../../lib/plan-preference-snapshot.ts";
import { reviewedPlan } from "./reviewed-recipe-fixture.ts";

test("saved and cached plan payload uses the preference signature checked on reload", () => {
  const plan = reviewedPlan(); plan.preferenceSignature = '{"calories":1830,"protein":216}';
  const before = structuredClone(plan);
  const saved = planForPreferenceSnapshot(plan, "complete-preference-snapshot");
  const reloaded = JSON.parse(JSON.stringify(saved));
  assert.equal(reloaded.preferenceSignature, "complete-preference-snapshot");
  assert.deepEqual(reloaded.days, before.days);
  assert.deepEqual(plan, before);
  assert.equal(planForPreferenceSnapshot(plan, null), plan);
});
