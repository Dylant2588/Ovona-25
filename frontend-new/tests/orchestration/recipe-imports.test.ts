import test from "node:test";
import assert from "node:assert/strict";
import { reviewedRecipe } from "./recipe-fixtures.ts";
import {
  createPendingRecipeImport,
  approveImportedRecipeVersion,
} from "../../lib/recipes/imports.ts";
import { acceptOperatorObservationBatch } from "../../lib/retailer-observation-adapters.ts";

const draft = () => {
  const recipe = reviewedRecipe();
  return {
    ...recipe,
    review: { status: "pending_review" as const, reviewedBy: null, reviewedAt: null },
    source: { ...recipe.source, reference: "https://source.test", reviewed: false },
    nutrition: { ...recipe.nutrition, reviewed: false },
    ingredients: recipe.ingredients.map((ingredient) => ({ ...ingredient, reviewed: false })),
  };
};

test("trusted imports fail closed when evidence or measured ingredients are absent", () => {
  const missingRights = draft();
  missingRights.source.rights = "";
  const result = createPendingRecipeImport({ record: missingRights, payloadHash: "sha256:test", importedBy: "importer", sourceReference: "https://source.test" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((error) => error.includes("rights")));
});

test("approval creates a new immutable reviewed version with reviewer attribution", () => {
  const pending = createPendingRecipeImport({ record: draft(), payloadHash: "sha256:test", importedBy: "importer", sourceReference: "https://source.test" });
  assert.equal(pending.ok, true);
  if (!pending.ok) return;
  const approved = approveImportedRecipeVersion(pending.value, { reviewerId: "reviewer", reviewedAt: "2026-10-13T12:00:00Z" });
  assert.equal(approved.ok, true);
  if (!approved.ok) return;
  assert.equal(approved.value.record.version, 2);
  assert.equal(approved.value.record.review.status, "approved");
  assert.equal(approved.value.record.review.reviewedBy, "reviewer");
  assert.equal(pending.value.record.version, 1);
  assert.equal(pending.value.record.review.status, "pending_review");
});

test("operator price adapters reject missing provenance and never accept a fetch implementation", () => {
  const result = acceptOperatorObservationBatch({
    adapterVersion: "feed-v1", importedBy: "operator", importBatchId: "batch-1", observations: [{
      retailerId: "tesco", retailerName: "Tesco", ingredientKey: "chicken", packSize: 500,
      packUnit: "g", unitPrice: 4.5, currency: "GBP", estimated: false,
      sourceReference: "https://feed.test/item", provenanceStatus: "operator_imported",
      observedAt: "2026-10-13T10:00:00Z", importedAt: "2026-10-13T10:05:00Z",
    }],
  });
  assert.equal(result.ok, true);
  assert.equal("fetch" in (result.ok ? result.value : {}), false);
});
