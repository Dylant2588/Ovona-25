import assert from "node:assert/strict";
import test from "node:test";
import { buildPlanningInput, PlanningInputError } from "../../lib/planning-input.ts";
import { loadServerConstraints } from "../../lib/recipes/server-constraints.ts";
import type { ConstraintDatabase } from "../../lib/recipes/server-constraints.ts";

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

const restrictionDatabase = (tables: Record<string, unknown>, failed?: string): ConstraintDatabase => ({
  from: (table) => ({ select: () => ({ eq: async () => ({ data: tables[table] ?? [], error: failed === table ? "unavailable" : null }) }) }),
});

test("server restrictions union every saved source and requested additions using canonical aliases", async () => {
  const constraints = await loadServerConstraints(restrictionDatabase({
    user_preferences: [{ dietary_mode: "vegan", allergies: "Dairy", never_foods: ["garlic"], max_prep_minutes: 30 }],
    profiles: [{ lifestyle: "pescetarian", allergies: ["nuts"], never_foods: ["onion"], max_prep_minutes: 20 }],
    user_allergies: [{ allergen: "shellfish" }],
  }), "user-1", { tastes: [], profile: { dietaryMode: "mixed", allergies: ["wheat"], neverFoods: ["tomato"], maxPrepMinutes: 15 } });
  assert.deepEqual(constraints.allergies, ["milk", "peanuts", "tree_nuts", "crustaceans", "molluscs", "gluten"]);
  assert.deepEqual(constraints.dietaryModes, ["vegan", "pescatarian", "mixed"]);
  assert.deepEqual(constraints.neverFoods, ["garlic", "onion", "tomato"]);
  assert.equal(constraints.maxPrepMinutes, 15);
});

test("unavailable or malformed restrictions cannot become an unrestricted profile", async () => {
  for (const tables of [{ profiles: [{ allergies: ["milk", 7] }] }, { user_allergies: [{}] }, { user_preferences: [{ max_prep_minutes: -5 }] }]) {
    await assert.rejects(loadServerConstraints(restrictionDatabase(tables), "user-1"));
  }
  await assert.rejects(loadServerConstraints(restrictionDatabase({}, "profiles"), "user-1"));
});
