import assert from "node:assert/strict";
import test from "node:test";
import { rotationHistoryFromRows, approvedHistoryRecords } from "../../lib/generation/rotation-history.ts";
import { orchestrateWeek } from "../../lib/orchestration/schedule.ts";
import { normalizePlannerProfile } from "../../lib/orchestration/normalize-profile.ts";
import type { VerifiedCandidateMeal } from "../../lib/orchestration/types.ts";
import { reviewedPlan } from "./reviewed-recipe-fixture.ts";

test("rotation history includes exactly the preceding fourteen calendar days and accepted/eaten states", () => {
  const history = rotationHistoryFromRows([
    { date: "2026-10-12", recipe_id: "inside", recipe_version: 1, similarity_key: "inside", planning_state: "accepted", meal_name: "Inside" },
    { date: "2026-09-29", recipe_id: "boundary", recipe_version: 2, similarity_key: "boundary", planning_state: "eaten", meal_name: "Boundary" },
    { date: "2026-09-28", recipe_id: "outside", recipe_version: 1, similarity_key: "outside", planning_state: "eaten", meal_name: "Outside" },
    { date: "2026-10-10", recipe_id: "ignored", recipe_version: 1, similarity_key: "ignored", planning_state: "planned", meal_name: "Ignored" },
  ], new Date("2026-10-13T09:00:00Z"));
  assert.deepEqual([...history.recentCandidateIds].sort(), ["boundary:2", "inside:1"]);
  assert.deepEqual([...history.recentSimilarityKeys].sort(), ["boundary", "inside"]);
});

test("recent exact and similarity matches are avoided when a safe alternative exists", () => {
  const candidate = (id: string, similarityKey: string): VerifiedCandidateMeal => ({ id, slot: "breakfast", title: id, verified: true,
    ingredients: [{ name: `${id} ingredient`, normalizedName: `${id}-ingredient`, quantity: 100, unit: "g", pantry: false }], allergens: [], dietaryTags: [], nutrition: { calories: 800, protein: 60, carbs: 50, fat: 15 }, cost: 1, prepMinutes: 10, servings: 1, similarityKey });
  const profile = normalizePlannerProfile({ calorieTarget: 800, proteinTarget: 60, allergies: [], dislikes: [], dietaryRules: [], maxPrepMinutes: 30, householdSize: 1, preferredMealTypes: [], requiredSlots: ["breakfast"] });
  const fresh = Array.from({ length: 7 }, (_, index) => candidate(`fresh:${index + 1}`, `fresh-${index + 1}`));
  const result = orchestrateWeek(profile, [candidate("old:1", "renamed-meal"), ...fresh], { recentCandidateIds: ["old:1"], recentSimilarityKeys: ["renamed-meal"] });
  assert.equal(result.ok, true, JSON.stringify(result));
  if (result.ok) assert.notEqual(result.value.days[0]?.meals[0]?.candidateId, "old:1");
});

test("approved history writes exact reviewed identity and excludes meal out", () => {
  const plan = reviewedPlan();
  plan.days[0]!.meals[0] = { ...plan.days[0]!.meals[0]!, mealKind: "social", nutritionStatus: "unknown", baseId: "social-meal", recipeVersion: undefined, title: "Meal out", ingredients: [], baseIngredients: [], macros: { calories: 0, protein: 0, carbs: 0, fat: 0 }, baseMacros: { calories: 0, protein: 0, carbs: 0, fat: 0 } };
  const rows = approvedHistoryRecords("user-1", plan);
  assert.equal(rows.length, 20);
  assert.ok(rows.every((row) => row.planning_state === "accepted" && row.recipe_id === "test-reviewed" && row.recipe_version === 1));
});
