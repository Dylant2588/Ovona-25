import { type NextRequest, NextResponse } from "next/server";
import { requireRecipeReviewer } from "@/lib/recipes/reviewer-access";
import { parsePendingImportBatch, readPendingImportBody, PendingImportBodyError } from "@/lib/recipes/pending-import";
import { ReviewPersistenceError } from "@/lib/recipe-reviewer";

export async function POST(request: NextRequest) {
  try {
    const { user, service } = await requireRecipeReviewer(request);
    const body = await readPendingImportBody(request);
    const parsed = parsePendingImportBatch(body, user.id);
    if (!parsed.ok) return NextResponse.json({ error: "invalid_import", message: parsed.errors.join(" ") }, { status: 400 });
    const { data, error } = await service.rpc("import_pending_recipe_batch", { p_records: parsed.records, p_actor: user.id });
    if (error) {
      if (error.code === "23505") throw new ReviewPersistenceError(409, "import_conflict", "An imported identity/version already exists. No recipes were imported.");
      if (error.code === "42501") throw new ReviewPersistenceError(403, "reviewer_role_required", "Recipe reviewer access is required.");
      if (["22023", "22P02"].includes(error.code)) throw new ReviewPersistenceError(400, "invalid_import", "Pending recipe evidence was rejected. No recipes were imported.");
      throw new ReviewPersistenceError(503, "recipe_import_unavailable", "Import is unavailable. Refresh the queue before retrying.");
    }
    if (data?.ok !== true || data.imported !== parsed.records.length) throw new ReviewPersistenceError(503, "recipe_import_unavailable", "Import was not confirmed. Refresh the queue before retrying.");
    return NextResponse.json({ ok: true, imported: data.imported });
  } catch (error) {
    if (error instanceof PendingImportBodyError) return NextResponse.json({ error: error.status === 413 ? "import_too_large" : "invalid_import", message: error.message }, { status: error.status });
    return error instanceof ReviewPersistenceError
      ? NextResponse.json({ error: error.code, message: error.message }, { status: error.status })
      : NextResponse.json({ error: "recipe_import_unavailable", message: "Recipe import is temporarily unavailable." }, { status: 503 });
  }
}
