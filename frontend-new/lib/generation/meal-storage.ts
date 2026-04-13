import { generateFallbackMealPlan, type PreferencesInput } from "@/lib/meal-generator";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MealConcept, PortionedMeal } from "@/lib/generation/types";

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toDateOnly = (value: Date) => value.toISOString().split("T")[0];

const calculateDate = (weekStart: string, day: number) => {
  const start = new Date(weekStart);
  const normalizedDay = Math.max(1, day);
  const next = new Date(start);
  next.setDate(next.getDate() + (normalizedDay - 1));
  return toDateOnly(next);
};

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
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

export async function storeMealConcepts(
  meals: MealConcept[],
  supabase: SupabaseClient,
  options?: { source?: "llm" | "seed" | "db"; verified?: boolean }
): Promise<void> {
  const unique = Array.from(
    new Map(
      meals
        .filter((meal) => meal.name?.trim())
        .map((meal) => [`${normalize(meal.name)}|${normalize(meal.slot)}`, meal])
    ).values()
  );

  for (const meal of unique) {
    const { data: existing, error: lookupError } = await supabase
      .from("meal_concepts")
      .select("id")
      .eq("name", meal.name)
      .limit(1);

    if (lookupError) {
      console.warn("[meal-storage] meal_concepts lookup failed:", lookupError.message);
      return;
    }
    if (Array.isArray(existing) && existing.length > 0) {
      continue;
    }

    const payload = {
      name: meal.name,
      ingredients: meal.ingredients,
      steps: meal.steps,
      cuisine: meal.cuisine,
      protein_type: meal.protein_type,
      meal_slots: [meal.slot],
      prep_minutes: meal.prep_minutes,
      source: options?.source ?? "llm",
      verified: options?.verified ?? false,
    };

    const { error: insertError } = await supabase.from("meal_concepts").insert(payload);
    if (insertError) {
      console.warn("[meal-storage] meal_concepts insert failed:", insertError.message);
      return;
    }
  }
}

export async function recordMealHistory(
  userId: string,
  plan: PortionedMeal[],
  weekStart: string,
  supabase: SupabaseClient
): Promise<void> {
  if (!plan.length) return;
  const records = plan.map((meal) => ({
    user_id: userId,
    concept_id: null,
    meal_name: meal.concept.name,
    protein_type: meal.concept.protein_type,
    date: calculateDate(weekStart, meal.day),
    meal_slot: meal.slot,
  }));

  const { error } = await supabase.from("user_meal_history").insert(records);
  if (error) {
    console.warn("[meal-storage] user_meal_history insert failed:", error.message);
  }
}

export async function getRecentHistory(
  userId: string,
  supabase: SupabaseClient
): Promise<{ mealNames: string[]; proteinTypes: string[] }> {
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const { data, error } = await supabase
    .from("user_meal_history")
    .select("meal_name, protein_type")
    .eq("user_id", userId)
    .gte("date", toDateOnly(twoWeeksAgo))
    .order("date", { ascending: false });

  if (error || !Array.isArray(data)) {
    if (error) {
      console.warn("[meal-storage] getRecentHistory failed:", error.message);
    }
    return { mealNames: [], proteinTypes: [] };
  }

  return {
    mealNames: Array.from(
      new Set(
        data
          .map((row) => (typeof (row as Record<string, unknown>).meal_name === "string"
            ? ((row as Record<string, unknown>).meal_name as string)
            : ""))
          .filter(Boolean)
      )
    ),
    proteinTypes: Array.from(
      new Set(
        data
          .map((row) => (typeof (row as Record<string, unknown>).protein_type === "string"
            ? ((row as Record<string, unknown>).protein_type as string)
            : ""))
          .filter(Boolean)
      )
    ),
  };
}

const mealToConcept = (
  meal: ReturnType<typeof generateFallbackMealPlan>["days"][number]["meals"][number]
): MealConcept => ({
  name: meal.title,
  ingredients: (meal.baseIngredients?.length ? meal.baseIngredients : meal.ingredients).map(
    (ingredient) => ingredient.name
  ),
  steps: toStringArray(meal.steps),
  cuisine: meal.tags[0] ?? "mixed",
  protein_type: meal.proteinType ?? "mixed",
  slot: meal.mealSlot,
  prep_minutes: meal.readyInMinutes,
});

export async function seedMealConceptsFromStaticLibrary(
  supabase: SupabaseClient
): Promise<number> {
  const preferenceSeeds: PreferencesInput[] = [
    { tastes: [], goal: "maintain", mealComplexity: "simple", profile: { mealsPerDay: 5 } },
    { tastes: [], goal: "lose_weight", mealComplexity: "normal", profile: { mealsPerDay: 5 } },
    { tastes: [], goal: "gain", mealComplexity: "adventurous", profile: { mealsPerDay: 5 } },
    { tastes: [], goal: "maintain", mealComplexity: "normal", profile: { mealsPerDay: 3 } },
  ];

  const concepts: MealConcept[] = [];
  preferenceSeeds.forEach((preferences) => {
    const plan = generateFallbackMealPlan(preferences);
    plan.days.forEach((day) => {
      day.meals.forEach((meal) => concepts.push(mealToConcept(meal)));
    });
  });

  const unique = Array.from(
    new Map(concepts.map((concept) => [`${normalize(concept.name)}|${concept.slot}`, concept])).values()
  );
  if (!unique.length) return 0;

  await storeMealConcepts(unique, supabase, { source: "seed", verified: true });
  return unique.length;
}
