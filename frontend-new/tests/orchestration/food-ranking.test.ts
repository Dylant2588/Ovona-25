import assert from "node:assert/strict";
import test from "node:test";
import { scoreCandidate, rankCandidates } from "../../lib/orchestration/score.ts";
import { normalizePlannerProfile } from "../../lib/orchestration/normalize-profile.ts";
import { recipesToCandidates } from "../../lib/recipes/candidates.ts";
import { reviewedRecipe } from "./recipe-fixtures.ts";
import { filterEligibleCandidates } from "../../lib/orchestration/eligibility.ts";

test("saved avoid foods and likes actually affect ranking while remaining soft preferences", () => {
  const recipe = reviewedRecipe();
  recipe.ingredients = [{ name: "Egg whites", canonicalId: "egg", amount: 100, unit: "g", allergens: ["eggs"], dietaryFlags: ["animal_product"], reviewed: true }];
  const egg = recipesToCandidates([recipe], {})[0];
  const rice = { ...egg, id: "rice:lunch", title: "Rice", ingredients: [{ ...egg.ingredients[0], name: "Brown rice", normalizedName: "rice" }], allergens: [] };
  const profile = normalizePlannerProfile({ calorieTarget: 1800, proteinTarget: 120, requiredSlots: ["breakfast", "lunch", "dinner"], dislikes: ["Eggs"], foodLikes: ["brown rice"] });
  const ctx = { selected: [], recentCandidateIds: [] };
  assert.ok(scoreCandidate(profile, egg, ctx).components.preference < 0);
  assert.ok(scoreCandidate(profile, rice, ctx).components.preference > 0);
  assert.equal(rankCandidates(profile, [egg, rice], ctx)[0].candidate.id, rice.id);
  assert.equal(filterEligibleCandidates(profile, [egg, rice]).eligible.length, 2);
  const allergic = normalizePlannerProfile({ calorieTarget: 1800, proteinTarget: 120, allergies: ["eggs"], foodLikes: ["eggs"] });
  assert.equal(filterEligibleCandidates(allergic, [egg]).eligible.length, 0);
});

test("cuisine preferences use reviewed metadata or whole title terms without becoming exclusions", () => {
  const recipe = reviewedRecipe();
  recipe.cuisine = "  Mediterranean  ";
  const candidate = recipesToCandidates([recipe], {})[0];
  assert.equal(candidate.cuisine, "mediterranean");
  const profile = normalizePlannerProfile({ calorieTarget: 1800, proteinTarget: 120, preferredMealTypes: ["MEDITERRANEAN"] });
  const ctx = { selected: [], recentCandidateIds: [] };
  const other = { ...candidate, id: "other", cuisine: "british" };
  assert.ok(scoreCandidate(profile, candidate, ctx).components.preference > scoreCandidate(profile, other, ctx).components.preference);
  assert.equal(filterEligibleCandidates(profile, [candidate, other]).eligible.length, 2);
  const titled = { ...other, cuisine: undefined, title: "Mediterranean chickpea bowl" };
  assert.ok(scoreCandidate(profile, titled, ctx).components.preference > 0);
  const unrelated = normalizePlannerProfile({ calorieTarget: 1800, proteinTarget: 120, preferredMealTypes: ["asian"] });
  assert.equal(scoreCandidate(unrelated, { ...other, title: "Caucasian bowl" }, ctx).components.preference, 0);
});
