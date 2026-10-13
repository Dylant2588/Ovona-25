import assert from "node:assert/strict";
import test from "node:test";
import { createPendingRecipeImport } from "../../lib/recipes/imports.ts";
import { OVONA_ORIGINAL_RECIPE_SEEDS } from "../../lib/recipes/ovona-original-seeds.ts";
import { recipeRecordErrors } from "../../lib/recipes/repository.ts";

test("Ovona original recipe seeds are complete, internal, and pending review", () => {
  assert.ok(OVONA_ORIGINAL_RECIPE_SEEDS.length >= 5);
  for (const record of OVONA_ORIGINAL_RECIPE_SEEDS) {
    assert.deepEqual(recipeRecordErrors(record), []);
    assert.equal(record.source.kind, "internal");
    assert.equal(record.review.status, "pending_review");
    const imported = createPendingRecipeImport({ record, payloadHash: `seed:${record.id}:v${record.version}`, importedBy: "operator-1", sourceReference: record.source.reference });
    assert.equal(imported.ok, true);
  }
});
