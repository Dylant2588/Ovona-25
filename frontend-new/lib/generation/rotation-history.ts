export type RotationHistory = Readonly<{
  recentCandidateIds: readonly string[];
  recentSimilarityKeys: readonly string[];
  recentProteinTypes: readonly string[];
  recentCuisines: readonly string[];
  recentFormats: readonly string[];
  recentMealNames: readonly string[];
  rejectedRecipeIds: readonly string[];
  rejectedSimilarityKeys: readonly string[];
}>;

export type RotationHistoryRow = Readonly<Record<string, unknown>>;

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const unique = (values: readonly string[]) => [...new Set(values.filter(Boolean))];

/** Server-clock calendar window: [today - 14 days, today), with rejection feedback kept distinct from eaten history. */
export function rotationHistoryFromRows(rows: readonly RotationHistoryRow[], now = new Date()): RotationHistory {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(today); start.setUTCDate(start.getUTCDate() - 14);
  const startDate = dateOnly(start); const endDate = dateOnly(today);
  const included = rows.filter((row) => {
    const state = text(row.planning_state);
    const date = text(row.date);
    return (state === "accepted" || state === "eaten") && date >= startDate && date < endDate;
  });
  const rejected = rows.filter((row) => {
    const state = text(row.planning_state);
    const date = text(row.date);
    return state === "rejected" && date >= startDate && date < endDate;
  });
  const values = (key: string) => unique(included.map((row) => text(row[key]).toLowerCase()));
  return {
    recentCandidateIds: unique(included.map((row) => {
      const id = text(row.recipe_id); const version = row.recipe_version;
      return id && Number.isInteger(version) ? `${id}:${version}` : "";
    })),
    recentSimilarityKeys: values("similarity_key"),
    recentProteinTypes: values("protein_type"),
    recentCuisines: values("cuisine"),
    recentFormats: values("format"),
    recentMealNames: values("meal_name"),
    rejectedRecipeIds: unique(rejected.map((row) => {
      const id = text(row.recipe_id); const version = row.recipe_version;
      return id && Number.isInteger(version) ? `${id}:${version}` : "";
    })),
    rejectedSimilarityKeys: unique(rejected.map((row) => text(row.similarity_key).toLowerCase())),
  };
}

const REJECTION_REASONS = new Set(["not_interested", "too_time_consuming", "ingredient_dislike", "other"]);
/** The caller must resolve the reviewed recipe before constructing this record. */
export function rejectedHistoryRecord(userId: string, date: string, meal: HistoryMeal, reason: string) {
  if (!REJECTION_REASONS.has(reason) || !meal.baseId || !Number.isInteger(meal.recipeVersion)) return null;
  return { user_id: userId, date: dateOnly(new Date(date)), recipe_id: meal.baseId, recipe_version: meal.recipeVersion,
    similarity_key: meal.baseId, meal_name: meal.title ?? meal.baseId, protein_type: meal.proteinType ?? "mixed",
    meal_slot: meal.mealSlot ?? "unknown", planning_state: "rejected", rejection_reason: reason };
}

type HistoryMeal = Readonly<{ baseId?: string; recipeVersion?: number; mealKind?: string; nutritionStatus?: string; title?: string; proteinType?: string; mealSlot?: string; tags?: readonly string[] }>;
type HistoryPlan = Readonly<{ days: readonly (Readonly<{ date: string; meals: readonly HistoryMeal[] }>)[] }>;

/** Only a plan that has already passed approval may be converted to accepted evidence. */
export function approvedHistoryRecords(userId: string, plan: HistoryPlan) {
  return plan.days.flatMap((day) => day.meals.flatMap((meal) => {
    if (meal.mealKind === "social" || meal.nutritionStatus === "unknown" || !meal.baseId || !Number.isInteger(meal.recipeVersion)) return [];
    return [{ user_id: userId, meal_name: meal.title ?? meal.baseId, protein_type: meal.proteinType ?? "mixed", date: dateOnly(new Date(day.date)),
      meal_slot: meal.mealSlot ?? "unknown", recipe_id: meal.baseId, recipe_version: meal.recipeVersion,
      similarity_key: meal.baseId, cuisine: (meal.tags ?? []).find((tag) => tag !== "reviewed-recipe") ?? null,
      format: meal.mealSlot ?? null, planning_state: "accepted" }];
  }));
}

export function eatenHistoryRecord(userId: string, date: string, meal: HistoryMeal) {
  const accepted = approvedHistoryRecords(userId, { days: [{ date, meals: [meal] }] })[0];
  return accepted ? { ...accepted, planning_state: "eaten" } : null;
}
