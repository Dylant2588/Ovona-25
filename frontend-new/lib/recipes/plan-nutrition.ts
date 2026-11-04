import type { WeeklyMealPlan } from "../meal-generator.ts";
import type { FoodCompositionSnapshot, IngredientNutritionEvidence, RecipeRecord } from "./types.ts";
import { CALCULATED_NUTRITION_METHOD, MICRONUTRIENT_KEYS, calculateRecipeMicronutrients, type MicronutrientCoverage, type MicronutrientKey } from "./nutrition.ts";

export type DisplayNutritionMapping = Readonly<{ recipeId: string; recipeVersion: number; ingredientIndex: number; expectedName: string; expectedCanonicalId: string; nutrition: IngredientNutritionEvidence }>;
export type NutrientSource = FoodCompositionSnapshot["source"] & { foodId: string; foodRevision: string };
export type DailyNutrientCoverage = MicronutrientCoverage & { estimated: boolean; sources: NutrientSource[]; reference: { amount: number; unit: "mg"; label: string; url: string } };
export type PlanNutritionSummary = { planId: string; days: Array<{ dayId: string; macros: WeeklyMealPlan["weeklyTotals"]; macroEvidence: "ingredient_calculated" | "legacy_reviewed" | "mixed" | "unknown"; micronutrients: Record<MicronutrientKey, DailyNutrientCoverage> }> };

const references = { calcium_mg: 800, iron_mg: 14, vitamin_c_mg: 80 };
const referenceUrl = "https://www.legislation.gov.uk/eur/2011/1169/pdfs/eur_20111169_2014-02-19_en.pdf";
const quantize = (v: number) => Math.round(v * 1e6) / 1e6;

/** Read-only projection of an already approved plan. Display enrichment is never approval evidence. */
export function buildPlanNutritionSummary(plan: WeeklyMealPlan, recipes: readonly RecipeRecord[], displayMappings: readonly DisplayNutritionMapping[] = []): PlanNutritionSummary {
  return { planId: plan.id, days: plan.days.map(day => {
    const empty = (key: MicronutrientKey): DailyNutrientCoverage => ({ unit: "mg", status: "unknown", knownSubtotal: null, amount: null,
      knownIngredients: 0, totalIngredients: 0, estimated: false, sources: [],
      reference: { amount: references[key], unit: "mg", label: "General adult food-labelling reference, not a personalised goal", url: referenceUrl } });
    const micronutrients = { calcium_mg: empty("calcium_mg"), iron_mg: empty("iron_mg"), vitamin_c_mg: empty("vitamin_c_mg") };
    const macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const methods = new Set<string>();
    for (const meal of day.meals) {
      for (const key of ["calories", "protein", "carbs", "fat"] as const) macros[key] += meal.macros[key];
      const recipe = recipes.find(r => r.id === meal.baseId && r.version === meal.recipeVersion);
      if (!recipe || meal.mealKind === "social") {
        methods.add("unknown");
        MICRONUTRIENT_KEYS.forEach(key => { micronutrients[key].totalIngredients++; });
        continue;
      }
      methods.add(recipe.nutrition.method === CALCULATED_NUTRITION_METHOD ? "ingredient_calculated" : "legacy_reviewed");
      recipe.ingredients.forEach((ingredient, index) => {
        const matches = displayMappings.filter(m => m.recipeId === recipe.id && m.recipeVersion === recipe.version && m.ingredientIndex === index && m.expectedName === ingredient.name && m.expectedCanonicalId === ingredient.canonicalId);
        // Ambiguous mappings and invalid embedded evidence never fall through to a guessed replacement.
        const mapping = !ingredient.nutrition && matches.length === 1 ? matches[0] : undefined;
        const nutrition = ingredient.nutrition ?? mapping?.nutrition;
        const checked = calculateRecipeMicronutrients({ servings: recipe.servings, ingredients: [{ ...ingredient, nutrition }] });
        for (const key of MICRONUTRIENT_KEYS) {
          const row = micronutrients[key]; row.totalIngredients++;
          if (checked[key].knownSubtotal === null || !nutrition) continue;
          const amount = checked[key].knownSubtotal * meal.portionMultiplier;
          if (!Number.isFinite(amount) || !Number.isFinite((row.knownSubtotal ?? 0) + amount)) continue;
          row.knownIngredients++; row.knownSubtotal = (row.knownSubtotal ?? 0) + amount;
          row.estimated ||= !!mapping;
          const source = { ...nutrition.food.source, foodId: nutrition.food.id, foodRevision: nutrition.food.revision };
          if (!row.sources.some(s => JSON.stringify(s) === JSON.stringify(source))) row.sources.push(source);
        }
      });
    }
    for (const key of MICRONUTRIENT_KEYS) {
      const row = micronutrients[key];
      row.status = row.knownIngredients === 0 ? "unknown" : row.knownIngredients === row.totalIngredients ? "complete" : "partial";
      row.knownSubtotal = row.knownSubtotal === null ? null : quantize(row.knownSubtotal);
      row.amount = row.status === "complete" ? row.knownSubtotal : null;
    }
    const macroEvidence = methods.has("unknown") ? "unknown" : methods.size > 1 ? "mixed" : methods.has("ingredient_calculated") ? "ingredient_calculated" : "legacy_reviewed";
    return { dayId: day.id, macros, macroEvidence, micronutrients };
  }) };
}
