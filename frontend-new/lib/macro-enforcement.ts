import type {
  DayPlan,
  IngredientLine,
  MacroBreakdown,
  MacroTargets,
  MealInstance,
  WeeklyMealPlan,
} from "@/lib/meal-generator";

type DailyTarget = {
  calories?: number | null;
  protein?: number | null;
};

export type DailyEnforcementResult = {
  label: string;
  passed: boolean;
  corrected: boolean;
  status: "verified" | "adjusted" | "partial";
  before: MacroBreakdown;
  after: MacroBreakdown;
  target: DailyTarget;
};

export type EnforcementResult = {
  passed: boolean;
  totalCorrections: number;
  dailyResults: DailyEnforcementResult[];
};

export type EnforcementStatus = "verified" | "adjusted" | "failed";

export type EnforcementInfo = {
  status: EnforcementStatus;
  passed: boolean;
  corrections: number;
  summary: string;
  days: Array<{
    label: string;
    passed: boolean;
    corrected: boolean;
    status: "verified" | "adjusted" | "partial";
  }>;
};

const CALORIE_MIN_FACTOR = 0.95;
const CALORIE_MAX_FACTOR = 1.08;
const PROTEIN_MIN_FACTOR = 0.98;
const PROTEIN_MAX_FACTOR = 1.1;
const SLOT_WEIGHTS: Record<string, number> = {
  breakfast: 0.9,
  lunch: 1.05,
  dinner: 1.2,
  snack: 0.55,
};

const sumMacros = (items: MacroBreakdown[]): MacroBreakdown =>
  items.reduce(
    (acc, macro) => ({
      calories: acc.calories + (macro.calories ?? 0),
      protein: acc.protein + (macro.protein ?? 0),
      carbs: acc.carbs + (macro.carbs ?? 0),
      fat: acc.fat + (macro.fat ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

const withinRange = (
  actual: number,
  target: number,
  minFactor: number,
  maxFactor: number
) => actual >= target * minFactor && actual <= target * maxFactor;

const passForDay = (totals: MacroBreakdown, targets: DailyTarget) => {
  const caloriePass =
    typeof targets.calories !== "number" ||
    withinRange(
      totals.calories,
      targets.calories,
      CALORIE_MIN_FACTOR,
      CALORIE_MAX_FACTOR
    );
  const proteinPass =
    typeof targets.protein !== "number" ||
    withinRange(
      totals.protein,
      targets.protein,
      PROTEIN_MIN_FACTOR,
      PROTEIN_MAX_FACTOR
    );
  return caloriePass && proteinPass;
};

const MIN_PORTION = 0.7;
const MAX_PORTION = 1.5;

const clampPortion = (value: number) =>
  Number(Math.min(MAX_PORTION, Math.max(MIN_PORTION, value)).toFixed(2));

const scaleMacros = (macros: MacroBreakdown, multiplier: number): MacroBreakdown => ({
  calories: Math.round((macros.calories ?? 0) * multiplier),
  protein: Math.round((macros.protein ?? 0) * multiplier),
  carbs: Math.round((macros.carbs ?? 0) * multiplier),
  fat: Math.round((macros.fat ?? 0) * multiplier),
});

const scaleIngredients = (ingredients: IngredientLine[], multiplier: number): IngredientLine[] =>
  ingredients.map((ingredient) => ({
    ...ingredient,
    amount: Number((ingredient.amount * multiplier).toFixed(2)),
  }));

const ensureBaseIngredients = (meal: MealInstance): IngredientLine[] => {
  if (meal.baseIngredients?.length) return meal.baseIngredients;
  const baseMultiplier = meal.portionMultiplier || 1;
  const base =
    meal.ingredients?.map((ingredient) => ({
      ...ingredient,
      amount: Number((ingredient.amount / baseMultiplier).toFixed(2)),
    })) ?? [];
  meal.baseIngredients = base;
  return base;
};

const applyMultiplier = (meal: MealInstance, multiplier: number) => {
  const next = clampPortion(multiplier);
  const baseMacros = meal.baseMacros ?? meal.macros;
  const baseIngredients = ensureBaseIngredients(meal);
  meal.portionMultiplier = next;
  meal.macros = scaleMacros(baseMacros, next);
  meal.ingredients = scaleIngredients(baseIngredients, next);
};

const recalcDay = (day: DayPlan) => {
  day.totals = sumMacros(day.meals.map((meal) => meal.macros));
};

const recalcPlan = (plan: WeeklyMealPlan) => {
  plan.weeklyTotals = sumMacros(plan.days.map((day) => day.totals));
  plan.generatedAt = new Date().toISOString();
};

const weightForSlots = (day: DayPlan) => {
  const values = day.meals.map((meal) => SLOT_WEIGHTS[meal.mealSlot] ?? 1);
  const total = values.reduce((acc, v) => acc + v, 0) || 1;
  return { values, total };
};

const enforceDay = (day: DayPlan, targets: DailyTarget): DailyEnforcementResult => {
  const before = { ...day.totals };
  let corrected = false;
  if (!day.meals.length) {
    const passed = passForDay(day.totals, targets);
    return {
      label: day.label,
      passed,
      corrected,
      status: passed ? "verified" : "partial",
      before,
      after: { ...day.totals },
      target: targets,
    };
  }

  for (let pass = 0; pass < 2; pass += 1) {
    const { values, total } = weightForSlots(day);
    day.meals.forEach((meal, index) => {
      const desiredCalories =
        typeof targets.calories === "number"
          ? (targets.calories * values[index]) / total
          : null;
      const desiredProtein =
        typeof targets.protein === "number"
          ? targets.protein / day.meals.length
          : null;

      const calorieScale =
        desiredCalories && meal.macros.calories > 0
          ? desiredCalories / meal.macros.calories
          : 1;
      const proteinScale =
        desiredProtein && meal.macros.protein > 0
          ? desiredProtein / meal.macros.protein
          : 1;

      const scale = Math.max(proteinScale || 1, calorieScale * 0.9);
      const boundedScale = Math.max(0.7, Math.min(1.35, scale));
      if (Math.abs(1 - boundedScale) > 0.02) {
        corrected = true;
        applyMultiplier(meal, meal.portionMultiplier * boundedScale);
      }
    });
    recalcDay(day);
  }

  if (typeof targets.calories === "number" && day.totals.calories > 0) {
    const correction = targets.calories / day.totals.calories;
    if (Math.abs(1 - correction) > 0.05) {
      const projectedProtein = day.totals.protein * correction;
      if (
        typeof targets.protein !== "number" ||
        projectedProtein >= targets.protein * 0.95
      ) {
        const boundedCorrection = Math.max(0.85, Math.min(1.15, correction));
        day.meals.forEach((meal) => {
          applyMultiplier(meal, meal.portionMultiplier * boundedCorrection);
        });
        corrected = true;
        recalcDay(day);
      }
    }
  }

  const after = { ...day.totals };
  const passed = passForDay(after, targets);
  const status = !passed ? "partial" : corrected ? "adjusted" : "verified";
  return {
    label: day.label,
    passed,
    corrected,
    status,
    before,
    after,
    target: targets,
  };
};

export const enforceMacros = (
  plan: WeeklyMealPlan,
  targets: MacroTargets
): EnforcementResult => {
  const dailyResults = plan.days.map((day) =>
    enforceDay(day, {
      calories: targets.calories ?? null,
      protein: targets.protein ?? null,
    })
  );
  recalcPlan(plan);

  const totalCorrections = dailyResults.filter((result) => result.corrected).length;
  const passed = dailyResults.every((result) => result.passed);

  return {
    passed,
    totalCorrections,
    dailyResults,
  };
};

export const enforcementSummary = (result: EnforcementResult) => {
  const partialDays = result.dailyResults.filter((day) => day.status === "partial").length;
  const adjustedDays = result.dailyResults.filter((day) => day.status === "adjusted").length;
  if (partialDays > 0) {
    return `${partialDays} day(s) couldn't meet targets within safe portion limits.`;
  }
  if (adjustedDays > 0) {
    return `Macros verified with portion adjustments on ${adjustedDays} day(s).`;
  }
  return "Macros verified: all days within target bounds.";
};

export const toEnforcementInfo = (result: EnforcementResult): EnforcementInfo => {
  const failedDays = result.dailyResults.filter((day) => day.status === "partial").length;
  const adjustedDays = result.dailyResults.filter((day) => day.status === "adjusted").length;
  const status: EnforcementStatus =
    failedDays > 0 ? "failed" : adjustedDays > 0 ? "adjusted" : "verified";

  return {
    status,
    passed: result.passed,
    corrections: result.totalCorrections,
    summary: enforcementSummary(result),
    days: result.dailyResults.map((day) => ({
      label: day.label,
      passed: day.passed,
      corrected: day.corrected,
      status: day.status,
    })),
  };
};
