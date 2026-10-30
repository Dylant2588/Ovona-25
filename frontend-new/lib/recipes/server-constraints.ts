import type { PreferencesInput } from "../meal-generator.ts";
import type { RecipeConstraints } from "./types.ts";
import { canonicalAllergens, normalizeIngredient } from "./taxonomy.ts";

type QueryResult = { data: unknown; error: unknown };
export type ConstraintDatabase = { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => PromiseLike<QueryResult> } } };
const strings = (value: unknown): string[] => {
  if (value == null) return [];
  if (Array.isArray(value) && value.every((item) => typeof item === "string" && !!item.trim())) return value;
  if (typeof value === "string") return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
  throw Object.assign(new Error("Saved restrictions need review before planning."), { statusCode: 503, code: "preferences_unavailable" });
};

const union = (values: string[]) => [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
const dietAliases: Record<string, string> = { vegan: "vegan", vegetarian: "vegetarian", pescatarian: "pescatarian", pescetarian: "pescatarian", "low carb": "low_carb", "high protein": "high_protein", mixed: "mixed", omnivore: "mixed", none: "mixed" };
const prepLimit = (value: unknown): number | undefined => {
  if (value == null) return undefined;
  const parsed = typeof value === "number" || (typeof value === "string" && value.trim()) ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 240 || !Number.isInteger(parsed)) {
    throw Object.assign(new Error("Saved preparation limits need review before planning."), { statusCode: 503, code: "preferences_unavailable" });
  }
  return parsed;
};

/** A request can add restrictions; no supplied group can replace another group. */
export function mergeEffectiveConstraints(...groups: RecipeConstraints[]): RecipeConstraints {
  const allergies = groups.flatMap((group) => strings(group.allergies)).flatMap((value) => {
    const canonical = canonicalAllergens(value);
    // Unknown restrictions remain present so recipe approval fails closed.
    return canonical.length ? canonical : [value.trim().toLowerCase()];
  });
  const limits = groups.map((group) => prepLimit(group.maxPrepMinutes)).filter((value): value is number => value !== undefined);
  return {
    allergies: union(allergies),
    dietaryModes: union(groups.flatMap((group) => [...strings(group.dietaryMode), ...strings(group.dietaryModes)])
      .map((value) => dietAliases[normalizeIngredient(value)] ?? normalizeIngredient(value))),
    neverFoods: union(groups.flatMap((group) => strings(group.neverFoods))),
    dislikes: union(groups.flatMap((group) => strings(group.dislikes))),
    maxPrepMinutes: limits.length ? Math.min(...limits) : undefined,
  };
}

export function constraintsFromSources(preferenceData: unknown, profileData: unknown, allergyData: unknown, requested?: PreferencesInput): RecipeConstraints {
  const sources = [...rows(preferenceData), ...rows(profileData)];
  const allergyRows = rows(allergyData).flatMap((row) => {
    const value = row.allergy_name ?? row.allergy ?? row.allergen ?? row.name;
    if (!strings(value).length) throw Object.assign(new Error("A saved allergy needs review before planning."), { statusCode: 503, code: "preferences_unavailable" });
    return strings(value);
  });
  return mergeEffectiveConstraints(...sources.map((row) => ({
    allergies: strings(row.allergies), dietaryModes: [...strings(row.dietary_mode), ...strings(row.lifestyle)],
    neverFoods: strings(row.never_foods), dislikes: strings(row.dislikes), maxPrepMinutes: prepLimit(row.max_prep_minutes),
  })), { allergies: allergyRows }, {
    allergies: requested?.profile?.allergies, dietaryMode: requested?.profile?.dietaryMode,
    neverFoods: requested?.profile?.neverFoods, dislikes: requested?.profile?.dislikes,
    maxPrepMinutes: requested?.profile?.maxPrepMinutes ?? undefined,
  });
}
const rows = (data: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(data) || data.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    throw Object.assign(new Error("Saved preferences could not be verified."), { statusCode: 503, code: "preferences_unavailable" });
  }
  return data as Record<string, unknown>[];
};

/** Client restrictions may add constraints, but can never remove saved restrictions. */
export async function loadServerConstraints(database: ConstraintDatabase, userId: string, requested?: PreferencesInput): Promise<RecipeConstraints> {
  const results = await Promise.all([
    database.from("user_preferences").select("*").eq("user_id", userId),
    database.from("profiles").select("*").eq("id", userId),
    database.from("user_allergies").select("*").eq("user_id", userId),
  ]);
  if (results.some((result) => result.error)) throw Object.assign(new Error("We couldn't verify your saved preferences. Your existing plan is unchanged."), { statusCode: 503, code: "preferences_unavailable" });
  return constraintsFromSources(results[0].data, results[1].data, results[2].data, requested);
}
