import assert from "node:assert/strict";
import test from "node:test";
import { buildDeterministicPlanningInput } from "../../lib/orchestration/candidate-adapter.ts";
import { filterEligibleCandidates } from "../../lib/orchestration/eligibility.ts";
import { orchestrateWeek } from "../../lib/orchestration/schedule.ts";
import { buildContext } from "../../lib/generation/context-builder.ts";
import { buildPlanningInput } from "../../lib/planning-input.ts";
import type { GenerationContext, GenerationSupabase } from "../../lib/generation/types.ts";
import type { RecipeRecord } from "../../lib/recipes/types.ts";
import { reviewedRecipe } from "./reviewed-recipe-fixture.ts";

const history = { recentCandidateIds: [], recentSimilarityKeys: [], recentProteinTypes: [], recentCuisines: [], recentFormats: [], recentMealNames: [], rejectedRecipeIds: [], rejectedSimilarityKeys: [] };
const context = (): GenerationContext => ({ calorieTarget: 1650, proteinTarget: 120, carbTarget: 60, fatTarget: 48, dietaryMode: "mixed", allergies: [], dislikes: [], cuisinePreferences: [], maxPrepMinutes: 30, healthConditions: [], microTargets: {}, mealsPerDay: 3, slotLabels: ["Breakfast", "Lunch", "Dinner"], weeklyBudget: 55, recentMealNames: [], recentProteinTypes: [], slotBudgets: [] });

const recipes = (): RecipeRecord[] => (["breakfast", "lunch", "dinner"] as const).flatMap((slot) => Array.from({ length: 7 }, (_, index) => {
  const record = { ...reviewedRecipe(), id: `${slot}-${index}`, title: `${slot} recipe ${index}`, slots: [slot], macros: { calories: 550, protein: 40, carbs: 20, fat: 16 } };
  const source = index % 4;
  if (source === 1) return { ...record, proteinType: "mixed" as const, ingredients: [{ name: "Eggs", canonicalId: "egg", amount: 2, unit: "each", allergens: ["eggs"], dietaryFlags: ["animal_product"], reviewed: true }] };
  if (source === 2) return { ...record, proteinType: "poultry" as const, ingredients: [{ name: "Chicken breast", canonicalId: "chicken", amount: 100, unit: "g", allergens: [], dietaryFlags: ["meat"], reviewed: true }] };
  if (source === 3) return { ...record, proteinType: "fish" as const, ingredients: [{ name: "Salmon", canonicalId: "salmon", amount: 100, unit: "g", allergens: ["fish"], dietaryFlags: ["fish", "animal_product"], reviewed: true }] };
  return record;
}));

function database(tables: Record<string, unknown>, failed?: string): GenerationSupabase {
  return { from: (table: string) => {
    const result = { data: tables[table] ?? [], error: failed === table ? { message: "unavailable" } : null };
    const query = { select: () => query, eq: () => query, limit: () => query, gte: () => query, lt: () => query, order: () => query,
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve) };
    return query;
  } } as unknown as GenerationSupabase;
}
const rows = (entries: RecipeRecord[]) => entries.map((record) => ({ id: record.id, version: record.version, review_status: record.review.status, record }));

for (const diet of ["mixed", "vegetarian", "vegan", "pescatarian", "pescetarian", "low_carb", "high_protein"]) {
  test(`reviewed ${diet} recipes survive actual adapter and eligibility with honest scheduling outcome`, async () => {
    const result = await buildDeterministicPlanningInput("user-1", { context: context(), supabase: database({ user_preferences: [{ dietary_mode: diet }], recipe_library: rows(recipes()) }) });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(filterEligibleCandidates(result.value.profile, result.value.candidates).eligible.length, result.value.candidates.length);
    const expectedCount = diet === "vegan" ? 6 : diet === "vegetarian" ? 12 : ["pescatarian", "pescetarian"].includes(diet) ? 15 : 21;
    assert.equal(result.value.candidates.length, expectedCount);
    const schedule = orchestrateWeek(result.value.profile, result.value.candidates, result.value.history);
    // Existing scheduler policy permits only two "plant" meals/day. Keep
    // accurate metadata and expose that separate policy gap rather than fake
    // vegan protein categories or silently relax the hard scheduler guard.
    assert.equal(schedule.ok, diet !== "vegan");
    if (!schedule.ok) assert.equal(schedule.error.code, "insufficient_candidates");
    if (schedule.ok) assert.equal(schedule.value.days.length, 7);
  });
}

test("saved exclusions override an injected/requested weaker planning brief and retain cross-contact evidence", async () => {
  const entries = recipes();
  entries[0].ingredients[0].mayContain = ["milk"];
  entries[4].ingredients[0].mayContain = ["soy"];
  const weaker = context();
  weaker.planningInput = buildPlanningInput({ defaults: { maxPrepMinutes: 45, mealsPerDay: 3, weeklyBudget: 55, macroTargets: { calories: 1650, protein: 120, carbs: 60, fat: 48 } }, history });
  const result = await buildDeterministicPlanningInput("user-1", { context: weaker,
    preferences: { tastes: [], profile: { dietaryMode: "mixed", allergies: [] } },
    supabase: database({ user_preferences: [{ dietary_mode: "vegan", max_prep_minutes: 20 }], profiles: [{ allergies: ["Dairy"], never_foods: ["onion"] }], recipe_library: rows(entries) }) });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.value.profile.hardConstraints.dietaryRules.includes("vegan"));
  assert.ok(result.value.profile.hardConstraints.allergies.includes("milk"));
  assert.equal(result.value.profile.hardConstraints.maxPrepMinutes, 20);
  assert.ok(result.value.constraints.neverFoods?.includes("onion"));
  assert.ok(result.value.context.planningInput?.hardExclusions.dietaryRules.includes("vegan"));
  assert.ok(result.value.context.planningInput?.hardExclusions.allergies.includes("milk"));
  assert.equal(result.value.context.maxPrepMinutes, 20);
  assert.equal(result.value.candidates.length, 5);
  assert.ok(!result.value.candidates.some((candidate) => candidate.id.startsWith(`${entries[0].id}:`)));
  assert.ok(result.value.candidates.find((candidate) => candidate.id.startsWith(`${entries[4].id}:`))?.allergens.includes("soy"));
});

test("combined saved and requested diets both remain required", async () => {
  const result = await buildDeterministicPlanningInput("user-1", { context: context(),
    preferences: { tastes: [], profile: { dietaryMode: "pescetarian" } },
    supabase: database({ user_preferences: [{ dietary_mode: "vegetarian" }], recipe_library: rows(recipes()) }) });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.value.profile.hardConstraints.dietaryRules.includes("vegetarian"));
  assert.ok(result.value.profile.hardConstraints.dietaryRules.includes("pescatarian"));
  assert.equal(result.value.candidates.length, 12);
  assert.ok(result.value.candidates.every((candidate) => candidate.dietaryTags.includes("vegetarian") && candidate.dietaryTags.includes("pescatarian")));
});

test("an unrestricted feasible five-meal profile retains two distinct snacks", async () => {
  const five = { ...context(), calorieTarget: 2750, proteinTarget: 200, mealsPerDay: 5, slotLabels: ["Breakfast", "Snack", "Lunch", "Snack", "Dinner"] };
  const snacks = recipes().filter((recipe) => recipe.slots.includes("breakfast")).map((recipe) => ({ ...recipe, id: `snack-${recipe.id}`, slots: ["snack" as const] }));
  const result = await buildDeterministicPlanningInput("user-1", { context: five, supabase: database({ recipe_library: rows([...recipes(), ...snacks]) }) });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const schedule = orchestrateWeek(result.value.profile, result.value.candidates, result.value.history);
  assert.equal(schedule.ok, true);
  if (!schedule.ok) return;
  assert.equal(schedule.value.days.length, 7);
  for (const day of schedule.value.days) {
    const meals = day.meals.filter((meal) => meal.slot === "snack");
    assert.equal(meals.length, 2);
    assert.notEqual(meals[0].candidateId, meals[1].candidateId);
  }
});

test("context uses the strict saved union instead of a client dietary-mode replacement", async () => {
  const built = await buildContext("user-1", { preferences: { tastes: [], profile: { dietaryMode: "mixed", maxPrepMinutes: 45 } },
    supabase: database({ user_preferences: [{ lifestyle: "vegan", target_calories: 1650, target_protein: 120, target_carbs: 60, target_fat: 48 }], profiles: [{ dietary_mode: "vegetarian", never_foods: ["garlic"], max_prep_minutes: 15 }] }) });
  assert.ok(built.planningInput?.hardExclusions.dietaryRules.includes("vegan"));
  assert.ok(built.planningInput?.hardExclusions.dietaryRules.includes("vegetarian"));
  assert.deepEqual(built.planningInput?.hardExclusions.neverFoods, ["garlic"]);
  assert.equal(built.maxPrepMinutes, 15);
});

test("unknown rules and missing safety sources cannot admit synthetic fallback candidates", async () => {
  for (const [diet, failed] of [["invented", undefined], ["mixed", "profiles"]] as const) {
    const result = await buildDeterministicPlanningInput("user-1", { context: context(), supabase: database({ user_preferences: [{ dietary_mode: diet }], recipe_library: rows(recipes()) }, failed) });
    assert.equal(result.ok, false);
  }
  await assert.rejects(buildContext("user-1", { supabase: database({}, "profiles") }), { code: "preferences_unavailable" });
});
