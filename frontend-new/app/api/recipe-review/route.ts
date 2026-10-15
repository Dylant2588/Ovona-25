import { NextRequest, NextResponse } from "next/server";
import { approveImportedRecipeVersion, type PendingRecipeImport } from "@/lib/recipes/imports";
import { approveRecipe } from "@/lib/recipes/approval";
import { recipeRecordErrors } from "@/lib/recipes/repository";
import type { RecipeRecord } from "@/lib/recipes/types";
import { recipeReviewerRole, recipeReviewService } from "@/lib/recipe-reviewer";
import { resolveRequestAuth } from "@/lib/serverAuth";

type PendingRow = { id: string; version: number; record: RecipeRecord; review_status: "pending_review" };
type Attestations = { source: boolean; rights: boolean; ingredients: boolean; nutrition: boolean; cooked: boolean };

const reviewAccess = async (request: NextRequest) => {
  const { user, status } = await resolveRequestAuth(request);
  if (status !== "authorized" || !user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) } as const;
  const role = await recipeReviewerRole(user.id);
  if (!role) return { error: NextResponse.json({ error: "reviewer_role_required" }, { status: 403 }) } as const;
  return { user, role } as const;
};

const rejectedRecord = (record: RecipeRecord, reviewerId: string): RecipeRecord => ({
  ...record,
  review: { status: "rejected", reviewedBy: reviewerId, reviewedAt: new Date().toISOString() },
});

export async function GET(request: NextRequest) {
  const access = await reviewAccess(request);
  if ("error" in access) return access.error;
  try {
    const service = recipeReviewService();
    const { data, error } = await service
      .from("recipe_library")
      .select("id, version, record, review_status")
      .eq("review_status", "pending_review")
      .order("id", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ recipes: (data ?? []).map((row) => ({
      ...row,
      validationErrors: recipeRecordErrors(row.record),
    })) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Recipe review is unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const access = await reviewAccess(request);
  if ("error" in access) return access.error;
  const body = await request.json() as { id?: string; version?: number; action?: "approve" | "reject"; attestations?: Attestations };
  if (!body.id || !Number.isInteger(body.version) || !body.action) return NextResponse.json({ error: "Invalid review request." }, { status: 400 });
  if (body.action === "approve" && !Object.values(body.attestations ?? {}).every(Boolean)) {
    return NextResponse.json({ error: "Record every review attestation before approving a recipe." }, { status: 400 });
  }
  try {
    const service = recipeReviewService();
    const { data, error } = await service.from("recipe_library").select("id, version, record, review_status")
      .eq("id", body.id).eq("version", body.version).eq("review_status", "pending_review").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "This draft has already been reviewed." }, { status: 409 });
    const row = data as PendingRow;
    const reviewedAt = new Date().toISOString();
    const closedDraft = rejectedRecord(row.record, access.user.id);
    if (body.action === "reject") {
      const { error: updateError } = await service.from("recipe_library").update({ record: closedDraft, review_status: "rejected" }).eq("id", row.id).eq("version", row.version).eq("review_status", "pending_review");
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
      return NextResponse.json({ ok: true, status: "rejected" });
    }
    const planningCheck = approveRecipe(row.record, {});
    if (!planningCheck.approved) {
      return NextResponse.json({
        error: "This draft cannot be approved for planning until its ingredient taxonomy is complete.",
        reasons: planningCheck.reasons,
      }, { status: 400 });
    }
    const pending: PendingRecipeImport = {
      record: row.record as PendingRecipeImport["record"],
      audit: { recipeId: row.id, recipeVersion: row.version, sourceReference: row.record.source.reference,
        rightsDeclaration: row.record.source.rights, payloadHash: `review:${row.id}:${row.version}`,
        importedBy: access.user.id, reviewStatus: "pending_review", reviewedBy: null, reviewedAt: null },
    };
    const approved = approveImportedRecipeVersion(pending, { reviewerId: access.user.id, reviewedAt });
    if (!approved.ok) return NextResponse.json({ error: approved.errors.join(" ") }, { status: 400 });
    const { error: insertError } = await service.from("recipe_library").insert({ id: approved.value.record.id,
      version: approved.value.record.version, record: approved.value.record, review_status: "approved" });
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    const { error: closeError } = await service.from("recipe_library").update({ record: closedDraft, review_status: "rejected" })
      .eq("id", row.id).eq("version", row.version).eq("review_status", "pending_review");
    if (closeError) return NextResponse.json({ error: closeError.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "approved", version: approved.value.record.version });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Recipe review is unavailable." }, { status: 503 });
  }
}
