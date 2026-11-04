import assert from "node:assert/strict";
import test from "node:test";
import { orchestrateWeek } from "../../lib/orchestration/schedule.ts";
import { normalizePlannerProfile } from "../../lib/orchestration/normalize-profile.ts";
import { approvePlanForUser } from "../../lib/recipes/plan-boundary.ts";
import { reviewedPlan, reviewedRecipe, recipeDatabase } from "./reviewed-recipe-fixture.ts";
import { validRawProfile } from "./fixtures.ts";
import type { VerifiedCandidateMeal } from "../../lib/orchestration/types.ts";

test("one-day scope schedules complete daily slots without requiring seven-day rotation", () => {
  const profile = normalizePlannerProfile({ ...validRawProfile, calorieTarget: 2000, proteinTarget: 120 });
  const candidates = (["breakfast", "lunch", "dinner", "snack"] as const).map((slot, i): VerifiedCandidateMeal => ({
    id: slot, slot, title: slot, verified: true, ingredients: [{ name: "Rice", normalizedName: "rice", quantity: 100, unit: "g", pantry: false }],
    allergens: [], dietaryTags: ["vegetarian"], nutrition: { calories: 500, protein: 30, carbs: 50, fat: 15 }, cost: 2, prepMinutes: 15, servings: 1, proteinType: ["plant", "poultry", "fish", "egg"][i],
  }));
  const result = orchestrateWeek(profile, candidates, {}, "day");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.days.length, 1);
});

test("actual approval accepts only explicit complete daily scope and preserves weekly requirements", async () => {
  const plan = reviewedPlan(); plan.scope = "day"; plan.days = plan.days.slice(0, 1);
  const deps = { context: async () => ({ calorieTarget: 1650, proteinTarget: 120, mealsPerDay: 3 }) };
  const accepted = await approvePlanForUser(recipeDatabase() as never, "user-1", plan, undefined, deps);
  assert.equal(accepted.days.length, 1); assert.equal(accepted.weeklyTotals.calories, 1650);
  await assert.rejects(approvePlanForUser(recipeDatabase() as never, "user-1", { ...plan, scope: undefined }, undefined, deps));
  await assert.rejects(approvePlanForUser(recipeDatabase() as never, "another", plan, undefined, deps));
  await assert.rejects(approvePlanForUser(recipeDatabase() as never, "user-1", { ...plan, days: [{ ...plan.days[0], meals: plan.days[0].meals.slice(0, 2) }] }, undefined, deps));
  const egg = reviewedRecipe(); egg.ingredients[0] = { ...egg.ingredients[0], name: "Egg", canonicalId: "egg", allergens: ["eggs"], dietaryFlags: ["animal_product"] };
  await assert.rejects(approvePlanForUser(recipeDatabase({ allergy: "eggs", recipes: [egg] }) as never, "user-1", plan, undefined, deps));
});
