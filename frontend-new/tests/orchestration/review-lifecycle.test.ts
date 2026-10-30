import assert from "node:assert/strict";
import test from "node:test";
import { parseReviewRequest, proposeReviewedVersion } from "../../lib/recipes/review-lifecycle.ts";
import { approveRecipe } from "../../lib/recipes/approval.ts";
import { reviewedRecipe } from "./recipe-fixtures.ts";
import { calculatedRecipe } from "./calculated-recipe-fixtures.ts";

const attestations = { source: true, rights: true, ingredients: true, nutrition: true, cooked: true };
const pending = () => {
  const recipe = calculatedRecipe();
  recipe.review = { status: "pending_review", reviewedBy: null, reviewedAt: null };
  recipe.source.reviewed = false;
  recipe.nutrition.reviewed = false;
  recipe.ingredients.forEach((ingredient) => { ingredient.reviewed = false; });
  return recipe;
};

test("approval requests require each of five explicit true attestations", () => {
  const request = { id: "reviewed-chicken", version: 1, action: "approve", attestations };
  assert.equal(parseReviewRequest(request).ok, true);
  for (const key of Object.keys(attestations)) {
    const missing: Record<string, unknown> = { ...attestations }; delete missing[key];
    for (const invalid of [missing, { ...attestations, [key]: false }, { ...attestations, [key]: "true" }]) {
      assert.equal(parseReviewRequest({ ...request, attestations: invalid }).ok, false);
    }
  }
  for (const invalid of [undefined, {}, null, [], { ...attestations, invented: true }]) {
    assert.equal(parseReviewRequest({ ...request, attestations: invalid }).ok, false);
  }
});

test("review requests reject malformed identities/actions and client-owned recipe/actor fields", () => {
  for (const body of [null, [], {}, { id: "x", version: 0, action: "reject" },
    { id: "x", version: 1.5, action: "reject" }, { id: "x", version: 1, action: "publish" },
    { id: "x", version: 1, action: "reject", actor: "forged" },
    { id: "x", version: 1, action: "reject", record: pending() }]) assert.equal(parseReviewRequest(body).ok, false);
  assert.deepEqual(parseReviewRequest({ id: "x", version: 1, action: "reject" }), {
    ok: true, value: { id: "x", version: 1, action: "reject", attestations: {} },
  });
});

test("pending conversion is immutable and validates the proposed reviewed version", () => {
  const draft = pending(); const original = structuredClone(draft);
  assert.equal(approveRecipe(draft).approved, false);
  const result = proposeReviewedVersion(draft, "reviewer-1", "2026-10-28T12:00:00Z");
  assert.equal(result.ok, true);
  assert.deepEqual(draft, original);
  if (!result.ok) return;
  assert.equal(result.record.version, 2);
  assert.equal(result.record.review.reviewedBy, "reviewer-1");
  assert.equal(approveRecipe(result.record).approved, true);
  assert.deepEqual(result.record.ingredients.map((ingredient) => ({ ...ingredient, reviewed: false })), draft.ingredients);
  assert.deepEqual(result.record.macros, draft.macros);
  assert.deepEqual(result.record.steps, draft.steps);
});

test("unknown taxonomy, nonpending state and malformed evidence cannot be proposed", () => {
  const unknown = pending(); unknown.ingredients[0].name = "Mystery ingredient";
  const rejected = pending(); rejected.review.status = "rejected";
  const partial = pending(); partial.ingredients[0].reviewed = true;
  for (const draft of [unknown, rejected, partial, reviewedRecipe(), null, { source: null }]) {
    assert.equal(proposeReviewedVersion(draft, "reviewer-1", "2026-10-28T12:00:00Z").ok, false);
  }
  assert.equal(proposeReviewedVersion(pending(), "", "2026-10-28T12:00:00Z").ok, false);
  assert.equal(proposeReviewedVersion(pending(), "reviewer-1", "invalid").ok, false);
});

test("new review approval cannot bypass calculation by using a legacy method", () => {
  const legacy = pending(); legacy.nutrition = { ...reviewedRecipe().nutrition, reviewed: false };
  assert.equal(proposeReviewedVersion(legacy, "reviewer", "2026-10-29T12:00:00Z").ok, false);
});
