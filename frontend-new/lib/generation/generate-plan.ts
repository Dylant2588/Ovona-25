import { randomUUID } from "crypto";
import type {
  MacroBreakdown,
  MealInstance,
  MealSlot,
  PreferencesInput,
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
import { buildDeterministicPlanningInput } from "@/lib/orchestration/candidate-adapter";
import { orchestrateWeek } from "@/lib/orchestration/schedule";
import { buildOrchestrationShoppingList } from "@/lib/orchestration/shopping";

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
  const required = context.mealsPerDay * 7;
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
  for (let day = 1; day <= 7; day += 1) {
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
  const required = context.mealsPerDay * 7;
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
  const dairyTerms = new Set([
    "dairy",
    "lactose",
    "milk",
    "yogurt",
    "yoghurt",
    "cheese",
    "whey",
    "casein",
    "butter",
    "cream",
  ]);
  const blocksDairy = [...allergySet].some((entry) => dairyTerms.has(entry));
  return allergenFlags.some((flag) => {
    const normalizedFlag = flag.toLowerCase();
    return allergySet.has(normalizedFlag) || (blocksDairy && dairyTerms.has(normalizedFlag));
  });
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

  for (let day = 1; day <= 7; day += 1) {
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

    const selectedValidation = await validateMealIngredients(selected, supabase);
    if (
      selectedValidation.unknownIngredients.length > 0 ||
      mealConflictsWithAllergies(selectedValidation.allergenFlags, context)
    ) {
      throw new Error(
        `[generation] no verified allergy-safe replacement for ${meal.name}`
      );
    }

    safeMeals.push(selected);
  }

  return safeMeals;
};

export async function generateWeeklyPlanWithArtifacts(
  userId: string,
  options?: { preferences?: PreferencesInput }
): Promise<GenerationArtifacts> {
  const hydrated = await buildDeterministicPlanningInput(userId, { preferences: options?.preferences });
  if (!hydrated.ok) throw Object.assign(new Error(hydrated.error.reasons.join("; ")), hydrated.error);
  const schedule = orchestrateWeek(hydrated.value.profile, hydrated.value.candidates, hydrated.value.history);
  if (!schedule.ok) {
    throw Object.assign(new Error(schedule.error.violations.map((violation) => violation.message).join("; ")), {
      statusCode: 422, code: "INSUFFICIENT_VERIFIED_CATALOGUE", reasons: schedule.error.violations.map((violation) => violation.message),
    });
  }
  const context = hydrated.value.context;
  const weekStart = getWeekStart();
  const weeklyPlan: WeeklyMealPlan = {
    id: randomUUID(), userId, weekStart: weekStart.toISOString(), generatedAt: new Date().toISOString(),
    preferenceSignature: JSON.stringify({ calories: context.calorieTarget, protein: context.proteinTarget, dietaryMode: context.dietaryMode, allergies: context.allergies }),
    days: schedule.value.days.map((day) => {
      const date = addDays(weekStart, day.day - 1);
      const meals = day.meals.map((meal): MealInstance => ({
        instanceId: randomUUID(), baseId: meal.candidateId, mealSlot: meal.slot, title: meal.title, description: meal.explanation,
        steps: [], recipeSteps: [], tags: ["verified", "deterministic", ...meal.score.facts], image: "", readyInMinutes: meal.prepMinutes, portionMultiplier: meal.nutritionPortionMultiplier,
        baseMacros: { ...meal.nutrition }, macros: {
          calories: Math.round(meal.nutrition.calories * meal.nutritionPortionMultiplier), protein: Math.round(meal.nutrition.protein * meal.nutritionPortionMultiplier),
          carbs: Math.round(meal.nutrition.carbs * meal.nutritionPortionMultiplier), fat: Math.round(meal.nutrition.fat * meal.nutritionPortionMultiplier),
        },
        baseIngredients: meal.ingredients.map((ingredient) => ({ name: ingredient.name, amount: ingredient.quantity, unit: ingredient.unit, category: ingredient.pantry ? "Pantry" : "Produce" })),
        ingredients: meal.ingredients.map((ingredient) => ({ name: ingredient.name, amount: ingredient.quantity * meal.servings, unit: ingredient.unit, category: ingredient.pantry ? "Pantry" : "Produce" })), proteinType: "plant",
      }));
      return { id: randomUUID(), label: date.toLocaleDateString("en-US", { weekday: "long" }), date: date.toISOString(), meals, totals: sumMacros(meals.map((meal) => meal.macros)) };
    }),
    weeklyTotals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  };
  weeklyPlan.weeklyTotals = sumMacros(weeklyPlan.days.map((day) => day.totals));
  const shopping = buildOrchestrationShoppingList(schedule.value);
  const adjustedPlan: PortionedMeal[] = schedule.value.days.flatMap((day) => day.meals.map((meal) => ({
    concept: { name: meal.title, ingredients: meal.ingredients.map((ingredient) => ingredient.name), steps: [], cuisine: "curated", protein_type: "plant", slot: meal.slot, prep_minutes: meal.prepMinutes, day: day.day },
    ingredients: meal.ingredients.map((ingredient) => ({ name: ingredient.name, amount: ingredient.quantity * meal.servings, unit: ingredient.unit, category: ingredient.pantry ? "Pantry" : "Produce", macros: { calories: 0, protein: 0, carbs: 0, fat: 0 }, micros: { iron_mg: 0, omega_3_g: 0, b12_mcg: 0, vitamin_d_mcg: 0, folate_mcg: 0, calcium_mg: 0, fibre_g: 0 } })),
    totalMacros: { ...meal.nutrition }, totalMicros: { iron_mg: 0, omega_3_g: 0, b12_mcg: 0, vitamin_d_mcg: 0, folate_mcg: 0, calcium_mg: 0, fibre_g: 0 }, slot: meal.slot, day: day.day,
  })));
  const shoppingList = shopping.buyItems.map((item) => {
    const amount = item.amountToBuy ?? item.quantity;
    return { name: item.name, amountNeeded: item.amountNeeded ?? amount, amountToBuy: amount, unit: item.unit, category: "Produce", pricePerPack: 0, packSize: amount, packsNeeded: 1, totalPrice: 0 };
  });
  const weeklyTotal = Number(schedule.value.days.flatMap((day) => day.meals).reduce((total, meal) => total + meal.cost * meal.servings, 0).toFixed(2));
  return { context, practical: { adjustedPlan, shoppingList, weeklyTotal, substitutionsMade: [] }, alternatives: [], source: "db", weeklyPlan };
}

export async function generateWeeklyPlan(
  userId: string,
  options?: { preferences?: PreferencesInput }
): Promise<WeeklyMealPlan> {
  const result = await generateWeeklyPlanWithArtifacts(userId, options);
  return result.weeklyPlan;
}
