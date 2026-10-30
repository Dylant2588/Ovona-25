import assert from "node:assert/strict";
import test from "node:test";
import { buildDeterministicPlanningInput } from "../../lib/orchestration/candidate-adapter.ts";
import { validateMealAgainstRecipe } from "../../lib/recipes/approval.ts";
import type { GenerationContext, GenerationSupabase } from "../../lib/generation/types.ts";
import { calculatedRecipe } from "./calculated-recipe-fixtures.ts";
import { reviewedMeal } from "./recipe-fixtures.ts";

const context = (): GenerationContext => ({ calorieTarget: 1800, proteinTarget: 150, carbTarget: 180, fatTarget: 60, dietaryMode: "mixed", allergies: [], dislikes: [], cuisinePreferences: [], maxPrepMinutes: 30, healthConditions: [], microTargets: {}, mealsPerDay: 3, slotLabels: ["Lunch"], weeklyBudget: 55, recentMealNames: [], recentProteinTypes: [], slotBudgets: [] });
const database = (record = calculatedRecipe(), allergies: string[] = []): GenerationSupabase => ({
  from: (table: string) => {
    const result = { data: table === "recipe_library" ? [{ id: record.id, version: record.version, review_status: "approved", record }] : table === "user_preferences" ? [{ allergies }] : [], error: null };
    const query = { select: () => query, eq: () => query, then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve) };
    return query;
  },
}) as unknown as GenerationSupabase;

test("actual adapter and final validator scale calculated two-serving recipe exactly once", async () => {
  const recipe = calculatedRecipe();
  const built = await buildDeterministicPlanningInput("user", { context: context(), supabase: database(recipe) });
  assert.equal(built.ok, true); if (!built.ok) return;
  const lunch = built.value.candidates.find(candidate => candidate.slot === "lunch");
  assert.ok(lunch);
  assert.equal(lunch.ingredients[0].quantity, 200); // 400g batch / 2 servings.
  assert.deepEqual(lunch.nutrition, { calories: 300, protein: 40, carbs: 5, fat: 10 });
  const meal = reviewedMeal(); meal.portionMultiplier = 1.5;
  meal.ingredients = meal.ingredients.map(ingredient => ({ ...ingredient, amount: ingredient.amount * 1.5 }));
  meal.macros = { calories: 450, protein: 60, carbs: 8, fat: 15 };
  const checked = validateMealAgainstRecipe(meal, recipe);
  assert.equal(checked.approved, true);
  assert.equal(checked.meal?.ingredients[0].amount, 300);
  assert.deepEqual(checked.meal?.macros, meal.macros);
});

test("actual adapter rejects stale source nutrition and honours saved ingredient exclusions", async () => {
  const stale = calculatedRecipe(); stale.ingredients[0].nutrition!.food.macros.protein += 1;
  const failed = await buildDeterministicPlanningInput("user", { context: context(), supabase: database(stale) });
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.equal(failed.error.code, "invalid_recipe_library");
  const recipe = calculatedRecipe();
  recipe.ingredients[0].mayContain = ["milk"];
  const allergic = await buildDeterministicPlanningInput("user", { context: context(), supabase: database(recipe, ["dairy"]) });
  assert.equal(allergic.ok, false);
  const meal = reviewedMeal(); meal.macros.protein += 1;
  assert.equal(validateMealAgainstRecipe(meal, recipe).approved, false);
});
