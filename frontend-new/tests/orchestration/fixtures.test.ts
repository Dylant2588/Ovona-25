import assert from "node:assert/strict";
import test from "node:test";

import {
  allergyProhibitedCandidate,
  declaredLeftoverCandidate,
  dietProhibitedCandidate,
  incompleteUnverifiedCandidate,
  normalizedIngredientAliases,
  pantryIngredient,
  safeCandidates,
  validRawProfile,
} from "./fixtures.ts";

test("planner fixtures expose complete deterministic safety variants", () => {
  assert.deepEqual(safeCandidates.map((candidate) => candidate.slot), ["breakfast", "lunch", "dinner", "snack"]);
  assert.equal(allergyProhibitedCandidate.allergens.includes("peanut"), true);
  assert.equal(dietProhibitedCandidate.dietaryTags.includes("omnivore"), true);
  assert.equal(incompleteUnverifiedCandidate.verified, false);
  assert.equal(declaredLeftoverCandidate.isLeftover, true);
  assert.equal(normalizedIngredientAliases.every((ingredient) => ingredient.normalizedName === "chickpea"), true);
  assert.equal(pantryIngredient.pantry, true);
  assert.equal(validRawProfile.householdSize, 2);

  for (const candidate of safeCandidates) {
    assert.equal(candidate.verified, true);
    assert.equal(Number.isFinite(candidate.nutrition.calories), true);
    assert.equal(Number.isFinite(candidate.nutrition.protein), true);
    assert.equal(Number.isFinite(candidate.cost), true);
    assert.equal(candidate.ingredients.every((ingredient) => ingredient.quantity > 0), true);
  }
});
