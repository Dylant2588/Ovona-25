/* eslint-disable @typescript-eslint/no-require-imports */
// Repairs only pending, internal Ovona drafts from the local catalogue. It
// never changes a reviewed recipe or grants approval.
const { createClient } = require("@supabase/supabase-js");
const { exportRecords } = require("./export-recipe-library.cjs");

async function main() {
  if (!process.argv.includes("--apply")) {
    console.log("Dry run. Re-run with --apply to repair pending draft methods.");
    return;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Administrator environment is unavailable");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.from("recipe_library").select("id, version, record").eq("review_status", "pending_review");
  if (error) throw error;
  const catalogue = new Map(exportRecords().map((record) => [`${record.id}:${record.version}`, record]));
  let repaired = 0;
  for (const row of data ?? []) {
    const existing = row.record ?? {};
    if (Array.isArray(existing.steps) && existing.steps.length) continue;
    const replacement = catalogue.get(`${row.id}:${row.version}`);
    if (!replacement?.steps?.length) continue;
    const { error: updateError } = await db.from("recipe_library").update({ record: replacement }).eq("id", row.id).eq("version", row.version).eq("review_status", "pending_review");
    if (updateError) throw updateError;
    repaired += 1;
  }
  console.log(`Repaired ${repaired} pending draft method(s).`);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
