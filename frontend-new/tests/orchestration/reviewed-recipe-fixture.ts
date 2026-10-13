import type { RecipeRecord } from "../../lib/recipes/types.ts";
import type { WeeklyMealPlan } from "../../lib/meal-generator.ts";
export const reviewedRecipe = (): RecipeRecord => ({ id: "test-reviewed", version: 1, title: "Reviewed fixture", description: "Test only",
  slots: ["breakfast", "lunch", "dinner", "snack"], ingredients: [{ name: "Chickpeas", canonicalId: "chickpea", amount: 200, unit: "g", allergens: [], dietaryFlags: [], reviewed: true }],
  steps: ["Cook and serve."], servings: 1, readyInMinutes: 10, macros: { calories: 550, protein: 40, carbs: 60, fat: 16 }, proteinType: "plant", image: "/images/meals/bowl.svg",
  source: { kind: "internal", reference: "test-fixture", rights: "Test only", reviewed: true }, nutrition: { method: "test", reference: "Test fixture", reviewed: true },
  review: { status: "approved", reviewedBy: "test-reviewer", reviewedAt: "2026-10-12T00:00:00Z" } });
export const reviewedPlan = (): WeeklyMealPlan => {
  const recipe = reviewedRecipe();
  return { id: "plan-test", userId: "user-1", weekStart: "2026-10-12T00:00:00Z", generatedAt: "2026-10-12T00:00:00Z", preferenceSignature: "test",
    days: Array.from({ length: 7 }, (_, index) => ({ id: `day-${index}`, label: `Day ${index}`, date: `2026-10-${12 + index}T00:00:00Z`,
      meals: (["breakfast", "lunch", "dinner"] as const).map((mealSlot) => ({ instanceId: `${index}-${mealSlot}`, baseId: recipe.id, recipeVersion: 1,
        title: recipe.title, mealSlot, description: recipe.description, steps: [...recipe.steps], recipeSteps: [...recipe.steps], tags: ["approved"],
        image: recipe.image, readyInMinutes: 10, portionMultiplier: 1, macros: { ...recipe.macros }, baseMacros: { ...recipe.macros },
        ingredients: recipe.ingredients.map(({ name, amount, unit }) => ({ name, amount, unit, category: "Produce" })),
        baseIngredients: recipe.ingredients.map(({ name, amount, unit }) => ({ name, amount, unit, category: "Produce" })), proteinType: "plant" })),
      totals: { calories: 1650, protein: 120, carbs: 180, fat: 48 } })), weeklyTotals: { calories: 11550, protein: 840, carbs: 1260, fat: 336 } };
};
export const recipeDatabase = (options: { allergy?: string; failed?: string; recipes?: RecipeRecord[]; dietary?: string } = {}) => ({
  from: (table: string) => ({ select: () => ({ eq: async () => ({ error: options.failed === table ? { message: "unavailable" } : null,
    data: table === "recipe_library" ? (options.recipes ?? [reviewedRecipe()]).map((record) => ({ id: record.id, version: record.version, record })) :
      table === "user_allergies" ? options.allergy ? [{ allergy_name: options.allergy }] : [] :
      table === "user_preferences" ? [{ dietary_mode: options.dietary ?? "mixed" }] : [] }) }) }),
});
