import assert from "node:assert/strict";
import test from "node:test";
import { buildPlanNutritionSummary, type DisplayNutritionMapping } from "../../lib/recipes/plan-nutrition.ts";
import { reviewedPlan, reviewedRecipe } from "./reviewed-recipe-fixture.ts";
import { syntheticFood } from "./calculated-recipe-fixtures.ts";

test("source estimates are exact-version ingredient bindings, preserve macros and report partial coverage", () => {
  const plan = reviewedPlan(); const recipe = reviewedRecipe(); recipe.servings = 2;
  const mapping: DisplayNutritionMapping = { recipeId: recipe.id, recipeVersion: 1, ingredientIndex: 0,
    expectedName: "Chickpeas", expectedCanonicalId: "chickpea", nutrition: { food: { ...syntheticFood(), micronutrients: { calcium_mg: 20, iron_mg: 0 } }, quantityState: "raw", mappingReference: "Exact display test mapping" } };
  const before = structuredClone(plan);
  const r = buildPlanNutritionSummary(plan, [recipe], [mapping]);
  assert.deepEqual(plan, before); assert.deepEqual(r.days[0].macros, plan.days[0].totals);
  assert.equal(r.days[0].macroEvidence, "legacy_reviewed");
  assert.equal(r.days[0].micronutrients.calcium_mg.amount, 60);
  assert.equal(r.days[0].micronutrients.calcium_mg.estimated, true);
  assert.equal(r.days[0].micronutrients.iron_mg.amount, 0);
  assert.equal(r.days[0].micronutrients.vitamin_c_mg.status, "unknown");
  const swapped = structuredClone(plan); swapped.days[0].meals[0].recipeVersion = 2;
  const changed = buildPlanNutritionSummary(swapped, [{ ...recipe, version: 2 }, recipe], [mapping]);
  assert.equal(changed.days[0].micronutrients.calcium_mg.status, "partial");
  assert.equal(changed.days[0].micronutrients.calcium_mg.amount, null);
  assert.equal(changed.days[0].micronutrients.calcium_mg.knownSubtotal, 40);
  assert.equal(buildPlanNutritionSummary(plan, [recipe], [{ ...mapping, expectedCanonicalId: "milk" }]).days[0].micronutrients.calcium_mg.status, "unknown");
});

test("embedded source evidence takes precedence and portions, reload and social unknowns stay honest", () => {
  const plan = reviewedPlan(); const recipe = reviewedRecipe();
  recipe.ingredients[0].nutrition = { food: { ...syntheticFood(), micronutrients: { calcium_mg: 10 } }, quantityState: "raw", mappingReference: "Authoritative fixture" };
  plan.days[0].meals[0].portionMultiplier = 0.75;
  const r = buildPlanNutritionSummary(plan, [recipe], []);
  assert.equal(r.days[0].micronutrients.calcium_mg.amount, 55);
  assert.equal(r.days[0].micronutrients.calcium_mg.estimated, false);
  assert.deepEqual(buildPlanNutritionSummary(JSON.parse(JSON.stringify(plan)), [recipe], []), r);
  recipe.ingredients[0].nutrition.food.micronutrients!.calcium_mg = 1e306;
  assert.equal(Number.isFinite(buildPlanNutritionSummary(plan, [recipe], []).days[0].micronutrients.calcium_mg.amount), true);
  plan.days[0].meals[0].mealKind = "social";
  const social = buildPlanNutritionSummary(plan, [recipe], []).days[0];
  assert.equal(social.macroEvidence, "unknown"); assert.equal(social.micronutrients.calcium_mg.status, "partial");
});
