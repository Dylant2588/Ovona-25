import assert from "node:assert/strict";
import test from "node:test";
import { calculateRecipeMicronutrients, calculateRecipeNutrition } from "../../lib/recipes/nutrition.ts";
import { calculatedRecipe } from "./calculated-recipe-fixtures.ts";

test("micronutrients preserve measured zero and per-nutrient partial/unknown data without changing macro evidence", () => {
  const recipe = calculatedRecipe();
  recipe.ingredients = recipe.ingredients.slice(0, 1);
  const macroBefore = calculateRecipeNutrition(recipe);
  Object.assign(recipe.ingredients[0].nutrition!.food, { micronutrients: { calcium_mg: 0, iron_mg: 2, vitamin_c_mg: null } });
  const r = calculateRecipeMicronutrients(recipe);
  assert.equal(r.calcium_mg.status, "complete"); assert.equal(r.calcium_mg.amount, 0);
  assert.equal(r.iron_mg.amount, 4); assert.equal(r.vitamin_c_mg.status, "unknown");
  assert.equal(r.vitamin_c_mg.amount, null); assert.equal(r.vitamin_c_mg.knownSubtotal, null);
  assert.deepEqual(calculateRecipeNutrition(recipe), macroBefore);
  recipe.ingredients.push({ ...structuredClone(recipe.ingredients[0]), amount: 100, nutrition: undefined });
  const partial = calculateRecipeMicronutrients(recipe);
  assert.equal(partial.iron_mg.status, "partial"); assert.equal(partial.iron_mg.amount, null);
  assert.equal(partial.iron_mg.knownSubtotal, 4); assert.equal(partial.iron_mg.knownIngredients, 1);
});

test("micronutrient scaling reuses compatible quantities, evidenced dimensions and servings once", () => {
  const recipe = calculatedRecipe();
  recipe.ingredients = recipe.ingredients.slice(0, 1);
  Object.assign(recipe.ingredients[0].nutrition!.food, { micronutrients: { calcium_mg: 10 } });
  recipe.ingredients[0].unit = "kg"; recipe.ingredients[0].amount = 0.4;
  assert.equal(calculateRecipeMicronutrients(recipe).calcium_mg.amount, 20);
  recipe.servings = 4;
  assert.equal(calculateRecipeMicronutrients(recipe).calcium_mg.amount, 10);
  recipe.ingredients[0].unit = "ml"; recipe.ingredients[0].amount = 200;
  assert.equal(calculateRecipeMicronutrients(recipe).calcium_mg.status, "unknown");
  recipe.ingredients[0].nutrition!.conversion = { reference: "Synthetic measured density", densityGramsPerMl: 2 };
  assert.equal(calculateRecipeMicronutrients(recipe).calcium_mg.amount, 10);
});

test("invalid provenance, state and nonnumeric nutrient facts remain unknown", () => {
  for (const value of [null, undefined, "Tr", "N", NaN, Infinity, -1]) {
    const recipe = calculatedRecipe();
    Object.assign(recipe.ingredients[0].nutrition!.food, { micronutrients: { iron_mg: value } });
    assert.equal(calculateRecipeMicronutrients(recipe).iron_mg.status, "unknown");
  }
  for (const mutate of [(r: ReturnType<typeof calculatedRecipe>) => { r.ingredients[0].nutrition!.food.source.reference = ""; },
    (r: ReturnType<typeof calculatedRecipe>) => { r.ingredients[0].nutrition!.quantityState = "cooked"; }]) {
    const recipe = calculatedRecipe(); Object.assign(recipe.ingredients[0].nutrition!.food, { micronutrients: { iron_mg: 2 } });
    mutate(recipe); assert.equal(calculateRecipeMicronutrients(recipe).iron_mg.status, "unknown");
  }
});
