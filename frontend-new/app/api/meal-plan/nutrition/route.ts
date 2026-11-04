import { NextRequest, NextResponse } from "next/server";
import type { WeeklyMealPlan } from "@/lib/meal-generator";
import { resolveRequestAuth } from "@/lib/serverAuth";
import { approvePlanForUser, approvalFailure, MealApprovalError } from "@/lib/recipes/plan-boundary";
import { loadServerConstraints, type ConstraintDatabase } from "@/lib/recipes/server-constraints";
import { loadReviewedRecipes, type RecipeReader } from "@/lib/recipes/repository";
import { buildPlanNutritionSummary } from "@/lib/recipes/plan-nutrition";
import { DISPLAY_NUTRITION_MAPPINGS } from "@/lib/recipes/display-nutrition-mappings";

/** Nutrition is a read-only projection of reviewed recipes, never client nutrient assertions. */
export async function POST(request: NextRequest) {
  try {
    const { user, supabase, status } = await resolveRequestAuth(request);
    if (status === "transient") return NextResponse.json({ error: "auth unavailable" }, { status: 503 });
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    let body: { plan?: WeeklyMealPlan } | null;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
    if (!body || !body.plan) return NextResponse.json({ error: "plan required" }, { status: 400 });
    const database = supabase as unknown as RecipeReader;
    const [constraints, loaded] = await Promise.all([
      loadServerConstraints(supabase as unknown as ConstraintDatabase, user.id), loadReviewedRecipes(database),
    ]);
    if (!loaded.ok) throw new MealApprovalError(loaded.code, loaded.reasons, 503);
    const approved = await approvePlanForUser(database, user.id, body.plan, undefined, {
      constraints: async () => constraints, recipes: async () => loaded,
    });
    return NextResponse.json(buildPlanNutritionSummary(approved, loaded.recipes, DISPLAY_NUTRITION_MAPPINGS));
  } catch (error) {
    const failure = approvalFailure(error);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
