import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import type { FoodCompositionSnapshot, FoodState, QuantityConversionEvidence, RecipeRecord } from "../lib/recipes/types.ts";
import { recipeRecordErrors } from "../lib/recipes/repository.ts";
import { calculateRecipeNutrition, CALCULATED_NUTRITION_METHOD } from "../lib/recipes/nutrition.ts";
import { createPendingRecipeImport } from "../lib/recipes/imports.ts";

type ObjectValue = Record<string, unknown>;
type PreparationResult = {
  prepared: RecipeRecord[];
  gaps: Array<{ recipeId: string; recipeVersion: number | null; errors: string[] }>;
  manifest: Array<{ recipeId: string; recipeVersion: number; payloadHash: string; preparedBy: string }>;
};
const object = (value: unknown): value is ObjectValue => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && !!value.trim();
const keys = ["calories", "protein", "carbs", "fat"] as const;
const states = ["raw", "cooked", "drained", "cooked_drained", "as_sold"];
const MAX_INPUT_BYTES = 8 * 1024 * 1024;

function sourceSnapshot(slice: ObjectValue, row: ObjectValue): FoodCompositionSnapshot {
  if (![slice.dataset, slice.datasetVersion, slice.publisher, slice.workbookUrl, slice.extractedAt, slice.attribution, row.foodCode, row.foodName].every(text) ||
      !text(slice.workbookSha256) || !/^[a-f0-9]{64}$/.test(slice.workbookSha256) || !text(row.sourceState) || !states.includes(row.sourceState) ||
      !object(row.basis) || row.basis.amount !== 100 || row.basis.unit !== "g" || !object(row.nutrients)) throw new Error("Food source identity, SHA256, state or 100g basis is incomplete.");
  const nutrients = row.nutrients;
  const macros = Object.fromEntries(keys.map(key => {
    const nutrient = nutrients[key];
    if (!object(nutrient) || nutrient.kind !== "numeric" || typeof nutrient.value !== "number" || !Number.isFinite(nutrient.value) || nutrient.value < 0 || !text(nutrient.raw) || !Number.isFinite(Number(nutrient.raw)) || Number(nutrient.raw) !== nutrient.value) throw new Error(`${row.foodCode} ${key}: unknown/trace or inconsistent source value is not numeric evidence.`);
    return [key, nutrient.value];
  })) as FoodCompositionSnapshot["macros"];
  return {
    id: `${slice.dataset}:${slice.datasetVersion}:${row.foodCode}`,
    revision: `${slice.datasetVersion}-sha256:${slice.workbookSha256}`,
    name: String(row.foodName), state: row.sourceState as FoodState,
    basis: { amount: 100, unit: "g" }, macros,
    source: { publisher: String(slice.publisher), dataset: String(slice.dataset), version: String(slice.datasetVersion),
      reference: `${slice.workbookUrl}#food-code=${row.foodCode}`, retrievedAt: String(slice.extractedAt),
      licence: String(slice.attribution), foodCode: String(row.foodCode) },
  };
}

/** File-derived values only. No environment loading, clients, network or persistence. */
export function prepareRecipeNutrition(records: unknown, foodSlice: unknown, mappingInput: unknown, actor: string): PreparationResult {
  if (!text(actor)) throw new Error("An explicit preparation actor is required; it is not a reviewer identity.");
  if (!Array.isArray(records) || records.length > 5000) throw new Error("Records must be an array of at most 5000 pending recipes.");
  if (!object(foodSlice) || !Array.isArray(foodSlice.foods)) throw new Error("Food slice must contain a foods array.");
  if (!Array.isArray(mappingInput) || mappingInput.length > 10000 || mappingInput.some(m => !object(m))) throw new Error("Mappings must be an array of explicit ingredient bindings.");
  const foods = foodSlice.foods;
  const mappings = mappingInput as ObjectValue[];
  const result: PreparationResult = { prepared: [], gaps: [], manifest: [] };
  const seen = new Set<string>();
  for (const input of records) {
    const id = object(input) && text(input.id) ? input.id : "unknown";
    const version = object(input) && Number.isInteger(input.version) ? Number(input.version) : null;
    const errors: string[] = [];
    if (!object(input) || !object(input.review) || input.review.status !== "pending_review" || input.review.reviewedBy !== null || input.review.reviewedAt !== null) errors.push("Only an explicit pending draft with null attribution can be prepared; approved/rejected versions require a separate pending successor.");
    // Reject malformed base content, but allow stale pending calculation evidence
    // to be replaced after exact input bindings pass below.
    const draft = object(input) ? structuredClone(input) : null;
    if (draft && object(draft.nutrition)) { draft.nutrition = { method: "pending_calculation", reference: "explicit local preparation", reviewed: false }; }
    if (draft) errors.push(...recipeRecordErrors(draft));
    else errors.push("Recipe must be an object.");
    const identity = `${id}:${version}`;
    if (seen.has(identity)) errors.push("Duplicate recipe ID/version in input.");
    seen.add(identity);
    if (!errors.length && draft) {
      const recipe = draft as unknown as RecipeRecord;
      const recipeMappings = mappings.filter(m => m.recipeId === id && m.recipeVersion === version);
      if (recipeMappings.some(m => !Number.isInteger(m.ingredientIndex) || Number(m.ingredientIndex) < 0 || Number(m.ingredientIndex) >= recipe.ingredients.length)) errors.push("Mapping contains an invalid ingredient index.");
      recipe.ingredients.forEach((ingredient, index) => {
        const bindings = recipeMappings.filter(m => m.ingredientIndex === index);
        const label = `Ingredient ${index + 1} (${ingredient.name})`;
        if (bindings.length !== 1) { errors.push(`${label}: requires exactly one explicit mapping, found ${bindings.length}.`); return; }
        const m = bindings[0];
        if (!object(m.expected) || m.expected.name !== ingredient.name || m.expected.canonicalId !== ingredient.canonicalId || m.expected.amount !== ingredient.amount || m.expected.unit !== ingredient.unit || m.recipeServings !== recipe.servings) { errors.push(`${label}: stale name, identity, amount, unit or servings binding.`); return; }
        if (m.datasetVersion !== foodSlice.datasetVersion || m.workbookSha256 !== foodSlice.workbookSha256 || !text(m.mappingReference)) { errors.push(`${label}: exact source revision/hash and mapping reference are required.`); return; }
        const matches = foods.filter(f => object(f) && f.foodCode === m.foodCode);
        if (matches.length !== 1 || !object(matches[0])) { errors.push(`${label}: exact food code is missing or ambiguous.`); return; }
        const row = matches[0];
        if (m.quantityState !== row.sourceState) { errors.push(`${label}: quantity state does not match the exact food state.`); return; }
        try {
          ingredient.nutrition = { food: sourceSnapshot(foodSlice, row), quantityState: m.quantityState as FoodState, mappingReference: String(m.mappingReference),
            ...(m.conversion !== undefined ? { conversion: structuredClone(m.conversion) as QuantityConversionEvidence } : {}) };
        } catch (error) { errors.push(`${label}: ${error instanceof Error ? error.message : "Invalid food evidence."}`); }
      });
      if (!errors.length) {
        const calculation = calculateRecipeNutrition(recipe);
        if (!calculation.ok) errors.push(...calculation.errors);
        else {
          recipe.macros = { ...calculation.calculation.perServingMacros };
          recipe.ingredients = recipe.ingredients.map(i => ({ ...i, reviewed: false }));
          recipe.source = { ...recipe.source, reviewed: false };
          recipe.nutrition = { method: CALCULATED_NUTRITION_METHOD, reference: `Local exact mappings; ${foodSlice.dataset} ${foodSlice.datasetVersion}; workbook sha256:${foodSlice.workbookSha256}`, reviewed: false, calculation: calculation.calculation };
          recipe.review = { status: "pending_review", reviewedBy: null, reviewedAt: null };
          const payloadHash = `sha256:${createHash("sha256").update(JSON.stringify(recipe)).digest("hex")}`;
          const pending = createPendingRecipeImport({ record: recipe, payloadHash, importedBy: actor, sourceReference: recipe.source.reference });
          if (!pending.ok) errors.push(...pending.errors);
          else {
            result.prepared.push(pending.value.record);
            result.manifest.push({ recipeId: recipe.id, recipeVersion: recipe.version, payloadHash, preparedBy: actor });
          }
        }
      }
    }
    if (errors.length) result.gaps.push({ recipeId: id, recipeVersion: version, errors: [...new Set(errors)] });
  }
  return result;
}

function readJson(file: string): unknown {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > MAX_INPUT_BYTES) throw new Error("Input must be a JSON file of at most 8 MiB.");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function nutritionPreparationCli(args: readonly string[]): PreparationResult {
  const options: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index], value = args[index + 1];
    if (!["--records", "--foods", "--mappings", "--actor", "--output", "--gaps"].includes(key) || !value || value.startsWith("--") || options[key]) throw new Error("Usage: node scripts/prepare-recipe-nutrition.ts --foods foods.json --mappings mappings.json --actor preparation-identity [--records pending.json] [--output prepared.json --gaps gaps.json]");
    options[key] = value;
  }
  if (!options["--foods"] || !options["--mappings"] || !options["--actor"]) throw new Error("Explicit foods, mappings and preparation actor are required.");
  if (!!options["--output"] !== !!options["--gaps"]) throw new Error("Named output requires a separate --gaps output; neither report may be silently omitted.");
  const inputs = ["--records", "--foods", "--mappings"].map(k => options[k]).filter(Boolean).map(f => path.resolve(f));
  const outputs = ["--output", "--gaps"].map(k => options[k]).filter(Boolean).map(f => path.resolve(f));
  const existingInputs = inputs.map(f => fs.realpathSync(f).toLowerCase());
  for (const output of outputs) {
    if (inputs.some(f => f.toLowerCase() === output.toLowerCase()) || (fs.existsSync(output) && existingInputs.includes(fs.realpathSync(output).toLowerCase()))) throw new Error("Output must not overwrite an input file.");
    if (fs.existsSync(output)) throw new Error("Output already exists; refusing overwrite.");
  }
  if (new Set(outputs.map(f => f.toLowerCase())).size !== outputs.length) throw new Error("Prepared and gap outputs must be different files.");
  const mappings = readJson(options["--mappings"]);
  if (!object(mappings)) throw new Error("Mapping file must contain drafts and ingredients fields.");
  const records = options["--records"] ? readJson(options["--records"]) : mappings.drafts;
  const result = prepareRecipeNutrition(records, readJson(options["--foods"]), mappings.ingredients, options["--actor"]);
  if (options["--output"]) {
    fs.writeFileSync(options["--output"], JSON.stringify(result.prepared, null, 2) + "\n", { flag: "wx" });
    fs.writeFileSync(options["--gaps"], JSON.stringify(result.gaps, null, 2) + "\n", { flag: "wx" });
  } else process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  return result;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { nutritionPreparationCli(process.argv.slice(2)); }
  catch (error) { console.error(error instanceof Error ? error.message : "Nutrition preparation failed."); process.exitCode = 1; }
}
