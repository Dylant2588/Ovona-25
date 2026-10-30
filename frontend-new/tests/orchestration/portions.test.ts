import assert from "node:assert/strict";
import test from "node:test";
import { solveMealPortions } from "../../lib/orchestration/portions.ts";
import { recipeProteinFamilies } from "../../lib/recipes/candidates.ts";
import { reviewedRecipe } from "./recipe-fixtures.ts";
import { normalizePlannerProfile } from "../../lib/orchestration/normalize-profile.ts";
import type { VerifiedCandidateMeal } from "../../lib/orchestration/types.ts";
const meal = (calories: number, protein: number) => ({ nutrition: { calories, protein, carbs: 0, fat: 0 } }) as VerifiedCandidateMeal;

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
