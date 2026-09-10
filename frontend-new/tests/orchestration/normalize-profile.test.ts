import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_PLANNER_POLICY } from "../../lib/orchestration/policy.ts";
import { normalizePlannerProfile } from "../../lib/orchestration/normalize-profile.ts";
import { PlannerInputError } from "../../lib/orchestration/types.ts";
import { validRawProfile } from "./fixtures.ts";

test("normalizes a legacy profile into frozen hard constraints and soft preferences", () => {
  const profile = normalizePlannerProfile({
    ...validRawProfile,
    allergies: [" Peanut ", "PEANUT"],
    dislikes: [" Mushroom ", "mushroom"],
    dietaryRules: ["Vegetarian"],
  });

  assert.equal(profile.calorieTarget, 2200);
  assert.equal(profile.proteinTarget, 160);
  assert.deepEqual(profile.hardConstraints.allergies, ["peanut"]);
  assert.deepEqual(profile.hardConstraints.dietaryRules, ["vegetarian"]);
  assert.deepEqual(profile.softPreferences.dislikes, ["mushroom"]);
  assert.equal(profile.householdSize, 2);
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(Object.isFrozen(profile.hardConstraints.allergies), true);
  assert.deepEqual(profile.policy.calorieBand, { min: 0.95, max: 1.08 });
  assert.deepEqual(profile.policy.proteinBand, { min: 0.98, max: 1.1 });
});

test("rejects non-finite and out-of-policy hard values with a 400-mappable input error", () => {
  for (const invalid of [
    { calorieTarget: Number.NaN },
    { calorieTarget: Number.POSITIVE_INFINITY },
    { calorieTarget: -1 },
    { proteinTarget: 2000 },
    { maxPrepMinutes: -1 },
    { householdSize: 0 },
    { householdSize: 1.5 },
  ]) {
    assert.throws(
      () => normalizePlannerProfile({ ...validRawProfile, ...invalid }),
      (error: unknown) => error instanceof PlannerInputError && error.statusCode === 400,
    );
  }
});

test("accepts explicit policy overrides without silently clamping restrictions", () => {
  const policy = { ...DEFAULT_PLANNER_POLICY, maxPrepMinutes: 15 };
  assert.throws(() => normalizePlannerProfile(validRawProfile, policy), PlannerInputError);
});
