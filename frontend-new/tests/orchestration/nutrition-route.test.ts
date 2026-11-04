import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";
import { reviewedPlan, recipeDatabase } from "./reviewed-recipe-fixture.ts";
import { approvePlanForUser, approvalFailure, MealApprovalError } from "../../lib/recipes/plan-boundary.ts";
import { loadServerConstraints } from "../../lib/recipes/server-constraints.ts";
import { loadReviewedRecipes } from "../../lib/recipes/repository.ts";
import { buildPlanNutritionSummary } from "../../lib/recipes/plan-nutrition.ts";

const require = createRequire(import.meta.url); const ts = require("typescript");
function handler(authorised = true, allergy?: string) {
  const database = recipeDatabase({ allergy }); let constraintReads = 0; let recipeReads = 0;
  const routeModule = { exports: {} as { POST(request: Request): Promise<Response> } };
  const deps: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (value: unknown, init?: ResponseInit) => Response.json(value, init) } },
    "@/lib/serverAuth": { resolveRequestAuth: async () => ({ user: authorised ? { id: "user-1" } : null, supabase: database }) },
    "@/lib/recipes/server-constraints": { loadServerConstraints: async () => { constraintReads++; return loadServerConstraints(database, "user-1"); } },
    "@/lib/recipes/repository": { loadReviewedRecipes: async () => { recipeReads++; return loadReviewedRecipes(database); } },
    "@/lib/recipes/plan-boundary": { approvalFailure, MealApprovalError, approvePlanForUser: async (_db: unknown, user: string, plan: ReturnType<typeof reviewedPlan>, _preferences: unknown, options: object) => approvePlanForUser(database, user, plan, undefined, { ...options, context: async () => ({ calorieTarget: 1650, proteinTarget: 120, mealsPerDay: 3 }) }) },
    "@/lib/recipes/plan-nutrition": { buildPlanNutritionSummary },
    "@/lib/recipes/display-nutrition-mappings": { DISPLAY_NUTRITION_MAPPINGS: [] },
  };
  const code = ts.transpileModule(fs.readFileSync("app/api/meal-plan/nutrition/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", code)((name: string) => { if (!(name in deps)) throw Error(name); return deps[name]; }, routeModule, routeModule.exports);
  return { post: (body: unknown) => routeModule.exports.POST(new Request("http://localhost/api/meal-plan/nutrition", { method: "POST", body: JSON.stringify(body) })), reads: () => [constraintReads, recipeReads] };
}

test("nutrition route uses actual reviewed approval and one source snapshot without writes", async () => {
  const h = handler(); const plan = reviewedPlan(); plan.scope = "day"; plan.days = [plan.days[0]];
  const response = await h.post({ plan }); assert.equal(response.status, 200);
  const body = await response.json(); assert.equal(body.planId, plan.id); assert.equal(body.days.length, 1);
  assert.deepEqual(body.days[0].macros, plan.days[0].totals); assert.equal(body.days[0].micronutrients.calcium_mg.status, "unknown");
  assert.deepEqual(h.reads(), [1, 1]);
  const forged = structuredClone(plan); forged.days[0].meals[0].ingredients[0].amount = 999;
  assert.equal((await h.post({ plan: forged })).status, 422);
  assert.equal((await h.post({ plan: { ...plan, userId: "victim" } })).status, 422);
  assert.equal((await handler(true, "soy").post({ plan })).status, 200);
  const excluded = structuredClone(plan); excluded.days[0].meals[0].recipeVersion = 999;
  assert.equal((await h.post({ plan: excluded })).status, 422);
  assert.equal((await handler(false).post({ plan })).status, 401);
  assert.equal((await h.post({})).status, 400);
});
