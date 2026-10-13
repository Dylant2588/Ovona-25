/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  let source = fs.readFileSync(file, "utf8");
  // Catalogue export never prices or generates a week.
  source = source.replace(/^import \{ priceBasket \} from "@\/lib\/tesco-prices";\r?\n/, "const priceBasket = () => ({ subtotal: 0, unmatchedItems: [] });\n");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
  new Function("exports", "require", "module", code)(mod.exports, id => id.startsWith(".") ? load(path.resolve(path.dirname(file), id.endsWith(".ts") ? id : `${id}.ts`)) : require(id), mod);
  return mod.exports;
}
function exportRecords() {
  const { exportStaticRecipeCatalogue } = load(path.join(__dirname, "../lib/meal-generator.ts"));
  const { findIngredientTaxon, normalizeIngredient } = load(path.join(__dirname, "../lib/recipes/taxonomy.ts"));
  const { imageForMeal } = load(path.join(__dirname, "../lib/meal-images.ts"));
  return exportStaticRecipeCatalogue().map(recipe => ({
    id: recipe.id, version: 1, title: recipe.name, description: recipe.description,
    slots: recipe.mealTypes, servings: 1, readyInMinutes: recipe.readyInMinutes, macros: recipe.macros,
    ingredients: recipe.ingredients.map(ingredient => { const known = findIngredientTaxon(ingredient.name); return {
      name: ingredient.name, canonicalId: known?.id ?? `unreviewed_${normalizeIngredient(ingredient.name).replaceAll(" ", "_")}`,
      amount: ingredient.amount, unit: ingredient.unit, allergens: known?.allergens ?? [],
      mayContain: [], dietaryFlags: known?.dietaryFlags ?? [], reviewed: false,
    }; }),
    steps: recipe.steps ?? [], proteinType: recipe.proteinType ?? "mixed",
    image: imageForMeal({ title: recipe.name, mealSlot: recipe.mealTypes[0] }),
    source: { kind: "internal", reference: `Ovona internal catalogue:${recipe.id}`, rights: "Internal draft; ownership and usage rights require review", reviewed: false },
    nutrition: { method: "estimated_internal_ingredient_baselines", reference: "frontend-new/lib/meal-generator.ts; estimates require measured-source review", reviewed: false },
    review: { status: "pending_review", reviewedBy: null, reviewedAt: null },
  })).sort((a, b) => a.id.localeCompare(b.id));
}
module.exports = { exportRecords, load };
if (require.main === module) {
  const records = exportRecords();
  const output = process.argv[2];
  if (output) fs.writeFileSync(output, JSON.stringify(records, null, 2) + "\n");
  else process.stdout.write(JSON.stringify(records, null, 2) + "\n");
}
