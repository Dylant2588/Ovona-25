import type { CalculatedNutritionEvidence, RecipeMacros } from "./types.ts";
import { convertIngredientQuantity } from "./quantities.ts";

export const CALCULATED_NUTRITION_METHOD = "ingredient_calculated_v1";
export const NUTRITION_POLICY_VERSION = "ingredient-v1";
const keys = ["calories", "protein", "carbs", "fat"] as const;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown) => typeof value === "string" && !!value.trim();
const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const zero = (): RecipeMacros => ({ calories: 0, protein: 0, carbs: 0, fat: 0 });
const macros = (value: unknown): value is RecipeMacros => object(value) && keys.every(key => typeof value[key] === "number" && Number.isFinite(value[key]) && Number(value[key]) >= 0);
// Divide before multiplying so finite large values do not overflow just for rounding.
const quantize = (value: number) => Math.abs(value) < 1e15 ? Math.round(value * 1e6) / 1e6 : value;
const quantized = (value: RecipeMacros): RecipeMacros => Object.fromEntries(keys.map(key => [key, quantize(value[key])])) as RecipeMacros;

export const MICRONUTRIENT_KEYS = ["calcium_mg", "iron_mg", "vitamin_c_mg"] as const;
export type MicronutrientKey = typeof MICRONUTRIENT_KEYS[number];
export type MicronutrientCoverage = {
  unit: "mg"; status: "unknown" | "partial" | "complete";
  knownSubtotal: number | null; amount: number | null;
  knownIngredients: number; totalIngredients: number;
};

/** Optional nutrient projection shares source validation and quantity conversion with macro evidence.
 * It deliberately does not change the immutable ingredient-v1 calculation payload.
 */
export function calculateRecipeMicronutrients(value: unknown): Record<MicronutrientKey, MicronutrientCoverage> {
  const ingredients = object(value) && Array.isArray(value.ingredients) ? value.ingredients : [];
  const servings = object(value) && positive(value.servings) ? value.servings : null;
  return Object.fromEntries(MICRONUTRIENT_KEYS.map(key => {
    let subtotal = 0; let known = 0;
    for (const ingredient of ingredients) {
      if (!servings || !object(ingredient)) continue;
      // A one-line macro calculation exercises the existing exact source/basis/state checks.
      const sourceCheck = calculateRecipeNutrition({ servings: 1, ingredients: [ingredient] });
      if (!sourceCheck.ok) continue;
      const evidence = ingredient.nutrition;
      if (!object(evidence) || !object(evidence.food) || !object(evidence.food.micronutrients)) continue;
      const nutrient = evidence.food.micronutrients[key];
      if (typeof nutrient !== "number" || !Number.isFinite(nutrient) || nutrient < 0) continue;
      const converted = convertIngredientQuantity(ingredient);
      if (!converted.ok || !object(evidence.food.basis)) continue;
      const amount = nutrient * (converted.sourceAmount / Number(evidence.food.basis.amount)) / servings;
      if (!Number.isFinite(amount) || !Number.isFinite(subtotal + amount)) continue;
      subtotal += amount; known++;
    }
    const status = known === 0 ? "unknown" : known === ingredients.length ? "complete" : "partial";
    return [key, { unit: "mg", status, knownSubtotal: known ? quantize(subtotal) : null,
      amount: status === "complete" ? quantize(subtotal) : null, knownIngredients: known, totalIngredients: ingredients.length }];
  })) as Record<MicronutrientKey, MicronutrientCoverage>;
}

/** Pure offline calculation: source snapshots are stored inside the immutable recipe.
 * Batch quantities are summed at full precision; servings are applied exactly once.
 */
export function calculateRecipeNutrition(value: unknown): { ok: true; calculation: CalculatedNutritionEvidence } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!object(value)) return { ok: false, errors: ["Recipe must be an object."] };
  if (!positive(value.servings)) errors.push("Recipe servings must be positive and finite.");
  if (!Array.isArray(value.ingredients) || !value.ingredients.length || value.ingredients.length > 500) return { ok: false, errors: [...errors, "Recipe requires 1–500 measured ingredients."] };
  const lines: CalculatedNutritionEvidence["lines"] = [];
  const batch = zero();
  for (const [index, ingredient] of value.ingredients.entries()) {
    const label = `Ingredient ${index + 1}${object(ingredient) && text(ingredient.name) ? ` (${ingredient.name})` : ""}`;
    const reject = (message: string) => errors.push(`${label}: ${message}`);
    const evidence = object(ingredient) ? ingredient.nutrition : null;
    const food = object(evidence) ? evidence.food : null;
    if (!object(evidence) || !text(evidence.mappingReference) || !object(food)) { reject("Missing exact food snapshot or mapping reference."); continue; }
    const source = food.source;
    if (![food.id, food.revision, food.name].every(text) || !object(source) || !["publisher", "dataset", "version", "reference", "retrievedAt", "licence", "foodCode"].every(key => text(source[key])) || !Number.isFinite(Date.parse(String(source.retrievedAt)))) { reject("Incomplete versioned food source identity, attribution or retrieval date."); continue; }
    if (!macros(food.macros)) { reject("All four source nutrients must be finite nonnegative numbers; unknown/trace is not zero."); continue; }
    const converted = convertIngredientQuantity(ingredient);
    if (!converted.ok) { converted.errors.forEach(reject); continue; }
    const basis = food.basis as { amount: number };
    const scale = converted.sourceAmount / basis.amount;
    const line = zero();
    for (const key of keys) line[key] = food.macros[key] * scale;
    if (!Number.isFinite(scale) || !macros(line)) { reject("Nutrition conversion overflowed finite arithmetic."); continue; }
    for (const key of keys) batch[key] += line[key];
    lines.push({ ingredientIndex: index, foodId: food.id as string, foodRevision: food.revision as string, sourceAmount: quantize(converted.sourceAmount), sourceUnit: converted.sourceUnit, macros: quantized(line) });
  }
  if (!macros(batch)) errors.push("Batch nutrition overflowed finite arithmetic.");
  if (errors.length || !positive(value.servings)) return { ok: false, errors };
  const perServing = zero();
  for (const key of keys) perServing[key] = Math.round(batch[key] / value.servings);
  if (!macros(perServing)) return { ok: false, errors: ["Per-serving nutrition overflowed finite arithmetic."] };
  return { ok: true, calculation: { policyVersion: "ingredient-v1", servings: value.servings, batchMacros: quantized(batch), perServingMacros: perServing, lines } };
}

const equal = (actual: unknown, expected: unknown): boolean => {
  if (typeof expected === "number") return typeof actual === "number" && Number.isFinite(actual) && actual === expected;
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((item, index) => equal(actual[index], item));
  if (object(expected)) return object(actual) && Object.keys(actual).length === Object.keys(expected).length && Object.keys(expected).every(key => equal(actual[key], expected[key]));
  return actual === expected;
};

/** Legacy attested evidence remains readable; a calculated claim must reproduce. */
export function calculatedNutritionErrors(value: unknown): string[] {
  if (!object(value) || !object(value.nutrition) || value.nutrition.method !== CALCULATED_NUTRITION_METHOD) return [];
  const result = calculateRecipeNutrition(value);
  if (!result.ok) return result.errors;
  const errors: string[] = [];
  if (!equal(value.nutrition.calculation, result.calculation)) errors.push("Stored ingredient calculation is missing, stale or inconsistent with source snapshots and measured amounts.");
  if (!equal(value.macros, result.calculation.perServingMacros)) errors.push("Recipe macros must equal calculated per-serving nutrition.");
  return errors;
}

/** All newly approved versions require reproducible evidence, regardless of legacy label. */
export function newApprovalNutritionErrors(value: unknown): string[] {
  if (!object(value) || !object(value.nutrition) || value.nutrition.method !== CALCULATED_NUTRITION_METHOD) return ["New recipe approvals require ingredient_calculated_v1 nutrition with complete food-source evidence."];
  return calculatedNutritionErrors(value);
}
