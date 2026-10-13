import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { PreferencesInput, WeeklyMealPlan, MealSlot } from "@/lib/meal-generator";
import { resolveRequestAuth } from "@/lib/serverAuth";
import { approvePlanForUser, approvalFailure, MealApprovalError } from "@/lib/recipes/plan-boundary";
import { generateWeeklyPlanWithArtifacts } from "@/lib/generation/generate-plan";
import { enforceMacros, toEnforcementInfo } from "@/lib/macro-enforcement";

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await resolveRequestAuth(request);
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const payload = await request.json() as { plan?: WeeklyMealPlan; preferences?: PreferencesInput; dayIndex?: number; mealIndex?: number; mealSlot?: MealSlot };
    if (!payload.plan) return NextResponse.json({ error: "Current plan required" }, { status: 400 });
    const plan = await approvePlanForUser(supabase, user.id, payload.plan, payload.preferences);
    const dayIndex = payload.dayIndex ?? 0;
    const day = plan.days[dayIndex];
    const mealIndex = payload.mealIndex ?? day?.meals.findIndex((meal) => meal.mealSlot === payload.mealSlot) ?? -1;
    const meal = day?.meals[mealIndex];
    if (!meal) return NextResponse.json({ error: "Invalid meal position" }, { status: 400 });
    const artifacts = await generateWeeklyPlanWithArtifacts(user.id, { preferences: payload.preferences, supabase });
    const replacement = artifacts.weeklyPlan.days.flatMap((entry) => entry.meals)
      .find((candidate) => candidate.mealSlot === meal.mealSlot && candidate.baseId !== meal.baseId);
    if (!replacement) throw new MealApprovalError("insufficient_reviewed_catalogue", ["No different reviewed recipe meets your preferences."]);
    day.meals[mealIndex] = { ...replacement, instanceId: randomUUID() };
    const enforced = enforceMacros(plan, { calories: artifacts.context.calorieTarget, protein: artifacts.context.proteinTarget,
      carbs: artifacts.context.carbTarget, fat: artifacts.context.fatTarget });
    if (!enforced.passed) throw new MealApprovalError("insufficient_reviewed_catalogue", ["The replacement couldn't meet daily targets."]);
    const approved = await approvePlanForUser(supabase, user.id, plan, payload.preferences);
    // State persistence performs its own fresh approval; swap itself has no partial history writes.
    return NextResponse.json({ plan: approved, day: approved.days[dayIndex], meal: approved.days[dayIndex].meals[mealIndex],
      dayIndex, mealIndex, source: "reviewed_library", approval: "checked", enforcement: toEnforcementInfo(enforced) });
  } catch (error) { const failure = approvalFailure(error); return NextResponse.json(failure.body, { status: failure.status }); }
}
