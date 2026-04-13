import { NextRequest, NextResponse } from "next/server";
import {
  generateFallbackMealPlan,
  resolveMacroTargets,
  type PreferencesInput,
} from "@/lib/meal-generator";
import {
  enforceMacros,
  toEnforcementInfo,
  type EnforcementInfo,
} from "@/lib/macro-enforcement";
import { generateWeeklyPlanWithArtifacts } from "@/lib/generation/generate-plan";
import type { MealConcept } from "@/lib/generation/types";
import { resolveRequestAuth } from "@/lib/serverAuth";

type MealPlanPayload = {
  preferences?: PreferencesInput;
};

const defaultPreferences: PreferencesInput = {
  tastes: [],
  goal: "maintain",
  mealComplexity: "normal",
  macroTargets: {
    calories: 2200,
    protein: 160,
    carbs: 220,
    fat: 75,
  },
  profile: {
    mealsPerDay: 5,
  },
};

const persistAlternatives = async (
  userId: string,
  weekStart: string,
  planId: string,
  alternatives: MealConcept[],
  supabase: Awaited<ReturnType<typeof resolveRequestAuth>>["supabase"]
) => {
  const date = weekStart.split("T")[0];
  await supabase
    .from("plan_history")
    .delete()
    .eq("user_id", userId)
    .eq("week_start", date)
    .eq("day_id", "alternatives");

  const { error } = await supabase.from("plan_history").insert({
    user_id: userId,
    plan_id: planId,
    day_id: "alternatives",
    date,
    week_start: date,
    meals: {
      alternatives,
      generated_at: new Date().toISOString(),
    },
  });

  if (error) {
    console.warn("[meal-plan] could not persist alternatives", error.message);
  }
};

export async function POST(request: NextRequest) {
  let payload: MealPlanPayload = {};
  try {
    payload = (await request.json()) as MealPlanPayload;
  } catch {
    payload = {};
  }

  const { supabase, session, user } = await resolveRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!session) {
    console.warn("[meal-plan] using bearer fallback auth");
  }

  const preferences = payload.preferences ?? defaultPreferences;

  try {
    const artifacts = await generateWeeklyPlanWithArtifacts(user.id);
    const plan = artifacts.weeklyPlan;

    const targets = payload.preferences
      ? resolveMacroTargets(preferences)
      : {
          calories: artifacts.context.calorieTarget,
          protein: artifacts.context.proteinTarget,
          carbs: artifacts.context.carbTarget,
          fat: artifacts.context.fatTarget,
        };

    let enforcement: EnforcementInfo | null = null;
    if (targets && (targets.calories || targets.protein)) {
      const result = enforceMacros(plan, targets);
      enforcement = toEnforcementInfo(result);
      if (!result.passed) {
        console.warn("[meal-plan] macro enforcement partial:", enforcement.summary);
      }
    }

    await persistAlternatives(
      user.id,
      plan.weekStart,
      plan.id,
      artifacts.alternatives,
      supabase
    );

    return NextResponse.json({
      plan,
      source: artifacts.source,
      enforcement,
      practical: {
        weeklyTotal: artifacts.practical.weeklyTotal,
        substitutionsMade: artifacts.practical.substitutionsMade,
      },
    });
  } catch (error) {
    console.error("[meal-plan] generation pipeline failed", error);

    const fallbackPlan = generateFallbackMealPlan({
      ...preferences,
      userId: user.id,
    });
    const targets = resolveMacroTargets(preferences);
    const fallbackEnforcement = toEnforcementInfo(enforceMacros(fallbackPlan, targets));

    return NextResponse.json({
      plan: fallbackPlan,
      source: "fallback",
      enforcement: fallbackEnforcement,
    });
  }
}
