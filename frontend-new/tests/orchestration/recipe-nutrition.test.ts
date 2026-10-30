import assert from "node:assert/strict";
import test from "node:test";
import { calculateRecipeNutrition, calculatedNutritionErrors, newApprovalNutritionErrors } from "../../lib/recipes/nutrition.ts";
import { convertIngredientQuantity } from "../../lib/recipes/quantities.ts";
import { calculatedRecipe, syntheticFood } from "./calculated-recipe-fixtures.ts";
import { reviewedRecipe } from "./recipe-fixtures.ts";

test("hand-computed batch is divided by servings once, without input mutation", () => {
  const recipe = calculatedRecipe(); const before = structuredClone(recipe);
  const result = calculateRecipeNutrition(recipe);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.calculation.batchMacros, { calories: 600, protein: 80, carbs: 10, fat: 20 });
  assert.deepEqual(result.calculation.perServingMacros, { calories: 300, protein: 40, carbs: 5, fat: 10 });
  assert.deepEqual(recipe, before);
  assert.deepEqual(calculatedNutritionErrors(recipe), []);
  assert.deepEqual(newApprovalNutritionErrors(recipe), []);
});

test("mass, volume and explicitly evidenced density/count/spoon conversions", () => {
  const ingredient = calculatedRecipe().ingredients[0];
  const convert = (amount: number, unit: string, basis: "g" | "ml" | "each", conversion?: unknown) => convertIngredientQuantity({
    ...ingredient, amount, unit, nutrition: { ...ingredient.nutrition!, food: { ...syntheticFood(), basis: { amount: 100, unit: basis } }, ...(conversion ? { conversion } : {}) },
  });
  assert.deepEqual(convert(0.4, "kg", "g"), { ok: true, sourceAmount: 400, sourceUnit: "g" });
  assert.deepEqual(convert(0.2, "l", "ml"), { ok: true, sourceAmount: 200, sourceUnit: "ml" });
  assert.deepEqual(convert(50, "ml", "g", { reference: "synthetic density", densityGramsPerMl: 0.8 }), { ok: true, sourceAmount: 40, sourceUnit: "g" });
  assert.deepEqual(convert(2, "large", "g", { reference: "synthetic weighed large item", gramsPerUnit: { unit: "large", grams: 60 } }), { ok: true, sourceAmount: 120, sourceUnit: "g" });
  assert.deepEqual(convert(2, "tbsp", "g", { reference: "synthetic measured spoon", mlPerUnit: { unit: "tbsp", ml: 15 }, densityGramsPerMl: 2 }), { ok: true, sourceAmount: 60, sourceUnit: "g" });
  assert.deepEqual(convert(3, "each", "each"), { ok: true, sourceAmount: 3, sourceUnit: "each" });
  assert.equal(convert(50, "ml", "g").ok, false);
  assert.equal(convert(2, "piece", "g", { reference: "wrong named item", gramsPerUnit: { unit: "large", grams: 60 } }).ok, false);
  assert.equal(convert(1, "tbsp", "ml").ok, false);
  assert.equal(convert(10, "g", "g", { reference: "invalid even when unused", densityGramsPerMl: 0 }).ok, false);
});

test("unknown nutrients, states, sources and invalid quantities fail closed with line diagnostics", () => {
  const mutations: Array<(r: ReturnType<typeof calculatedRecipe>) => void> = [
    r => { r.servings = 0; }, r => { r.servings = Infinity; },
    r => { r.ingredients[0].amount = -1; }, r => { r.ingredients[0].amount = NaN; },
    r => { r.ingredients[0].nutrition!.quantityState = "cooked"; },
    r => { r.ingredients[0].nutrition!.food.macros.protein = null as unknown as number; },
    r => { r.ingredients[0].nutrition!.food.macros.protein = "Tr" as unknown as number; },
    r => { r.ingredients[0].nutrition!.food.source.reference = ""; },
    r => { r.ingredients[0].nutrition!.food.source.retrievedAt = "invalid"; },
    r => { delete r.ingredients[0].nutrition; },
  ];
  for (const mutate of mutations) {
    const recipe = calculatedRecipe(); mutate(recipe);
    const result = calculateRecipeNutrition(recipe); assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors.length);
  }
  const recipe = calculatedRecipe(); recipe.ingredients[0].amount = -1;
  const result = calculateRecipeNutrition(recipe);
  if (!result.ok) assert.match(result.errors.join(" "), /Ingredient 1/);
  assert.equal(calculateRecipeNutrition(null).ok, false);
});

test("stored calculation rejects stale quantities, revisions, lines, servings and output macros", () => {
  const mutations: Array<(r: ReturnType<typeof calculatedRecipe>) => void> = [
    r => { r.ingredients[0].amount += 1; }, r => { r.servings += 1; },
    r => { r.ingredients[0].nutrition!.food.revision = "changed"; },
    r => { r.nutrition.calculation!.lines[0].sourceAmount += 1; },
    r => { r.nutrition.calculation!.lines[0].ingredientIndex = 1; },
    r => { r.macros.protein += 1; },
    r => { r.nutrition.calculation!.perServingMacros.fat += 0.01; },
    r => { delete r.nutrition.calculation; },
  ];
  for (const mutate of mutations) { const recipe = calculatedRecipe(); mutate(recipe); assert.ok(calculatedNutritionErrors(recipe).length); }
  const legacy = reviewedRecipe(); assert.deepEqual(calculatedNutritionErrors(legacy), []);
  assert.ok(newApprovalNutritionErrors(legacy).length);
  const bypass = calculatedRecipe(); bypass.nutrition.method = "measured";
  assert.ok(newApprovalNutritionErrors(bypass).length);
});

test("distinct foods under the same allergy taxonomy remain independent and precision is stable", () => {
  const recipe = calculatedRecipe();
  recipe.ingredients[1].canonicalId = recipe.ingredients[0].canonicalId;
  const result = calculateRecipeNutrition(recipe); assert.equal(result.ok, true);
  if (result.ok) assert.notEqual(result.calculation.lines[0].foodId, result.calculation.lines[1].foodId);
  recipe.ingredients[0].amount = Number.MAX_VALUE;
  assert.equal(calculateRecipeNutrition(recipe).ok, false);
  const fractional = calculatedRecipe(); fractional.ingredients[0].amount = 1 / 3;
  const a = calculateRecipeNutrition(fractional); const b = calculateRecipeNutrition(fractional);
  assert.deepEqual(a, b);
});

test("cooked and drained source state is retained exactly rather than collapsed", () => {
  const ingredient = calculatedRecipe().ingredients[0];
  ingredient.nutrition!.food.state = "cooked_drained";
  ingredient.nutrition!.quantityState = "cooked_drained";
  assert.equal(convertIngredientQuantity(ingredient).ok, true);
  ingredient.nutrition!.quantityState = "drained";
  assert.equal(convertIngredientQuantity(ingredient).ok, false);
});

test("malformed JSON unit and state objects return diagnostics instead of throwing", () => {
  const bad = { toString: null };
  type MalformedRecipe = { ingredients: Array<{ unit: unknown; nutrition: { quantityState: unknown; food: { basis: { unit: unknown } }; conversion?: unknown } }> };
  for (const mutate of [
    (r: MalformedRecipe) => { r.ingredients[0].unit = bad; },
    (r: MalformedRecipe) => { r.ingredients[0].nutrition.quantityState = bad; },
    (r: MalformedRecipe) => { r.ingredients[0].nutrition.food.basis.unit = bad; },
    (r: MalformedRecipe) => { r.ingredients[0].nutrition.conversion = { reference: "synthetic", gramsPerUnit: { unit: bad, grams: 50 } }; },
    (r: MalformedRecipe) => { r.ingredients[0].nutrition.conversion = { reference: "synthetic", mlPerUnit: { unit: bad, ml: 5 } }; },
  ]) {
    const recipe = calculatedRecipe(); mutate(recipe as unknown as MalformedRecipe);
    assert.equal(calculateRecipeNutrition(recipe).ok, false);
  }
});
