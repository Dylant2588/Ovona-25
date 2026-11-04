import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";
import * as revisions from "../../lib/plan-revisions.ts";
import * as scopes from "../../lib/plan-scope.ts";
import { writeApprovedPlan, approvalFailure } from "../../lib/recipes/plan-boundary.ts";
import { recipeDatabase } from "./reviewed-recipe-fixture.ts";
import { revisionRows, selectPlanRevision } from "../../lib/plan-revisions.ts";
import { reviewedPlan } from "./reviewed-recipe-fixture.ts";

test("revision selection isolates scope, never mixes rows and falls back to last complete commit", () => {
  const week = reviewedPlan(); const day = { ...week, scope: "day" as const, days: week.days.slice(0, 1), id: "daily" };
  const old = revisionRows(week, "user-1", "weekly", "2026-10-12");
  const current = revisionRows(day, "user-1", "daily", "2026-10-12");
  const incomplete = revisionRows(week, "user-1", "broken", "2026-10-12").slice(0, 6);
  assert.equal(selectPlanRevision([...incomplete, ...current, ...old], "user-1", "week", "2026-10-12")?.id, "weekly");
  assert.equal(selectPlanRevision([...incomplete, ...current, ...old], "user-1", "day", "2026-10-12")?.id, "daily");
  assert.equal(selectPlanRevision(old.slice(0, 1), "user-1", "day", "2026-10-12"), null);
  assert.equal(selectPlanRevision(current, "another", "day", "2026-10-12"), null);
  assert.equal(selectPlanRevision([...old.slice(0, 6), old[0]], "user-1", "week", "2026-10-12"), null);
});

test("actual daily state handlers commit complete revisions, reload and preserve old state on failed writes", async () => {
  const require = createRequire(import.meta.url);
  const ts = require("typescript");
  const history: unknown[] = revisionRows(reviewedPlan(), "user-1", "original-week", "2026-10-12");
  let failInsert = false; let writes = 0; let deletes = 0; let summaries = 0;
  const database = { from(table: string) {
    const filters: Array<[string, string]> = [];
    const query = {
      select: () => query, eq: (key: string, value: string) => { filters.push([key, value]); return query; }, order: () => query,
      range: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: history.filter(row => filters.every(([key, value]) => (row as Record<string, unknown>)[key] === value)), error: null }).then(resolve),
      insert: async (rows: unknown[]) => { writes++; if (failInsert) return { error: { message: "test unavailable" } }; history.unshift(...rows); return { error: null }; },
      delete: () => { deletes++; throw new Error("No delete is permitted"); },
      upsert: async () => { if (table === "meal_plans") summaries++; return { error: { message: "auxiliary unavailable" } }; },
    }; return query;
  } };
  const deps: Record<string, unknown> = {
    crypto: require("node:crypto"),
    "next/server": { NextResponse: { json: (value: unknown, init?: ResponseInit) => Response.json(value, init) } },
    "@/lib/serverAuth": { resolveRequestAuth: async () => ({ supabase: database, user: { id: "user-1" }, status: "authenticated" }) },
    "@/lib/recipes/plan-boundary": { approvalFailure, writeApprovedPlan: (_db: unknown, user: string, plan: Parameters<typeof writeApprovedPlan>[2], callback: Parameters<typeof writeApprovedPlan>[3]) => writeApprovedPlan(recipeDatabase() as never, user, plan, callback, undefined, { context: async () => ({ calorieTarget: 1650, proteinTarget: 120, mealsPerDay: 3 }) }) },
    "@/lib/generation/meal-storage": { recordAcceptedMealHistory: async () => { throw Error("auxiliary unavailable"); } },
    "@/lib/plan-scope": scopes, "@/lib/plan-revisions": revisions,
  };
  const code = ts.transpileModule(fs.readFileSync("app/api/meal-plan/state/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const routeModule = { exports: {} as { POST(request: Request): Promise<Response>; GET(request: unknown): Promise<Response> } };
  new Function("require", "module", "exports", code)((id: string) => { assert.ok(id in deps, id); return deps[id]; }, routeModule, routeModule.exports);
  const day = { ...reviewedPlan(), scope: "day" as const, days: reviewedPlan().days.slice(0, 1) };
  const post = (plan = day) => routeModule.exports.POST(new Request("http://localhost/api/meal-plan/state", { method: "POST", body: JSON.stringify({ plan }) }));
  const response = await post(); assert.equal(response.status, 200);
  const saved = await response.json(); assert.notEqual(saved.plan.id, day.id); assert.equal(saved.plan.scope, "day");
  assert.equal(saved.plan.weeklyTotals.calories, 1650); assert.deepEqual(saved.warnings, ["rotation_history_not_recorded"]);
  assert.equal(history.length, 8); assert.equal(summaries, 0); assert.equal(deletes, 0);
  const loadedResponse = await routeModule.exports.GET({ nextUrl: new URL("http://localhost/api/meal-plan/state?weekStart=2026-10-12&scope=day") });
  assert.equal(loadedResponse.status, 200); const loaded = await loadedResponse.json();
  assert.equal(loaded.plan.id, saved.plan.id); assert.deepEqual(loaded.plan.days[0].meals, saved.plan.days[0].meals);
  assert.equal(selectPlanRevision(history, "user-1", "week", "2026-10-12")?.id, "original-week");
  failInsert = true; assert.equal((await post()).status, 503); assert.equal(history.length, 8);
  assert.equal(selectPlanRevision(history, "user-1", "day", "2026-10-12")?.id, saved.plan.id);
  assert.equal((await post({ ...day, userId: "foreign" })).status, 422); assert.equal(writes, 2); assert.equal(deletes, 0);
});
