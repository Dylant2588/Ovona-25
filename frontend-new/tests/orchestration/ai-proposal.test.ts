import assert from "node:assert/strict";
import test from "node:test";
import { resolveReviewedProposal, type AiMealProposal } from "../../lib/generation/ai-proposal.ts";
import { reviewedRecipe } from "./reviewed-recipe-fixture.ts";

const choices = (): AiMealProposal => ({ choices: [
  { slot: "breakfast", recipeId: "test-reviewed", recipeVersion: 1 },
  { slot: "lunch", recipeId: "test-reviewed", recipeVersion: 1 },
  { slot: "dinner", recipeId: "test-reviewed", recipeVersion: 1 },
] });

test("AI choices resolve only to server-loaded reviewed recipe IDs and versions", () => {
  const result = resolveReviewedProposal(choices(), [reviewedRecipe()], ["breakfast", "lunch", "dinner"]);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.value.map((choice) => choice.recipe.id), ["test-reviewed", "test-reviewed", "test-reviewed"]);
});

test("forged versions, unknown IDs, duplicate slots, and missing slots fail closed", () => {
  const invalid = [
    { ...choices(), choices: [{ slot: "breakfast", recipeId: "test-reviewed", recipeVersion: 999 }] },
    { ...choices(), choices: [{ slot: "breakfast", recipeId: "unknown", recipeVersion: 1 }] },
    { choices: [{ slot: "breakfast", recipeId: "test-reviewed", recipeVersion: 1 }, { slot: "breakfast", recipeId: "test-reviewed", recipeVersion: 1 }, { slot: "dinner", recipeId: "test-reviewed", recipeVersion: 1 }] },
    { choices: [{ slot: "breakfast", recipeId: "test-reviewed", recipeVersion: 1 }] },
    { choices: [{ slot: "breakfast", recipeId: "test-reviewed", recipeVersion: 1 }, { slot: "lunch", recipeId: "test-reviewed", recipeVersion: 1 }, { slot: "dinner", recipeId: "test-reviewed" }] },
  ];
  for (const proposal of invalid) {
    const result = resolveReviewedProposal(proposal, [reviewedRecipe()], ["breakfast", "lunch", "dinner"]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error.code, /ai_proposal_/);
  }
});
