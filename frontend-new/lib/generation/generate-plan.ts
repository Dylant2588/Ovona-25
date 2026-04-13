import { randomUUID } from "crypto";
import type {
  MacroBreakdown,
  MealInstance,
  MealSlot,
  ProteinType,
  WeeklyMealPlan,
} from "@/lib/meal-generator";
import { supabaseServer } from "@/lib/supabaseServer";
import { buildContext } from "@/lib/generation/context-builder";
import { fallbackToStaticLibrary } from "@/lib/generation/fallback";
import { applyHealthAdjustments, calculatePortions } from "@/lib/generation/medical-engine";
import {
  storeMealConcepts,
  recordMealHistory,
  seedMealConceptsFromStaticLibrary,
} from "@/lib/generation/meal-storage";
import { generateMeals } from "@/lib/generation/nutritionist";
import { optimiseAndPrice } from "@/lib/generation/practical-engine";
import type {
  GenerationArtifacts,
  GenerationContext,
  MealConcept,
  PortionedMeal,
} from "@/lib/generation/types";
import { validateMealIngredients } from "@/lib/generation/validation-gate";

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toDateOnly = (value: Date) => value.toISOString().split("T")[0];

const getWeekStart = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const normalizeSlot = (slot: string): MealSlot => {
  const lower = slot.toLowerCase();
  if (lower.includes("break")) return "breakfast";
  if (lower.includes("lunch")) return "lunch";
  if (lower.includes("dinner")) return "dinner";
  return "snack";
};

const slotLabelToSlot = (label: string) => normalizeSlot(label);

const mapProteinType = (value: string): ProteinType => {
  const normalized = value.toLowerCase();
  if (normalized.includes("poultry") || normalized.includes("chicken") || normalized.includes("turkey")) {
    return "poultry";
  }
  if (normalized.includes("red")) return "red_meat";
  if (normalized.includes("seafood")) return "seafood";
  if (normalized.includes("fish")) return "fish";
  if (normalized.includes("plant") || normalized.includes("vegan") || normalized.includes("vegetarian")) {
    return "plant";
  }
  return "mixed";
};

const sumMacros = (items: MacroBreakdown[]): MacroBreakdown =>
  items.reduce(
    (acc, item) => ({
      calories: Math.round(acc.calories + item.calories),
      protein: Math.round(acc.protein + item.protein),
      carbs: Math.round(acc.carbs + item.carbs),
      fat: Math.round(acc.fat + item.fat),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

const toMealInstance = (meal: PortionedMeal): MealInstance => {
  const ingredients = meal.ingredients.map((ingredient) => ({
    name: ingredient.name,
    amount: Number(ingredient.amount.toFixed(2)),
    unit: ingredient.unit,
    category: ingredient.category,
  }));

  const macros: MacroBreakdown = {
    calories: Math.round(meal.totalMacros.calories),
    protein: Math.round(meal.totalMacros.protein),
    carbs: Math.round(meal.totalMacros.carbs),
    fat: Math.round(meal.totalMacros.fat),
  };

  const slot = normalizeSlot(meal.slot);
  const titleSlug = normalize(meal.concept.name).replace(/\s+/g, "-");

  return {
    instanceId: randomUUID(),
    baseId: `${titleSlug}-${slot}`,
    mealSlot: slot,
    title: meal.concept.name,
    description: `${meal.concept.cuisine} ${meal.concept.slot}`.trim(),
    steps: meal.concept.steps,
    recipeSteps: meal.concept.steps,
    tags: [
      `cuisine:${meal.concept.cuisine}`,
      `protein:${meal.concept.protein_type}`,
      "generated",
    ],
    image: "",
    readyInMinutes: meal.concept.prep_minutes,
    portionMultiplier: 1,
    baseMacros: macros,
    macros,
    baseIngredients: ingredients,
    ingredients,
    proteinType: mapProteinType(meal.concept.protein_type),
  };
};

const distributeAcrossWeek = (
  concepts: MealConcept[],
  context: GenerationContext
) => {
  const required = context.mealsPerDay * 5;
  const slots = context.slotLabels.map(slotLabelToSlot);
  const prepared = concepts.map((concept, index) => ({
    ...concept,
    day:
      concept.day ??
      concept.for_day ??
      Math.floor(index / context.mealsPerDay) + 1,
    slot: concept.slot ? normalizeSlot(concept.slot) : slots[index % slots.length],
  }));

  const byDaySlot = new Map<string, MealConcept>();
  prepared.forEach((meal) => {
    const key = `${meal.day}-${meal.slot}`;
    if (!byDaySlot.has(key)) {
      byDaySlot.set(key, meal);
    }
  });

  const ordered: MealConcept[] = [];
  for (let day = 1; day <= 5; day += 1) {
    slots.forEach((slot, slotIndex) => {
      const key = `${day}-${slot}`;
      const existing = byDaySlot.get(key);
      if (existing) {
        ordered.push(existing);
      } else {
        const fallback = prepared.find((meal) => normalizeSlot(meal.slot) === slot);
        if (fallback) {
          ordered.push({
            ...fallback,
            day,
            slot,
            name: `${fallback.name} (${day}-${slotIndex + 1})`,
          });
        }
      }
    });
  }
  return ordered.slice(0, required);
};

const fillFromFallback = (
  current: MealConcept[],
  context: GenerationContext
): MealConcept[] => {
  const required = context.mealsPerDay * 5;
  if (current.length >= required) return current.slice(0, required);
  const fallback = distributeAcrossWeek(fallbackToStaticLibrary(context).meals, context);
  const merged = [...current];
  let cursor = 0;
  while (merged.length < required && cursor < fallback.length * 2) {
    merged.push({
      ...fallback[cursor % fallback.length],
      day: Math.floor(merged.length / context.mealsPerDay) + 1,
      slot: slotLabelToSlot(context.slotLabels[merged.length % context.mealsPerDay]),
    });
    cursor += 1;
  }
  return merged.slice(0, required);
};

const mealConflictsWithAllergies = (
  allergenFlags: string[],
  context: GenerationContext
) => {
  const allergySet = new Set(context.allergies.map((entry) => entry.toLowerCase()));
  return allergenFlags.some((flag) => allergySet.has(flag.toLowerCase()));
};

const chooseSlotBudget = (context: GenerationContext, slot: string) => {
  const normalized = normalizeSlot(slot);
  const hit =
    context.slotBudgets.find((budget) => normalizeSlot(budget.label) === normalized) ??
    context.slotBudgets[0];
  return hit;
};

const buildPlanFromPortionedMeals = (
  meals: PortionedMeal[],
  context: GenerationContext,
  userId: string
): WeeklyMealPlan => {
  const weekStart = getWeekStart();
  const days: WeeklyMealPlan["days"] = [];

  for (let day = 1; day <= 5; day += 1) {
    const date = addDays(weekStart, day - 1);
    const dayMeals = meals
      .filter((meal) => meal.day === day)
      .map(toMealInstance);
    const totals = sumMacros(dayMeals.map((meal) => meal.macros));
    days.push({
      id: randomUUID(),
      label: date.toLocaleDateString("en-US", { weekday: "long" }),
      date: date.toISOString(),
      meals: dayMeals,
      totals,
    });
  }

  return {
    id: randomUUID(),
    userId,
    weekStart: weekStart.toISOString(),
    generatedAt: new Date().toISOString(),
    preferenceSignature: JSON.stringify({
      calories: context.calorieTarget,
      protein: context.proteinTarget,
      carbs: context.carbTarget,
      fat: context.fatTarget,
      dietaryMode: context.dietaryMode,
      allergies: context.allergies,
      dislikes: context.dislikes,
      cuisines: context.cuisinePreferences,
    }),
    days,
    weeklyTotals: sumMacros(days.map((day) => day.totals)),
  };
};

const resolveAlternativesForMeal = (
  alternatives: MealConcept[],
  day: number,
  slot: string
) =>
  alternatives.find(
    (alternative) =>
      (alternative.for_day ?? alternative.day) === day &&
      normalizeSlot(alternative.for_slot ?? alternative.slot) === normalizeSlot(slot)
  );

const ensureSafety = async (
  distributedMeals: MealConcept[],
  alternatives: MealConcept[],
  context: GenerationContext,
  supabase: Awaited<ReturnType<typeof supabaseServer>>
) => {
  const safeMeals: MealConcept[] = [];

  for (const meal of distributedMeals) {
    const validation = await validateMealIngredients(meal, supabase);
    let selected = meal;

    if (
      validation.unknownIngredients.length > 0 ||
      mealConflictsWithAllergies(validation.allergenFlags, context)
    ) {
      const day = meal.day ?? 1;
      const alternative = resolveAlternativesForMeal(alternatives, day, meal.slot);
      if (alternative) {
        const altValidation = await validateMealIngredients(alternative, supabase);
        if (
          altValidation.unknownIngredients.length === 0 &&
          !mealConflictsWithAllergies(altValidation.allergenFlags, context)
        ) {
          selected = {
            ...alternative,
            day,
            slot: meal.slot,
          };
        }
      }
    }

    safeMeals.push(selected);
  }

  return safeMeals;
};

export async function generateWeeklyPlanWithArtifacts(
  userId: string
): Promise<GenerationArtifacts> {
  const supabase = await supabaseServer();

  try {
    const { count, error } = await supabase
      .from("meal_concepts")
      .select("id", { count: "exact", head: true });
    if (!error && (count ?? 0) === 0) {
      await seedMealConceptsFromStaticLibrary(supabase);
    }
  } catch (error) {
    console.warn("[generate-plan] meal_concepts seed check skipped:", error);
  }

  const context = await buildContext(userId, { supabase });
  let nutrition = await generateMeals(context, { supabase });

  if (!nutrition.meals.length) {
    nutrition = fallbackToStaticLibrary(context);
  }

  let distributedMeals = distributeAcrossWeek(nutrition.meals, context);
  distributedMeals = fillFromFallback(distributedMeals, context);
  const safeMeals = await ensureSafety(
    distributedMeals,
    nutrition.alternatives,
    context,
    supabase
  );

  const portioned = await Promise.all(
    safeMeals.map((meal) =>
      calculatePortions(meal, chooseSlotBudget(context, meal.slot), supabase)
    )
  );
  const healthAdjusted = await applyHealthAdjustments(portioned, context);
  const practical = await optimiseAndPrice(healthAdjusted, context.weeklyBudget, supabase);

  let finalPortioned = practical.adjustedPlan;
  if (practical.substitutionsMade.length > 0) {
    finalPortioned = await applyHealthAdjustments(finalPortioned, context);
  }

  const weeklyPlan = buildPlanFromPortionedMeals(finalPortioned, context, userId);

  await storeMealConcepts(nutrition.meals, supabase, {
    source: nutrition.source === "fallback" ? "seed" : "llm",
    verified: nutrition.source === "fallback",
  });
  await storeMealConcepts(nutrition.alternatives, supabase, {
    source: nutrition.source === "fallback" ? "seed" : "llm",
    verified: nutrition.source === "fallback",
  });

  await recordMealHistory(userId, finalPortioned, toDateOnly(getWeekStart()), supabase);

  return {
    context,
    practical,
    alternatives: nutrition.alternatives,
    source: nutrition.source,
    weeklyPlan,
  };
}

export async function generateWeeklyPlan(userId: string): Promise<WeeklyMealPlan> {
  const result = await generateWeeklyPlanWithArtifacts(userId);
  return result.weeklyPlan;
}
