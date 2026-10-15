import assert from "node:assert/strict";
import test from "node:test";
import { buildReviewedProposalRequest, resolveReviewedProposal, type AiMealProposal } from "../../lib/generation/ai-proposal.ts";
import { buildPlanningInput } from "../../lib/planning-input.ts";
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

test("AI brief receives structured constraints without identity or free-form notes", () => {
  const input = buildPlanningInput({ requested: { allergies: ["wheat"], dislikes: ["mushrooms"], maxPrepMinutes: 10 },
    defaults: { maxPrepMinutes: 30, mealsPerDay: 5, weeklyBudget: 55, macroTargets: { calories: 1800, protein: 150, carbs: 180, fat: 60 } },
    history: { recentCandidateIds: [], recentSimilarityKeys: [], recentProteinTypes: [], recentCuisines: [], recentFormats: [], recentMealNames: [], rejectedRecipeIds: [], rejectedSimilarityKeys: [] } });
  const request = buildReviewedProposalRequest([{ slot: "breakfast", recipeId: "test-reviewed", recipeVersion: 1, title: "Safe meal" }], input);
  assert.deepEqual(request.planningBrief?.hardExclusions.allergies, ["wheat"]);
  assert.deepEqual(request.planningBrief?.foodPreferences.dislikes, ["mushrooms"]);
  assert.equal(request.planningBrief?.mealConstraints.maxPrepMinutes, 10);
  assert.doesNotMatch(JSON.stringify(request), /userId|notes|token/i);
});
