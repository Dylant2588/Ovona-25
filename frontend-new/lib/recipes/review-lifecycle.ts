import { approveRecipe } from "./approval.ts";
import { approveImportedRecipeVersion, type PendingRecipeImport } from "./imports.ts";
import { recipeRecordErrors } from "./repository.ts";
import type { RecipeRecord } from "./types.ts";

export const REVIEW_ATTESTATIONS = ["source", "rights", "ingredients", "nutrition", "cooked"] as const;
export type ReviewAttestations = Record<typeof REVIEW_ATTESTATIONS[number], true>;
export type ReviewRequest = {
  id: string; version: number; action: "approve" | "reject";
  attestations: ReviewAttestations | Record<string, never>;
};
type Failure = { ok: false; errors: string[] };
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function parseReviewRequest(value: unknown): { ok: true; value: ReviewRequest } | Failure {
  if (!object(value) || Object.keys(value).some((key) => !["id", "version", "action", "attestations"].includes(key)) ||
      typeof value.id !== "string" || !value.id.trim() || !Number.isSafeInteger(value.version) || Number(value.version) < 1 ||
      (value.action !== "approve" && value.action !== "reject")) {
    return { ok: false, errors: ["Provide a recipe ID, positive integer version and approve/reject action."] };
  }
  if (value.action === "approve") {
    const evidence = value.attestations;
    if (!object(evidence) || Object.keys(evidence).length !== REVIEW_ATTESTATIONS.length ||
        REVIEW_ATTESTATIONS.some((key) => evidence[key] !== true)) {
      return { ok: false, errors: ["Record all five review attestations before approving a recipe."] };
    }
    return { ok: true, value: { id: value.id, version: Number(value.version), action: "approve", attestations: evidence as ReviewAttestations } };
  }
  return { ok: true, value: { id: value.id, version: Number(value.version), action: "reject", attestations: {} } };
}

export function proposeReviewedVersion(draft: unknown, reviewerId: string, reviewedAt: string):
  { ok: true; record: RecipeRecord } | Failure {
  const errors = recipeRecordErrors(draft);
  if (errors.length) return { ok: false, errors };
  const record = draft as RecipeRecord;
  if (record.review.status !== "pending_review" || record.review.reviewedBy !== null || record.review.reviewedAt !== null ||
      record.source.reviewed || record.nutrition.reviewed || record.ingredients.some((ingredient) => ingredient.reviewed)) {
    return { ok: false, errors: ["Only an unreviewed pending draft can be proposed."] };
  }
  // The existing converter needs an audit shape but does not persist it. Unknown
  // import attribution stays empty here; SQL resolves real provenance under lock.
  const pending: PendingRecipeImport = { record: record as PendingRecipeImport["record"], audit: {
    recipeId: record.id, recipeVersion: record.version, sourceReference: record.source.reference,
    rightsDeclaration: record.source.rights, payloadHash: "", importedBy: "",
    reviewStatus: "pending_review", reviewedBy: null, reviewedAt: null,
  } };
  const converted = approveImportedRecipeVersion(pending, { reviewerId, reviewedAt });
  if (!converted.ok) return converted;
  const checked = approveRecipe(converted.value.record, {});
  if (!checked.approved) return { ok: false, errors: checked.reasons.map((reason) => reason.message) };
  return { ok: true, record: converted.value.record };
}
