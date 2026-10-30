import assert from "node:assert/strict";
import test from "node:test";

import { normalizePlannerProfile } from "../../lib/orchestration/normalize-profile.ts";
import { orchestrateWeek } from "../../lib/orchestration/schedule.ts";
import { validateAndRepairWeek } from "../../lib/orchestration/validate.ts";
import { validRawProfile } from "./fixtures.ts";

const profile = (householdSize = 3) => normalizePlannerProfile({ ...validRawProfile, calorieTarget: 2000, proteinTarget: 120, householdSize });

const candidates = (calories: number, protein: number, options: { allergens?: readonly string[] } = {}) =>
  (["breakfast", "lunch", "dinner", "snack"] as const).flatMap((slot) =>
    Array.from({ length: 7 }, (_, index) => ({
      id: `${slot}-${index}`,
      slot,
      title: `${slot}-${index}`,
      verified: true as const,
      ingredients: [{ name: `${slot}-${index}`, normalizedName: `${slot}-${index}`, quantity: 100, unit: "g", pantry: false }],
      allergens: options.allergens ?? [],
      dietaryTags: ["vegetarian"],
      nutrition: { calories, protein, carbs: 40, fat: 12 },
      cost: 2,
      prepMinutes: 15,
      servings: 2,
      proteinType: ["plant", "mixed", "poultry", "fish"][index % 4],
    })),
  );

test("accepts inclusive calorie and protein tolerance boundaries for every one of seven days", () => {
  const result = orchestrateWeek(profile(), candidates(475, 29.4), {});
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.days.length, 7);
  for (const day of result.value.days) assert.equal(day.meals.length, 4);
});

test("repairs individual nutrition portions deterministically and materializes household servings exactly once", () => {
  const result = orchestrateWeek(profile(3), candidates(450, 28), {});
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const meal = result.value.days[0]!.meals[0]!;
  assert.ok(meal.nutritionPortionMultiplier > 1);
  assert.equal(meal.householdPortionMultiplier, 3);
  assert.equal(meal.servings, meal.recipeServings * meal.nutritionPortionMultiplier * meal.householdPortionMultiplier);
  assert.notEqual(meal.servings, meal.recipeServings * meal.nutritionPortionMultiplier * meal.householdPortionMultiplier * 3);
});

test("returns reason-coded invalidity when bounded repair cannot meet daily bands or use an unsafe candidate", () => {
  const impossible = orchestrateWeek(profile(), candidates(100, 5), {});
  assert.equal(impossible.ok, false);
  if (!impossible.ok) assert.equal(impossible.error.code, "insufficient_candidates");

  const valid = orchestrateWeek(profile(), candidates(475, 29.4));
  assert.equal(valid.ok, true);
  if (valid.ok) {
    const unrecoverable = validateAndRepairWeek(profile(), { days: valid.value.days.map(day => ({
      ...day, meals: day.meals.map(meal => ({ ...meal, nutrition: { calories: 100, protein: 5, carbs: 10, fat: 2 } })),
    })) });
    assert.equal(unrecoverable.ok, false);
    if (!unrecoverable.ok) assert.ok(unrecoverable.error.violations.some(violation => violation.code === "repair_exhausted"));
  }

  const unsafe = orchestrateWeek(profile(), candidates(450, 28, { allergens: ["peanut"] }), {});
  assert.equal(unsafe.ok, false);
  if (!unsafe.ok) assert.equal(unsafe.error.code, "insufficient_candidates");
});

test("rejects a macro-valid week when exact selected ingredients create an impractical protein basket", () => {
  const chickenHeavy = candidates(475, 29.4).map((candidate) => ({
    ...candidate,
    ingredients: [{ name: "Chicken breast", normalizedName: "chicken breast", quantity: 250, unit: "g", pantry: false }],
  }));

  const result = orchestrateWeek(profile(1), chickenHeavy, {});

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "insufficient_candidates");
  }
  const valid = orchestrateWeek(profile(1), candidates(475, 29.4));
  assert.equal(valid.ok, true);
  if (valid.ok) {
    const direct = validateAndRepairWeek(profile(1), { days: valid.value.days.map(day => ({ ...day,
      meals: day.meals.map(meal => ({ ...meal, ingredients: [{ name: "Chicken breast", normalizedName: "chicken breast", quantity: 250, unit: "g", pantry: false }] })),
    })) });
    assert.equal(direct.ok, false);
    if (!direct.ok) assert.ok(direct.error.violations.some(violation => violation.code === "practical_quantity_exceeded"));
  }
});

test("missing protein metadata cannot evade the daily repetition cap", () => {
  assert.equal(orchestrateWeek(profile(1), candidates(475, 29.4).map(item => ({ ...item, proteinType: undefined }))).ok, false);
});
