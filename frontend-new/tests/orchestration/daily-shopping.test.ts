import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { shoppingMealSources } from "../../lib/shopping-provenance.ts";
import { ingredientLedgerKey } from "../../lib/ingredient-ledger.ts";
import { formatShoppingLineForDisplay } from "../../lib/ingredient-display.ts";
import { reviewedPlan } from "./reviewed-recipe-fixture.ts";
import type { WeeklyMealPlan, ShoppingListItem } from "../../lib/meal-generator.ts";

const require = createRequire(import.meta.url);
const { load } = require("../../scripts/export-recipe-library.cjs") as { load(path: string): { buildShoppingList(plan: WeeklyMealPlan): ShoppingListItem[] } };
const { buildShoppingList } = load(fileURLToPath(new URL("../../lib/meal-generator.ts", import.meta.url)));
const ingredient = (name: string, amount: number, unit = "g") => ({ name, amount, unit, category: "Produce" });
function dailyFixture(): WeeklyMealPlan {
  const plan = reviewedPlan(); plan.scope = "day"; plan.days = [plan.days[0]];
  const base = plan.days[0].meals[0];
  plan.days[0].meals = Array.from({ length: 5 }, (_, index) => ({ ...base,
    instanceId: `daily-${index}`, baseId: index < 2 ? "repeat" : `recipe-${index}`, recipeVersion: 2, title: index < 2 ? "Repeated meal" : `Meal ${index}`,
    // Batch 200g for two servings, selected portion 1.25: already materialized 125g.
    portionMultiplier: 1.25, baseIngredients: [ingredient("Chicken breast", 100)],
    ingredients: [ingredient("Chicken breast", index % 2 ? 0.125 : 125, index % 2 ? "kg" : "g"),
      ingredient("Water", index % 2 ? 0.2 : 200, index % 2 ? "L" : "ml"),
      ingredient(index % 2 ? "Tinned tomatoes" : "Fresh tomatoes", 20), ingredient("Spice", 0.00004)],
  }));
  return plan;
}

test("five daily contributions equal the production shopping ledger without reapplying serving scale", () => {
  const plan = dailyFixture(), before = structuredClone(plan);
  const list = buildShoppingList(plan), sources = shoppingMealSources(plan.days);
  assert.equal(list.find(i => i.name === "Chicken breast")?.quantity, 625);
  assert.equal(list.find(i => i.name === "Water")?.quantity, 1000);
  assert.equal(list.find(i => i.name === "Fresh tomatoes")?.quantity, 60);
  assert.equal(list.find(i => i.name === "Tinned tomatoes")?.quantity, 40);
  assert.equal(list.find(i => i.name === "Spice")?.quantity, 0.0002);
  for (const item of list) {
    const contributions = sources.get(ingredientLedgerKey(item.name, item.unit))!;
    assert.ok(Math.abs(contributions.reduce((sum, source) => sum + source.quantity, 0) - item.quantity) < 1e-10);
    formatShoppingLineForDisplay({ quantity: item.quantity, unit: item.unit, ingredientName: item.name });
  }
  assert.equal(sources.get(ingredientLedgerKey("Chicken breast", "g"))?.[0].meals, 2);
  assert.deepEqual(plan, before);
});

test("swapped daily requirements and sources survive reload without obsolete ingredients", () => {
  const plan = dailyFixture();
  plan.days[0].meals[0] = { ...plan.days[0].meals[0], baseId: "replacement", title: "Replacement", ingredients: [ingredient("Cucumber", 14.1725)] };
  const reloaded = JSON.parse(JSON.stringify(plan)) as WeeklyMealPlan;
  assert.deepEqual(buildShoppingList(reloaded), buildShoppingList(plan));
  assert.deepEqual(shoppingMealSources(reloaded.days), shoppingMealSources(plan.days));
  assert.equal(buildShoppingList(reloaded).find(i => i.name === "Chicken breast")?.quantity, 500);
  const cucumber = buildShoppingList(reloaded).find(i => i.name === "Cucumber")!;
  assert.equal(cucumber.quantity, 14.1725);
  assert.equal(formatShoppingLineForDisplay({ quantity: cucumber.quantity, unit: cucumber.unit, ingredientName: cucumber.name }).amount, "14g");
  assert.equal(cucumber.quantity, 14.1725);
  assert.equal(shoppingMealSources(reloaded.days).get(ingredientLedgerKey("Cucumber", "g"))?.[0].title, "Replacement");
});
