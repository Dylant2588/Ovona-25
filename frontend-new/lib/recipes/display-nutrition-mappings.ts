import type { FoodCompositionSnapshot } from "./types.ts";
import type { DisplayNutritionMapping } from "./plan-nutrition.ts";

/** Crown copyright, CoFID 2021, reused under the Open Government Licence v3.0.
 * Generic composition estimates for these exact raw recipe ingredients only.
 * These mappings do not approve recipes or replace their attested macro totals.
 * Workbook SHA256: 436e9445ef2adb2a75f3d7edd51302de3adad25385f9795fc94ba58bd030e97d.
 * Worksheets: Proximates (4), Inorganics (5), Vitamins (6), per 100g edible food.
 */
const source = (foodCode: string) => ({
  publisher: "Public Health England", dataset: "CoFID", version: "2021", foodCode,
  reference: "https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx",
  retrievedAt: "2026-11-04T00:00:00Z", licence: "Open Government Licence v3.0",
});
const banana: FoodCompositionSnapshot = {
  id: "cofid:14-318", revision: "2021", name: "Bananas, flesh only", state: "raw", basis: { amount: 100, unit: "g" },
  macros: { calories: 81, protein: 1.2, carbs: 20.3, fat: 0.1 },
  micronutrients: { calcium_mg: 6, iron_mg: 0.27, vitamin_c_mg: 9 }, source: source("14-318"),
};
const cucumber: FoodCompositionSnapshot = {
  id: "cofid:13-523", revision: "2021", name: "Cucumber, raw, flesh and skin", state: "raw", basis: { amount: 100, unit: "g" },
  macros: { calories: 14, protein: 1, carbs: 1.2, fat: 0.6 },
  micronutrients: { calcium_mg: 21, iron_mg: 0.30, vitamin_c_mg: 2 }, source: source("13-523"),
};
const tomatoes: FoodCompositionSnapshot = {
  id: "cofid:13-519", revision: "2021", name: "Tomatoes, cherry, raw", state: "raw", basis: { amount: 100, unit: "g" },
  macros: { calories: 22, protein: 1.1, carbs: 3.6, fat: 0.5 },
  micronutrients: { calcium_mg: 10, iron_mg: 0.34, vitamin_c_mg: 15 }, source: source("13-519"),
};
const nutrition = (food: FoodCompositionSnapshot, mappingReference: string) => ({ food, quantityState: "raw" as const, mappingReference });

export const DISPLAY_NUTRITION_MAPPINGS: readonly DisplayNutritionMapping[] = [
  { recipeId: "vanilla-berry-pea-shake", recipeVersion: 2, ingredientIndex: 2, expectedName: "Banana", expectedCanonicalId: "banana",
    nutrition: nutrition(banana, "Curated CoFID 2021 mapping: edible raw banana blended and served chilled; recipe v2 steps 1–3.") },
  { recipeId: "chicken-crunch-snack-box", recipeVersion: 2, ingredientIndex: 1, expectedName: "Cucumber", expectedCanonicalId: "cucumber",
    nutrition: nutrition(cucumber, "Curated CoFID 2021 mapping: raw cucumber served alongside cooked chicken; recipe v2 step 2.") },
  { recipeId: "chicken-crunch-snack-box", recipeVersion: 2, ingredientIndex: 2, expectedName: "Cherry tomatoes", expectedCanonicalId: "tomato",
    nutrition: nutrition(tomatoes, "Curated CoFID 2021 mapping: raw halved cherry tomatoes; recipe v2 step 2.") },
  { recipeId: "turkey-cucumber-rolls", recipeVersion: 2, ingredientIndex: 1, expectedName: "Cucumber", expectedCanonicalId: "cucumber",
    nutrition: nutrition(cucumber, "Curated CoFID 2021 mapping: washed raw cucumber sticks; recipe v2 step 1.") },
];
