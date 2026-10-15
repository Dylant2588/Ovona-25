import assert from "node:assert/strict";
import test from "node:test";
import { buildPlanningInput, PlanningInputError } from "../../lib/planning-input.ts";

const history = { recentCandidateIds: [], recentSimilarityKeys: [], recentProteinTypes: [], recentCuisines: [], recentFormats: [], recentMealNames: [], rejectedRecipeIds: [], rejectedSimilarityKeys: [] };
const defaults = { maxPrepMinutes: 30, mealsPerDay: 5 as const, weeklyBudget: 55, macroTargets: { calories: 1800, protein: 150, carbs: 180, fat: 60 } };

test("saved wheat allergy cannot be cleared by an empty client request", () => {
  const input = buildPlanningInput({ saved: { hardExclusions: { allergies: ["wheat"], dietaryRules: [], neverFoods: [] } }, requested: { allergies: [] }, defaults, history });
  assert.deepEqual(input.hardExclusions.allergies, ["wheat"]);
});

test("mushrooms are a soft dislike unless explicitly marked never include", () => {
  const soft = buildPlanningInput({ requested: { dislikes: [" Mushrooms "] }, defaults, history });
  const hard = buildPlanningInput({ requested: { neverFoods: ["mushrooms"] }, defaults, history });
  assert.deepEqual(soft.foodPreferences.dislikes, ["mushrooms"]);
  assert.deepEqual(soft.hardExclusions.neverFoods, []);
  assert.deepEqual(hard.hardExclusions.neverFoods, ["mushrooms"]);
});

test("quick meals has a durable explicit time limit and invalid terms fail closed", () => {
  assert.equal(buildPlanningInput({ requested: { maxPrepMinutes: "under_10" }, defaults, history }).mealConstraints.maxPrepMinutes, 10);
  assert.throws(() => buildPlanningInput({ requested: { maxPrepMinutes: 0 }, defaults, history }), PlanningInputError);
  assert.throws(() => buildPlanningInput({ requested: { dislikes: ["mushrooms", 7] }, defaults, history }), PlanningInputError);
});
