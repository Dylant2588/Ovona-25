import assert from "node:assert/strict";
import test from "node:test";
import { shoppingMealSources, shoppingSourceLabel } from "../../lib/shopping-provenance.ts";
import { buildFinalIngredientLedger, ingredientLedgerKey } from "../../lib/ingredient-ledger.ts";
import { reviewedMethodForDisplay } from "../../lib/reviewed-method.ts";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { reviewedPlan } from "./reviewed-recipe-fixture.ts";
import type { WeeklyMealPlan, ShoppingListItem } from "../../lib/meal-generator.ts";

const ingredient = (amount: number, name = "Olives", unit = "g") => ({ name, amount, unit });

test("reported olives basket traces to four actual meals without confusing olive oil", () => {
  const days = [{ meals: [
    { title: "Turkey Cucumber Rolls", ingredients: [ingredient(23.78875)] },
    { title: "Turkey Cucumber Rolls", ingredients: [ingredient(25.56521739130435)] },
    { title: "White Bean Snack Box", ingredients: [ingredient(28.81524), ingredient(10, "Olive oil")] },
    { title: "Turkey Cucumber Rolls", ingredients: [ingredient(24.679025)] },
  ] }];
  const key = ingredientLedgerKey("Olives", "g");
  const sources = shoppingMealSources(days).get(key)!;
  assert.equal(sources.length, 2);
  assert.equal(sources[0].meals, 3);
  assert.equal(sources[1].meals, 1);
  assert.equal(shoppingSourceLabel(sources), "Turkey Cucumber Rolls (3 meals), White Bean Snack Box");
  const total = buildFinalIngredientLedger(days[0].meals).find(item => item.name === "Olives")!.quantity;
  assert.ok(Math.abs(total - 102.84823239130435) < 1e-10);
  assert.ok(Math.abs(sources.reduce((n, s) => n + s.quantity, 0) - total) < 1e-10);
});

test("provenance follows same-plan swaps and compatible units, not stale shopping data", () => {
  const initial = [{ meals: [{ title: "First", ingredients: [ingredient(0.025, "Olives", "kg"), ingredient(5)] }] }];
  const sources = shoppingMealSources(initial).get(ingredientLedgerKey("olives", "g"))!;
  assert.deepEqual(sources, [{ title: "First", meals: 1, quantity: 30, unit: "g" }]);
  const swapped = [{ meals: [{ title: "Replacement", ingredients: [ingredient(100, "Cucumber")] }] }];
  assert.equal(shoppingMealSources(swapped).has(ingredientLedgerKey("Olives", "g")), false);
  assert.equal(shoppingMealSources([{ meals: [{ title: "Meal out", mealKind: "social", ingredients: [ingredient(99)] }] }]).size, 0);
});

test("reviewed cooking instructions retain ingredient steps even when they mention packet directions", () => {
  const steps = ["Cook the rice according to package directions, then stir in the olives.", "Serve and enjoy."];
  assert.deepEqual(reviewedMethodForDisplay({ recipeVersion: 2, steps }), steps);
  assert.notEqual(reviewedMethodForDisplay({ recipeVersion: 2, steps }), steps);
  assert.deepEqual(reviewedMethodForDisplay({ recipeVersion: 2, recipeSteps: steps }), steps);
  assert.deepEqual(reviewedMethodForDisplay({ recipeVersion: 2 }), []);
  assert.equal(reviewedMethodForDisplay({ steps }), null);
});

test("production shopping builder uses batch-to-serving portions exactly once and retains small quantities", () => {
  const require = createRequire(import.meta.url);
  const { load } = require("../../scripts/export-recipe-library.cjs") as { load(path: string): { buildShoppingList(plan: WeeklyMealPlan): ShoppingListItem[] } };
  const { buildShoppingList } = load(fileURLToPath(new URL("../../lib/meal-generator.ts", import.meta.url)));
  const plan = reviewedPlan();
  // Recipe batch: 200g for two servings. Selected portion: 1.25 servings.
  for (const day of plan.days) for (const meal of day.meals) {
    meal.portionMultiplier = 1.25;
    meal.baseIngredients = [ingredient(100, "Chickpeas")];
    meal.ingredients = [ingredient(200 / 2 * 1.25, "Chickpeas"), ingredient(0.00004, "Spice")];
  }
  const before = structuredClone(plan);
  const list = buildShoppingList(plan);
  assert.equal(list.find(i => i.name === "Chickpeas")?.quantity, 125 * 21);
  assert.equal(list.find(i => i.name === "Spice")?.quantity, 0.00084);
  assert.deepEqual(plan, before);
});
