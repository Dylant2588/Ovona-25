import assert from "node:assert/strict";
import test from "node:test";
import { buildContext } from "../../lib/generation/context-builder.ts";
import type { GenerationSupabase } from "../../lib/generation/types.ts";

function database(tables: Record<string, unknown>): GenerationSupabase {
  return { from: (table: string) => {
    const result = { data: tables[table] ?? [], error: null };
    const query = { select: () => query, eq: () => query, limit: () => query, gte: () => query, lt: () => query, order: () => query,
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve) };
    return query;
  } } as unknown as GenerationSupabase;
}

test("generation carries saved, legacy-profile and current requested likes into its planning brief", async () => {
  const built = await buildContext("owner", {
    supabase: database({ user_preferences: [{ food_likes: ["Rice"] }], profiles: [{ food_likes: ["Tofu"] }] }),
    preferences: { tastes: [], profile: { foodLikes: ["Beans", "rice"] } },
  });
  assert.deepEqual(built.planningInput?.foodPreferences.likes, ["rice", "tofu", "beans"]);
});

test("explicit zero carbohydrate and fat targets are retained rather than replaced by calculated defaults", async () => {
  const built = await buildContext("owner", {
    supabase: database({ user_preferences: [{ target_calories: 1800, target_protein: 150, target_carbs: 0, target_fat: 0 }] }),
  });
  assert.equal(built.carbTarget, 0);
  assert.equal(built.fatTarget, 0);
});

test("partial requested macro overrides retain zeros while other targets are derived", async () => {
  const built = await buildContext("owner", {
    supabase: database({}),
    preferences: { tastes: [], macroTargets: { carbs: 0, fat: 0 } },
  });
  assert.equal(built.carbTarget, 0);
  assert.equal(built.fatTarget, 0);
  assert.ok(built.calorieTarget > 0);
  assert.ok(built.proteinTarget > 0);
});
