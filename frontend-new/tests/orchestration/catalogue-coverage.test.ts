import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { recipesToCandidates } from "../../lib/recipes/candidates.ts";
import { reportCatalogueCoverage, DEFAULT_COVERAGE_COHORTS, type CoverageCohort } from "../../lib/recipes/catalogue-coverage.ts";
import { reviewedRecipe } from "./recipe-fixtures.ts";
import { calculatedRecipe } from "./calculated-recipe-fixtures.ts";

const cohort: CoverageCohort = { id: "synthetic-breakfast-probe", calorieTarget: 800, proteinTarget: 40, dietaryMode: "mixed", allergies: [], maxPrepMinutes: 30, slots: ["breakfast"] };
// Deliberately synthetic attested macros, not composition data or real coverage.
const legacyCatalogue = () => Array.from({ length: 7 }, (_, index) => {
  const recipe = reviewedRecipe(); recipe.id = `synthetic-${index}`; recipe.title = `Synthetic breakfast ${index}`;
  recipe.slots = ["breakfast"]; recipe.macros = { calories: 800, protein: 40, carbs: 80, fat: 30 };
  return recipe;
});

test("shared mapping preserves batch division, allergens, tags and metadata exactly", () => {
  const recipe = reviewedRecipe(); recipe.ingredients[0].mayContain = ["milk"];
  const [candidate] = recipesToCandidates([recipe], { dietaryModes: ["mixed"] });
  assert.deepEqual(candidate, { id: "reviewed-chicken:lunch", recipeId: recipe.id, recipeVersion: recipe.version, slot: "lunch", title: recipe.title, verified: true,
    ingredients: [{ name: "Chicken breast", normalizedName: "chicken", quantity: 200, unit: "g", pantry: false }, { name: "Spinach", normalizedName: "spinach", quantity: 100, unit: "g", pantry: false }],
    allergens: ["milk"], dietaryTags: ["mixed"], nutrition: recipe.macros, cost: 0, prepMinutes: 20, servings: 1, similarityKey: recipe.id, proteinType: "poultry", proteinFamilies: ["chicken"], format: "lunch" });
});

test("actual seven-day scheduling succeeds in compatibility mode without claiming calculated coverage", () => {
  const records = legacyCatalogue();
  const first = reportCatalogueCoverage(records, [cohort]);
  assert.deepEqual(first, reportCatalogueCoverage(records, [cohort]));
  assert.equal(first.catalogue.approvedLegacy, 7);
  assert.equal(first.cohorts[0].legacyCompatible.status, "feasible");
  assert.equal(first.cohorts[0].legacyCompatible.plan?.days.length, 7);
  assert.equal(first.cohorts[0].calculatedOnly.status, "not_feasible");
});

test("explicit daily coverage uses one complete day and preserves legacy weekly default", () => {
  const record = legacyCatalogue()[0];
  const daily = { ...cohort, scope: "day" as const };
  const report = reportCatalogueCoverage([record], [daily]);
  assert.equal(report.cohorts[0].legacyCompatible.status, "feasible");
  assert.equal(report.cohorts[0].legacyCompatible.plan?.days.length, 1);
  assert.equal(report.cohorts[0].dayCount, 1);
  assert.equal(report.cohorts[0].slots.breakfast.periodDemand, 1);
  assert.notEqual(reportCatalogueCoverage([record], [cohort]).cohorts[0].legacyCompatible.status, "feasible");
  assert.equal(report.cohorts[0].calculatedOnly.status, "not_feasible");
});

test("turkey never-food is hard while turkey avoidance stays a soft ranking preference", () => {
  const turkey = legacyCatalogue()[0];
  turkey.ingredients[0] = { ...turkey.ingredients[0], name: "Turkey breast", canonicalId: "turkey" };
  const daily = { ...cohort, scope: "day" as const };
  const hard = reportCatalogueCoverage([turkey], [{ ...daily, neverFoods: ["turkey"] }]);
  assert.equal(hard.cohorts[0].legacyCompatible.admittedRecipes, 0);
  assert.ok(hard.cohorts[0].rejectionReasons.never_food_conflict > 0);
  const soft = reportCatalogueCoverage([turkey], [{ ...daily, dislikes: ["turkey"] }]);
  assert.equal(soft.cohorts[0].legacyCompatible.status, "feasible");
  for (const invalid of [{ scope: "month" }, { neverFoods: "turkey" }, { dislikes: [""] }]) {
    assert.throws(() => reportCatalogueCoverage([], [{ ...daily, ...invalid } as CoverageCohort]));
  }
});

test("synthetic owner-shaped five-slot daily fixture respects restrictions and serving division", () => {
  const definitions = [["breakfast", "Pea protein", "unreviewed_pea_protein", []], ["snack", "Chicken breast", "chicken", ["meat"]],
    ["lunch", "Tofu", "tofu", []], ["snack", "Pea protein", "unreviewed_pea_protein", []], ["dinner", "Chicken breast", "chicken", ["meat"]]] as const;
  const records = definitions.map(([slot, name, canonicalId, flags], index) => {
    const recipe = reviewedRecipe(); recipe.id = `synthetic-owner-${index}`; recipe.slots = [slot];
    recipe.macros = { calories: 366, protein: 43.2, carbs: 30, fat: 10 };
    recipe.ingredients[0] = { ...recipe.ingredients[0], name, canonicalId, allergens: canonicalId === "tofu" ? ["soy"] : [], dietaryFlags: [...flags] };
    return recipe;
  });
  const owner = { id: "synthetic-owner", scope: "day" as const, calorieTarget: 1830, proteinTarget: 216, dietaryMode: "mixed", allergies: ["Dairy", "Nuts", "Fish", "Shellfish", "Eggs", "Sesame"], neverFoods: ["egg", "turkey"], dislikes: ["turkey"], maxPrepMinutes: 30, slots: ["breakfast", "snack", "lunch", "snack", "dinner"] as CoverageCohort["slots"] };
  const report = reportCatalogueCoverage(records, [owner]);
  assert.equal(report.cohorts[0].legacyCompatible.status, "feasible");
  const meals = report.cohorts[0].legacyCompatible.plan!.days[0].meals;
  assert.equal(meals.length, 5); assert.equal(report.cohorts[0].slots.snack.periodDemand, 2);
  assert.ok(meals.every(meal => meal.ingredients[0].quantity === 200));
  assert.equal(reportCatalogueCoverage(records, [{ ...owner, neverFoods: ["chicken", "tofu", "pea protein"] }]).cohorts[0].legacyCompatible.status, "not_feasible");
});

test("slot counts never claim macro feasibility and repeated snack demand counts twice", () => {
  const records = legacyCatalogue().map(recipe => ({ ...recipe, slots: ["breakfast", "lunch", "dinner", "snack"] as const, macros: { calories: 10, protein: 1, carbs: 1, fat: 0 } }));
  const five = { ...cohort, id: "five", slots: ["breakfast", "snack", "lunch", "snack", "dinner"] as CoverageCohort["slots"] };
  const report = reportCatalogueCoverage(records, [five]);
  assert.equal(report.cohorts[0].slots.snack.weeklyDemand, 14);
  assert.equal(report.cohorts[0].slots.snack.uniqueRecipes, 7);
  assert.equal(report.cohorts[0].legacyCompatible.status, "not_feasible");
  assert.equal(report.cohorts[0].legacyCompatible.plan, undefined);
});

test("classifies pending, calculated, malformed and duplicate versions without inflated identities", () => {
  const calculated = calculatedRecipe(); const pending = reviewedRecipe(); pending.id = "pending"; pending.review.status = "pending_review";
  const otherVersion = { ...calculated, version: 2 };
  const report = reportCatalogueCoverage([calculated, otherVersion, pending, {}], [cohort]);
  assert.equal(report.catalogue.uniqueRecipeIds, 2);
  assert.equal(report.catalogue.approvedCalculated, 2);
  assert.equal(report.catalogue.pending, 1); assert.equal(report.catalogue.malformed, 1);
  assert.deepEqual(report.catalogue.multipleApprovedVersions, [calculated.id]);
});

test("hard restrictions remain exclusions and vegan structural policy is explicit", () => {
  const records = legacyCatalogue(); records[0].ingredients[0].mayContain = ["milk"];
  const report = reportCatalogueCoverage(records, [{ ...cohort, allergies: ["Dairy"], maxPrepMinutes: 15 }, { ...cohort, id: "vegan", dietaryMode: "vegan", slots: ["breakfast", "lunch", "dinner"] }]);
  assert.equal(report.cohorts[0].legacyCompatible.admittedRecipes, 0);
  assert.ok(report.cohorts[0].rejectionReasons.prep_time_conflict > 0);
  assert.ok(report.cohorts[0].rejectionReasons.allergy_conflict > 0);
  assert.ok(report.cohorts[1].policyGaps.some(gap => gap.includes("plant")));
});

test("invalid cohorts are rejected rather than normalized into different probes", () => {
  assert.throws(() => reportCatalogueCoverage([], [{ ...cohort, slots: ["unknown"] } as unknown as CoverageCohort]), /slot/i);
  assert.throws(() => reportCatalogueCoverage([], [{ ...cohort, dietaryMode: "mystery" }]), /diet/i);
  assert.throws(() => reportCatalogueCoverage([], [{ ...cohort, allergies: ["unknown allergy"] }]), /allerg/i);
  assert.equal(DEFAULT_COVERAGE_COHORTS.length, 7);
});

test("bounded diagnostic never calls a search-budget rejection proven infeasible", () => {
  const records = Array.from({ length: 12 }, (_, index) => ({ ...legacyCatalogue()[0], id: `wide-${index}`, slots: ["breakfast", "lunch", "dinner", "snack"] }));
  const report = reportCatalogueCoverage(records, [{ ...cohort, slots: ["breakfast", "snack", "lunch", "snack", "dinner"] }]);
  assert.equal(report.cohorts[0].legacyCompatible.status, "indeterminate");
  assert.match(report.cohorts[0].legacyCompatible.reason!, /budget/);
});

test("a broad daily catalogue runs the production search instead of the weekly combination guard", () => {
  const ingredients = [["Chicken breast", "chicken", ["meat"]], ["Tofu", "tofu", []], ["Pea protein", "unreviewed_pea_protein", []]] as const;
  const records = Array.from({ length: 12 }, (_, index) => {
    const recipe = reviewedRecipe(); const [name, canonicalId, flags] = ingredients[index % ingredients.length];
    recipe.id = `synthetic-wide-${index}`; recipe.slots = ["breakfast", "lunch", "dinner", "snack"];
    recipe.macros = { calories: 160, protein: 8, carbs: 20, fat: 5 };
    recipe.ingredients[0] = { ...recipe.ingredients[0], name, canonicalId, allergens: canonicalId === "tofu" ? ["soy"] : [], dietaryFlags: [...flags] };
    return recipe;
  });
  const report = reportCatalogueCoverage(records, [{ ...cohort, scope: "day", slots: ["breakfast", "snack", "lunch", "snack", "dinner"] }]);
  assert.equal(report.cohorts[0].legacyCompatible.status, "feasible");
});

test("malformed approved rows block readiness just as the production loader does", () => {
  const broken = { ...reviewedRecipe(), ingredients: [] };
  const result = reportCatalogueCoverage([...legacyCatalogue(), broken], [cohort]);
  assert.equal(result.catalogue.malformedApproved, 1);
  assert.equal(result.cohorts[0].legacyCompatible.status, "not_feasible");
  assert.match(result.cohorts[0].legacyCompatible.reason!, /invalid_recipe_library/);
});

test("file-only CLI is deterministic, rejects bad input and never overwrites inputs", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "ovona-coverage-"));
  try {
    const input = path.join(folder, "recipes.json"); const cohorts = path.join(folder, "cohorts.json");
    fs.writeFileSync(input, JSON.stringify(legacyCatalogue())); fs.writeFileSync(cohorts, JSON.stringify([cohort]));
    const before = fs.readFileSync(input, "utf8");
    const args = ["scripts/catalogue-coverage.ts", "--input", input, "--cohorts", cohorts];
    const run = () => execFileSync(process.execPath, args, { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const first = run(); assert.equal(first, run()); assert.equal(JSON.parse(first).cohorts[0].legacyCompatible.status, "feasible");
    fs.writeFileSync(cohorts, JSON.stringify([{ ...cohort, scope: "day", neverFoods: ["turkey"], dislikes: ["turkey"] }]));
    const daily = run(); assert.equal(daily, run()); assert.equal(JSON.parse(daily).cohorts[0].dayCount, 1);
    assert.equal(fs.readFileSync(input, "utf8"), before);
    const overwrite = spawnSync(process.execPath, [...args, "--output", input], { encoding: "utf8", windowsHide: true });
    assert.equal(overwrite.status, 1); assert.match(overwrite.stderr, /overwrite/);
    const invalid = spawnSync(process.execPath, ["scripts/catalogue-coverage.ts"], { encoding: "utf8", windowsHide: true });
    assert.equal(invalid.status, 1); assert.match(invalid.stderr, /explicit --input/);
    assert.deepEqual(fs.readdirSync(folder).sort(), ["cohorts.json", "recipes.json"]);
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});
