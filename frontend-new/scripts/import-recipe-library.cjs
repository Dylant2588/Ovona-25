/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const { createClient } = require("@supabase/supabase-js");
const { exportRecords } = require("./export-recipe-library.cjs");
async function main() {
  const file = process.argv.find((arg, index) => index > 1 && !arg.startsWith("--"));
  const records = file ? JSON.parse(fs.readFileSync(file, "utf8")) : exportRecords();
  if (!Array.isArray(records) || records.some(record => record.review?.status !== "pending_review" || record.review?.reviewedBy || record.review?.reviewedAt || record.ingredients?.some(i => i.reviewed))) throw new Error("Import accepts pending, unreviewed drafts only; approval requires the separate review workflow");
  if (!process.argv.includes("--apply")) { console.log(`Dry run: ${records.length} pending recipe drafts; no database writes`); return; }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Administrator environment is unavailable");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const rows = records.map(record => ({ id: record.id, version: record.version, record, review_status: "pending_review" }));
  const { error } = await db.from("recipe_library").upsert(rows, { onConflict: "id,version", ignoreDuplicates: true });
  if (error) throw new Error("Recipe import failed; verify migration and administrator connection");
  console.log(`Imported up to ${rows.length} new pending drafts; existing records preserved`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
