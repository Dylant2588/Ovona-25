import type { RecipeRecord } from "./types.ts";

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && !!value.trim();
const strings = (value: unknown) => Array.isArray(value) && value.every(text);
const positive = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0;
export function recipeRecordErrors(value: unknown): string[] {
  if (!object(value)) return ["Recipe must be an object"];
  const errors: string[] = [];
  if (!text(value.id) || !Number.isInteger(value.version) || Number(value.version) < 1 || !text(value.title)) errors.push("Missing identity/title/version");
  if (!positive(value.servings) || !positive(value.readyInMinutes)) errors.push("Invalid servings or preparation time");
  if (!["poultry", "red_meat", "fish", "seafood", "plant", "mixed"].includes(String(value.proteinType))) errors.push("Invalid protein classification");
  if (!strings(value.steps) || !(value.steps as unknown[]).length) errors.push("Missing measured recipe method");
  if (!Array.isArray(value.slots) || !value.slots.length || value.slots.some(s => !["breakfast", "lunch", "dinner", "snack"].includes(s))) errors.push("Invalid meal slots");
  if (!Array.isArray(value.ingredients) || !value.ingredients.length || value.ingredients.some(i => !object(i) || !text(i.name) || !text(i.canonicalId) || !["g", "kg", "ml", "l", "each", "large", "piece", "tbsp", "tsp"].includes(String(i.unit)) || !positive(i.amount) || !strings(i.allergens) || (i.mayContain !== undefined && !strings(i.mayContain)) || !strings(i.dietaryFlags) || typeof i.reviewed !== "boolean")) errors.push("Invalid measured ingredient evidence");
  if (!object(value.macros) || !["calories", "protein", "carbs", "fat"].every(key => typeof value.macros === "object" && value.macros !== null && typeof (value.macros as Record<string, unknown>)[key] === "number" && Number.isFinite((value.macros as Record<string, number>)[key]) && (value.macros as Record<string, number>)[key] >= 0) || Number((value.macros as Record<string, number>)?.calories) <= 0) errors.push("Invalid nutrition");
  if (!object(value.source) || !["internal", "licensed", "public_domain"].includes(String(value.source.kind)) || !text(value.source.reference) || !text(value.source.rights) || typeof value.source.reviewed !== "boolean") errors.push("Missing source/rights evidence");
  if (!object(value.nutrition) || !text(value.nutrition.method) || !text(value.nutrition.reference) || typeof value.nutrition.reviewed !== "boolean") errors.push("Missing nutrition evidence");
  if (!object(value.review) || !["pending_review", "approved", "rejected"].includes(String(value.review.status))) errors.push("Missing review state");
  if (object(value.review) && value.review.status === "approved") {
    if (!text(value.review.reviewedBy) || !text(value.review.reviewedAt) || !Number.isFinite(Date.parse(String(value.review.reviewedAt)))) errors.push("Missing review attribution");
    if (!object(value.source) || value.source.reviewed !== true || !object(value.nutrition) || value.nutrition.reviewed !== true || !Array.isArray(value.ingredients) || value.ingredients.some(i => !object(i) || i.reviewed !== true)) errors.push("Incomplete approved evidence");
  }
  return errors;
}
export type RecipeReader = { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => PromiseLike<{ data: unknown; error: unknown }> } } };
export async function loadReviewedRecipes(supabase: RecipeReader): Promise<
  { ok: true; recipes: RecipeRecord[] } | { ok: false; code: "recipe_library_unavailable" | "invalid_recipe_library"; reasons: string[] }
> {
  try {
    const { data, error } = await supabase.from("recipe_library").select("id,version,review_status,record").eq("review_status", "approved");
    if (error || !Array.isArray(data)) return { ok: false, code: "recipe_library_unavailable", reasons: ["Reviewed recipe library could not be loaded"] };
    const recipes: RecipeRecord[] = [];
    for (const row of data) {
      const record = row?.record;
      const errors = recipeRecordErrors(record);
      if (errors.length || record?.id !== row.id || record?.version !== row.version || record?.review?.status !== "approved" || row?.review_status !== "approved") return { ok: false, code: "invalid_recipe_library", reasons: errors.length ? errors : ["Recipe identity or approval mismatch"] };
      recipes.push(record as RecipeRecord);
    }
    return { ok: true, recipes };
  } catch { return { ok: false, code: "recipe_library_unavailable", reasons: ["Reviewed recipe library could not be loaded"] }; }
}
