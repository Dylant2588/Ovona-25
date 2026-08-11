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

const hasCompleteNutrition = (plan: ReturnType<typeof generateFallbackMealPlan>) =>
  plan.days.length > 0 &&
  plan.days.every(
    (day) =>
      day.totals.calories > 0 &&
      day.totals.protein > 0 &&
      day.meals.length > 0 &&
      day.meals.every((meal) => meal.macros.calories > 0 && meal.macros.protein > 0)
  );

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

const logRouteFailure = (category: string, error: unknown) => {
  const details =
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { type: typeof error };
  console.error(`[meal-plan] ${category}`, details);
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

  let auth: Awaited<ReturnType<typeof resolveRequestAuth>>;
  try {
    auth = await resolveRequestAuth(request);
  } catch (error) {
    logRouteFailure("auth resolution failed", error);
    return NextResponse.json(
      {
        error: "auth_unavailable",
        message: "We couldn't verify your session right now. Please try again.",
      },
      { status: 503 }
    );
  }

  const { supabase, session, user } = auth;
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!session) {
    console.warn("[meal-plan] using bearer fallback auth");
  }

  const preferences = payload.preferences ?? defaultPreferences;

  try {
    const artifacts = await generateWeeklyPlanWithArtifacts(user.id, { preferences });
    const plan = artifacts.weeklyPlan;
    if (!hasCompleteNutrition(plan)) {
      throw new Error("[meal-plan] generated plan was missing calorie or protein data");
    }

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
        throw new Error(`[meal-plan] ${enforcement.summary}`);
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
    logRouteFailure("generation pipeline failed", error);

    let fallbackStage = "plan_creation";
    try {
      const fallbackPlan = generateFallbackMealPlan({
        ...preferences,
        userId: user.id,
      });
      fallbackStage = "target_resolution";
      const targets = resolveMacroTargets(preferences);
      fallbackStage = "macro_enforcement";
      const fallbackResult = enforceMacros(fallbackPlan, targets);
      fallbackStage = "enforcement_serialization";
      const fallbackEnforcement = toEnforcementInfo(fallbackResult);

      if (!fallbackResult.passed) {
        fallbackStage = "partial_response";
        return NextResponse.json(
          {
            plan: fallbackPlan,
            source: "fallback",
            incomplete: true,
            message:
              "We couldn't build a safe plan that meets your daily calorie and protein targets yet.",
            enforcement: fallbackEnforcement,
          },
          { status: 200 }
        );
      }

      fallbackStage = "success_response";
      return NextResponse.json({
        plan: fallbackPlan,
        source: "fallback",
        enforcement: fallbackEnforcement,
      });
    } catch (fallbackError) {
      logRouteFailure(`fallback failed at ${fallbackStage}`, fallbackError);
      return NextResponse.json(
        {
          error: "fallback_unavailable",
          stage: fallbackStage,
          message: "We couldn't build a meal plan right now. Please try again.",
        },
        { status: 500 }
      );
    }
  }
}
