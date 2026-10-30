import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { parsePreferencePatch, savePreferencePatch, preferenceSaveFailure, preferencePrepLimitForSave } from "../../lib/preferences-persistence.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript") as { transpileModule(source: string, options: unknown): { outputText: string }; ModuleKind: { CommonJS: number }; ScriptTarget: { ES2022: number } };

function route(options: { authorised?: boolean; verified?: boolean; authThrows?: boolean; accessToken?: string; rpcError?: { code: string; message: string }; rpcData?: unknown } = {}) {
  const calls: Array<{ name: string; patch: unknown }> = [];
  const verifiedTokens: Array<string | undefined> = [];
  const database = {
    auth: { getUser: async (token?: string) => { verifiedTokens.push(token); return { data: { user: options.verified === false ? null : { id: "owner-a" } }, error: options.verified === false ? { status: 401 } : null }; } },
    rpc: async (name: string, args: { p_patch: unknown }) => { calls.push({ name, patch: args.p_patch }); return { data: options.rpcData ?? { ok: true, profileSaved: true, allergiesSynced: true }, error: options.rpcError ?? null }; },
    from: () => { throw new Error("Direct-write fallback is forbidden"); },
  };
  const source = fs.readFileSync(path.resolve("app/api/preferences/route.ts"), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const routeModule = { exports: {} as { POST(request: Request): Promise<Response> } };
  const localRequire = (id: string) => {
    if (id === "next/server") return { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } };
    if (id === "@/lib/preferences-persistence") return { parsePreferencePatch, savePreferencePatch, preferenceSaveFailure };
    if (id === "@/lib/serverAuth") return { resolveRequestAuth: async () => {
      if (options.authThrows) throw new Error("Auth is unavailable");
      return { supabase: database, user: options.authorised === false ? null : { id: "owner-a" }, session: null, accessToken: options.accessToken ?? null, status: options.authorised === false ? "unauthorized" : "authorized" };
    } };
    throw new Error(`Unexpected route dependency ${id}`);
  };
  new Function("require", "module", "exports", code)(localRequire, routeModule, routeModule.exports);
  return { post: (body: string) => routeModule.exports.POST(new Request("http://localhost/api/preferences", { method: "POST", body })), calls, verifiedTokens };
}

test("preference patches preserve omission and distinguish explicit empty replacements", () => {
  assert.deepEqual(parsePreferencePatch({}), {});
  const patch = parsePreferencePatch({ neverFoods: [], allergies: [], dietaryMode: "mixed", maxPrepMinutes: 30 });
  assert.deepEqual(patch, { never_foods: [], allergies: [], dietary_mode: null, max_prep_minutes: 30 });
  assert.equal(Object.hasOwn(parsePreferencePatch({ dislikes: [" Mushrooms "] }), "never_foods"), false);
});

test("preference patches reject malformed lists, unsafe keys and invalid preparation values", () => {
  for (const value of [null, [], { allergies: "milk" }, { allergies: [null] }, { maxPrepMinutes: null }, { maxPrepMinutes: -1 }, { maxPrepMinutes: 0 }, { maxPrepMinutes: 1.5 }, { maxPrepMinutes: Infinity }, { maxPrepMinutes: 241 }, { user_id: "victim" }, { profile: { id: "victim" } }, { dietaryMode: {} }, { goal: "__proto__" }, { mealComplexity: "constructor" }]) {
    assert.throws(() => parsePreferencePatch(value));
  }
});

test("onboarding profile, macros and taste fields survive normalisation without filling omitted fields", () => {
  assert.deepEqual(parsePreferencePatch({ goal: "build_muscle", mealComplexity: "simple", tastePreferences: ["Quick Minimal"], macroTargets: { calories: 1830, protein: 216 }, profile: { email: null, bodyWeightKg: 80, heightCm: 180, activityLevel: "light", notes: "meta" } }), {
    goal: "gain", meal_complexity: "simple", taste_preferences: ["quick minimal"], target_calories: 1830, target_protein: 216,
    profile: { email: null, body_weight_kg: 80, height_cm: 180, activity_level: "light", notes: "meta" },
  });
});

test("actual POST rejects invalid bodies and unverified identity before any RPC", async () => {
  for (const body of ["{", "null", "[]", JSON.stringify({ allergies: {} }), JSON.stringify({ maxPrepMinutes: null })]) {
    const handler = route(); const response = await handler.post(body);
    assert.equal(response.status, 400); assert.equal(handler.calls.length, 0);
  }
  for (const options of [{ authorised: false }, { verified: false }]) {
    const handler = route(options); const response = await handler.post("{}");
    assert.equal(response.status, 401); assert.equal(handler.calls.length, 0);
  }
  assert.equal((await route({ authThrows: true }).post("{}")).status, 503);
});

test("actual POST uses exactly one owner RPC and reports success only after complete persistence", async () => {
  const handler = route(); const response = await handler.post(JSON.stringify({ allergies: ["Dairy"], neverFoods: [], profile: { notes: "keep" } }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, profileSaved: true, allergiesSynced: true });
  assert.deepEqual(handler.calls, [{ name: "save_safety_preferences", patch: { allergies: ["dairy"], never_foods: [], profile: { notes: "keep" } } }]);
  const partial = route({ rpcData: { ok: true, profileSaved: false, allergiesSynced: true } });
  assert.equal((await partial.post("{}")).status, 500);
});

test("bearer fallback is verified with its explicit access token without a stored session", async () => {
  const handler = route({ accessToken: "synthetic-test-token" });
  assert.equal((await handler.post("{}")).status, 200);
  assert.deepEqual(handler.verifiedTokens, ["synthetic-test-token"]);
  assert.equal(handler.calls.length, 1);
});

test("the panel's standard limit saves as 30 minutes while explicit stricter limits survive", async () => {
  for (const [selected, expected] of [[null, 30], [10, 10], [15, 15], [45, 45]] as const) {
    const handler = route();
    const response = await handler.post(JSON.stringify({ maxPrepMinutes: preferencePrepLimitForSave(selected) }));
    assert.equal(response.status, 200);
    assert.deepEqual(handler.calls, [{ name: "save_safety_preferences", patch: { max_prep_minutes: expected } }]);
  }
});

test("missing RPC/schema fails explicitly without retrying reduced safety payloads", async () => {
  for (const code of ["PGRST202", "42883", "42703"]) {
    const handler = route({ rpcError: { code, message: "missing deployment contract" } });
    const response = await handler.post(JSON.stringify({ neverFoods: ["mushroom"], maxPrepMinutes: 15 }));
    assert.equal(response.status, 503);
    const body = await response.json(); assert.equal(body.error, "preferences_schema_unsupported"); assert.equal(body.ok, undefined); assert.match(body.message, /safety preferences/i);
    assert.equal(handler.calls.length, 1); assert.deepEqual(handler.calls[0].patch, { never_foods: ["mushroom"], max_prep_minutes: 15 });
  }
});

test("permission and transaction failures cannot report partial success or use direct writes", async () => {
  for (const code of ["42501", "23514"]) {
    const handler = route({ rpcError: { code, message: "sensitive database detail" } });
    const response = await handler.post("{}"); assert.equal(response.status, 500);
    const body = await response.json(); assert.equal(body.ok, undefined); assert.equal(JSON.stringify(body).includes("sensitive"), false); assert.equal(handler.calls.length, 1);
  }
});
