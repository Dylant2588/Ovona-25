import { NextRequest, NextResponse } from "next/server";
import {
  generateFallbackMealPlan,
  resolveMacroTargets,
  swapMealInPlan,
  type MealSlot,
  type PreferencesInput,
  type WeeklyMealPlan,
} from "@/lib/meal-generator";
import { enforceMacros, toEnforcementInfo } from "@/lib/macro-enforcement";

type MealGeneratePayload = {
  preferences?: PreferencesInput;
  plan?: WeeklyMealPlan | null;
  dayIndex?: number;
  mealIndex?: number;
  mealSlot?: MealSlot;
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
    const bySlotIndex = day.meals.findIndex((meal) => meal.mealSlot === mealSlot);
    if (bySlotIndex >= 0) return bySlotIndex;
  }
  return 0;
};

export async function POST(request: NextRequest) {
  let payload: MealGeneratePayload;
  try {
    payload = (await request.json()) as MealGeneratePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const preferences = payload.preferences;
  if (!preferences) {
    return NextResponse.json({ error: "Missing preferences" }, { status: 400 });
  }

  const basePlan =
    payload.plan && payload.plan.days?.length
      ? payload.plan
      : generateFallbackMealPlan(preferences);

  let targetDayIndex =
    typeof payload.dayIndex === "number" ? payload.dayIndex : 0;
  if (targetDayIndex < 0 || targetDayIndex >= basePlan.days.length) {
    targetDayIndex = 0;
  }

  const targetMealIndex = resolveMealIndex(
    basePlan,
    targetDayIndex,
    payload.mealIndex,
    payload.mealSlot
  );
  if (targetMealIndex < 0) {
    return NextResponse.json(
      { error: "Unable to resolve meal index" },
      { status: 400 }
    );
  }

  const nextPlan = swapMealInPlan(
    basePlan,
    targetDayIndex,
    targetMealIndex,
    preferences
  );
  const targets = resolveMacroTargets(preferences);
  const enforcementResult = enforceMacros(nextPlan, targets);
  const enforcement = toEnforcementInfo(enforcementResult);
  const day = nextPlan.days[targetDayIndex];
  const meal = day?.meals?.[targetMealIndex];
  if (!day || !meal) {
    return NextResponse.json({ error: "Unable to regenerate meal" }, { status: 500 });
  }

  return NextResponse.json({
    plan: nextPlan,
    day,
    meal,
    dayIndex: targetDayIndex,
    mealIndex: targetMealIndex,
    source: "fallback",
    enforcement,
  });
}
