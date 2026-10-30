import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:http";
import { calculatedRecipe } from "./calculated-recipe-fixtures.ts";
import { reviewedRecipe } from "./recipe-fixtures.ts";

const pending = () => {
  const recipe = calculatedRecipe();
  recipe.review = { status: "pending_review", reviewedBy: null, reviewedAt: null };
  recipe.source.reviewed = false; recipe.nutrition.reviewed = false;
  recipe.ingredients.forEach(ingredient => { ingredient.reviewed = false; });
  return recipe;
};
const run = (script: string, value: unknown, apply = false, extraEnvironment: Record<string, string> = {}) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ovona-cli-boundary-"));
  try {
    const file = path.join(directory, "recipes.json"); fs.writeFileSync(file, JSON.stringify(value));
    const env: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/SUPABASE|OPENAI|OVONA_RECIPE_IMPORT/i.test(key))), NODE_ENV: process.env.NODE_ENV ?? "test", ...extraEnvironment };
    const child = spawnSync(process.execPath, [path.resolve("scripts", script), file, ...(apply ? ["--apply"] : [])], { encoding: "utf8", env, timeout: 10_000, windowsHide: true });
    assert.equal(child.error, undefined);
    return { status: child.status, output: `${child.stdout}${child.stderr}` };
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
};

test("review CLI checks calculated evidence but can never perform direct approval writes", () => {
  const good = run("review-recipe-library.cjs", calculatedRecipe());
  assert.equal(good.status, 0); assert.match(good.output, /no writes/);
  for (const record of [calculatedRecipe(), pending(), reviewedRecipe()]) {
    const applied = run("review-recipe-library.cjs", record, true);
    assert.equal(applied.status, 1); assert.match(applied.output, /Use \/review-recipes/);
    assert.doesNotMatch(applied.output, /Administrator environment/);
  }
  const stale = calculatedRecipe(); stale.macros.protein += 1;
  assert.equal(run("review-recipe-library.cjs", stale).status, 1);
  assert.equal(run("review-recipe-library.cjs", reviewedRecipe()).status, 1);
});

test("import CLI never prints malformed bearer token values", () => {
  const token = "synthetic-secret\ninvalid";
  const result = run("import-recipe-library.cjs", [pending()], true, { OVONA_RECIPE_IMPORT_ENDPOINT: "http://127.0.0.1:65534/api/recipe-import", OVONA_RECIPE_IMPORT_TOKEN: token });
  assert.equal(result.status, 1); assert.match(result.output, /without whitespace or control/);
  assert.doesNotMatch(result.output, /synthetic-secret|invalid header value/);
});

test("import CLI refuses redirects without forwarding bearer credentials or recipe payload", async () => {
  let redirectedRequests = 0; let importRequests = 0;
  const server = createServer((request, response) => {
    if (request.url === "/capture") { redirectedRequests += 1; response.end("must not reach"); return; }
    importRequests += 1; response.writeHead(307, { location: "/capture" }); response.end();
  });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ovona-import-redirect-"));
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const file = path.join(directory, "recipes.json"); fs.writeFileSync(file, JSON.stringify([pending()]));
    const env: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/SUPABASE|OPENAI|OVONA_RECIPE_IMPORT/i.test(key))), NODE_ENV: "test", OVONA_RECIPE_IMPORT_ENDPOINT: `http://127.0.0.1:${address.port}/api/recipe-import`, OVONA_RECIPE_IMPORT_TOKEN: "synthetic-local-token" };
    let stderr = "";
    await assert.rejects(promisify(execFile)(process.execPath, [path.resolve("scripts/import-recipe-library.cjs"), file, "--apply"], { env, encoding: "utf8", timeout: 10_000, windowsHide: true }), (error: unknown) => { stderr = (error as { stderr?: string }).stderr ?? ""; return true; });
    assert.equal(importRequests, 1, stderr); assert.equal(redirectedRequests, 0);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); fs.rmSync(directory, { recursive: true, force: true }); }
});

test("import CLI validates entire pending batch with shared evidence and never opens old unaudited apply path", () => {
  assert.equal(run("import-recipe-library.cjs", [pending()]).status, 0);
  const preAttested = pending(); preAttested.nutrition.reviewed = true;
  const stale = pending(); stale.ingredients[0].amount += 1;
  for (const record of [preAttested, stale, { source: null }, null]) {
    const result = run("import-recipe-library.cjs", [pending(), record]);
    assert.equal(result.status, 1); assert.match(result.output, /rejected/);
  }
  const applied = run("import-recipe-library.cjs", [pending()], true);
  assert.equal(applied.status, 1); assert.match(applied.output, /explicit OVONA_RECIPE_IMPORT_ENDPOINT/);
  assert.match(applied.output, /No database connection/);
});
