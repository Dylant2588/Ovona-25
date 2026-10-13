import type { PreferencesInput } from "../meal-generator.ts";
import type { RecipeConstraints } from "./types.ts";

type QueryResult = { data: unknown; error: unknown };
export type ConstraintDatabase = { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => PromiseLike<QueryResult> } } };
const strings = (value: unknown): string[] => {
  if (value == null) return [];
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value;
  if (typeof value === "string") return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
  throw Object.assign(new Error("Saved restrictions need review before planning."), { statusCode: 503, code: "preferences_unavailable" });
};
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
  const sources = [...rows(results[0].data), ...rows(results[1].data)];
  const allergyRows = rows(results[2].data).flatMap((row) => {
    const value = row.allergy_name ?? row.allergy ?? row.allergen ?? row.name;
    if (!strings(value).length) throw Object.assign(new Error("A saved allergy needs review before planning."), { statusCode: 503, code: "preferences_unavailable" });
    return strings(value);
  });
  const union = (values: string[]) => [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
  const dietaryModes = union(sources.flatMap((row) => [...strings(row.dietary_mode), ...strings(row.lifestyle)]).concat(strings(requested?.profile?.dietaryMode)));
  const prepLimits = sources.map((row) => Number(row.max_prep_minutes)).filter((value) => Number.isFinite(value) && value > 0);
  return {
    allergies: union(sources.flatMap((row) => strings(row.allergies)).concat(allergyRows, strings(requested?.profile?.allergies))),
    dislikes: union(sources.flatMap((row) => strings(row.dislikes)).concat(strings(requested?.profile?.dislikes))),
    dietaryModes,
    maxPrepMinutes: prepLimits.length ? Math.min(...prepLimits) : undefined,
  };
}
