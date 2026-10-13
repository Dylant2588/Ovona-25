import assert from "node:assert/strict";
import test from "node:test";
import { writeApprovedPlan } from "../../lib/recipes/plan-boundary.ts";
import { loadServerConstraints } from "../../lib/recipes/server-constraints.ts";
import { recipeDatabase, reviewedPlan, reviewedRecipe } from "./reviewed-recipe-fixture.ts";
const dependencies = { context: async () => ({ calorieTarget: 1650, proteinTarget: 120, mealsPerDay: 3 }) };
test("actual persistence boundary writes a reviewed fixture with recomputed totals", async () => {
  const mutations: string[] = [];
  const plan = reviewedPlan(); plan.weeklyTotals.calories = -999;
  const result = await writeApprovedPlan(recipeDatabase(), "user-1", plan, async (approved) => {
    mutations.push("delete", "insert", "history"); return approved;
  }, undefined, dependencies);
  assert.equal(result.weeklyTotals.calories, 11550); assert.deepEqual(mutations, ["delete", "insert", "history"]);
});
test("forged approval, changed ingredient, version, owner, nutrition and incomplete days produce zero writes", async () => {
  const mutations: string[] = [];
  const altered = [
    (plan: ReturnType<typeof reviewedPlan>) => { plan.userId = "another-user"; },
    (plan: ReturnType<typeof reviewedPlan>) => { plan.days[0].meals[0].ingredients[0].name = "Milk"; },
    (plan: ReturnType<typeof reviewedPlan>) => { plan.days[0].meals[0].recipeVersion = 999; },
    (plan: ReturnType<typeof reviewedPlan>) => { plan.days[0].meals[0].macros.protein = 999; },
    (plan: ReturnType<typeof reviewedPlan>) => { plan.days[0].meals.pop(); },
    (plan: ReturnType<typeof reviewedPlan>) => { plan.days[0].date = plan.days[1].date; },
  ];
  for (const mutate of altered) {
    const plan = reviewedPlan(); mutate(plan);
    await assert.rejects(writeApprovedPlan(recipeDatabase(), "user-1", plan, async () => { mutations.push("write"); }, undefined, dependencies));
  }
  assert.deepEqual(mutations, []);
});
test("missing review and unavailable saved preferences reject before mutation", async () => {
  const pending = reviewedRecipe(); pending.review.status = "pending_review";
  let writes = 0;
  for (const options of [{ recipes: [pending] }, { failed: "user_preferences" }, { failed: "recipe_library" }, { allergy: "unknown-allergy" }]) {
    await assert.rejects(writeApprovedPlan(recipeDatabase(options), "user-1", reviewedPlan(), async () => { writes += 1; }, undefined, dependencies));
  }
  assert.equal(writes, 0);
});
test("client restrictions never erase saved allergies, dietary modes or dislikes", async () => {
  const constraints = await loadServerConstraints(recipeDatabase({ allergy: "milk", dietary: "vegan" }), "user-1", { tastes: [], profile: { allergies: [], dietaryMode: "mixed", dislikes: ["chickpeas"] } });
  assert.deepEqual(constraints.allergies, ["milk"]); assert.deepEqual(constraints.dietaryModes, ["vegan", "mixed"]); assert.deepEqual(constraints.dislikes, ["chickpeas"]);
});
