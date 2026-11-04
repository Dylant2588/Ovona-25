import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";
import { enforceMacros, toEnforcementInfo } from "../../lib/macro-enforcement.ts";
import { approvalFailure, MealApprovalError } from "../../lib/recipes/plan-boundary.ts";
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

test("actual swap endpoint forwards daily scope and preserves all non-target meals", async () => {
  const require = createRequire(import.meta.url); const ts = require("typescript");
  const day = { ...reviewedPlan(), scope: "day" as const, days: reviewedPlan().days.slice(0, 1) };
  const replacement = reviewedRecipe(); replacement.id = "replacement-reviewed"; replacement.title = "Replacement reviewed fixture";
  const next = structuredClone(day);
  next.days[0].meals.forEach(meal => { meal.baseId = replacement.id; meal.title = replacement.title; });
  let requested: { scope?: string; date?: string } | null = null;
  const deps: Record<string, unknown> = {
    crypto: require("node:crypto"),
    "next/server": { NextResponse: { json: (value: unknown, init?: ResponseInit) => Response.json(value, init) } },
    "@/lib/serverAuth": { resolveRequestAuth: async () => ({ user: { id: "user-1" }, supabase: {} }) },
    "@/lib/recipes/plan-boundary": { approvalFailure, MealApprovalError, approvePlanForUser: (_db: unknown, user: string, plan: typeof day) =>
      approvePlanForUser(recipeDatabase({ recipes: [reviewedRecipe(), replacement] }) as never, user, plan, undefined, { context: async () => ({ calorieTarget: 1650, proteinTarget: 120, mealsPerDay: 3 }) }) },
    "@/lib/generation/generate-plan": { generateWeeklyPlanWithArtifacts: async (_user: string, options: { scope?: string; date?: string }) => {
      requested = options; return { weeklyPlan: next, context: { calorieTarget: 1650, proteinTarget: 120 } };
    } },
    "@/lib/macro-enforcement": { enforceMacros, toEnforcementInfo },
  };
  const code = ts.transpileModule(fs.readFileSync("app/api/meal-plan/swap/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const routeModule = { exports: {} as { POST(request: Request): Promise<Response> } };
  new Function("require", "module", "exports", code)((id: string) => { assert.ok(id in deps, id); return deps[id]; }, routeModule, routeModule.exports);
  const response = await routeModule.exports.POST(new Request("http://localhost/api/meal-plan/swap", { method: "POST", body: JSON.stringify({ plan: day, dayIndex: 0, mealIndex: 0 }) }));
  assert.equal(response.status, 200); const result = await response.json();
  assert.equal((requested as { scope?: string } | null)?.scope, "day");
  assert.equal((requested as { date?: string } | null)?.date, day.weekStart);
  assert.equal(result.plan.days.length, 1); assert.equal(result.plan.days[0].meals[0].baseId, replacement.id);
  assert.deepEqual(result.plan.days[0].meals.slice(1), day.days[0].meals.slice(1));
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
