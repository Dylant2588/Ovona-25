import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecipeRecord } from "../recipes/types.ts";

const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
export type PreviousPlanRotation = { recentCandidateIds: string[]; recentSimilarityKeys: string[]; previousDayRecipeIds: string[][] };

/** Derive ranking hints only from this owner's persisted plan and known reviewed versions. */
export function previousPlanRotation(rows: unknown, recipes: readonly RecipeRecord[]): PreviousPlanRotation {
  const empty: PreviousPlanRotation = { recentCandidateIds: [], recentSimilarityKeys: [], previousDayRecipeIds: [] };
  if (!Array.isArray(rows)) return empty;
  const days = rows.filter(row => object(row) && typeof row.plan_id === "string" && typeof row.date === "string" && typeof row.day_id === "string" &&
    object(row.meals) && Array.isArray(row.meals.meals) && !["shopping-list", "alternatives"].includes(row.day_id));
  if (!days.length) return empty;
  const latestId = days[0].plan_id;
  const latest = days.filter(row => row.plan_id === latestId).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7);
  if (latest.length !== 7) return empty;
  const known = new Map(recipes.map(recipe => [JSON.stringify([recipe.id, recipe.version]), recipe]));
  const candidates: string[] = [];
  const perDay = latest.map(row => row.meals.meals.flatMap((meal: unknown) => {
    if (!object(meal) || typeof meal.baseId !== "string" || typeof meal.mealSlot !== "string" || !Number.isInteger(meal.recipeVersion)) return [];
    const recipe = known.get(JSON.stringify([meal.baseId, meal.recipeVersion]));
    if (!recipe || !recipe.slots.includes(meal.mealSlot as RecipeRecord["slots"][number])) return [];
    candidates.push(`${recipe.id}:${meal.mealSlot}`);
    return [recipe.id];
  }));
  if (perDay.some(day => !day.length)) return empty;
  return { recentCandidateIds: [...new Set(candidates)], recentSimilarityKeys: [...new Set(perDay.flat().map(id => id.toLowerCase()))], previousDayRecipeIds: perDay };
}

export async function loadPreviousPlanRotation(database: SupabaseClient, userId: string, recipes: readonly RecipeRecord[]) {
  const { data, error } = await database.from("plan_history").select("plan_id,day_id,date,meals")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error("Previous plan could not be loaded for rotation. Please try again.");
  return previousPlanRotation(data, recipes);
}

export function sameRecipeDays(previous: readonly (readonly string[])[], next: readonly { meals: readonly { baseId: string }[] }[]): boolean {
  return previous.length === 7 && next.length === 7 && previous.every((ids, index) =>
    JSON.stringify([...ids].sort()) === JSON.stringify(next[index].meals.map(meal => meal.baseId).sort()));
}
