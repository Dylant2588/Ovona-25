import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveNutritionBaseline } from "@/lib/meal-generator";
import type { MealConcept, ValidationResult } from "@/lib/generation/types";

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[,;\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const fallbackAllergenInference = (ingredientName: string): string[] => {
  const name = normalize(ingredientName);
  const hits: string[] = [];
  if (/\bmilk|cheese|yogurt|yoghurt|cream|butter|whey|casein|cottage\b/.test(name)) hits.push("dairy");
  if (/\bwheat|bread|pasta|flour|barley|rye\b/.test(name)) hits.push("gluten");
  if (/\bpeanut|almond|cashew|walnut|hazelnut|nut\b/.test(name)) hits.push("nuts");
  if (/\bshrimp|prawn|crab|lobster|mussel|shellfish\b/.test(name)) hits.push("shellfish");
  if (/\bsalmon|cod|tuna|fish|anchovy|mackerel\b/.test(name)) hits.push("fish");
  if (/\begg\b/.test(name)) hits.push("eggs");
  if (/\bsoy|tofu|tempeh|edamame\b/.test(name)) hits.push("soy");
  if (/\bsesame|tahini\b/.test(name)) hits.push("sesame");
  return hits;
};

export async function validateMealIngredients(
  meal: MealConcept,
  supabase: SupabaseClient
): Promise<ValidationResult> {
  const validIngredients: string[] = [];
  const unknownIngredients: string[] = [];
  const allergenFlags = new Set<string>();

  for (const ingredientName of meal.ingredients) {
    const needle = ingredientName.trim();
    if (!needle) continue;
    const { data, error } = await supabase
      .from("ingredients")
      .select("*")
      .ilike("name", `%${needle}%`)
      .limit(1);

    if (error) {
      if (resolveNutritionBaseline(ingredientName)) {
        validIngredients.push(ingredientName);
      } else {
        unknownIngredients.push(ingredientName);
      }
      fallbackAllergenInference(ingredientName).forEach((allergen) =>
        allergenFlags.add(allergen)
      );
      continue;
    }

    if (Array.isArray(data) && data.length > 0) {
      const row = data[0] as Record<string, unknown>;
      const canonicalName =
        typeof row.name === "string" && row.name.trim() ? row.name.trim() : ingredientName;
      validIngredients.push(canonicalName);

      const dbAllergens = toStringArray(row.allergens).map((item) => item.toLowerCase());
      if (dbAllergens.length) {
        dbAllergens.forEach((item) => allergenFlags.add(item));
      } else {
        fallbackAllergenInference(canonicalName).forEach((item) => allergenFlags.add(item));
      }
    } else {
      if (resolveNutritionBaseline(ingredientName)) {
        validIngredients.push(ingredientName);
      } else {
        unknownIngredients.push(ingredientName);
      }
      fallbackAllergenInference(ingredientName).forEach((allergen) =>
        allergenFlags.add(allergen)
      );
    }
  }

  return {
    meal,
    validIngredients,
    unknownIngredients,
    allergenFlags: Array.from(allergenFlags),
  };
}

export async function addUnverifiedIngredient(
  name: string,
  nutritionFromLLM: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fibre: number;
    allergens: string[];
    dietary_flags: string[];
  },
  supabase: SupabaseClient
): Promise<void> {
  const payload = {
    name: name.trim(),
    category: "Other",
    per_100g_calories: nutritionFromLLM.calories,
    per_100g_protein: nutritionFromLLM.protein,
    per_100g_carbs: nutritionFromLLM.carbs,
    per_100g_fat: nutritionFromLLM.fat,
    per_100g_fibre: nutritionFromLLM.fibre,
    allergens: nutritionFromLLM.allergens,
    dietary_flags: nutritionFromLLM.dietary_flags,
    verified: false,
    source: "llm",
  };

  const { error } = await supabase.from("ingredients").insert(payload);
  if (error) {
    console.warn("[validation-gate] unable to insert unverified ingredient:", error.message);
  }
}
