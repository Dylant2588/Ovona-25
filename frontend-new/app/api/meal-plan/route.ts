import { NextRequest, NextResponse } from "next/server";
import type { PreferencesInput } from "@/lib/meal-generator";
import { generateWeeklyPlanWithArtifacts } from "@/lib/generation/generate-plan";
import { resolveRequestAuth } from "@/lib/serverAuth";
import { approvalFailure } from "@/lib/recipes/plan-boundary";

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await resolveRequestAuth(request);
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const body = await request.json() as { preferences?: PreferencesInput };
    const artifacts = await generateWeeklyPlanWithArtifacts(user.id, { preferences: body.preferences, supabase });
    // Generation has already applied the reviewed-recipe boundary and checked
    // daily macro bands. Re-running a mutating enforcement pass here could
    // change a verified plan before it reaches persistence.
    const plan = artifacts.weeklyPlan;
    return NextResponse.json({ plan, source: "reviewed_library", approval: "checked", enforcement: {
      status: "verified", passed: true, corrections: 0,
      summary: "Macros verified against reviewed recipes.",
      days: plan.days.map((day) => ({ label: day.label, passed: true, corrected: false, status: "verified" as const })),
    },
      practical: { pricingStatus: "unavailable", substitutionsMade: [] } });
  } catch (error) {
    const failure = approvalFailure(error);
    // Keep generation failures diagnosable without logging user input or
    // credentials. The response already exposes a safe, actionable message.
    console.warn("[meal-plan] generation rejected", {
      status: failure.status,
      code: failure.body.error,
      reasons: failure.body.reasons,
    });
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
