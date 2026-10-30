/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { exportRecords, load } = require("./export-recipe-library.cjs");
async function main() {
  const file = process.argv.find((arg, index) => index > 1 && !arg.startsWith("--"));
  const records = file ? JSON.parse(fs.readFileSync(file, "utf8")) : exportRecords();
  if (!Array.isArray(records) || !records.length || records.length > 5000) throw new Error("Supply 1–5000 pending recipe drafts.");
  const { createPendingRecipeImport } = load(path.join(__dirname, "../lib/recipes/imports.ts"));
  const errors = records.flatMap((record, index) => {
    const result = createPendingRecipeImport({ record, sourceReference: record?.source?.reference ?? "",
      payloadHash: `sha256:${createHash("sha256").update(JSON.stringify(record)).digest("hex")}`,
      importedBy: "local-dry-run-only-not-an-importer" });
    return result.ok ? [] : result.errors.map(error => `Recipe ${index + 1}: ${error}`);
  });
  if (errors.length) throw new Error(`Import evidence rejected: ${errors.join("; ")}`);
  if (process.argv.includes("--apply")) {
    const { pendingImportEndpoint, parsePendingImportBatch } = load(path.join(__dirname, "../lib/recipes/pending-import.ts"));
    const endpoint = process.env.OVONA_RECIPE_IMPORT_ENDPOINT;
    const token = process.env.OVONA_RECIPE_IMPORT_TOKEN;
    if (!endpoint || !token) throw new Error("Set explicit OVONA_RECIPE_IMPORT_ENDPOINT and OVONA_RECIPE_IMPORT_TOKEN for the authenticated atomic import endpoint. No database connection was made.");
    if (/\s/.test(token) || [...token].some(character => character.charCodeAt(0) < 33 || character.charCodeAt(0) === 127)) throw new Error("OVONA_RECIPE_IMPORT_TOKEN must be a single nonempty bearer token without whitespace or control characters.");
    const target = pendingImportEndpoint(endpoint);
    const checked = parsePendingImportBatch(records, "verified-by-server-not-client");
    if (!checked.ok) throw new Error(`Calculated import rejected: ${checked.errors.join("; ")}`);
    let response;
    try { response = await fetch(target, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(checked.records), redirect: "error" }); }
    catch { throw new Error("Atomic import transport failed. No import confirmation was received; refresh /review-recipes before retrying."); }
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.ok !== true || body.imported !== records.length) throw new Error(`Atomic import was not confirmed (HTTP ${response.status}). Refresh /review-recipes before retrying.`);
    console.log(`Imported ${body.imported} pending calculated recipes with atomic audit evidence. Complete actual review at /review-recipes.`);
    return;
  }
  console.log(`Dry run: ${records.length} structurally valid pending recipe drafts; no database writes or importer attribution created. Legacy nutrition still requires preparation before approval.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
