import { randomUUID } from "crypto";
import { imageForMeal } from "@/lib/meal-images";
import type { MealInstance, PreferencesInput, WeeklyMealPlan } from "@/lib/meal-generator";
import type { GenerationArtifacts, GenerationSupabase, PortionedMeal } from "./types";
import { buildDeterministicPlanningInput } from "@/lib/orchestration/candidate-adapter";
import { orchestrateWeek } from "@/lib/orchestration/schedule";
import { approvePlanForUser, MealApprovalError } from "@/lib/recipes/plan-boundary";
import type { ConstraintDatabase } from "@/lib/recipes/server-constraints";
import { supabaseServer } from "@/lib/supabaseServer";
import { requestReviewedProposal, resolveReviewedProposal } from "./ai-proposal";

const sum = (meals: MealInstance[]) => meals.reduce((total, meal) => ({ calories: total.calories + meal.macros.calories,
  protein: total.protein + meal.macros.protein, carbs: total.carbs + meal.macros.carbs, fat: total.fat + meal.macros.fat }),
{ calories: 0, protein: 0, carbs: 0, fat: 0 });

export async function generateWeeklyPlanWithArtifacts(userId: string,
  options?: { preferences?: PreferencesInput; supabase?: GenerationSupabase }): Promise<GenerationArtifacts> {
  const database = options?.supabase ?? await supabaseServer();
  const hydrated = await buildDeterministicPlanningInput(userId, { ...options, supabase: database });
  if (!hydrated.ok) {
    const message = hydrated.error.code === "insufficient_reviewed_catalogue"
      ? "No reviewed recipes can safely make this plan yet. Review recipes first, then generate a checked replacement. Your existing plan is unchanged."
      : "The reviewed recipe library is unavailable. Your existing plan is unchanged.";
    throw new MealApprovalError(hydrated.error.code, hydrated.error.reasons, hydrated.error.statusCode, message);
  }
  const { context, recipes, profile, candidates, history } = hydrated.value;
  let rankedCandidates = [...candidates];
  // Without credentials the deterministic reviewed catalogue remains usable.
  // With credentials, a failed/refused proposal is explicit and leaves any
  // previously persisted plan untouched because this function never writes.
  if (process.env.OPENAI_API_KEY) {
    const requested = await requestReviewedProposal(candidates.map((candidate) => {
      const [recipeId] = candidate.id.split(":");
      const recipe = recipes.find((entry) => entry.id === recipeId);
      return { slot: candidate.id, recipeId, recipeVersion: recipe?.version ?? -1, title: candidate.title };
    }), context.planningInput);
    // The model may only rank server-loaded, reviewed candidates. If its
    // optional ranking call fails, the deterministic scheduler remains safe
    // and useful; do not turn a temporary AI outage into a failed meal plan.
    if (!requested.ok) {
      console.warn("[generate-plan] AI ranking unavailable; using deterministic reviewed schedule", {
        code: requested.error.code,
      });
    } else {
      const resolved = resolveReviewedProposal(requested.value, recipes, candidates.map((candidate) => candidate.id));
      if (!resolved.ok) {
        console.warn("[generate-plan] AI ranking was invalid; using deterministic reviewed schedule", {
          code: resolved.error.code,
        });
      } else {
        const priority = new Map(resolved.value.map((choice, index) => [choice.slot, index]));
        rankedCandidates = candidates.map((candidate) => ({ ...candidate, aiPriority: priority.get(candidate.id) }));
      }
    }
  }
  const schedule = orchestrateWeek(profile, rankedCandidates, history);
  if (!schedule.ok) {
    const practicalBasketFailure = schedule.error.violations.some(
      (violation) => violation.code === "practical_quantity_exceeded"
    );
    const coverageReason = schedule.error.violations.find(
      (violation) => violation.code === "insufficient_candidates"
    )?.message;
    throw new MealApprovalError(
      practicalBasketFailure ? "impractical_ingredient_basket" : "insufficient_reviewed_catalogue",
      schedule.error.violations,
      422,
      practicalBasketFailure
        ? "The available reviewed recipes would create an impractical weekly ingredient basket. Your existing plan is unchanged."
        : coverageReason
          ? `${coverageReason} Review more recipes for that meal type, or choose a longer preparation limit. Your existing plan is unchanged.`
          : undefined
    );
  }
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  let weeklyPlan: WeeklyMealPlan = {
    id: randomUUID(), userId, weekStart: weekStart.toISOString(), generatedAt: new Date().toISOString(),
    preferenceSignature: JSON.stringify({ calories: context.calorieTarget, protein: context.proteinTarget }),
    days: schedule.value.days.map((day) => {
      const date = new Date(weekStart); date.setDate(date.getDate() + day.day - 1);
      const materializeMeals = (portionMultiplier: number) => day.meals.map((selected): MealInstance => {
        const recipe = recipes.find((entry) => `${entry.id}:${selected.slot}` === selected.candidateId);
        if (!recipe) throw new MealApprovalError("meal_approval_failed", ["Reviewed recipe identity was lost during selection."]);
        const baseIngredients = recipe.ingredients.map((ingredient) => ({ name: ingredient.name,
          amount: ingredient.amount / recipe.servings, unit: ingredient.unit, category: "Produce" }));
        const multiplier = portionMultiplier;
        return { instanceId: randomUUID(), baseId: recipe.id, recipeVersion: recipe.version, mealSlot: selected.slot,
          title: recipe.title, description: recipe.description, steps: [...recipe.steps], recipeSteps: [...recipe.steps],
          tags: ["reviewed-recipe"], image: imageForMeal({ title: recipe.title, mealSlot: selected.slot, image: recipe.image }),
          readyInMinutes: recipe.readyInMinutes, portionMultiplier: multiplier, baseMacros: { ...recipe.macros },
          macros: { calories: Math.round(recipe.macros.calories * multiplier), protein: Math.round(recipe.macros.protein * multiplier),
            carbs: Math.round(recipe.macros.carbs * multiplier), fat: Math.round(recipe.macros.fat * multiplier) },
          baseIngredients, ingredients: baseIngredients.map((ingredient) => ({ ...ingredient, amount: ingredient.amount * multiplier })), proteinType: recipe.proteinType };
      });
      // The scheduler works with decimal nutrition values while the plan stores
      // whole-number meal macros. Reconcile the final, displayed portions here
      // so rounding cannot push a day one calorie above an approval boundary.
      const initialMultiplier = day.meals[0]?.nutritionPortionMultiplier ?? 1;
      const calorieMin = profile.calorieTarget * profile.hardConstraints.calorieBand.min;
      const calorieMax = profile.calorieTarget * profile.hardConstraints.calorieBand.max;
      const proteinMin = profile.proteinTarget * profile.hardConstraints.proteinBand.min;
      const proteinMax = profile.proteinTarget * profile.hardConstraints.proteinBand.max;
      const isWithinFinalBands = (meals: MealInstance[]) => {
        const totals = sum(meals);
        return totals.calories >= calorieMin && totals.calories <= calorieMax &&
          totals.protein >= proteinMin && totals.protein <= proteinMax;
      };
      let meals = materializeMeals(initialMultiplier);
      if (!isWithinFinalBands(meals)) {
        for (let step = 1; step <= 100 && !isWithinFinalBands(meals); step += 1) {
          for (const direction of [-1, 1]) {
            const candidate = Number((initialMultiplier + direction * step * 0.0005).toFixed(6));
            if (candidate < 0.7 || candidate > 1.5) continue;
            const candidateMeals = materializeMeals(candidate);
            if (isWithinFinalBands(candidateMeals)) {
              meals = candidateMeals;
              break;
            }
          }
        }
      }
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
