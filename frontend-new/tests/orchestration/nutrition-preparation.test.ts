import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculatedNutritionErrors } from "../../lib/recipes/nutrition.ts";
import { prepareRecipeNutrition, nutritionPreparationCli } from "../../scripts/prepare-recipe-nutrition.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const load = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const inputs = () => ({ foods: load("data/nutrition/cofid-2021-slice.json"), mappings: load("data/recipes/nutrition-mappings.json") });

test("official source preparation is deterministic, hand-computed and unreviewed", () => {
  const { foods, mappings } = inputs(); const before = structuredClone({ foods, mappings });
  const result = prepareRecipeNutrition(mappings.drafts, foods, mappings.ingredients, "local-test-preparer");
  assert.equal(result.gaps.length, 0); assert.equal(result.prepared.length, 1);
  const recipe = result.prepared[0];
  assert.deepEqual(recipe.macros, { calories: 373, protein: 19, carbs: 66, fat: 6 });
  assert.deepEqual(recipe.nutrition.calculation!.batchMacros, { calories: 745.6, protein: 37.06, carbs: 132.22, fat: 11.46 });
  assert.deepEqual(calculatedNutritionErrors(recipe), []);
  assert.equal(recipe.review.status, "pending_review"); assert.equal(recipe.review.reviewedBy, null);
  assert.equal(recipe.source.reviewed, false); assert.equal(recipe.nutrition.reviewed, false);
  assert.ok(recipe.ingredients.every(i => !i.reviewed));
  assert.equal(recipe.ingredients[2].nutrition!.quantityState, "cooked_drained");
  assert.match(result.manifest[0].payloadHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.manifest[0].preparedBy, "local-test-preparer");
  assert.deepEqual(result, prepareRecipeNutrition(mappings.drafts, foods, mappings.ingredients, "local-test-preparer"));
  assert.deepEqual({ foods, mappings }, before);
  assert.deepEqual(result.prepared, load("data/recipes/calculated-pending.json"));
});

test("stale ingredient bindings, source identity/state, missing and trace nutrients remain gaps", () => {
  const mutations = [
    (v: ReturnType<typeof inputs>) => { v.mappings.drafts[0].ingredients[0].name = "Jasmine rice"; },
    (v: ReturnType<typeof inputs>) => { v.mappings.drafts[0].ingredients[0].amount += 1; },
    (v: ReturnType<typeof inputs>) => { v.mappings.drafts[0].ingredients[0].unit = "kg"; },
    (v: ReturnType<typeof inputs>) => { v.mappings.ingredients[0].quantityState = "cooked"; },
    (v: ReturnType<typeof inputs>) => { v.mappings.ingredients[0].foodCode = "not-a-food"; },
    (v: ReturnType<typeof inputs>) => { v.mappings.ingredients[0].workbookSha256 = "changed"; },
    (v: ReturnType<typeof inputs>) => { const f = v.foods.foods.find((r: { foodCode: string }) => r.foodCode === "11-868"); f.nutrients.protein = { kind: "unknown", value: null, raw: "N" }; },
    (v: ReturnType<typeof inputs>) => { const f = v.foods.foods.find((r: { foodCode: string }) => r.foodCode === "11-868"); f.nutrients.protein = { kind: "trace", value: null, raw: "Tr" }; },
    (v: ReturnType<typeof inputs>) => { v.mappings.ingredients.push(structuredClone(v.mappings.ingredients[0])); },
  ];
  for (const mutate of mutations) {
    const values = inputs(); mutate(values);
    const result = prepareRecipeNutrition(values.mappings.drafts, values.foods, values.mappings.ingredients, "test-preparer");
    assert.equal(result.prepared.length, 0); assert.ok(result.gaps[0].errors.length);
  }
  const oil = inputs(); oil.mappings.ingredients[0].foodCode = "17-038"; oil.mappings.ingredients[0].quantityState = "as_sold";
  const oilResult = prepareRecipeNutrition(oil.mappings.drafts, oil.foods, oil.mappings.ingredients, "test");
  assert.equal(oilResult.prepared.length, 0); assert.match(oilResult.gaps[0].errors.join(" "), /trace/);
});

test("approved recipes are refused, missing mappings do not invent data, and reviews are cleared", () => {
  const { foods, mappings } = inputs();
  const approved = structuredClone(mappings.drafts); approved[0].review.status = "approved";
  assert.match(prepareRecipeNutrition(approved, foods, mappings.ingredients, "test").gaps[0].errors.join(" "), /pending|approved/i);
  assert.equal(prepareRecipeNutrition(mappings.drafts, foods, [], "test").prepared.length, 0);
  mappings.drafts[0].ingredients[0].reviewed = true; mappings.drafts[0].source.reviewed = true;
  const result = prepareRecipeNutrition(mappings.drafts, foods, mappings.ingredients, "test");
  assert.equal(result.prepared.length, 1); assert.equal(result.prepared[0].ingredients[0].reviewed, false);
  assert.throws(() => prepareRecipeNutrition([], foods, [], ""), /actor/i);
});

test("file-only CLI refuses overwrite and requires separate gap output; source values stay intact", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ovona-nutrition-"));
  try {
    const foodFile = path.join(root, "data/nutrition/cofid-2021-slice.json");
    const mappingFile = path.join(root, "data/recipes/nutrition-mappings.json");
    const output = path.join(dir, "prepared.json"), gaps = path.join(dir, "gaps.json");
    const args = ["--foods", foodFile, "--mappings", mappingFile, "--actor", "local-test-only", "--output", output, "--gaps", gaps];
    const result = nutritionPreparationCli(args);
    assert.equal(result.prepared.length, 1); assert.deepEqual(JSON.parse(fs.readFileSync(gaps, "utf8")), []);
    assert.throws(() => nutritionPreparationCli(args), /exist|overwrite/i);
    assert.throws(() => nutritionPreparationCli(["--foods", foodFile, "--mappings", mappingFile, "--actor", "test", "--output", mappingFile, "--gaps", gaps]), /overwrite/i);
    assert.throws(() => nutritionPreparationCli(["--foods", foodFile, "--mappings", mappingFile, "--actor", "test", "--output", output]), /gaps/i);
    const olive = load("data/nutrition/cofid-2021-slice.json").foods.find((f: { foodCode: string }) => f.foodCode === "17-038");
    assert.deepEqual(olive.nutrients.protein, { kind: "trace", value: null, raw: "Tr" });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
