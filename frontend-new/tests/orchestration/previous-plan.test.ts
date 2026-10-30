import assert from "node:assert/strict";
import test from "node:test";
import { loadPreviousPlanRotation, previousPlanRotation, sameRecipeDays } from "../../lib/generation/previous-plan.ts";
import { reviewedRecipe } from "./recipe-fixtures.ts";
import { recipesToCandidates } from "../../lib/recipes/candidates.ts";
import { scoreCandidate } from "../../lib/orchestration/score.ts";
import { normalizePlannerProfile } from "../../lib/orchestration/normalize-profile.ts";
import { orchestrateWeek } from "../../lib/orchestration/schedule.ts";
import type { VerifiedCandidateMeal } from "../../lib/orchestration/types.ts";

const rows = () => Array.from({ length: 7 }, (_, index) => ({ plan_id: "latest", day_id: `day-${index}`,
  date: `2026-10-${26 + index}`, meals: { meals: [{ baseId: "reviewed-chicken", recipeVersion: 1, mealSlot: "lunch" }] } }));

test("latest persisted reviewed recipe identities drive rotation without accepting forged versions", () => {
  const data = rows();
  data[0].meals.meals.push({ baseId: "forged", recipeVersion: 100, mealSlot: "lunch" });
  const result = previousPlanRotation(data, [reviewedRecipe()]);
  assert.deepEqual(result.recentCandidateIds, ["reviewed-chicken:lunch"]);
  assert.deepEqual(result.recentSimilarityKeys, ["reviewed-chicken"]);
  assert.deepEqual(result.previousDayRecipeIds, Array.from({ length: 7 }, () => ["reviewed-chicken"]));
  assert.deepEqual(previousPlanRotation(data.slice(0, 6), [reviewedRecipe()]).previousDayRecipeIds, []);
  assert.deepEqual(previousPlanRotation(null, [reviewedRecipe()]).previousDayRecipeIds, []);
});

test("previous-plan reads are owner-scoped and bounded; failures are explicit", async () => {
  const calls: unknown[] = [];
  const chain = { select(v: string) { calls.push(["select", v]); return chain; }, eq(k: string, v: string) { calls.push(["eq", k, v]); return chain; },
    order(k: string, v: unknown) { calls.push(["order", k, v]); return chain; }, async limit(v: number) { calls.push(["limit", v]); return { data: rows(), error: null }; } };
  const database = { from(table: string) { assert.equal(table, "plan_history"); return chain; } };
  const result = await loadPreviousPlanRotation(database as never, "owner", [reviewedRecipe()]);
  assert.equal(result.previousDayRecipeIds.length, 7);
  assert.ok(calls.some(v => JSON.stringify(v) === JSON.stringify(["eq", "user_id", "owner"])));
  assert.ok(calls.some(v => JSON.stringify(v) === JSON.stringify(["limit", 100])));
  const broken = { from() { return { select() { return { eq() { return { order() { return { limit: async () => ({ data: null, error: {} }) }; } }; } }; } }; } };
  await assert.rejects(loadPreviousPlanRotation(broken as never, "owner", [reviewedRecipe()]), /rotation/);
});

test("real mapped recipe candidates match versioned history and similarity ranking", () => {
  const candidate = recipesToCandidates([reviewedRecipe()], {})[0];
  const profile = normalizePlannerProfile({ calorieTarget: 900, proteinTarget: 120, requiredSlots: ["breakfast", "lunch", "dinner"] });
  for (const history of [{ recentCandidateIds: ["reviewed-chicken:1"] }, { recentCandidateIds: [], recentSimilarityKeys: ["reviewed-chicken"] }]) {
    assert.ok(scoreCandidate(profile, candidate, { selected: [], ...history }).components.repetition < 0);
  }
});

test("same-day rotation changes recipes where feasible while retaining the complete safe pool", () => {
  const profile = normalizePlannerProfile({ calorieTarget: 800, proteinTarget: 60, requiredSlots: ["breakfast"], maxPrepMinutes: 30 });
  const candidates: VerifiedCandidateMeal[] = Array.from({ length: 9 }, (_, index) => ({ id: `recipe-${index}:breakfast`, recipeId: `recipe-${index}`, recipeVersion: 1,
    similarityKey: `recipe-${index}`, slot: "breakfast", title: `Recipe ${index}`, verified: true,
    ingredients: [{ name: "Chickpeas", normalizedName: "chickpea", quantity: 100, unit: "g", pantry: false }],
    nutrition: { calories: 800, protein: 60, carbs: 70, fat: 10 }, allergens: [], dietaryTags: [], cost: 0, prepMinutes: 10, servings: 1 }));
  const first = orchestrateWeek(profile, candidates); assert.equal(first.ok, true);
  if (!first.ok) return;
  const previousDayRecipeIds = first.value.days.map(day => day.meals.map(meal => meal.similarityKey));
  const next = orchestrateWeek(profile, candidates, { recentSimilarityKeys: candidates.map(c => c.recipeId!), previousDayRecipeIds });
  assert.equal(next.ok, true);
  if (next.ok) assert.ok(next.value.days.some((day, index) => day.meals[0].similarityKey !== previousDayRecipeIds[index][0]));
  const fallback = orchestrateWeek(profile, candidates, { differentFromDays: previousDayRecipeIds });
  assert.equal(fallback.ok, true);
  if (fallback.ok) assert.ok(fallback.value.days.some((day, index) => day.meals[0].similarityKey !== previousDayRecipeIds[index][0]));
  const old = Array.from({ length: 7 }, () => ["only-recipe"]);
  const same = old.map(ids => ({ meals: ids.map(baseId => ({ baseId })) }));
  assert.equal(sameRecipeDays(old, same), true);
  assert.equal(sameRecipeDays(old, same.map((day, index) => index === 0 ? { meals: [{ baseId: "different" }] } : day)), false);
});
