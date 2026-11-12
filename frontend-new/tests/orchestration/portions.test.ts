import assert from "node:assert/strict";
import test from "node:test";
import { solveMealPortions } from "../../lib/orchestration/portions.ts";
import { recipeProteinFamilies } from "../../lib/recipes/candidates.ts";
import { reviewedRecipe } from "./recipe-fixtures.ts";
import { normalizePlannerProfile } from "../../lib/orchestration/normalize-profile.ts";
import type { VerifiedCandidateMeal } from "../../lib/orchestration/types.ts";
const meal = (calories: number, protein: number) => ({ nutrition: { calories, protein, carbs: 0, fat: 0 } }) as VerifiedCandidateMeal;
const roundedCalories = (meals: VerifiedCandidateMeal[], portions: number[]) => meals.reduce((sum, m, i) => sum + Math.round(m.nutrition.calories * portions[i]), 0);

test("calorie objective improves an already acceptable unscaled combination", () => {
  const profile = normalizePlannerProfile({ calorieTarget: 1000, proteinTarget: 60, requiredSlots: ["breakfast", "dinner"] });
  const meals = [meal(500, 30), meal(550, 35)];
  const result = solveMealPortions(profile, meals);
  assert.ok(result);
  assert.ok(Math.abs(roundedCalories(meals, result) - 1000) <= 1);
});

test("independent portions aim at calories instead of stopping at the first in-band point", () => {
  const profile = normalizePlannerProfile({ calorieTarget: 800, proteinTarget: 100, requiredSlots: ["breakfast", "dinner"] });
  const meals = [meal(600, 10), meal(200, 80)];
  const result = solveMealPortions(profile, meals);
  assert.ok(result);
  assert.ok(Math.abs(roundedCalories(meals, result) - 800) <= 1);
});

test("an infeasible exact calorie target retains the nearest verified protein-safe projection", () => {
  const profile = normalizePlannerProfile({ calorieTarget: 1000, proteinTarget: 108, requiredSlots: ["breakfast"] });
  const meals = [meal(1000, 100)];
  const result = solveMealPortions(profile, meals);
  assert.ok(result);
  assert.ok(roundedCalories(meals, result) >= 1058 && roundedCalories(meals, result) <= 1060);
  assert.ok(Math.round(100 * result[0]) >= 108 * .98);
  let projections = 0;
  const bounded = solveMealPortions(profile, meals, [], { canContinue: () => { projections++; return true; } });
  assert.ok(bounded);
  assert.ok(projections < 300, `Provably infeasible narrowed calorie intervals consumed ${projections} iterations`);
});

test("fixed surrounding portions stay fixed while the remaining meal reaches the calorie target", () => {
  const profile = normalizePlannerProfile({ calorieTarget: 1000, proteinTarget: 60, requiredSlots: ["breakfast", "dinner"] });
  const meals = [meal(500, 30), meal(500, 30)];
  const result = solveMealPortions(profile, meals, [], { bounds: [{ min: 1.2, max: 1.2 }, { min: .7, max: 1.5 }] });
  assert.ok(result);
  assert.equal(result[0], 1.2);
  assert.ok(Math.abs(roundedCalories(meals, result) - 1000) <= 1);
  assert.equal(solveMealPortions(profile, meals, [], { bounds: [{ min: .6, max: 1.2 }, { min: .7, max: 1.5 }] }), null);
});

test("independent portions solve a day that no shared multiplier can satisfy", () => {
  const profile = normalizePlannerProfile({ calorieTarget: 800, proteinTarget: 100, requiredSlots: ["breakfast", "dinner"] });
  const result = solveMealPortions(profile, [meal(600, 10), meal(200, 80)]);
  assert.ok(result); if (!result) return;
  assert.notEqual(result[0], result[1]);
  const c = Math.round(600 * result[0]) + Math.round(200 * result[1]);
  const p = Math.round(10 * result[0]) + Math.round(80 * result[1]);
  assert.ok(c >= 760 && c <= 864 && p >= 98 && p <= 110);
});

test("portion bounds and ingredient budgets remain hard constraints", () => {
  const profile = normalizePlannerProfile({ calorieTarget: 800, proteinTarget: 100, requiredSlots: ["breakfast", "dinner"] });
  assert.equal(solveMealPortions(profile, [meal(600, 1), meal(200, 1)]), null);
  assert.equal(solveMealPortions(profile, [meal(600, 10), meal(200, 80)], [{ amounts: [300, 300], max: 100 }]), null);
  const result = solveMealPortions(profile, [meal(600, 10), meal(200, 80)], [{ amounts: [100, 0], max: 100 }]);
  assert.ok(result); if (result) assert.ok(result[0] <= 1 && result.every(x => x >= .7 && x <= 1.5));
});

test("reviewed ingredient identities distinguish turkey, chicken, pea and beans without inventing protein labels", () => {
  const recipe = reviewedRecipe();
  const ingredient = recipe.ingredients[0];
  for (const [canonicalId, expected] of [["chicken", "chicken"], ["turkey", "turkey"], ["unreviewed_pea_protein", "pea"], ["unreviewed_mashed_white_beans", "beans"]]) {
    recipe.ingredients = [{ ...ingredient, canonicalId }];
    assert.deepEqual(recipeProteinFamilies(recipe), [expected]);
  }
  recipe.ingredients = [{ ...ingredient, reviewed: false }];
  assert.deepEqual(recipeProteinFamilies(recipe), [recipe.proteinType]);
});
