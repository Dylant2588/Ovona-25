import { type NextRequest, NextResponse } from "next/server";
import { parseReviewRequest, proposeReviewedVersion } from "@/lib/recipes/review-lifecycle";
import { recipeRecordErrors } from "@/lib/recipes/repository";
import { newApprovalNutritionErrors } from "@/lib/recipes/nutrition";
import type { RecipeRecord } from "@/lib/recipes/types";
import { persistReviewedRecipe, ReviewPersistenceError } from "@/lib/recipe-reviewer";
import { requireRecipeReviewer } from "@/lib/recipes/reviewer-access";

type PendingRow = { id: string; version: number; record: RecipeRecord; review_status: "pending_review" };

const failure = (error: unknown) => error instanceof ReviewPersistenceError
  ? NextResponse.json({ error: error.code, message: error.message }, { status: error.status })
  : NextResponse.json({ error: "recipe_review_unavailable", message: "Recipe review is temporarily unavailable." }, { status: 503 });

export async function GET(request: NextRequest) {
  try {
    const { service } = await requireRecipeReviewer(request);
    const { data, error } = await service.from("recipe_library").select("id, version, record, review_status")
      .eq("review_status", "pending_review").order("id", { ascending: true });
    if (error) throw new ReviewPersistenceError(503, "recipe_review_unavailable", "The review queue could not be loaded.");
    return NextResponse.json({ recipes: (data ?? []).map((row) => ({ ...row, validationErrors: [...new Set([...recipeRecordErrors(row.record), ...newApprovalNutritionErrors(row.record)])] })) });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const { user, service } = await requireRecipeReviewer(request);
    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "invalid_review_request", message: "Provide a valid JSON review request." }, { status: 400 });
    }
    const parsed = parseReviewRequest(body);
    if (!parsed.ok) return NextResponse.json({ error: "invalid_review_request", message: parsed.errors.join(" ") }, { status: 400 });
    const { value: command } = parsed;
    const { data, error } = await service.from("recipe_library").select("id, version, record, review_status")
      .eq("id", command.id).eq("version", command.version).eq("review_status", "pending_review").maybeSingle();
    if (error) throw new ReviewPersistenceError(503, "recipe_review_unavailable", "The draft could not be loaded.");
    if (!data) throw new ReviewPersistenceError(409, "review_conflict", "This draft has already been reviewed. Refresh the queue.");
    const row = data as PendingRow;
    const errors = recipeRecordErrors(row.record);
    if (errors.length || row.id !== command.id || row.version !== command.version ||
        row.record.id !== row.id || row.record.version !== row.version || row.record.review.status !== "pending_review") {
      return NextResponse.json({ error: "invalid_recipe_draft", message: "This draft's saved evidence is incomplete." }, { status: 400 });
    }
    let proposed: RecipeRecord | null = null;
    if (command.action === "approve") {
      const proposal = proposeReviewedVersion(row.record, user.id, new Date().toISOString());
      if (!proposal.ok) return NextResponse.json({ error: "invalid_recipe_draft", message: proposal.errors.join(" ") }, { status: 400 });
      proposed = proposal.record;
    }
    const saved = await persistReviewedRecipe(service, command, row.record, proposed, user.id);
    return NextResponse.json(saved);
  } catch (error) { return failure(error); }
}
