import type { RotationHistory } from "./generation/rotation-history";

export type PlanningInput = Readonly<{
  hardExclusions: Readonly<{ allergies: readonly string[]; dietaryRules: readonly string[]; neverFoods: readonly string[] }>;
  foodPreferences: Readonly<{ likes: readonly string[]; dislikes: readonly string[]; cuisines: readonly string[] }>;
  mealConstraints: Readonly<{
    maxPrepMinutes: number; mealsPerDay: 3 | 5; weeklyBudget: number;
    macroTargets: Readonly<{ calories: number; protein: number; carbs: number; fat: number }>;
  }>;
  memory: Readonly<{ acceptedOrEaten: RotationHistory; rejectedRecipeIds: readonly string[]; rejectedSimilarityKeys: readonly string[] }>;
}>;

export class PlanningInputError extends Error {}

const MAX_TERMS = 40;
const clean = (value: unknown) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLowerCase() : "";
export const normalizeTerms = (value: unknown, field: string): string[] => {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new PlanningInputError(`${field} must be an array of text values.`);
  const terms = value.map(clean);
  if (terms.some((term) => !term)) throw new PlanningInputError(`${field} contains an empty or invalid value.`);
  return [...new Set(terms)].slice(0, MAX_TERMS);
};

const positive = (value: unknown, field: string, fallback: number, max: number) => {
  if (value == null) return fallback;
  if (field === "maxPrepMinutes" && typeof value === "string") {
    const quick = { under_10: 10, "10_15": 15, "15_30": 30 }[value.trim().toLowerCase()];
    if (quick) return quick;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > max) throw new PlanningInputError(`${field} must be a positive number.`);
  return Math.round(numeric);
};
const combine = (...groups: readonly (readonly string[])[]) => [...new Set(groups.flat().map(clean).filter(Boolean))];

export function buildPlanningInput(source: {
  saved?: Partial<PlanningInput>;
  requested?: { allergies?: unknown; dietaryRules?: unknown; neverFoods?: unknown; foodLikes?: unknown; dislikes?: unknown; cuisines?: unknown; maxPrepMinutes?: unknown; mealsPerDay?: unknown; weeklyBudget?: unknown; macroTargets?: Partial<PlanningInput["mealConstraints"]["macroTargets"]> };
  defaults: PlanningInput["mealConstraints"];
  history: RotationHistory;
  rejectedRecipeIds?: readonly string[];
  rejectedSimilarityKeys?: readonly string[];
}): PlanningInput {
  const requested = source.requested ?? {};
  const saved = source.saved;
  const meals = positive(requested.mealsPerDay, "mealsPerDay", source.defaults.mealsPerDay, 5);
  if (meals !== 3 && meals !== 5) throw new PlanningInputError("mealsPerDay must be 3 or 5.");
  const maxPrepMinutes = positive(requested.maxPrepMinutes, "maxPrepMinutes", source.defaults.maxPrepMinutes, 240);
  const budget = positive(requested.weeklyBudget, "weeklyBudget", source.defaults.weeklyBudget, 10000);
  const macros = source.defaults.macroTargets;
  const targets = {
    calories: positive(requested.macroTargets?.calories, "calorie target", macros.calories, 10000),
    protein: positive(requested.macroTargets?.protein, "protein target", macros.protein, 1000),
    carbs: positive(requested.macroTargets?.carbs, "carbohydrate target", macros.carbs, 2000),
    fat: positive(requested.macroTargets?.fat, "fat target", macros.fat, 1000),
  };
  return {
    // Server values are always retained. A client can add a safety restriction but cannot erase one.
    hardExclusions: {
      allergies: combine(saved?.hardExclusions?.allergies ?? [], normalizeTerms(requested.allergies, "allergies")),
      dietaryRules: combine(saved?.hardExclusions?.dietaryRules ?? [], normalizeTerms(requested.dietaryRules, "dietaryRules")),
      neverFoods: combine(saved?.hardExclusions?.neverFoods ?? [], normalizeTerms(requested.neverFoods, "neverFoods")),
    },
    foodPreferences: {
      likes: combine(saved?.foodPreferences?.likes ?? [], normalizeTerms(requested.foodLikes, "foodLikes")),
      dislikes: combine(saved?.foodPreferences?.dislikes ?? [], normalizeTerms(requested.dislikes, "dislikes")),
      cuisines: combine(saved?.foodPreferences?.cuisines ?? [], normalizeTerms(requested.cuisines, "cuisines")),
    },
    mealConstraints: { maxPrepMinutes, mealsPerDay: meals, weeklyBudget: budget, macroTargets: targets },
    memory: { acceptedOrEaten: source.history, rejectedRecipeIds: combine(source.rejectedRecipeIds ?? []), rejectedSimilarityKeys: combine(source.rejectedSimilarityKeys ?? []) },
  };
}

/** Safe, non-identifying subset sent to AI ranking only. */
export function planningBrief(input: PlanningInput) {
  return { hardExclusions: input.hardExclusions, foodPreferences: input.foodPreferences, mealConstraints: input.mealConstraints,
    memory: { recentRecipeIds: input.memory.acceptedOrEaten.recentCandidateIds, rejectedRecipeIds: input.memory.rejectedRecipeIds,
      recentSimilarityKeys: input.memory.acceptedOrEaten.recentSimilarityKeys, rejectedSimilarityKeys: input.memory.rejectedSimilarityKeys } };
}
