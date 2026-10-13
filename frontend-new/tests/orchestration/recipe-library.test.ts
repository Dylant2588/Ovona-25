import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadReviewedRecipes, recipeRecordErrors } from "../../lib/recipes/repository.ts";
import { reviewedRecipe } from "./recipe-fixtures.ts";
const reader = (data: unknown, error: unknown = null) => ({ from: () => ({ select: () => ({ eq: async () => ({ data, error }) }) }) });
test("reviewed recipes retain batch measurements, source and nutrition evidence", async () => {
  const recipe = reviewedRecipe();
  const loaded = await loadReviewedRecipes(reader([{ id: recipe.id, version: recipe.version, review_status: "approved", record: JSON.parse(JSON.stringify(recipe)) }]));
  assert.equal(loaded.ok, true);
  if (loaded.ok) assert.deepEqual(loaded.recipes[0], recipe);
  assert.deepEqual(recipeRecordErrors(recipe), []);
});
test("missing schema, malformed recipe and forged row approval fail closed", async () => {
  assert.equal((await loadReviewedRecipes(reader(null, { code: "42P01" }))).ok, false);
  for (const mutate of [(r: ReturnType<typeof reviewedRecipe>) => { r.ingredients[0].amount = 0; }, (r: ReturnType<typeof reviewedRecipe>) => { r.review.status = "pending_review"; }, (r: ReturnType<typeof reviewedRecipe>) => { r.nutrition.reviewed = false; }]) {
    const recipe = reviewedRecipe(); mutate(recipe);
    assert.equal((await loadReviewedRecipes(reader([{ id: recipe.id, version: recipe.version, review_status: "approved", record: recipe }]))).ok, false);
  }
});
test("catalogue export is complete deterministic and never certifies internal drafts", () => {
  const require = createRequire(import.meta.url);
  const { exportRecords } = require("../../scripts/export-recipe-library.cjs");
  const first = exportRecords(), second = exportRecords();
  assert.deepEqual(first, second);
  assert.ok(first.length >= 28);
  assert.equal(new Set(first.map((r: { id: string }) => r.id)).size, first.length);
  assert.ok(first.every((r: ReturnType<typeof reviewedRecipe>) => r.review.status === "pending_review" && !r.source.reviewed && !r.nutrition.reviewed && r.ingredients.every(i => !i.reviewed)));
});
