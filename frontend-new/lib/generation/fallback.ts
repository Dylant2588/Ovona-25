import {
  generateFallbackMealPlan,
  swapMealInPlan,
  type MealInstance,
  type PreferencesInput,
} from "@/lib/meal-generator";
import type { GenerationContext, MealConcept, NutritionistOutput } from "@/lib/generation/types";

const toPreferences = (context: GenerationContext): PreferencesInput => ({
  tastes: [],
  goal: "maintain",
  mealComplexity: context.maxPrepMinutes <= 10 ? "simple" : "normal",
  macroTargets: {
    calories: context.calorieTarget,
    protein: context.proteinTarget,
    carbs: context.carbTarget,
    fat: context.fatTarget,
  },
  profile: {
    dietaryMode: context.dietaryMode === "mixed" ? null : context.dietaryMode,
    allergies: context.allergies,
    dislikes: context.dislikes,
    cuisines: context.cuisinePreferences,
    mealsPerDay: context.mealsPerDay === 3 ? 3 : 5,
  },
});

const toMealConcept = (
  meal: MealInstance,
  day: number,
  slot?: string,
  includeAlternativePointers = false
): MealConcept => ({
  day,
  slot: slot ?? meal.mealSlot,
  name: meal.title,
  ingredients: (meal.baseIngredients?.length ? meal.baseIngredients : meal.ingredients).map(
    (ingredient) => ingredient.name
  ),
  steps:
    meal.steps && meal.steps.length
      ? meal.steps
      : ["Combine all ingredients.", "Cook until done and plate immediately."],
  cuisine:
    meal.tags.find((tag) =>
      ["asian", "mediterranean", "mexican", "indian", "british", "american"].includes(
        tag.toLowerCase()
      )
    ) ?? "mixed",
  protein_type: meal.proteinType ?? "mixed",
  prep_minutes: meal.readyInMinutes || 15,
  ...(includeAlternativePointers ? { for_day: day, for_slot: slot ?? meal.mealSlot } : {}),
});

export function fallbackToStaticLibrary(context: GenerationContext): NutritionistOutput {
  const preferences = toPreferences(context);
  const plan = generateFallbackMealPlan(preferences);
  const meals: MealConcept[] = [];
  const alternatives: MealConcept[] = [];

  plan.days.forEach((day, dayIndex) => {
    day.meals.forEach((meal, mealIndex) => {
      const dayNumber = dayIndex + 1;
      meals.push(toMealConcept(meal, dayNumber));

      try {
        const swappedPlan = swapMealInPlan(plan, dayIndex, mealIndex, preferences);
        const alternativeMeal = swappedPlan.days[dayIndex]?.meals?.[mealIndex];
        if (alternativeMeal) {
          alternatives.push(
            toMealConcept(
              alternativeMeal,
              dayNumber,
              meal.mealSlot,
              true
            )
          );
        }
      } catch {
        alternatives.push({
          ...toMealConcept(meal, dayNumber, meal.mealSlot, true),
          name: `${meal.title} (Alt)`,
        });
      }
    });
  });

  return {
    meals,
    alternatives,
    source: "fallback",
  };
}
