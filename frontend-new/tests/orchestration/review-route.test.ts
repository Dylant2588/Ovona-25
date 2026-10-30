import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { reviewedRecipe } from "./recipe-fixtures.ts";
import { calculatedRecipe } from "./calculated-recipe-fixtures.ts";
import * as nutrition from "../../lib/recipes/nutrition.ts";
import * as lifecycle from "../../lib/recipes/review-lifecycle.ts";
import { recipeRecordErrors } from "../../lib/recipes/repository.ts";
import * as imports from "../../lib/recipes/imports.ts";
import * as approval from "../../lib/recipes/approval.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript") as typeof import("typescript");
const attestations = { source: true, rights: true, ingredients: true, nutrition: true, cooked: true };
const actor = "00000000-0000-0000-0000-000000000001";
const pending = () => {
  const record = calculatedRecipe();
  record.review = { status: "pending_review", reviewedBy: null, reviewedAt: null };
  record.source.reviewed = false; record.nutrition.reviewed = false;
  record.ingredients.forEach((ingredient) => { ingredient.reviewed = false; });
  return record;
};
type Options = { status?: string; verified?: boolean; verificationError?: { status: number }; role?: string | null;
  serviceThrows?: boolean; rowMissing?: boolean; rpcError?: { code: string }; invalidDraft?: boolean; legacyDraft?: boolean; staleCalculation?: boolean };
type Route = { POST: (request: Request) => Promise<Response>; GET: (request: Request) => Promise<Response> };

function harness(options: Options = {}) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const draft = pending(); if (options.invalidDraft) draft.ingredients[0].name = "Mystery ingredient";
  if (options.legacyDraft) draft.nutrition = { ...reviewedRecipe().nutrition, reviewed: false };
  if (options.staleCalculation) draft.macros.protein += 1;
  const row = { id: draft.id, version: draft.version, record: draft, review_status: "pending_review" };
  let verified = false; let serviceReads = 0;
  const query = {
    select: () => query, eq: () => query,
    maybeSingle: async () => ({ data: options.rowMissing ? null : row, error: null }),
    order: async () => ({ data: [row], error: null }),
    insert: () => { throw Error("Unexpected direct insert"); },
    update: () => { throw Error("Unexpected direct update"); },
  };
  const service = { from: () => { assert.equal(verified, true); serviceReads++; return query; },
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: { ok: true, status: args.p_action === "approve" ? "approved" : "rejected", version: args.p_action === "approve" ? 2 : null }, error: options.rpcError ?? null };
    } };
  const compile = (relative: string, imports: Record<string, unknown>) => {
    const file = path.resolve(process.cwd(), relative);
    const result: { exports: Record<string, unknown> } = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText;
    new Function("require", "module", "exports", code)((name: string) => name in imports ? imports[name] : require(name), result, result.exports);
    return result.exports;
  };
  const reviewer = compile("lib/recipe-reviewer.ts", {});
  const access = compile("lib/recipes/reviewer-access.ts", {
    "@/lib/recipe-reviewer": { ...reviewer,
      recipeReviewerRole: async () => { assert.equal(verified, true); return options.role === undefined ? "reviewer" : options.role; },
      recipeReviewService: () => { assert.equal(verified, true); if (options.serviceThrows) throw Error("private credentials detail"); return service; },
    },
    "@/lib/serverAuth": { resolveRequestAuth: async () => ({ status: options.status ?? "authorized", user: { id: "untrusted-cookie-identity" }, accessToken: "test-token", supabase: { auth: {
      getUser: async () => { verified = true; return { data: { user: options.verified === false ? null : { id: actor } }, error: options.verificationError ?? null }; },
    } } }) },
  });
  const route = compile("app/api/recipe-review/route.ts", {
    "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    "@/lib/recipes/review-lifecycle": lifecycle,
    "@/lib/recipes/imports": imports,
    "@/lib/recipes/approval": approval,
    "@/lib/recipes/repository": { recipeRecordErrors },
    "@/lib/recipes/nutrition": nutrition,
    "@/lib/recipes/reviewer-access": access,
    "@/lib/recipe-reviewer": { ...reviewer,
      recipeReviewerRole: async () => { assert.equal(verified, true); return options.role === undefined ? "reviewer" : options.role; },
      recipeReviewService: () => { assert.equal(verified, true); if (options.serviceThrows) throw Error("private credentials detail"); return service; },
    },
    "@/lib/serverAuth": { resolveRequestAuth: async () => ({ status: options.status ?? "authorized",
      user: { id: "untrusted-cookie-identity" }, accessToken: "test-token", supabase: { auth: {
        getUser: async () => { verified = true; return { data: { user: options.verified === false ? null : { id: actor } }, error: options.verificationError ?? null }; },
      } },
    }) },
  }) as unknown as Route;
  const post = (body: unknown = { id: draft.id, version: 1, action: "approve", attestations }) =>
    route.POST(new Request("http://localhost/api/recipe-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  return { route, post, calls, row, serviceReads: () => serviceReads };
}

test("actual approval POST converts pending evidence and calls the atomic RPC once", async () => {
  const h = harness(); const response = await h.post();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, status: "approved", version: 2 });
  assert.equal(h.calls.length, 1); const call = h.calls[0];
  assert.equal(call.name, "review_recipe_version");
  assert.equal(call.args.p_actor, actor);
  assert.deepEqual(call.args.p_expected_pending, h.row.record);
  assert.equal((call.args.p_proposed_record as { version: number }).version, 2);
});

test("review route verifies identity and role before any privileged reads", async () => {
  for (const [options, expected] of [
    [{ status: "unauthorized" }, 401], [{ status: "transient" }, 503],
    [{ verified: false }, 401], [{ verificationError: { status: 503 } }, 503], [{ role: null }, 403],
  ] as Array<[Options, number]>) {
    const h = harness(options);
    assert.equal((await h.post()).status, expected); assert.equal(h.calls.length, 0); assert.equal(h.serviceReads(), 0);
    assert.equal((await h.route.GET(new Request("http://localhost/api/recipe-review"))).status, expected);
  }
});

test("actual POST rejects malformed JSON, unsupported actions and every missing attestation with zero writes", async () => {
  const h = harness();
  const malformed = await h.route.POST(new Request("http://localhost/api/recipe-review", { method: "POST", body: "{" }));
  assert.equal(malformed.status, 400);
  for (const body of [null, {}, { id: "x", version: 1, action: "publish" },
    { id: "x", version: 1, action: "approve", attestations: {} },
    { id: "x", version: 1, action: "approve", attestations, actor: "forged" }]) assert.equal((await h.post(body)).status, 400);
  for (const key of Object.keys(attestations)) {
    const flags: Record<string, unknown> = { ...attestations }; delete flags[key];
    assert.equal((await h.post({ id: "x", version: 1, action: "approve", attestations: flags })).status, 400);
  }
  assert.equal(h.calls.length, 0);
});

test("unknown ingredients cannot reach persistence and rejection needs no false approval", async () => {
  const invalid = harness({ invalidDraft: true });
  assert.equal((await invalid.post()).status, 400); assert.equal(invalid.calls.length, 0);
  const rejected = harness(); const response = await rejected.post({ id: rejected.row.id, version: 1, action: "reject" });
  assert.equal(response.status, 200); assert.equal(rejected.calls.length, 1);
  assert.equal(rejected.calls[0].args.p_proposed_record, null);
});

test("stale versions and unavailable persistence return safe non-success responses", async () => {
  for (const [options, expected] of [
    [{ rowMissing: true }, 409], [{ rpcError: { code: "P0002" } }, 409],
    [{ rpcError: { code: "23505" } }, 409], [{ rpcError: { code: "42501" } }, 403],
    [{ rpcError: { code: "PGRST202" } }, 503], [{ serviceThrows: true }, 503],
  ] as Array<[Options, number]>) assert.equal((await harness(options).post()).status, expected);
  const unavailable = harness({ serviceThrows: true });
  assert.equal((await unavailable.route.GET(new Request("http://localhost/api/recipe-review"))).status, 503);
});

test("actual GET returns pending review validation after verified access", async () => {
  const h = harness(); const response = await h.route.GET(new Request("http://localhost/api/recipe-review"));
  assert.equal(response.status, 200);
  const body = await response.json() as { recipes: Array<{ validationErrors: string[] }> };
  assert.equal(body.recipes.length, 1); assert.deepEqual(body.recipes[0].validationErrors, []);
});

test("unprepared legacy and stale calculated drafts never reach approval persistence", async () => {
  for (const options of [{ legacyDraft: true }, { staleCalculation: true }]) {
    const h = harness(options);
    const queue = await h.route.GET(new Request("http://localhost/api/recipe-review"));
    const body = await queue.json() as { recipes: Array<{ validationErrors: string[] }> };
    assert.ok(body.recipes[0].validationErrors.length);
    assert.equal((await h.post()).status, 400);
    assert.equal(h.calls.length, 0);
  }
  const legacy = harness({ legacyDraft: true });
  assert.equal((await legacy.post({ id: legacy.row.id, version: 1, action: "reject" })).status, 200);
});
