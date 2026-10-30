import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ReviewRequest } from "./recipes/review-lifecycle";
import type { RecipeRecord } from "./recipes/types";

export const recipeReviewService = (): SupabaseClient => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Recipe review service is not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

export const recipeReviewerRole = async (userId: string, service = recipeReviewService()): Promise<"reviewer" | "admin" | null> => {
  const { data, error } = await service
    .from("recipe_reviewer_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Recipe review roles are unavailable.");
  if (data?.role !== "reviewer" && data?.role !== "admin") return null;
  return data.role;
};

export class ReviewPersistenceError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export async function persistReviewedRecipe(service: SupabaseClient, request: ReviewRequest,
  pending: RecipeRecord, proposed: RecipeRecord | null, actorId: string) {
  const { data, error } = await service.rpc("review_recipe_version", {
    p_recipe_id: request.id, p_expected_version: request.version, p_expected_pending: pending,
    p_proposed_record: proposed, p_action: request.action, p_actor: actorId, p_attestations: request.attestations,
  });
  if (error) {
    if (error.code === "P0002" || error.code === "23505")
      throw new ReviewPersistenceError(409, "review_conflict", "This draft changed or has already been reviewed. Refresh the queue.");
    if (error.code === "42501")
      throw new ReviewPersistenceError(403, "reviewer_role_required", "Recipe reviewer access is required.");
    if (error.code === "22023" || error.code === "22007" || error.code === "22008")
      throw new ReviewPersistenceError(400, "invalid_review_request", "The review evidence could not be accepted.");
    throw new ReviewPersistenceError(503, "recipe_review_unavailable", "Recipe review is unavailable. The review was not saved.");
  }
  if (!data || data.ok !== true || data.status !== (request.action === "approve" ? "approved" : "rejected") ||
      (request.action === "approve" && data.version !== request.version + 1)) {
    throw new ReviewPersistenceError(503, "recipe_review_unavailable", "Recipe review did not confirm a saved transition. Refresh before retrying.");
  }
  return data as { ok: true; status: "approved" | "rejected"; version: number | null };
}
