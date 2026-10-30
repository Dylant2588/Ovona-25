import type { NextRequest } from "next/server";
import { resolveRequestAuth } from "@/lib/serverAuth";
import { recipeReviewService, recipeReviewerRole, ReviewPersistenceError } from "@/lib/recipe-reviewer";

/** Shared verified-actor boundary for privileged recipe operations. */
export async function requireRecipeReviewer(request: NextRequest) {
  const auth = await resolveRequestAuth(request);
  if (auth.status === "transient") throw new ReviewPersistenceError(503, "auth_unavailable", "Authentication is temporarily unavailable.");
  if (auth.status !== "authorized" || !auth.user) throw new ReviewPersistenceError(401, "unauthorized", "Sign in to review recipes.");
  const verified = await auth.supabase.auth.getUser(auth.accessToken ?? undefined);
  if (verified.error) {
    const status = [400, 401, 403].includes(verified.error.status ?? 0) ? 401 : 503;
    throw new ReviewPersistenceError(status, status === 401 ? "unauthorized" : "auth_unavailable", "We could not verify your sign-in.");
  }
  if (!verified.data.user) throw new ReviewPersistenceError(401, "unauthorized", "Sign in to review recipes.");
  const service = recipeReviewService();
  if (!await recipeReviewerRole(verified.data.user.id, service)) throw new ReviewPersistenceError(403, "reviewer_role_required", "Recipe reviewer access is required.");
  return { user: verified.data.user, service };
}
