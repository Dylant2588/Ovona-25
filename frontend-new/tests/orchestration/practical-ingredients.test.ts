import assert from "node:assert/strict";
import test from "node:test";
import { practicalIngredientViolations, hasPracticalIngredientBasket } from "../../lib/orchestration/practical-ingredients.ts";
import { recipesToCandidates } from "../../lib/recipes/candidates.ts";
import { reviewedRecipe } from "./recipe-fixtures.ts";
import { normalizePlannerProfile } from "../../lib/orchestration/normalize-profile.ts";
import { validRawProfile } from "./fixtures.ts";

const profile = (householdSize = 1) => normalizePlannerProfile({ ...validRawProfile, householdSize });
const meal = (name: string, normalizedName: string, quantity: number, unit = "g", householdPortionMultiplier = 1) => ({
  ingredients: [{ name, normalizedName, quantity, unit, pantry: false }],
  nutritionPortionMultiplier: 1, householdPortionMultiplier,
});

test("specific reviewed egg-white names cannot evade the weekly cap through the broad egg taxonomy", () => {
  const recipe = reviewedRecipe();
  recipe.ingredients = [{ name: "Egg whites", canonicalId: "egg", amount: 370, unit: "g", allergens: ["eggs"], dietaryFlags: ["animal_product"], reviewed: true }];
  recipe.servings = 1;
  const candidate = recipesToCandidates([recipe], {})[0];
  const week = Array.from({ length: 7 }, () => ({ ingredients: candidate.ingredients, nutritionPortionMultiplier: 1, householdPortionMultiplier: 1 }));
  assert.deepEqual(practicalIngredientViolations(week), [{ label: "Egg whites", grams: 2590, maxGrams: 1000 }]);
  assert.equal(hasPracticalIngredientBasket(week, profile()), false);
  assert.deepEqual(practicalIngredientViolations([meal("Eggs", "egg", 1500)]), []);
});

test("exact kilogram conversion and household allowances use the same mass budget", () => {
  const kilograms = [meal("Liquid egg whites", "egg", 1.001, "kg")];
  assert.equal(hasPracticalIngredientBasket(kilograms, profile()), false);
  const household = [meal("Egg whites", "egg", 1000, "g", 2)];
  assert.equal(hasPracticalIngredientBasket(household, profile(2)), true);
  assert.equal(hasPracticalIngredientBasket([meal("Egg whites", "egg", 1001, "g", 2)], profile(2)), false);
  assert.equal(hasPracticalIngredientBasket([meal("Chicken breast", "chicken", 1.401, "kg")], profile()), false);
  assert.equal(hasPracticalIngredientBasket([meal("Roast turkey slices", "turkey", 1.201, "kg")], profile()), false);
});

test("unmeasured concentrated-protein units fail closed without guessing density or whole-egg weights", () => {
  for (const unit of ["ml", "each"]) {
    const unknown = [meal("Egg whites", "egg", 300, unit)];
    assert.equal(hasPracticalIngredientBasket(unknown, profile()), false);
    assert.equal(practicalIngredientViolations(unknown)[0]?.grams, null);
  }
  assert.equal(hasPracticalIngredientBasket([meal("Eggs", "egg", 2, "large")], profile()), true);
});
