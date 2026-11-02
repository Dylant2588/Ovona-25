import assert from "node:assert/strict";
import test from "node:test";
import { buildFinalIngredientLedger } from "../../lib/ingredient-ledger.ts";

test("compatible mass and volume units consolidate without rescaling servings again", () => {
  const meals = [{ ingredients: [
    { name: "Chicken breast", amount: 0.25, unit: "kg" },
    { name: "Chicken breast", amount: 125, unit: "g" },
    { name: "Milk", amount: 0.2, unit: "l" },
    { name: "Milk", amount: 50, unit: "ml" },
  ] }];
  const before = structuredClone(meals);
  const rows = buildFinalIngredientLedger(meals);
  assert.equal(rows.length, 2);
  assert.equal(rows.find(r => r.name === "Chicken breast")?.quantity, 375);
  assert.equal(rows.find(r => r.name === "Chicken breast")?.unit, "g");
  assert.equal(rows.find(r => r.name === "Milk")?.quantity, 250);
  assert.equal(rows.find(r => r.name === "Milk")?.unit, "ml");
  assert.deepEqual(meals, before);
});

test("shopping aliases cannot replace fresh or unspecified foods with different ingredient forms", () => {
  const rows = buildFinalIngredientLedger([{ ingredients: [
    { name: "Tuna", amount: 100, unit: "g" },
    { name: "Tinned tuna", amount: 50, unit: "g" },
    { name: "Tuna canned", amount: 25, unit: "g" },
    { name: "Tofu", amount: 80, unit: "g" },
    { name: "Firm tofu", amount: 60, unit: "g" },
    { name: "Extra-firm tofu", amount: 40, unit: "g" },
    { name: "Extra firm tofu", amount: 20, unit: "g" },
  ] }]);
  assert.equal(rows.length, 5);
  assert.equal(rows.find(r => r.name === "Tuna")?.quantity, 100);
  assert.equal(rows.find(r => r.name === "Tinned tuna")?.quantity, 75);
  assert.equal(rows.find(r => r.name === "Tofu")?.quantity, 80);
  assert.equal(rows.find(r => r.name === "Firm tofu")?.quantity, 60);
  assert.equal(rows.find(r => r.name === "Extra-firm tofu")?.quantity, 60);
});

test("small measured values survive aggregation and display noise is removed only at the final sum", () => {
  const rows = buildFinalIngredientLedger([{ ingredients: [
    { name: "Salt", amount: 0.00004, unit: "kg" },
    { name: "Salt", amount: 0.00000004, unit: "kg" },
    { name: "Spice", amount: 0.00004, unit: "g" },
    { name: "Oil", amount: 0.1, unit: "ml" },
    { name: "Oil", amount: 0.2, unit: "ml" },
  ] }]);
  assert.equal(rows.find(r => r.name === "Salt")?.quantity, 0.04004);
  assert.equal(rows.find(r => r.name === "Spice")?.quantity, 0.00004);
  assert.equal(rows.find(r => r.name === "Oil")?.quantity, 0.3);
  assert.ok(rows.every(r => r.quantity === r.amountNeeded && r.quantity > 0));
});

test("incompatible dimensions, food states and slices stay separate while safe synonyms consolidate", () => {
  const rows = buildFinalIngredientLedger([{ ingredients: [
    { name: "Olive oil", amount: 10, unit: "g" },
    { name: "Olive oil", amount: 10, unit: "ml" },
    { name: "Bread", amount: 2, unit: "slice" },
    { name: "Bread", amount: 1, unit: "each" },
    { name: "Rice cooked", amount: 100, unit: "g" },
    { name: "Rice raw", amount: 50, unit: "g" },
    { name: "Scallions", amount: 10, unit: "g" },
    { name: "Spring onions", amount: 15, unit: "g" },
    { name: "Whole wheat wraps", amount: 1, unit: "each" },
    { name: "Whole grain wrap", amount: 1, unit: "each" },
  ] }, { mealKind: "social", ingredients: [{ name: "Not required", amount: 5, unit: "g" }] }]);
  assert.equal(rows.length, 9);
  assert.equal(rows.find(r => r.name === "Scallions")?.quantity, 25);
  assert.equal(rows.filter(r => r.name === "Olive oil").length, 2);
  assert.equal(rows.filter(r => r.name === "Bread").length, 2);
  assert.equal(rows.some(r => r.name === "Not required"), false);
});
