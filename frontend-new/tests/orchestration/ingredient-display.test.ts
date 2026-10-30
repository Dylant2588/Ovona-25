import assert from "node:assert/strict";
import test from "node:test";
import { formatIngredientLineForDisplay, formatShoppingLineForDisplay, humaniseAmount } from "../../lib/ingredient-display.ts";
import { buildFinalIngredientLedger } from "../../lib/ingredient-ledger.ts";

test("meal display keeps meaningful amounts without coarse rounding or excessive precision", () => {
  for (const [amount, unit, ingredientName, expected] of [
    [1.4, "each", "Eggs", "1.4 Eggs"],
    [0.5, "each", "Avocados", "0.5 Avocado"],
    [84, "g", "Oats", "84g Oats"],
    [7, "ml", "Olive oil", "7ml Olive oil"],
    [0.025, "kg", "Spinach", "25g Spinach"],
    [14.1725, "g", "Cocoa", "14g Cocoa"],
    [583.4498, "g", "Cucumber", "583g Cucumber"],
    [1.4567, "each", "Eggs", "1.5 Eggs"],
    [0.5, "slice", "Bread", "0.5 slice Bread"],
    [0, "each", "Eggs", "0 Eggs"],
  ] as const) assert.equal(formatIngredientLineForDisplay({ amount, unit, ingredientName }), expected);
});

test("shopping needed quantities match final meal ledger amounts without package rounding", () => {
  assert.deepEqual(formatShoppingLineForDisplay({ quantity: 4.2, unit: "each", ingredientName: "Eggs" }), { amount: "4.2", name: "Eggs" });
  assert.deepEqual(formatShoppingLineForDisplay({ quantity: 84, unit: "g", ingredientName: "Oats" }), { amount: "84g", name: "Oats" });
  assert.deepEqual(formatShoppingLineForDisplay({ quantity: 0.025, unit: "kg", ingredientName: "Spinach" }), { amount: "25g", name: "Spinach" });
  assert.deepEqual(formatShoppingLineForDisplay({ quantity: 583.4498, unit: "g", ingredientName: "Cucumber" }), { amount: "583g", name: "Cucumber" });
});

test("decimal presentation removes arithmetic noise without erasing small positive quantities", () => {
  assert.equal(humaniseAmount(0.1 + 0.2, "g", "Salt"), "0.3g");
  assert.equal(humaniseAmount(0.00004, "kg", "Salt"), "0.04g");
  assert.equal(humaniseAmount(0.025, "l", "Oil"), "25ml");
  assert.equal(humaniseAmount(1, "each", "Eggs"), "1");
  assert.equal(formatIngredientLineForDisplay({ amount: Number.NaN, unit: "each", ingredientName: "Eggs" }), "Quantity unavailable Eggs");
});

test("practical display never rewrites the materialized shopping quantities", () => {
  const rows = buildFinalIngredientLedger([{ ingredients: [{ name: "Cocoa", amount: 14.1725, unit: "g" }] }]);
  const before = structuredClone(rows);
  assert.deepEqual(formatShoppingLineForDisplay({ quantity: rows[0].quantity, unit: rows[0].unit, ingredientName: rows[0].name }), { amount: "14g", name: "Cocoa" });
  assert.deepEqual(rows, before);
  assert.equal(rows[0].quantity, 14.1725);
});

test("shopping preserves slices separately from whole counts of the same named ingredient", () => {
  const rows = buildFinalIngredientLedger([{ ingredients: [
    { name: "Bread", amount: 2, unit: "slice" },
    { name: "Bread", amount: 1, unit: "each" },
  ] }]);
  assert.equal(rows.length, 2);
  assert.equal(rows.find(row => row.unit === "slice")?.quantity, 2);
  assert.equal(rows.find(row => row.unit === "piece")?.quantity, 1);
  const sliced = rows.find(row => row.unit === "slice")!;
  assert.deepEqual(formatShoppingLineForDisplay({ quantity: sliced.quantity, unit: sliced.unit, ingredientName: sliced.name }), { amount: "2 slices", name: "Bread" });
});
