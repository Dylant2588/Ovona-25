import assert from "node:assert/strict";
import test from "node:test";

import { normalizePlannerProfile } from "../../lib/orchestration/normalize-profile.ts";
import { replaceMeal } from "../../lib/orchestration/replace.ts";
import { orchestrateWeek } from "../../lib/orchestration/schedule.ts";
import type { VerifiedCandidateMeal } from "../../lib/orchestration/types.ts";
import { validRawProfile } from "./fixtures.ts";

const profile = () => normalizePlannerProfile({ ...validRawProfile, calorieTarget: 2000, proteinTarget: 120 });

const candidate = (id: string, slot: VerifiedCandidateMeal["slot"], extra: Partial<VerifiedCandidateMeal> = {}): VerifiedCandidateMeal => ({
  id,
  slot,
  title: id,
  verified: true,
  ingredients: [{ name: `${id} ingredient`, normalizedName: `${id}-ingredient`, quantity: 100, unit: "g", pantry: false }],
  allergens: [],
  dietaryTags: ["vegetarian"],
  nutrition: { calories: 500, protein: 30, carbs: 50, fat: 15 },
  cost: 2,
  prepMinutes: 15,
  servings: 2,
  ...extra,
});

const weekCandidates = (): VerifiedCandidateMeal[] =>
  (["breakfast", "lunch", "dinner", "snack"] as const).flatMap((slot) =>
    Array.from({ length: 7 }, (_, index) => candidate(`${slot}-${String(index + 1).padStart(2, "0")}`, slot)),
  );

const scheduledWeek = () => {
  const result = orchestrateWeek(profile(), weekCandidates(), {});
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("fixture week must be valid");
  return result.value;
};

test("replaces exactly one target slot immutably with a score-derived explanation", () => {
  const original = scheduledWeek();
  const target = { day: 1, slot: "breakfast" as const };
  const oldMeal = original.days[0]!.meals.find((meal) => meal.slot === target.slot)!;
  const replacement = candidate("breakfast-replacement", "breakfast", { title: "Quick replacement" });

  const outcome = replaceMeal(original, target, [...weekCandidates(), replacement], profile(), {}, profile().policy);

  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.notEqual(outcome.value.days[0]!.meals.find((meal) => meal.slot === target.slot)!.candidateId, oldMeal.candidateId);
  assert.equal(outcome.value.days[0]!.meals.find((meal) => meal.slot === target.slot)!.candidateId, replacement.id);
  assert.match(outcome.value.days[0]!.meals.find((meal) => meal.slot === target.slot)!.explanation, /target contribution|ingredient reuse|prep time|cost/i);
  assert.deepEqual(original.days.flatMap((day) => day.meals).map((meal) => meal.candidateId), scheduledWeek().days.flatMap((day) => day.meals).map((meal) => meal.candidateId));
  for (const day of original.days) {
    for (const meal of day.meals) {
      if (day.day === target.day && meal.slot === target.slot) continue;
      assert.strictEqual(outcome.value.days.find((item) => item.day === day.day)!.meals.find((item) => item.slot === meal.slot), meal);
    }
  }
});

test("rejects unsafe, repeated, or malformed replacement candidates without relaxing the existing week", () => {
  const original = scheduledWeek();
  const target = { day: 1, slot: "breakfast" as const };
  const oldMeal = original.days[0]!.meals.find((meal) => meal.slot === target.slot)!;
  const repeated = candidate("already-used", "breakfast", { similarityKey: original.days[1]!.meals.find((meal) => meal.slot === target.slot)!.similarityKey });
  const unsafe = candidate("unsafe", "breakfast", { allergens: ["peanut"] });

  const outcome = replaceMeal(original, target, [oldMeal as unknown as VerifiedCandidateMeal, repeated, unsafe], profile(), {}, profile().policy);

  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.equal(outcome.error.code, "insufficient_replacement_candidates");
  assert.equal(original.days[0]!.meals.find((meal) => meal.slot === target.slot)!.candidateId, oldMeal.candidateId);
});
