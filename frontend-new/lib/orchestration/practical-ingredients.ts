import type { PlannerProfile, SelectedMeal } from "./types.ts";

// Per-adult weekly caps for concentrated proteins. Ingredient names are
// canonical ids in reviewed recipes, so separators must accept spaces,
// hyphens and underscores alike.
const WEEKLY_PROTEIN_INGREDIENT_LIMITS = [
  { label: "Chicken", pattern: /\bchicken(?:[\s_-]|$)/i, maxGrams: 1400 },
  { label: "Turkey", pattern: /\bturkey(?:[\s_-]|$)/i, maxGrams: 1200 },
  { label: "Egg whites", pattern: /\begg[\s_-]whites?\b/i, maxGrams: 1000 },
] as const;

export type PracticalIngredientViolation = Readonly<{ label: string; grams: number; maxGrams: number }>;

export const practicalIngredientViolations = (
  meals: readonly Pick<SelectedMeal, "ingredients" | "nutritionPortionMultiplier" | "householdPortionMultiplier">[],
): PracticalIngredientViolation[] => {
  const totals = WEEKLY_PROTEIN_INGREDIENT_LIMITS.map((limit) => ({ ...limit, grams: 0 }));
  meals.forEach((meal) => meal.ingredients.forEach((ingredient) => {
    if (ingredient.unit.trim().toLowerCase() !== "g") return;
    const matchingLimit = totals.find((limit) => limit.pattern.test(ingredient.normalizedName));
    if (matchingLimit) matchingLimit.grams += ingredient.quantity * meal.nutritionPortionMultiplier * meal.householdPortionMultiplier;
  }));
  return totals.filter((limit) => limit.grams > limit.maxGrams);
};

export const hasPracticalIngredientBasket = (
  meals: readonly Pick<SelectedMeal, "ingredients" | "nutritionPortionMultiplier" | "householdPortionMultiplier">[],
  profile: PlannerProfile,
) => practicalIngredientViolations(meals).every((limit) => limit.grams <= limit.maxGrams * profile.householdSize);
