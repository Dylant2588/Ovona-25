/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { load } = require("./export-recipe-library.cjs");
async function main() {
  if (process.argv.includes("--apply")) throw new Error("CLI approval writes are disabled. Use /review-recipes with an authorised reviewer, all five attestations and the atomic new-version workflow.");
  const file = process.argv.find((arg, index) => index > 1 && !arg.startsWith("--"));
  if (!file) throw new Error("Supply one manually reviewed recipe JSON file");
  const record = JSON.parse(fs.readFileSync(file, "utf8"));
  const { newApprovalNutritionErrors } = load(path.join(__dirname, "../lib/recipes/nutrition.ts"));
  const nutritionErrors = newApprovalNutritionErrors(record);
  if (nutritionErrors.length) throw new Error(`Calculated nutrition rejected: ${nutritionErrors.join("; ")}`);
  const { approveRecipe } = load(path.join(__dirname, "../lib/recipes/approval.ts"));
  const checked = approveRecipe(record, {});
  if (!checked.approved) throw new Error(`Review evidence rejected: ${checked.reasons.map(reason => reason.code).join(", ")}`);
  console.log(`Dry run: calculated review evidence accepted for ${record.id} v${record.version}; no writes. Actual approvals use /review-recipes.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
