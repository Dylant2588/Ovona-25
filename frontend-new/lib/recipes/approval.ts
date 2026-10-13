import type { ApprovalConstraints, ApprovalResult, RecipeRecord, RecipeMacros } from "./types.ts";
import { recipeRecordErrors } from "./repository.ts";
import { ALLERGENS, canonicalAllergens, findIngredientTaxon, normalizeIngredient } from "./taxonomy.ts";
export const APPROVAL_POLICY_VERSION = "2026-10-12.1";
const result = (recipe: RecipeRecord): ApprovalResult => ({ approved: true, reasons: [], recipeId: recipe.id, recipeVersion: recipe.version, policyVersion: APPROVAL_POLICY_VERSION });
const deny = (r: ApprovalResult, code: string, message: string) => { r.approved = false; r.reasons.push({ code, message }); };
export function approveRecipe(recipe: RecipeRecord, constraints: ApprovalConstraints = {}): ApprovalResult {
  const r = result(recipe);
  const errors = recipeRecordErrors(recipe);
  if (errors.length) { deny(r, "invalid_recipe", errors.join("; ")); return r; }
  if (recipe.review.status !== "approved") deny(r, "recipe_unreviewed", "Recipe has not completed review");
  const allergies = new Set<string>();
  for (const allergy of constraints.allergies ?? []) {
    const mapped = canonicalAllergens(allergy);
    if (!mapped.length) deny(r, "unknown_allergy", `Unrecognized allergy: ${allergy}`);
    mapped.forEach(value => allergies.add(value));
  }
  const diets = [...new Set([...(constraints.dietaryModes ?? []), ...(constraints.dietaryMode ? [constraints.dietaryMode] : [])].map(normalizeIngredient))];
  const dietAliases: Record<string, string> = { vegan: "vegan", vegetarian: "vegetarian", pescatarian: "pescatarian", pescetarian: "pescatarian", "low carb": "low_carb", "high protein": "high_protein", omnivore: "omnivore", mixed: "omnivore", none: "omnivore" };
  for (const diet of diets) if (!dietAliases[diet]) deny(r, "unknown_diet", `Unrecognized dietary restriction: ${diet}`);
  const dislikes = (constraints.dislikes ?? []).map(normalizeIngredient);
  for (const dislike of dislikes) {
    if (!dislike) deny(r, "unknown_dislike", "Empty disliked ingredient cannot be checked");
  }
  for (const ingredient of recipe.ingredients) {
    const taxon = findIngredientTaxon(ingredient.name);
    if (!taxon || taxon.id !== ingredient.canonicalId || !ingredient.reviewed) { deny(r, "unknown_ingredient", `Ingredient evidence is incomplete: ${ingredient.name}`); continue; }
    const declared = [...ingredient.allergens, ...(ingredient.mayContain ?? [])];
    if (declared.some(a => !ALLERGENS.includes(a as typeof ALLERGENS[number])) || taxon.allergens.some(a => !ingredient.allergens.includes(a)) || taxon.dietaryFlags.some(flag => !ingredient.dietaryFlags.includes(flag)) || ingredient.dietaryFlags.some(flag => !["meat", "fish", "animal_product"].includes(flag))) deny(r, "ingredient_evidence_conflict", `Ingredient evidence contradicts the taxonomy: ${ingredient.name}`);
    if (declared.some(a => allergies.has(a))) deny(r, "allergy_conflict", `Allergy conflicts with ${ingredient.name}`);
    if (dislikes.some(dislike => !dislike || dislike === normalizeIngredient(ingredient.name) || dislike === normalizeIngredient(taxon.id) || taxon.aliases.includes(dislike) || normalizeIngredient(ingredient.name).split(" ").includes(dislike))) deny(r, "dislike_conflict", `Disliked ingredient: ${ingredient.name}`);
    const flags = new Set([...ingredient.dietaryFlags, ...taxon.dietaryFlags]);
    if (diets.some(d => (dietAliases[d] === "vegan" && (flags.has("animal_product") || flags.has("meat") || flags.has("fish"))) || (dietAliases[d] === "vegetarian" && (flags.has("meat") || flags.has("fish"))) || (dietAliases[d] === "pescatarian" && flags.has("meat")))) deny(r, "diet_conflict", `Diet conflicts with ${ingredient.name}`);
  }
  if (diets.some(d => dietAliases[d] === "low_carb") && recipe.macros.carbs > 30) deny(r, "diet_conflict", "Recipe exceeds low-carb per-meal policy (30g)");
  if (diets.some(d => dietAliases[d] === "high_protein") && recipe.macros.protein < 20) deny(r, "diet_conflict", "Recipe misses high-protein per-meal policy (20g)");
  if (constraints.maxPrepMinutes != null && (!Number.isFinite(constraints.maxPrepMinutes) || constraints.maxPrepMinutes <= 0 || recipe.readyInMinutes > constraints.maxPrepMinutes)) deny(r, "prep_time_conflict", "Recipe exceeds preparation time limit");
  return r;
}
type Ingredient = { name: string; amount: number; unit: string };
export type CheckableMeal = {
  baseId: string; recipeVersion?: number; mealSlot: string; title: string; portionMultiplier: number;
  mealKind?: "recipe" | "social"; nutritionStatus?: "checked" | "unknown";
  ingredients: Ingredient[]; baseIngredients: Ingredient[]; macros: RecipeMacros; baseMacros: RecipeMacros;
  steps?: string[]; recipeSteps?: string[];
};
const zeroMacros = (macros: RecipeMacros | undefined) =>
  !!macros && Object.values(macros).every((value) => value === 0);

/**
 * A meal out is a user-declared planning exception, not a recipe. Keeping the
 * shape deliberately narrow prevents it being used to smuggle an unchecked
 * recipe through the approval gate.
 */
export function validateSocialMeal(meal: CheckableMeal): ApprovalResult {
  const r: ApprovalResult = { approved: true, reasons: [], recipeId: "social-meal", recipeVersion: 1, policyVersion: APPROVAL_POLICY_VERSION };
  const isValid = meal?.mealKind === "social" && meal.nutritionStatus === "unknown" &&
    meal.baseId === "social-meal" && meal.title === "Meal out" && meal.recipeVersion === undefined &&
    meal.portionMultiplier === 1 && Array.isArray(meal.ingredients) && !meal.ingredients.length &&
    Array.isArray(meal.baseIngredients) && !meal.baseIngredients.length &&
    zeroMacros(meal.macros) && zeroMacros(meal.baseMacros);
  if (!isValid) deny(r, "invalid_social_meal", "A meal out must remain an explicit nutrition-unknown exception with no ingredients.");
  return r;
}
const close = (actual: number, expected: number) => Number.isFinite(actual) && Math.abs(actual - expected) <= Math.max(0.011, expected * 0.0001);
const scaledMacros = (macros: RecipeMacros, multiplier: number): RecipeMacros => Object.fromEntries(Object.entries(macros).map(([key, value]) => [key, Math.round(value * multiplier)])) as RecipeMacros;
export function validateMealAgainstRecipe<T extends CheckableMeal>(meal: T, recipe: RecipeRecord, constraints: ApprovalConstraints = {}): ApprovalResult & { meal?: T } {
  const r = approveRecipe(recipe, constraints);
  if (!meal || typeof meal !== "object") { deny(r, "invalid_meal", "Meal must be an object"); return r; }
  if (meal.baseId !== recipe.id || meal.recipeVersion !== recipe.version) deny(r, "recipe_identity_conflict", "Recipe identity/version does not match reviewed record");
  if (!recipe.slots.includes(meal.mealSlot as RecipeRecord["slots"][number]) || meal.title !== recipe.title) deny(r, "recipe_identity_conflict", "Recipe slot or title changed");
  const portion = meal.portionMultiplier;
  if (!Number.isFinite(portion) || portion < 0.7 || portion > 1.5) deny(r, "unsafe_portion", "Portion must be between 0.7 and 1.5 servings");
  const matches = (items: Ingredient[], multiplier: number) => Array.isArray(items) && items.length === recipe.ingredients.length && items.every((item, index) => { const expected = recipe.ingredients[index]; return !!item && item.name === expected.name && item.unit === expected.unit && close(item.amount, expected.amount / recipe.servings * multiplier); });
  if (!matches(meal.baseIngredients, 1) || !matches(meal.ingredients, portion)) deny(r, "ingredient_substitution", "Ingredients or measured amounts differ from reviewed recipe");
  const steps = (items: unknown) => Array.isArray(items) && items.length === recipe.steps.length && items.every((item, index) => item === recipe.steps[index]);
  if (!steps(meal.steps ?? meal.recipeSteps) || (meal.steps !== undefined && !steps(meal.steps)) || (meal.recipeSteps !== undefined && !steps(meal.recipeSteps))) deny(r, "method_substitution", "Method differs from reviewed recipe");
  const trusted = scaledMacros(recipe.macros, portion);
  const finalDiet = [...(constraints.dietaryModes ?? []), ...(constraints.dietaryMode ? [constraints.dietaryMode] : [])].map(normalizeIngredient);
  if (finalDiet.includes("low carb") && trusted.carbs > 30) deny(r, "diet_conflict", "Final portion exceeds low-carb policy");
  if (finalDiet.includes("high protein") && trusted.protein < 20) deny(r, "diet_conflict", "Final portion misses high-protein policy");
  if (!meal.macros || !meal.baseMacros || Object.keys(trusted).some(key => !close(meal.macros[key as keyof RecipeMacros], trusted[key as keyof RecipeMacros]) || !close(meal.baseMacros[key as keyof RecipeMacros], recipe.macros[key as keyof RecipeMacros]))) deny(r, "nutrition_tampering", "Nutrition differs from reviewed recipe and portion");
  return { ...r, ...(r.approved ? { meal: { ...meal, macros: trusted, baseMacros: { ...recipe.macros }, readyInMinutes: recipe.readyInMinutes, image: recipe.image, proteinType: recipe.proteinType } } : {}) };
}
export function validatePlanAgainstRecipes<T extends { meals: CheckableMeal[]; totals?: RecipeMacros }>(days: T[], recipes: RecipeRecord[], constraints: ApprovalConstraints = {}): { approved: boolean; reasons: ApprovalResult["reasons"]; days: T[] } {
  const reasons: ApprovalResult["reasons"] = [];
  if (!Array.isArray(days) || !days.length) return { approved: false, reasons: [{ code: "empty_plan", message: "Plan contains no days" }], days: [] };
  const sanitized = days.map(day => {
    if (!day || !Array.isArray(day.meals) || !day.meals.length) { reasons.push({ code: "empty_day", message: "Day contains no meals" }); return day; }
    const meals = day.meals.map(meal => {
      if (meal?.mealKind === "social") {
        const checked = validateSocialMeal(meal);
        reasons.push(...checked.reasons);
        return meal;
      }
      const recipe = recipes.find(r => !!meal && r.id === meal.baseId && r.version === meal.recipeVersion);
      if (!recipe) { reasons.push({ code: "recipe_not_found", message: "Reviewed recipe/version was not found" }); return meal; }
      const checked = validateMealAgainstRecipe(meal, recipe, constraints);
      reasons.push(...checked.reasons);
      return checked.meal ?? meal;
    });
    const totals = meals.reduce((sum, meal) => { for (const key of Object.keys(sum) as Array<keyof RecipeMacros>) sum[key] += meal?.macros?.[key] ?? 0; return sum; }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    return { ...day, meals, totals };
  });
  return { approved: !reasons.length, reasons, days: sanitized };
}
