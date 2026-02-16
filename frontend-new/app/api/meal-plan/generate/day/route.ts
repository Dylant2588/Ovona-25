import { NextRequest, NextResponse } from "next/server";
import {
  generateFallbackMealPlan,
  regenerateDayInPlan,
  resolveMacroTargets,
  type PreferencesInput,
  type WeeklyMealPlan,
} from "@/lib/meal-generator";
import { enforceMacros, toEnforcementInfo } from "@/lib/macro-enforcement";

type DayGeneratePayload = {
  preferences?: PreferencesInput;
  plan?: WeeklyMealPlan | null;
  dayIndex?: number;
  dayDate?: string;
};

const findDayIndexByDate = (plan: WeeklyMealPlan, dayDate?: string) => {
  if (!dayDate) return -1;
  const parsed = new Date(dayDate);
  if (Number.isNaN(parsed.getTime())) return -1;
  const needle = parsed.toISOString().split("T")[0];
  return plan.days.findIndex((day) => day.date.startsWith(needle));
};

export async function POST(request: NextRequest) {
  let payload: DayGeneratePayload;
  try {
    payload = (await request.json()) as DayGeneratePayload;
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
    typeof payload.dayIndex === "number" ? payload.dayIndex : -1;
  if (targetDayIndex < 0 || targetDayIndex >= basePlan.days.length) {
    targetDayIndex = findDayIndexByDate(basePlan, payload.dayDate);
  }
  if (targetDayIndex < 0 || targetDayIndex >= basePlan.days.length) {
    targetDayIndex = 0;
  }

  const nextPlan = regenerateDayInPlan(basePlan, targetDayIndex, preferences);
  const targets = resolveMacroTargets(preferences);
  const enforcementResult = enforceMacros(nextPlan, targets);
  const enforcement = toEnforcementInfo(enforcementResult);
  const day = nextPlan.days[targetDayIndex];
  if (!day) {
    return NextResponse.json({ error: "Unable to regenerate day" }, { status: 500 });
  }

  return NextResponse.json({
    plan: nextPlan,
    day,
    dayIndex: targetDayIndex,
    source: "fallback",
    enforcement,
  });
}
