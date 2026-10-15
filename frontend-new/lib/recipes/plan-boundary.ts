import type { WeeklyMealPlan, PreferencesInput } from "../meal-generator.ts";
import type { RecipeRecord, RecipeConstraints } from "./types.ts";
import { loadReviewedRecipes, type RecipeReader } from "./repository.ts";
import { validatePlanAgainstRecipes } from "./approval.ts";
import { loadServerConstraints, type ConstraintDatabase } from "./server-constraints.ts";

export class MealApprovalError extends Error {
  statusCode: number;
  code: string;
  reasons: readonly unknown[];
  constructor(
    code: string,
    reasons: readonly unknown[],
    statusCode = 422,
    message = "This plan couldn't pass recipe checks. Your existing plan is unchanged."
  ) {
    super(message);
    this.statusCode = statusCode; this.code = code; this.reasons = reasons;
  }
}
export type BoundaryDependencies = {
  constraints?: (database: ConstraintDatabase, userId: string, preferences?: PreferencesInput) => Promise<RecipeConstraints>;
  recipes?: typeof loadReviewedRecipes;
  context?: () => Promise<{ calorieTarget: number; proteinTarget: number; mealsPerDay: number }>;
};

type NutritionContext = { calorieTarget: number; proteinTarget: number; mealsPerDay: number };

const loadNutritionContext = async (database: RecipeReader, userId: string): Promise<NutritionContext> => {
  const { buildContext } = await import("../generation/context-builder");
  const context = await buildContext(userId, { supabase: database as never });
  return {
    calorieTarget: context.calorieTarget,
    proteinTarget: context.proteinTarget,
    mealsPerDay: context.mealsPerDay,
  };
};

/** Validate before invoking any persistence callback; injected doubles test this real boundary. */
export async function approvePlanForUser(database: RecipeReader, userId: string,
  plan: WeeklyMealPlan, preferences?: PreferencesInput, dependencies: BoundaryDependencies = {}): Promise<WeeklyMealPlan> {
  if (!plan || plan.userId !== userId || !Array.isArray(plan.days) || plan.days.length !== 7 ||
      plan.days.some((day) => !day || !Array.isArray(day.meals) || !day.meals.length)) {
    throw new MealApprovalError("meal_approval_failed", ["Invalid plan ownership or incomplete week."]);
  }
  const constraints = await (dependencies.constraints ?? loadServerConstraints)(database, userId, preferences);
  const context = dependencies.context ? await dependencies.context() : await loadNutritionContext(database, userId);
  const start = new Date(plan.weekStart);
  const dates = plan.days.map((day) => new Date(day.date));
  if (!Number.isFinite(start.getTime()) || new Set(plan.days.map((day) => day.id)).size !== 7 ||
      dates.some((date, index) => !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== new Date(start.getTime() + index * 86400000).toISOString().slice(0, 10))) {
    throw new MealApprovalError("meal_approval_failed", ["Plan days must identify seven unique consecutive dates in this week."]);
  }
  const loaded = await (dependencies.recipes ?? loadReviewedRecipes)(database);
  if (!loaded.ok) throw new MealApprovalError(loaded.code, loaded.reasons, 503);
  const result = validatePlanAgainstRecipes(plan.days, loaded.recipes as RecipeRecord[], constraints);
  if (!result.approved) {
    const firstReason = result.reasons[0]?.message;
    throw new MealApprovalError(
      "meal_approval_failed",
      result.reasons,
      422,
      firstReason
        ? `A checked plan was blocked: ${firstReason} Update the relevant preference or review another suitable recipe, then try again.`
        : undefined
    );
  }
  const days = result.days;
  const dayFailures = days.flatMap((day) => {
    const slotSummary = {
      breakfast: day.meals.filter((meal) => meal.mealSlot === "breakfast").length,
      lunch: day.meals.filter((meal) => meal.mealSlot === "lunch").length,
      dinner: day.meals.filter((meal) => meal.mealSlot === "dinner").length,
      snack: day.meals.filter((meal) => meal.mealSlot === "snack").length,
    };
    const slotsAreValid = day.meals.length === context.mealsPerDay &&
      slotSummary.breakfast === 1 && slotSummary.lunch === 1 && slotSummary.dinner === 1 &&
      slotSummary.snack === context.mealsPerDay - 3;
    const nutritionIsValid = day.meals.some((meal) => meal.mealKind === "social") ||
      (day.totals.calories >= context.calorieTarget * 0.95 && day.totals.calories <= context.calorieTarget * 1.08 &&
        day.totals.protein >= context.proteinTarget * 0.98 && day.totals.protein <= context.proteinTarget * 1.1);
    const failures: string[] = [];
    if (!slotsAreValid) failures.push(`${day.label}: expected ${context.mealsPerDay} meals (1 breakfast, 1 lunch, 1 dinner, ${context.mealsPerDay - 3} snacks); received ${day.meals.length} (${slotSummary.breakfast}/${slotSummary.lunch}/${slotSummary.dinner}/${slotSummary.snack}).`);
    if (!nutritionIsValid) failures.push(`${day.label}: ${Math.round(day.totals.calories)} kcal and ${Math.round(day.totals.protein)}g protein; required ${Math.ceil(context.calorieTarget * 0.95)}-${Math.floor(context.calorieTarget * 1.08)} kcal and ${Math.ceil(context.proteinTarget * 0.98)}-${Math.floor(context.proteinTarget * 1.1)}g protein.`);
    return failures;
  });
  if (dayFailures.length) {
    throw new MealApprovalError("meal_approval_failed", dayFailures);
  }
  const weeklyTotals = days.reduce((total, day) => ({ calories: total.calories + day.totals.calories,
    protein: total.protein + day.totals.protein, carbs: total.carbs + day.totals.carbs, fat: total.fat + day.totals.fat }),
  { calories: 0, protein: 0, carbs: 0, fat: 0 });
  return { ...plan, days, weeklyTotals };
}

export async function writeApprovedPlan<T>(database: RecipeReader, userId: string,
  plan: WeeklyMealPlan, write: (approved: WeeklyMealPlan) => Promise<T>, preferences?: PreferencesInput,
  dependencies: BoundaryDependencies = {}): Promise<T> {
  const approved = await approvePlanForUser(database, userId, plan, preferences, dependencies);
  return write(approved);
}

export function approvalFailure(error: unknown) {
  const failure = error as Error & { statusCode?: number; code?: string; reasons?: readonly unknown[] };
  return { status: failure.statusCode ?? 503, body: { error: failure.code ?? "recipe_library_unavailable",
    message: failure.message || "Recipe checks are unavailable. Your existing plan is unchanged.", reasons: failure.reasons ?? [] } };
}
