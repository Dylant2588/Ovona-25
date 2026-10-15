import assert from "node:assert/strict";
import test from "node:test";

import { buildOrchestrationShoppingList } from "../../lib/orchestration/shopping.ts";
import type { SelectedMeal, WeekSchedule } from "../../lib/orchestration/types.ts";
import { buildFinalIngredientLedger } from "../../lib/ingredient-ledger.ts";

const selected = (id: string, householdMultiplier = 2, nutritionMultiplier = 1, recipeServings = 1): SelectedMeal => ({
  candidateId: id,
  slot: "breakfast",
  title: id,
  similarityKey: id,
  ingredients: [
    { name: id.endsWith("1") ? "Chickpeas" : "Chickpea", normalizedName: "chickpea", quantity: 10, unit: "g", pantry: false },
    { name: "Olive oil", normalizedName: "olive oil", quantity: 2, unit: "ml", pantry: true },
  ],
  nutrition: { calories: 500, protein: 30, carbs: 50, fat: 15 },
  cost: 2,
  prepMinutes: 15,
  isLeftover: false,
  recipeServings,
  nutritionPortionMultiplier: nutritionMultiplier,
  householdPortionMultiplier: householdMultiplier,
  servings: recipeServings * nutritionMultiplier * householdMultiplier,
  score: { candidate: {} as never, components: { nutrition: 1, preference: 0, reuse: 0, prep: 0, cost: 0, repetition: 0, diversity: 0 }, total: 1, facts: ["target contribution"] },
  explanation: "Selected for target contribution.",
});

const sevenDayWeek = (mealForDay: (day: number) => SelectedMeal): WeekSchedule => ({
  days: Array.from({ length: 7 }, (_, index) => ({ day: index + 1, meals: [mealForDay(index + 1)] })),
});

test("aggregates all seven days, merges canonical duplicates, and separates pantry items with provenance", () => {
  const list = buildOrchestrationShoppingList(sevenDayWeek((day) => selected(`meal-${day}`)));

  assert.equal(list.buyItems.length, 1);
  assert.equal(list.pantryItems.length, 1);
  assert.deepEqual(list.buyItems[0], {
    name: "Chickpeas",
    displayName: "Chickpeas",
    normalizedName: "chickpea",
    quantity: 140,
    amountNeeded: 140,
    amountToBuy: 140,
    unit: "g",
    pantry: false,
    sourceMealIds: ["meal-1", "meal-2", "meal-3", "meal-4", "meal-5", "meal-6", "meal-7"],
  });
  assert.equal(list.pantryItems[0]!.quantity, 28);
  assert.deepEqual(list.pantryItems[0]!.sourceMealIds, ["meal-1", "meal-2", "meal-3", "meal-4", "meal-5", "meal-6", "meal-7"]);
});

test("uses the already materialized household servings exactly once", () => {
  const scaledWeek = (householdSize: number): WeekSchedule => ({
    days: Array.from({ length: 7 }, (_, index) => ({
      day: index + 1,
      meals: index === 0 ? [selected("scaled", householdSize, 1.25, 3)] : [],
    })),
  });
  const smallHousehold = scaledWeek(2);
  const largerHousehold = scaledWeek(4);

  const smallLine = buildOrchestrationShoppingList(smallHousehold).buyItems.find((item) => item.sourceMealIds.includes("scaled"))!;
  const largerLine = buildOrchestrationShoppingList(largerHousehold).buyItems.find((item) => item.sourceMealIds.includes("scaled"))!;
  assert.equal(smallHousehold.days[0]!.meals[0]!.servings, 7.5);
  assert.equal(smallLine.quantity, 75);
  assert.equal(largerHousehold.days[0]!.meals[0]!.servings, 15);
  assert.equal(largerLine.quantity, 150);
  assert.equal(largerLine.quantity, smallLine.quantity * 2);
});

test("uses final meal ingredients as the shopping ledger without substituting base ingredients", () => {
  const finalChicken = { name: "Chicken breast", amount: 150, unit: "g", category: "Protein" };
  const list = buildFinalIngredientLedger(Array.from({ length: 4 }, () => ({ ingredients: [finalChicken] })));

  assert.deepEqual(list, [{
    name: "Chicken breast",
    displayName: "Chicken breast",
    unit: "g",
    category: "Protein",
    quantity: 600,
    amountNeeded: 600,
  }]);
  assert.equal(list.some((item) => item.name.toLowerCase().includes("turkey")), false);
});
