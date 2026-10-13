import assert from "node:assert/strict";
import test from "node:test";
import { buildDeterministicPlanningInput } from "../../lib/orchestration/candidate-adapter.ts";
import type { GenerationSupabase, GenerationContext } from "../../lib/generation/types.ts";
import { recipeDatabase, reviewedRecipe } from "./reviewed-recipe-fixture.ts";
const context: GenerationContext = { calorieTarget: 1650, proteinTarget: 120, carbTarget: 180, fatTarget: 48, dietaryMode: "mixed", allergies: [], dislikes: [], cuisinePreferences: [],
  maxPrepMinutes: 30, healthConditions: [], microTargets: {}, mealsPerDay: 5, slotLabels: ["Breakfast", "Snack", "Lunch", "Snack", "Dinner"], weeklyBudget: 55,
  recentMealNames: [], recentProteinTypes: [], slotBudgets: [] };
test("adapter admits only reviewed database recipes and preserves duplicate snack slots", async () => {
  const result = await buildDeterministicPlanningInput("user-1", { context, supabase: recipeDatabase() as unknown as GenerationSupabase });
  assert.equal(result.ok, true);
  if (result.ok) { assert.equal(result.value.candidates.length, 4); assert.equal(result.value.profile.hardConstraints.requiredSlots.length, 5);
    assert.equal(result.value.candidates[0].title, reviewedRecipe().title); }
});
test("pending, missing-schema, restrictions and preference-read failures cannot use synthetic meals", async () => {
  const pending = reviewedRecipe(); pending.review.status = "pending_review";
  for (const options of [{ recipes: [] }, { recipes: [pending] }, { failed: "recipe_library" }, { failed: "user_allergies" }, { allergy: "unknown-new-allergy" }]) {
    const result = await buildDeterministicPlanningInput("user-1", { context, supabase: recipeDatabase(options) as unknown as GenerationSupabase });
    assert.equal(result.ok, false);
  }
});
