type JsonObject = Record<string, unknown>;
export type PreferencePatch = JsonObject;
/** The panel's null option means its displayed standard limit, not a clear operation. */
export const preferencePrepLimitForSave = (minutes: number | null): number => minutes ?? 30;
export class PreferencePersistenceError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) { super(message); this.status = status; this.code = code; }
}
const invalid = (message: string): never => { throw new PreferencePersistenceError(message, 400, "invalid_preferences"); };
const object = (value: unknown): value is JsonObject => !!value && typeof value === "object" && !Array.isArray(value);
const own = (value: JsonObject, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const allowedKeys = (value: JsonObject, keys: readonly string[]) => {
  if (Object.keys(value).some((key) => !keys.includes(key))) invalid("Unsupported preference field.");
};
const list = (value: unknown, field: string) => {
  if (!Array.isArray(value) || value.length > 40 || value.some((item) => typeof item !== "string" || !item.trim() || item.length > 160)) invalid(`${field} must contain at most 40 nonempty text values.`);
  return [...new Set((value as string[]).map((item) => item.trim().replace(/\s+/g, " ").toLowerCase()))];
};
const optionalText = (value: unknown, field: string, max: number) => {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > max) invalid(`${field} must be text or null.`);
  return (value as string).trim();
};
const number = (value: unknown, field: string, min: number, max: number) => {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) invalid(`${field} is outside its supported range.`);
  return value;
};

/** Omitted fields stay omitted all the way to the transaction. */
export function parsePreferencePatch(value: unknown): PreferencePatch {
  if (!object(value)) return invalid("Preferences must be an object.");
  allowedKeys(value, ["dietaryMode", "allergies", "dislikes", "cuisines", "tastePreferences", "neverFoods", "foodLikes", "maxPrepMinutes", "goal", "mealComplexity", "macroTargets", "profile"]);
  const patch: PreferencePatch = {};
  for (const [input, output] of [["allergies", "allergies"], ["dislikes", "dislikes"], ["cuisines", "cuisines"], ["tastePreferences", "taste_preferences"], ["neverFoods", "never_foods"], ["foodLikes", "food_likes"]]) {
    if (own(value, input)) patch[output] = list(value[input], input);
  }
  if (own(value, "dietaryMode")) {
    if (value.dietaryMode !== null && typeof value.dietaryMode !== "string") invalid("dietaryMode must be text or null.");
    const mode = String(value.dietaryMode ?? "mixed").trim().toLowerCase().replace(/[- ]/g, "_");
    const modes: Record<string, string | null> = { mixed: null, omnivore: null, none: null, vegan: "vegan", vegetarian: "vegetarian", pescatarian: "pescatarian", pescetarian: "pescatarian", low_carb: "low_carb", high_protein: "high_protein" };
    if (!own(modes, mode)) invalid("Unsupported dietary mode.");
    patch.dietary_mode = modes[mode];
  }
  if (own(value, "maxPrepMinutes")) {
    const prep = value.maxPrepMinutes;
    if (typeof prep !== "number" || !Number.isInteger(prep) || prep < 1 || prep > 240) invalid("maxPrepMinutes must be an integer between 1 and 240.");
    patch.max_prep_minutes = prep;
  }
  if (own(value, "goal") && value.goal !== null) {
    if (typeof value.goal !== "string") invalid("goal must be text.");
    const goals: Record<string, string> = { lose: "lose_weight", lose_weight: "lose_weight", gain: "gain", build_muscle: "gain", maintain: "maintain", recomp: "recomp", body_recomposition: "recomp" };
    const goal = (value.goal as string).trim().toLowerCase();
    if (!own(goals, goal)) invalid("Unsupported goal."); patch.goal = goals[goal];
  }
  if (own(value, "mealComplexity") && value.mealComplexity !== null) {
    if (typeof value.mealComplexity !== "number" && typeof value.mealComplexity !== "string") invalid("Unsupported meal complexity.");
    const complexity = String(value.mealComplexity).trim().toLowerCase();
    const choices: Record<string, string> = { "1": "simple", "2": "normal", "3": "adventurous", simple: "simple", normal: "normal", adventurous: "adventurous" };
    if (!own(choices, complexity)) invalid("Unsupported meal complexity."); patch.meal_complexity = choices[complexity];
  }
  if (own(value, "macroTargets") && value.macroTargets !== null) {
    if (!object(value.macroTargets)) invalid("macroTargets must be an object or null.");
    const macros = value.macroTargets as JsonObject;
    allowedKeys(macros, ["calories", "protein", "carbs", "fat"]);
    for (const key of ["calories", "protein", "carbs", "fat"]) if (own(macros, key)) patch[`target_${key}`] = number(macros[key], key, key === "calories" || key === "protein" ? 1 : 0, key === "calories" ? 10000 : 2000);
  }
  if (own(value, "profile") && value.profile !== null) {
    if (!object(value.profile)) invalid("profile must be an object or null.");
    const input = value.profile as JsonObject;
    allowedKeys(input, ["email", "bodyWeightKg", "heightCm", "activityLevel", "notes"]);
    const profile: JsonObject = {};
    if (own(input, "email")) profile.email = optionalText(input.email, "email", 320);
    if (own(input, "notes")) profile.notes = optionalText(input.notes, "notes", 10000);
    if (own(input, "bodyWeightKg")) profile.body_weight_kg = number(input.bodyWeightKg, "bodyWeightKg", 1, 1000);
    if (own(input, "heightCm")) profile.height_cm = number(input.heightCm, "heightCm", 1, 300);
    if (own(input, "activityLevel")) {
      const activity = optionalText(input.activityLevel, "activityLevel", 30)?.toLowerCase() ?? null;
      if (activity !== null && !["sedentary", "light", "moderate", "intense"].includes(activity)) invalid("Unsupported activity level.");
      profile.activity_level = activity;
    }
    patch.profile = profile;
  }
  return patch;
}

type RpcClient = { rpc(name: string, args: { p_patch: PreferencePatch }): PromiseLike<{ data: unknown; error: { code?: string } | null }> };
export async function savePreferencePatch(client: RpcClient, patch: PreferencePatch) {
  const { data, error } = await client.rpc("save_safety_preferences", { p_patch: patch });
  if (error) {
    if (["PGRST202", "PGRST204", "42883", "42703", "42P01"].includes(error.code ?? "")) throw new PreferencePersistenceError("Your safety preferences could not be saved. Please try again after the service is updated.", 503, "preferences_schema_unsupported");
    throw new PreferencePersistenceError("Your preferences could not be saved. Your previous preferences are unchanged.", 500, "preferences_save_failed");
  }
  if (!object(data) || data.ok !== true || data.profileSaved !== true || data.allergiesSynced !== true) throw new PreferencePersistenceError("Your preferences could not be confirmed as saved. Please try again.", 500, "preferences_save_failed");
  return { ok: true, profileSaved: true, allergiesSynced: true };
}
export function preferenceSaveFailure(error: unknown) {
  const failure = error instanceof PreferencePersistenceError ? error : new PreferencePersistenceError("Preferences are temporarily unavailable. Please try again.", 503, "preferences_unavailable");
  return { status: failure.status, body: { error: failure.code, message: failure.message } };
}
