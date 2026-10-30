import type { FoodCompositionSnapshot, RecipeRecord } from "../../lib/recipes/types.ts";
import { calculateRecipeNutrition } from "../../lib/recipes/nutrition.ts";
import { reviewedRecipe } from "./recipe-fixtures.ts";

/** Synthetic hand-computable inputs only; these are not real composition values. */
export const syntheticFood = (): FoodCompositionSnapshot => ({
  id: "synthetic-chicken-raw", revision: "test-v1", name: "Synthetic chicken calculation fixture", state: "raw",
  basis: { amount: 100, unit: "g" }, macros: { calories: 140, protein: 20, carbs: 0, fat: 5 },
  source: { publisher: "Ovona automated tests", dataset: "synthetic hand-computed fixtures", version: "test-v1", reference: "test-only: not real food data", retrievedAt: "2026-10-29T00:00:00Z", licence: "test-only synthetic values", foodCode: "synthetic-chicken" },
});

export const calculatedRecipe = (): RecipeRecord => {
  const recipe = reviewedRecipe();
  recipe.ingredients[0].nutrition = { food: syntheticFood(), quantityState: "raw", mappingReference: "synthetic explicit chicken test mapping" };
  recipe.ingredients[1].nutrition = { food: { ...syntheticFood(), id: "synthetic-spinach-raw", name: "Synthetic spinach fixture", macros: { calories: 20, protein: 0, carbs: 5, fat: 0 }, source: { ...syntheticFood().source, foodCode: "synthetic-spinach" } }, quantityState: "raw", mappingReference: "synthetic explicit spinach test mapping" };
  const result = calculateRecipeNutrition(recipe);
  if (!result.ok) throw new Error(result.errors.join("; "));
  recipe.macros = { ...result.calculation.perServingMacros };
  recipe.nutrition = { method: "ingredient_calculated_v1", reference: "synthetic hand-computed ingredient fixture", reviewed: true, calculation: result.calculation };
  return recipe;
};
