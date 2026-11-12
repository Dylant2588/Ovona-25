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
  proteinType: ["plant", "mixed", "poultry", "fish"][Number.parseInt(id.match(/(\d+)/)?.[1] ?? "0", 10) % 4],
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

test("a lower soft-score replacement wins on daily calories and leaves other meals intact", () => {
  const original = scheduledWeek();
  const highScore = candidate("a-inaccurate", "breakfast", { proteinType: "new", prepMinutes: 0, cost: 0, nutrition: { calories: 600, protein: 26, carbs: 0, fat: 0 } });
  const precise = candidate("b-precise", "breakfast", { proteinType: "new", prepMinutes: 30, cost: 19 });
  const outcome = replaceMeal(original, { day: 1, slot: "breakfast" }, [highScore, precise], profile());
  assert.ok(outcome.ok);
  assert.equal(outcome.value.days[0].meals[0].candidateId, precise.id);
  for (const [dayIndex, day] of original.days.entries()) for (const [mealIndex, meal] of day.meals.entries()) {
    if (dayIndex === 0 && meal.slot === "breakfast") continue;
    assert.strictEqual(outcome.value.days[dayIndex].meals[mealIndex], meal);
  }
});

test("replacement optimises only its own portion and preserves both snack identities", () => {
  const p = normalizePlannerProfile({ ...validRawProfile, calorieTarget: 2500, proteinTarget: 150, requiredSlots: ["breakfast", "snack", "lunch", "snack", "dinner"] });
  const generated = orchestrateWeek(p, [...weekCandidates(), ...Array.from({ length: 7 }, (_, i) => candidate(`extra-snack-${i}`, "snack"))]);
  assert.ok(generated.ok);
  const original = generated.value;
  const replacement = candidate("new-breakfast", "breakfast", { proteinType: "new", nutrition: { calories: 600, protein: 40, carbs: 0, fat: 0 } });
  const outcome = replaceMeal(original, { day: 1, slot: "breakfast" }, [replacement], p);
  assert.ok(outcome.ok);
  const day = outcome.value.days[0];
  assert.ok(Math.abs(day.meals.reduce((s, m) => s + Math.round(m.nutrition.calories * m.nutritionPortionMultiplier), 0) - 2500) <= 1);
  for (const [dayIndex, oldDay] of original.days.entries()) for (const [mealIndex, meal] of oldDay.meals.entries()) {
    if (dayIndex === 0 && meal.slot === "breakfast") continue;
    assert.strictEqual(outcome.value.days[dayIndex].meals[mealIndex], meal);
  }
});

test("replacement cannot introduce a third meal from one protein family", () => {
  const generated = scheduledWeek();
  const original = { days: generated.days.map((day, index) => index ? day : { ...day, meals: day.meals.map((meal, mealIndex) =>
    mealIndex === 1 || mealIndex === 2 ? { ...meal, proteinFamilies: ["shared"] } : meal) }) };
  const replacement = candidate("third-shared", "breakfast", { proteinFamilies: ["shared"] });
  const before = JSON.stringify(original);
  assert.equal(replaceMeal(original, { day: 1, slot: "breakfast" }, [replacement], profile()).ok, false);
  assert.equal(JSON.stringify(original), before);
});

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
