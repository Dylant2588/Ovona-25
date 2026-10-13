import { randomUUID } from "crypto";
import { imageForMeal } from "@/lib/meal-images";
import type { MealInstance, PreferencesInput, WeeklyMealPlan } from "@/lib/meal-generator";
import type { GenerationArtifacts, GenerationSupabase, PortionedMeal } from "./types";
import { buildDeterministicPlanningInput } from "@/lib/orchestration/candidate-adapter";
import { orchestrateWeek } from "@/lib/orchestration/schedule";
import { approvePlanForUser, MealApprovalError } from "@/lib/recipes/plan-boundary";
import type { ConstraintDatabase } from "@/lib/recipes/server-constraints";
import { supabaseServer } from "@/lib/supabaseServer";

const sum = (meals: MealInstance[]) => meals.reduce((total, meal) => ({ calories: total.calories + meal.macros.calories,
  protein: total.protein + meal.macros.protein, carbs: total.carbs + meal.macros.carbs, fat: total.fat + meal.macros.fat }),
{ calories: 0, protein: 0, carbs: 0, fat: 0 });

export async function generateWeeklyPlanWithArtifacts(userId: string,
  options?: { preferences?: PreferencesInput; supabase?: GenerationSupabase }): Promise<GenerationArtifacts> {
  const database = options?.supabase ?? await supabaseServer();
  const hydrated = await buildDeterministicPlanningInput(userId, { ...options, supabase: database });
  if (!hydrated.ok) throw new MealApprovalError(hydrated.error.code, hydrated.error.reasons, hydrated.error.statusCode);
  const { context, recipes, profile, candidates, history } = hydrated.value;
  const schedule = orchestrateWeek(profile, candidates, history);
  if (!schedule.ok) throw new MealApprovalError("insufficient_reviewed_catalogue", schedule.error.violations);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  let weeklyPlan: WeeklyMealPlan = {
    id: randomUUID(), userId, weekStart: weekStart.toISOString(), generatedAt: new Date().toISOString(),
    preferenceSignature: JSON.stringify({ calories: context.calorieTarget, protein: context.proteinTarget }),
    days: schedule.value.days.map((day) => {
      const date = new Date(weekStart); date.setDate(date.getDate() + day.day - 1);
      const meals = day.meals.map((selected): MealInstance => {
        const recipe = recipes.find((entry) => `${entry.id}:${selected.slot}` === selected.candidateId);
        if (!recipe) throw new MealApprovalError("meal_approval_failed", ["Reviewed recipe identity was lost during selection."]);
        const baseIngredients = recipe.ingredients.map((ingredient) => ({ name: ingredient.name,
          amount: ingredient.amount / recipe.servings, unit: ingredient.unit, category: "Produce" }));
        const multiplier = selected.nutritionPortionMultiplier;
        return { instanceId: randomUUID(), baseId: recipe.id, recipeVersion: recipe.version, mealSlot: selected.slot,
          title: recipe.title, description: recipe.description, steps: [...recipe.steps], recipeSteps: [...recipe.steps],
          tags: ["reviewed-recipe"], image: imageForMeal({ title: recipe.title, mealSlot: selected.slot, image: recipe.image }),
          readyInMinutes: recipe.readyInMinutes, portionMultiplier: multiplier, baseMacros: { ...recipe.macros },
          macros: { calories: Math.round(recipe.macros.calories * multiplier), protein: Math.round(recipe.macros.protein * multiplier),
            carbs: Math.round(recipe.macros.carbs * multiplier), fat: Math.round(recipe.macros.fat * multiplier) },
          baseIngredients, ingredients: baseIngredients.map((ingredient) => ({ ...ingredient, amount: ingredient.amount * multiplier })), proteinType: recipe.proteinType };
      });
      return { id: randomUUID(), label: date.toLocaleDateString("en-US", { weekday: "long" }), date: date.toISOString(), meals, totals: sum(meals) };
    }), weeklyTotals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  };
  weeklyPlan = await approvePlanForUser(database as unknown as ConstraintDatabase, userId, weeklyPlan, options?.preferences);
  // The reviewed catalogue has no retailer-price evidence yet. Routes omit this internal neutral value.
  const adjustedPlan: PortionedMeal[] = [];
  return { context, practical: { adjustedPlan, shoppingList: [], weeklyTotal: 0, substitutionsMade: [] },
    alternatives: [], source: "db", weeklyPlan };
}

export async function generateWeeklyPlan(userId: string, options?: { preferences?: PreferencesInput }): Promise<WeeklyMealPlan> {
  return (await generateWeeklyPlanWithArtifacts(userId, options)).weeklyPlan;
}
