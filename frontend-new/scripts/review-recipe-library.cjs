/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");
const { load } = require("./export-recipe-library.cjs");
async function main() {
  const file = process.argv.find((arg, index) => index > 1 && !arg.startsWith("--"));
  if (!file) throw new Error("Supply one manually reviewed recipe JSON file");
  const record = JSON.parse(fs.readFileSync(file, "utf8"));
  const { approveRecipe } = load(path.join(__dirname, "../lib/recipes/approval.ts"));
  const checked = approveRecipe(record, {});
  if (!checked.approved) throw new Error(`Review evidence rejected: ${checked.reasons.map(reason => reason.code).join(", ")}`);
  if (!process.argv.includes("--apply")) { console.log(`Dry run: review evidence accepted for ${record.id} v${record.version}; no writes`); return; }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Administrator environment is unavailable");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error: lookupError } = await db.from("recipe_library").select("review_status").eq("id", record.id).eq("version", record.version).single();
  if (lookupError || !data || data.review_status === "approved") throw new Error("Review requires an existing pending/rejected version; approved versions are immutable, create a new version");
  const { error } = await db.from("recipe_library").update({ record, review_status: "approved", updated_at: new Date().toISOString() }).eq("id", record.id).eq("version", record.version).neq("review_status", "approved");
  if (error) throw new Error("Review write failed");
  console.log(`Reviewed recipe saved: ${record.id} v${record.version}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
