import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import * as pendingImports from "../../lib/recipes/pending-import.ts";
import { calculatedRecipe } from "./calculated-recipe-fixtures.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript") as typeof import("typescript");
const pending = () => {
  const record = calculatedRecipe(); record.review = { status: "pending_review", reviewedBy: null, reviewedAt: null };
  record.source.reviewed = false; record.nutrition.reviewed = false; record.ingredients.forEach(i => { i.reviewed = false; });
  return record;
};
const compile = (file: string, modules: Record<string, unknown>) => {
  const compiled = { exports: {} as Record<string, unknown> };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", code)((name: string) => modules[name] ?? require(name), compiled, compiled.exports);
  return compiled.exports;
};
function harness(options: { authStatus?: number; rpcError?: string } = {}) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const reviewer = compile("lib/recipe-reviewer.ts", {});
  const ErrorClass = reviewer.ReviewPersistenceError as new (status: number, code: string, message: string) => Error;
  const route = compile("app/api/recipe-import/route.ts", {
    "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    "@/lib/recipe-reviewer": reviewer, "@/lib/recipes/pending-import": pendingImports,
    "@/lib/recipes/reviewer-access": { requireRecipeReviewer: async () => {
      if (options.authStatus) throw new ErrorClass(options.authStatus, "access_denied", "Access denied.");
      return { user: { id: "verified-reviewer" }, service: { rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args }); return { data: { ok: true, imported: (args.p_records as unknown[]).length }, error: options.rpcError ? { code: options.rpcError } : null };
      } } };
    } },
  }) as unknown as { POST: (request: Request) => Promise<Response> };
  return { calls, route, post: (body: unknown) => route.POST(new Request("http://127.0.0.1/api/recipe-import", { method: "POST", body: JSON.stringify(body) })) };
}

test("pending batch parser rejects invalid, pre-attested, legacy and duplicate identities", () => {
  assert.equal(pendingImports.parsePendingImportBatch([pending()], "reviewer").ok, true);
  const legacy = pending(); legacy.nutrition.method = "measured";
  for (const invalid of [[null], [undefined], [{ source: null }], [], [pending(), pending()], [legacy], [calculatedRecipe()], Array(51).fill(pending()), { records: [pending()], actor: "forged" }]) {
    assert.equal(pendingImports.parsePendingImportBatch(invalid, "reviewer").ok, false);
  }
});

test("import endpoint restricts origin scheme and exact path without credential forwarding", () => {
  assert.equal(pendingImports.pendingImportEndpoint("http://127.0.0.1:3004/api/recipe-import"), "http://127.0.0.1:3004/api/recipe-import");
  assert.equal(pendingImports.pendingImportEndpoint("https://example.test/api/recipe-import"), "https://example.test/api/recipe-import");
  for (const url of ["http://example.test/api/recipe-import", "https://user:password@example.test/api/recipe-import", "https://example.test/api/recipe-import?token=x", "https://example.test/api/recipe-import#x", "http://127.0.0.1/other", "file:///api/recipe-import"]) assert.throws(() => pendingImports.pendingImportEndpoint(url));
});

test("actual import route uses verified actor and one atomic RPC after complete validation", async () => {
  const h = harness(); const record = pending(); const response = await h.post([record]);
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true, imported: 1 });
  assert.deepEqual(h.calls, [{ name: "import_pending_recipe_batch", args: { p_records: [record], p_actor: "verified-reviewer" } }]);
  for (const body of [[null], [{ source: null }], [pending(), pending()], { records: [record], actor: "spoofed" }]) {
    const invalid = harness(); assert.equal((await invalid.post(body)).status, 400); assert.equal(invalid.calls.length, 0);
  }
  for (const status of [401, 403, 503]) { const denied = harness({ authStatus: status }); assert.equal((await denied.post([record])).status, status); assert.equal(denied.calls.length, 0); }
  assert.equal((await harness({ rpcError: "23505" }).post([record])).status, 409);
});

test("actual byte bound cancels chunked body without trusting a content-length header", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(pendingImports.MAX_PENDING_IMPORT_BYTES)); controller.enqueue(new Uint8Array(1)); }, cancel() { cancelled = true; } });
  const request = new Request("http://127.0.0.1/api/recipe-import", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  const h = harness(); assert.equal((await h.route.POST(request)).status, 413); assert.equal(cancelled, true); assert.equal(h.calls.length, 0);
  const badJson = new Request("http://127.0.0.1/api/recipe-import", { method: "POST", body: "{" });
  assert.equal((await harness().route.POST(badJson)).status, 400);
});
