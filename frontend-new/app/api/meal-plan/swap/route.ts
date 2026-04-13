import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  buildShoppingList,
  resolveMacroTargets,
  swapMealInPlan,
  WORKDAY_COUNT,
  type MacroBreakdown,
  type MealInstance,
  type MealSlot,
  type PreferencesInput,
  type WeeklyMealPlan,
} from "@/lib/meal-generator";
import { buildContext } from "@/lib/generation/context-builder";
import { calculatePortions } from "@/lib/generation/medical-engine";
import type { MealConcept, PortionedMeal } from "@/lib/generation/types";
import { enforceMacros, toEnforcementInfo } from "@/lib/macro-enforcement";
import { resolveRequestAuth } from "@/lib/serverAuth";

type SwapPayload = {
  preferences?: PreferencesInput;
  plan?: WeeklyMealPlan | null;
  dayIndex?: number;
  mealIndex?: number;
  mealSlot?: MealSlot;
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeSlot = (value: string): MealSlot => {
  const lower = value.toLowerCase();
  if (lower.includes("break")) return "breakfast";
  if (lower.includes("lunch")) return "lunch";
  if (lower.includes("dinner")) return "dinner";
  return "snack";
};

const mapProteinType = (value: string) => {
  const normalized = value.toLowerCase();
  if (normalized.includes("poultry") || normalized.includes("chicken") || normalized.includes("turkey")) {
    return "poultry";
  }
  if (normalized.includes("red")) return "red_meat";
  if (normalized.includes("seafood")) return "seafood";
  if (normalized.includes("fish")) return "fish";
  if (normalized.includes("plant") || normalized.includes("vegan")) return "plant";
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

const toDateOnly = (value: string) => new Date(value).toISOString().split("T")[0];

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
  return {
    instanceId: randomUUID(),
    baseId: `${normalize(meal.concept.name).replace(/\s+/g, "-")}-${slot}`,
    mealSlot: slot,
    title: meal.concept.name,
    description: `${meal.concept.cuisine} ${meal.concept.slot}`.trim(),
    steps: meal.concept.steps,
    recipeSteps: meal.concept.steps,
    tags: [
      `cuisine:${meal.concept.cuisine}`,
      `protein:${meal.concept.protein_type}`,
      "swap-alt",
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

const recalcPlanTotals = (plan: WeeklyMealPlan) => {
  plan.days = plan.days.slice(0, WORKDAY_COUNT).map((day) => ({
    ...day,
    totals: sumMacros(day.meals.map((meal) => meal.macros)),
  }));
  plan.weeklyTotals = sumMacros(plan.days.map((day) => day.totals));
};

const resolveMealIndex = (
  plan: WeeklyMealPlan,
  dayIndex: number,
  mealIndex?: number,
  mealSlot?: MealSlot
) => {
  const day = plan.days[dayIndex];
  if (!day?.meals?.length) return -1;
  if (typeof mealIndex === "number" && mealIndex >= 0 && mealIndex < day.meals.length) {
    return mealIndex;
  }
  if (mealSlot) {
    const index = day.meals.findIndex((meal) => meal.mealSlot === mealSlot);
    if (index >= 0) return index;
  }
  return 0;
};

const getStoredAlternatives = async (
  userId: string,
  weekStart: string,
  supabase: Awaited<ReturnType<typeof resolveRequestAuth>>["supabase"]
) => {
  const { data, error } = await supabase
    .from("plan_history")
    .select("meals")
    .eq("user_id", userId)
    .eq("week_start", toDateOnly(weekStart))
    .eq("day_id", "alternatives")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !Array.isArray(data) || !data.length) {
    if (error) {
      console.warn("[meal-plan/swap] alternatives lookup failed:", error.message);
    }
    return [] as MealConcept[];
  }

  const payload = (data[0]?.meals as { alternatives?: MealConcept[] } | null) ?? null;
  return Array.isArray(payload?.alternatives) ? payload.alternatives : [];
};

const findAlternative = (
  alternatives: MealConcept[],
  dayNumber: number,
  slot: MealSlot,
  currentMealTitle: string
) => {
  const current = normalize(currentMealTitle);
  return (
    alternatives.find(
      (alt) =>
        (alt.for_day ?? alt.day) === dayNumber &&
        normalizeSlot(alt.for_slot ?? alt.slot) === slot &&
        normalize(alt.name) !== current
    ) ??
    alternatives.find(
      (alt) =>
        normalizeSlot(alt.for_slot ?? alt.slot) === slot &&
        normalize(alt.name) !== current
    )
  );
};

const persistSwapSideEffects = async (
  userId: string,
  plan: WeeklyMealPlan,
  dayIndex: number,
  supabase: Awaited<ReturnType<typeof resolveRequestAuth>>["supabase"]
) => {
  const weekStart = toDateOnly(plan.weekStart);
  const day = plan.days[dayIndex];
  if (!day) return;

  await supabase
    .from("plan_history")
    .delete()
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .eq("day_id", day.id);

  await supabase.from("plan_history").insert({
    user_id: userId,
    plan_id: plan.id,
    day_id: day.id,
    date: toDateOnly(day.date),
    week_start: weekStart,
    meals: {
      id: day.id,
      label: day.label,
      date: day.date,
      meals: day.meals,
      totals: day.totals,
      preferenceSignature: plan.preferenceSignature ?? null,
    },
  });

  const shopping = buildShoppingList({
    ...plan,
    days: plan.days.slice(0, WORKDAY_COUNT),
  });
  await supabase
    .from("plan_history")
    .delete()
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .eq("day_id", "shopping-list");
  await supabase.from("plan_history").insert({
    user_id: userId,
    plan_id: plan.id,
    day_id: "shopping-list",
    date: weekStart,
    week_start: weekStart,
    meals: { items: shopping, locale: "UK" },
  });
};

export async function POST(request: NextRequest) {
  const { supabase, session, user } = await resolveRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!session) {
    console.warn("[meal-plan/swap] using bearer fallback auth");
  }

  let payload: SwapPayload;
  try {
    payload = (await request.json()) as SwapPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const preferences = payload.preferences;
  if (!preferences) {
    return NextResponse.json({ error: "Missing preferences" }, { status: 400 });
  }
  const basePlan = payload.plan;
  if (!basePlan?.days?.length) {
    return NextResponse.json({ error: "Missing current plan" }, { status: 400 });
  }

  let targetDayIndex = typeof payload.dayIndex === "number" ? payload.dayIndex : 0;
  if (targetDayIndex < 0 || targetDayIndex >= basePlan.days.length) targetDayIndex = 0;
  const targetMealIndex = resolveMealIndex(
    basePlan,
    targetDayIndex,
    payload.mealIndex,
    payload.mealSlot
  );
  if (targetMealIndex < 0) {
    return NextResponse.json({ error: "Unable to resolve meal index" }, { status: 400 });
  }

  const day = basePlan.days[targetDayIndex];
  const currentMeal = day.meals[targetMealIndex];
  const slot = currentMeal.mealSlot;
  const dayNumber = targetDayIndex + 1;

  const alternatives = await getStoredAlternatives(user.id, basePlan.weekStart, supabase);
  const chosenAlternative = findAlternative(alternatives, dayNumber, slot, currentMeal.title);

  let nextPlan: WeeklyMealPlan = {
    ...basePlan,
    days: basePlan.days.map((entry) => ({ ...entry, meals: [...entry.meals] })),
  };

  if (chosenAlternative) {
    const context = await buildContext(user.id, { supabase });
    const slotBudget =
      context.slotBudgets.find(
        (budget) => normalizeSlot(budget.label) === slot
      ) ?? context.slotBudgets[0];
    const portionedAlternative = await calculatePortions(
      { ...chosenAlternative, day: dayNumber, slot },
      slotBudget,
      supabase
    );
    nextPlan.days[targetDayIndex].meals[targetMealIndex] = toMealInstance(
      portionedAlternative
    );
    recalcPlanTotals(nextPlan);
  } else {
    nextPlan = swapMealInPlan(basePlan, targetDayIndex, targetMealIndex, preferences);
  }

  const targets = resolveMacroTargets(preferences);
  const enforcementResult = enforceMacros(nextPlan, targets);
  const enforcement = toEnforcementInfo(enforcementResult);

  await persistSwapSideEffects(user.id, nextPlan, targetDayIndex, supabase);

  return NextResponse.json({
    plan: nextPlan,
    day: nextPlan.days[targetDayIndex],
    meal: nextPlan.days[targetDayIndex]?.meals?.[targetMealIndex],
    dayIndex: targetDayIndex,
    mealIndex: targetMealIndex,
    source: chosenAlternative ? "pre_generated_alternative" : "fallback",
    enforcement,
  });
}
