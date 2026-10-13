import { NextRequest, NextResponse } from "next/server";
import type { PreferencesInput } from "@/lib/meal-generator";
import { generateWeeklyPlanWithArtifacts } from "@/lib/generation/generate-plan";
import { resolveRequestAuth } from "@/lib/serverAuth";
import { approvePlanForUser, approvalFailure } from "@/lib/recipes/plan-boundary";
import { enforceMacros, toEnforcementInfo } from "@/lib/macro-enforcement";

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await resolveRequestAuth(request);
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const body = await request.json() as { preferences?: PreferencesInput };
    const artifacts = await generateWeeklyPlanWithArtifacts(user.id, { preferences: body.preferences, supabase });
    const result = enforceMacros(artifacts.weeklyPlan, { calories: artifacts.context.calorieTarget,
      protein: artifacts.context.proteinTarget, carbs: artifacts.context.carbTarget, fat: artifacts.context.fatTarget });
    if (!result.passed) return NextResponse.json({ error: "insufficient_reviewed_catalogue",
      message: "Reviewed recipes couldn't meet your targets. Your existing plan is unchanged." }, { status: 422 });
    const plan = await approvePlanForUser(supabase as never, user.id, artifacts.weeklyPlan, body.preferences);
    return NextResponse.json({ plan, source: "reviewed_library", approval: "checked", enforcement: toEnforcementInfo(result),
      practical: { pricingStatus: "unavailable", substitutionsMade: [] } });
  } catch (error) {
    const failure = approvalFailure(error);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
