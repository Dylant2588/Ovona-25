import { randomUUID } from "crypto";
import { imageForMeal } from "@/lib/meal-images";
import { preferenceSignatureFor, type MealInstance, type PreferencesInput, type WeeklyMealPlan } from "@/lib/meal-generator";
import type { GenerationArtifacts, GenerationSupabase, PortionedMeal } from "./types";
import { buildDeterministicPlanningInput } from "@/lib/orchestration/candidate-adapter";
import { orchestrateWeek } from "@/lib/orchestration/schedule";
import { approvePlanForUser, MealApprovalError } from "@/lib/recipes/plan-boundary";
import type { ConstraintDatabase } from "@/lib/recipes/server-constraints";
import { supabaseServer } from "@/lib/supabaseServer";
import { requestReviewedProposal, resolveReviewedProposal } from "./ai-proposal";
import { loadPreviousPlanRotation, sameRecipeDays } from "./previous-plan.ts";
import { practicalIngredientViolations } from "../orchestration/practical-ingredients.ts";

const sum = (meals: MealInstance[]) => meals.reduce((total, meal) => ({ calories: total.calories + meal.macros.calories,
  protein: total.protein + meal.macros.protein, carbs: total.carbs + meal.macros.carbs, fat: total.fat + meal.macros.fat }),
{ calories: 0, protein: 0, carbs: 0, fat: 0 });

export async function generateWeeklyPlanWithArtifacts(userId: string,
  options?: { preferences?: PreferencesInput; supabase?: GenerationSupabase; requireDifferent?: boolean }): Promise<GenerationArtifacts> {
  const database = options?.supabase ?? await supabaseServer();
  const hydrated = await buildDeterministicPlanningInput(userId, { ...options, supabase: database });
  if (!hydrated.ok) {
    const message = hydrated.error.code === "insufficient_reviewed_catalogue"
      ? "No reviewed recipes can safely make this plan yet. Review recipes first, then generate a checked replacement. Your existing plan is unchanged."
      : "The reviewed recipe library is unavailable. Your existing plan is unchanged.";
    throw new MealApprovalError(hydrated.error.code, hydrated.error.reasons, hydrated.error.statusCode, message);
  }
  const { context, recipes, profile, candidates, history } = hydrated.value;
  const previous = await loadPreviousPlanRotation(database, userId, recipes);
  const rotation = { ...history,
    recentCandidateIds: [...new Set([...history.recentCandidateIds, ...previous.recentCandidateIds])],
    recentSimilarityKeys: [...new Set([...(history.recentSimilarityKeys ?? []), ...previous.recentSimilarityKeys])],
    previousDayRecipeIds: previous.previousDayRecipeIds,
    differentFromDays: options?.requireDifferent ? previous.previousDayRecipeIds : undefined,
  };
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
  let schedule = orchestrateWeek(profile, rankedCandidates, rotation);
  // Recency and AI are ranking hints, not feasibility rules. A poor traversal
  // must not hide a valid week. Retry with the identical hard-safe pool, all
  // profile preferences and quantity limits, keeping the explicit new-week check.
  if (!schedule.ok) {
    schedule = orchestrateWeek(profile, candidates, { differentFromDays: rotation.differentFromDays });
  }
  if (!schedule.ok) {
    if (schedule.error.code === "planning_search_exhausted") {
      throw new MealApprovalError("planning_search_exhausted", schedule.error.violations, 422,
        "The planner could not find a complete practical week within its search limit. Your existing plan is unchanged. Try different meal targets or review more suitable recipes.");
    }
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
    preferenceSignature: options?.preferences ? preferenceSignatureFor(options.preferences) : "",
    days: schedule.value.days.map((day) => {
      const date = new Date(weekStart); date.setDate(date.getDate() + day.day - 1);
      const materializeMeals = (portionMultipliers: readonly number[]) => day.meals.map((selected, mealIndex): MealInstance => {
        const recipe = recipes.find((entry) => `${entry.id}:${selected.slot}` === selected.candidateId);
        if (!recipe) throw new MealApprovalError("meal_approval_failed", ["Reviewed recipe identity was lost during selection."]);
        const baseIngredients = recipe.ingredients.map((ingredient) => ({ name: ingredient.name,
          amount: ingredient.amount / recipe.servings, unit: ingredient.unit, category: "Produce" }));
        const multiplier = portionMultipliers[mealIndex];
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
      const initialMultipliers = day.meals.map(meal => meal.nutritionPortionMultiplier);
      const calorieMin = profile.calorieTarget * profile.hardConstraints.calorieBand.min;
      const calorieMax = profile.calorieTarget * profile.hardConstraints.calorieBand.max;
      const proteinMin = profile.proteinTarget * profile.hardConstraints.proteinBand.min;
      const proteinMax = profile.proteinTarget * profile.hardConstraints.proteinBand.max;
      const isWithinFinalBands = (meals: MealInstance[]) => {
        const totals = sum(meals);
        return totals.calories >= calorieMin && totals.calories <= calorieMax &&
          totals.protein >= proteinMin && totals.protein <= proteinMax;
      };
      let meals = materializeMeals(initialMultipliers);
      if (!isWithinFinalBands(meals)) {
        for (let step = 1; step <= 100 && !isWithinFinalBands(meals); step += 1) {
          for (const direction of [-1, 1]) {
            const candidates = initialMultipliers.map(multiplier => Number((multiplier + direction * step * 0.0005).toFixed(6)));
            if (candidates.some(candidate => candidate < 0.7 || candidate > 1.5)) continue;
            const candidateMeals = materializeMeals(candidates);
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
  // Check the final stored amounts too: macro reconciliation may adjust the
  // scheduler's portions, and shopping must not inherit an over-limit basket.
  const practical = practicalIngredientViolations(weeklyPlan.days.flatMap(day => day.meals)
    .filter(meal => meal.mealKind !== "social").map(meal => ({
      nutritionPortionMultiplier: 1, householdPortionMultiplier: 1,
      ingredients: meal.ingredients.map(ingredient => ({ name: ingredient.name, normalizedName: ingredient.name,
        quantity: ingredient.amount, unit: ingredient.unit, pantry: false })),
    })));
  if (practical.length) throw new MealApprovalError("impractical_ingredient_basket", practical, 422,
    "The final portions exceed a practical weekly ingredient quantity. Your existing plan is unchanged.");
  if (options?.requireDifferent && sameRecipeDays(previous.previousDayRecipeIds, weeklyPlan.days)) {
    throw new MealApprovalError("no_alternative_reviewed_plan", ["The available safe recipes produced the same meals."], 422,
      "A different checked plan was not found with the available recipes and your restrictions. Your existing plan is unchanged.");
  }
  // The reviewed catalogue has no retailer-price evidence yet. Routes omit this internal neutral value.
  const adjustedPlan: PortionedMeal[] = [];
  return { context, practical: { adjustedPlan, shoppingList: [], weeklyTotal: 0, substitutionsMade: [] },
    alternatives: [], source: "db", weeklyPlan };
}

export async function generateWeeklyPlan(userId: string, options?: { preferences?: PreferencesInput }): Promise<WeeklyMealPlan> {
  return (await generateWeeklyPlanWithArtifacts(userId, options)).weeklyPlan;
}
