/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

const escapeCell = (value) => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");

async function main() {
  const outputFlag = process.argv.indexOf("--output");
  const output = outputFlag >= 0 ? process.argv[outputFlag + 1] : path.resolve("docs/recipe-review-queue.md");
  if (!output) throw new Error("Provide a file path after --output.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Administrator environment is unavailable.");

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db
    .from("recipe_library")
    .select("id, version, review_status, record")
    .eq("review_status", "pending_review")
    .order("id", { ascending: true });
  if (error) throw new Error(`Could not load pending recipe drafts: ${error.message}`);

  const rows = (data ?? []).map((row) => {
    const record = row.record && typeof row.record === "object" ? row.record : {};
    const ingredients = Array.isArray(record.ingredients) ? record.ingredients : [];
    const unreviewedIngredients = ingredients.filter((ingredient) => !ingredient?.reviewed).length;
    return {
      id: row.id,
      version: row.version,
      title: record.title ?? row.id,
      slots: Array.isArray(record.slots) ? record.slots.join(", ") : "",
      prep: record.readyInMinutes ?? "",
      ingredients: ingredients.map((ingredient) => ingredient?.name).filter(Boolean).join(", "),
      evidence: [
        record.source?.reviewed ? null : "source/rights",
        record.nutrition?.reviewed ? null : "nutrition",
        unreviewedIngredients ? `${unreviewedIngredients} ingredient(s)` : null,
        record.review?.reviewedBy ? null : "reviewer attribution",
      ].filter(Boolean).join(", "),
    };
  });

  const now = new Date().toISOString();
  const document = [
    "# Ovona recipe evidence review queue",
    "",
    `Generated: ${now}`,
    `Pending drafts: ${rows.length}`,
    "",
    "These recipes are **not approved**. Verify each recipe's original ownership/rights, ingredient quantity and taxonomy, declared allergens and cross-contact, cooking method, servings, preparation time, and nutrition evidence before approving a new immutable version.",
    "",
    "| Recipe | Slots | Prep | Ingredients | Evidence still required |",
    "| --- | --- | ---: | --- | --- |",
    ...rows.map((row) => `| ${escapeCell(`${row.title} (${row.id} v${row.version})`)} | ${escapeCell(row.slots)} | ${escapeCell(row.prep)} min | ${escapeCell(row.ingredients)} | ${escapeCell(row.evidence)} |`),
    "",
    "## Approval record requirements",
    "",
    "For an approval, record the responsible reviewer, ISO review timestamp, reviewed source/rights statement, nutrition method/reference, and reviewed ingredient/allergen evidence. Do not amend an approved version; issue a new version for any correction.",
  ].join("\n");
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, `${document}\n`);
  console.log(`Wrote ${rows.length} pending drafts to ${output}`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
