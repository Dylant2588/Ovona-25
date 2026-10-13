import type { RecipeRecord } from "./types.ts";
import { recipeRecordErrors } from "./repository.ts";

type PendingRecipeRecord = RecipeRecord & { review: { status: "pending_review"; reviewedBy: null; reviewedAt: null } };

export type RecipeImportPayload = {
  record: RecipeRecord;
  payloadHash: string;
  importedBy: string;
  sourceReference: string;
};

export type RecipeImportAudit = {
  recipeId: string;
  recipeVersion: number;
  sourceReference: string;
  rightsDeclaration: string;
  payloadHash: string;
  importedBy: string;
  reviewStatus: "pending_review" | "approved";
  reviewedBy: string | null;
  reviewedAt: string | null;
};

export type PendingRecipeImport = { record: PendingRecipeRecord; audit: RecipeImportAudit };
export type RecipeImportResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const present = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function createPendingRecipeImport(payload: RecipeImportPayload): RecipeImportResult<PendingRecipeImport> {
  const record = clone(payload.record);
  const errors = recipeRecordErrors(record);
  if (!present(payload.payloadHash)) errors.push("Missing import payload hash");
  if (!present(payload.importedBy)) errors.push("Missing importer identity");
  if (!present(payload.sourceReference) || payload.sourceReference !== record.source.reference) errors.push("Import source reference must match recipe evidence");
  if (!present(record.source.rights)) errors.push("Missing source rights declaration");
  if (record.review.status !== "pending_review" || record.review.reviewedBy !== null || record.review.reviewedAt !== null) errors.push("Imports must begin pending review");
  if (record.source.reviewed || record.nutrition.reviewed || record.ingredients.some((ingredient) => ingredient.reviewed)) errors.push("Imported evidence cannot be pre-approved");
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };
  return { ok: true, value: { record: record as PendingRecipeRecord, audit: {
    recipeId: record.id, recipeVersion: record.version, sourceReference: record.source.reference,
    rightsDeclaration: record.source.rights, payloadHash: payload.payloadHash, importedBy: payload.importedBy,
    reviewStatus: "pending_review", reviewedBy: null, reviewedAt: null,
  } } };
}

export function approveImportedRecipeVersion(
  pending: PendingRecipeImport,
  reviewer: { reviewerId: string; reviewedAt: string },
): RecipeImportResult<{ record: RecipeRecord; audit: RecipeImportAudit }> {
  if (!present(reviewer.reviewerId) || !present(reviewer.reviewedAt) || !Number.isFinite(Date.parse(reviewer.reviewedAt))) return { ok: false, errors: ["Valid reviewer identity and review time are required"] };
  const current = clone(pending.record);
  if (current.review.status !== "pending_review" || current.review.reviewedBy !== null || current.review.reviewedAt !== null) return { ok: false, errors: ["Only a pending import can be approved"] };
  const record: RecipeRecord = {
    ...current, version: current.version + 1,
    ingredients: current.ingredients.map((ingredient) => ({ ...ingredient, reviewed: true })),
    source: { ...current.source, reviewed: true }, nutrition: { ...current.nutrition, reviewed: true },
    review: { status: "approved", reviewedBy: reviewer.reviewerId, reviewedAt: reviewer.reviewedAt },
  };
  const errors = recipeRecordErrors(record);
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { record, audit: {
    ...pending.audit, recipeVersion: record.version, reviewStatus: "approved",
    reviewedBy: reviewer.reviewerId, reviewedAt: reviewer.reviewedAt,
  } } };
}
