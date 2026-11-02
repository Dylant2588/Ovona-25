import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { WeeklyMealPlan, ShoppingListItem } from "../../lib/meal-generator.ts";
import { reviewedPlan } from "./reviewed-recipe-fixture.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const { load } = require("../../scripts/export-recipe-library.cjs") as { load(path: string): { buildShoppingList(plan: WeeklyMealPlan): ShoppingListItem[] } };
const { buildShoppingList } = load(fileURLToPath(new URL("../../lib/meal-generator.ts", import.meta.url)));
const week = "2026-10-12";
function plan(amount = 25) {
  const value = reviewedPlan(); value.userId = "owner-a";
  value.days.forEach(d => d.meals.forEach(m => { m.ingredients = [{ name: "Olives", amount, unit: "g", category: "Produce" }]; }));
  return value;
}
function rows(value = plan()) {
  return value.days.map(d => ({ plan_id: value.id, day_id: d.id, date: d.date, week_start: week, created_at: "2026-10-12T12:00:00Z", meals: d }));
}
function handler(history: unknown[], authorised = true) {
  const filters: Array<[string, unknown]> = []; let writes = 0;
  const db = { from: (table: string) => {
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { if (table === "plan_history") filters.push([key, value]); return query; },
      order: () => query, limit: () => query,
      maybeSingle: async () => ({ data: table === "plan_history" ? history.find((x: unknown) => (x as { day_id?: string }).day_id === "shopping-list") : { weekly_budget: 55 }, error: null }),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: table === "plan_history" ? history : [], error: null }).then(resolve),
      delete: () => { writes++; throw Error("Shopping cache writes are forbidden"); },
      insert: () => { writes++; throw Error("Shopping cache writes are forbidden"); },
    }; return query;
  } };
  const code = ts.transpileModule(fs.readFileSync("app/api/shopping-list/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const routeModule = { exports: {} as { GET(request: unknown): Promise<Response>; POST(request: unknown): Promise<Response> } };
  const deps: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (v: unknown, init?: ResponseInit) => Response.json(v, init) } },
    "@/lib/meal-generator": { WORKDAY_COUNT: 7, buildShoppingList },
    "@/lib/retailer-comparison": { compareRetailerBaskets: () => ({ status: "price_comparison_unavailable", claimable: false }) },
    "@/lib/serverAuth": { resolveRequestAuth: async () => ({ user: authorised ? { id: "owner-a" } : null, session: {}, supabase: db }) },
  };
  new Function("require", "module", "exports", code)((id: string) => {
    if (!(id in deps)) throw Error(`Unexpected dependency ${id}`); return deps[id];
  }, routeModule, routeModule.exports);
  return { get: () => routeModule.exports.GET({ nextUrl: new URL(`http://localhost/api/shopping-list?weekStart=${week}`) }),
    post: (body: unknown) => routeModule.exports.POST(new Request("http://localhost/api/shopping-list", { method: "POST", body: JSON.stringify(body) })), filters, writes: () => writes };
}

test("GET derives current quantities from complete saved meals and ignores stale cached shopping rows", async () => {
  for (const amount of [25, 50]) {
    const current = plan(amount); current.id = `new-plan-${amount}`;
    const h = handler([...rows(current), { plan_id: "old-plan", day_id: "shopping-list", meals: { items: [{ name: "Unexpected ingredient", quantity: 9999, unit: "g" }] } }]);
    const response = await h.get(); assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.planId, current.id);
    assert.equal(result.items.length, 1); assert.equal(result.items[0].quantity, amount * 21);
    assert.equal(result.items[0].name, "Olives");
    assert.ok(h.filters.some(([k, v]) => k === "user_id" && v === "owner-a"));
    assert.ok(h.filters.some(([k, v]) => k === "week_start" && v === week));
    assert.equal(h.writes(), 0);
  }
});

test("GET rejects incomplete, duplicated or malformed latest week rather than returning old cache", async () => {
  const complete = rows();
  for (const history of [complete.slice(0, 6), [...complete.slice(0, 6), complete[0]],
    [...complete.slice(0, 6).map(r => ({ ...r, plan_id: "new-incomplete" })), ...complete],
    complete.map((r, i) => i ? r : { ...r, meals: { meals: [{ ingredients: [{ name: "Olives", amount: -2, unit: "g" }] }] } })]) {
    const response = await handler(history).get(); assert.equal(response.status, 409);
  }
  assert.equal((await handler([]).get()).status, 404);
});

test("POST calculates final materialized quantities without any shopping-cache mutations", async () => {
  const h = handler([]);
  const current = plan(); current.days[0].meals[0].ingredients[0].amount = 12.5;
  const response = await h.post({ weekStart: week, plan: current }); assert.equal(response.status, 200);
  const result = await response.json(); assert.equal(result.items[0].quantity, 512.5);
  assert.equal(result.planId, current.id); assert.equal(h.writes(), 0);
});

test("POST rejects malformed weeks/ingredients and another owner's plan without writes", async () => {
  for (const body of [null, [], {}, { plan: {} }, { plan: { ...plan(), days: [] } }, { plan: { ...plan(), days: plan().days.slice(0, 6) } }, { weekStart: "2026-10-19", plan: plan() }]) {
    const h = handler([]); assert.equal((await h.post(body)).status, 400); assert.equal(h.writes(), 0);
  }
  const h = handler([]); assert.equal((await h.post({ plan: { ...plan(), userId: "other-owner" } })).status, 403);
  assert.equal(h.writes(), 0);
  const invalid = plan(); invalid.days[0].meals[0].ingredients[0].amount = -1;
  assert.equal((await h.post({ plan: invalid })).status, 400);
});

test("shopping endpoints preserve authentication checks", async () => {
  const h = handler(rows(), false);
  assert.equal((await h.get()).status, 401); assert.equal((await h.post({ plan: plan() })).status, 401); assert.equal(h.writes(), 0);
});

test("same-plan ingredient swaps remove olives on POST and subsequent persisted GET reload", async () => {
  const original = plan();
  const before = await handler(rows(original)).get();
  assert.equal((await before.json()).items[0].name, "Olives");
  const swapped = structuredClone(original);
  swapped.days.forEach(day => day.meals.forEach(meal => { meal.ingredients = [{ name: "Cucumber", amount: 50, unit: "g", category: "Produce" }]; }));
  assert.equal(swapped.id, original.id);
  const posted = await handler([]).post({ plan: swapped });
  const postBody = await posted.json(); assert.equal(posted.status, 200);
  assert.deepEqual(postBody.items.map((i: { name: string }) => i.name), ["Cucumber"]);
  assert.equal(postBody.items[0].quantity, 1050);
  const cache = { day_id: "shopping-list", plan_id: original.id, meals: { items: [{ name: "Olives", quantity: 525, unit: "g" }] } };
  const reloaded = await handler([...rows(swapped), cache]).get();
  const getBody = await reloaded.json();
  assert.equal(reloaded.status, 200); assert.deepEqual(getBody.items, postBody.items);
});

test("actual production shopping builder keeps very small positive final ingredient quantities", async () => {
  const current = plan();
  current.days.forEach(day => day.meals.forEach(meal => { meal.ingredients = [{ name: "Fine spice", amount: 0.00004, unit: "g", category: "Pantry" }]; }));
  const posted = await handler([]).post({ plan: current });
  const reloaded = await handler(rows(current)).get();
  const postBody = await posted.json(); const getBody = await reloaded.json();
  assert.equal(postBody.items[0].quantity, 0.00084);
  assert.deepEqual(getBody.items, postBody.items);
});
