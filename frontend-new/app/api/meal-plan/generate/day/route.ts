import { NextRequest, NextResponse } from "next/server";
import type { PreferencesInput, WeeklyMealPlan } from "@/lib/meal-generator";
import { resolveRequestAuth } from "@/lib/serverAuth";
import { generateWeeklyPlanWithArtifacts } from "@/lib/generation/generate-plan";
import { approvePlanForUser, approvalFailure } from "@/lib/recipes/plan-boundary";

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await resolveRequestAuth(request);
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const payload = await request.json() as { preferences?: PreferencesInput; plan?: WeeklyMealPlan; dayIndex?: number; dayDate?: string };
    if (!payload.plan) return NextResponse.json({ error: "Current plan required" }, { status: 400 });
    const plan = await approvePlanForUser(supabase, user.id, payload.plan, payload.preferences);
    const dayIndex = payload.dayIndex ?? plan.days.findIndex((day) => day.date.startsWith(payload.dayDate?.split("T")[0] ?? "invalid"));
    if (!plan.days[dayIndex]) return NextResponse.json({ error: "Invalid day" }, { status: 400 });
    const artifacts = await generateWeeklyPlanWithArtifacts(user.id, { preferences: payload.preferences, supabase });
    plan.days[dayIndex] = { ...plan.days[dayIndex], meals: artifacts.weeklyPlan.days[dayIndex].meals,
      totals: artifacts.weeklyPlan.days[dayIndex].totals };
    const approved = await approvePlanForUser(supabase, user.id, plan, payload.preferences);
    return NextResponse.json({ plan: approved, day: approved.days[dayIndex], dayIndex, source: "reviewed_library", approval: "checked" });
  } catch (error) { const failure = approvalFailure(error); return NextResponse.json(failure.body, { status: failure.status }); }
}
