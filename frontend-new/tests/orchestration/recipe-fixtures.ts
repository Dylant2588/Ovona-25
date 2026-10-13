import type { RecipeRecord } from "../../lib/recipes/types.ts";
export const reviewedRecipe = (): RecipeRecord => ({
  id: "reviewed-chicken", version: 1, title: "Reviewed chicken", description: "Measured fixture",
  slots: ["lunch", "dinner"], ingredients: [
    { name: "Chicken breast", canonicalId: "chicken", amount: 400, unit: "g", allergens: [], mayContain: [], dietaryFlags: ["meat"], reviewed: true },
    { name: "Spinach", canonicalId: "spinach", amount: 200, unit: "g", allergens: [], mayContain: [], dietaryFlags: [], reviewed: true },
  ], steps: ["Cook the chicken thoroughly; serve with spinach."], servings: 2,
  readyInMinutes: 20, macros: { calories: 300, protein: 40, carbs: 5, fat: 10 }, proteinType: "poultry", image: "/images/meals/plate.svg",
  source: { kind: "internal", reference: "test fixture only", rights: "test-only", reviewed: true },
  nutrition: { method: "measured", reference: "test-only measured calculation", reviewed: true },
  review: { status: "approved", reviewedBy: "fixture-reviewer", reviewedAt: "2026-10-12T12:00:00Z" },
});
export const reviewedMeal = () => {
  const recipe = reviewedRecipe();
  return { instanceId: "fixture-instance", baseId: recipe.id, recipeVersion: recipe.version, mealSlot: "lunch", title: recipe.title,
    description: recipe.description, tags: [], image: recipe.image, readyInMinutes: recipe.readyInMinutes,
    portionMultiplier: 1, baseIngredients: recipe.ingredients.map(i => ({ name: i.name, unit: i.unit, amount: i.amount / recipe.servings })),
    ingredients: recipe.ingredients.map(i => ({ name: i.name, unit: i.unit, amount: i.amount / recipe.servings })),
    steps: [...recipe.steps], recipeSteps: [...recipe.steps], macros: { ...recipe.macros }, baseMacros: { ...recipe.macros }, proteinType: "poultry" };
};
