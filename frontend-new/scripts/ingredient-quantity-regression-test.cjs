/* eslint-disable @typescript-eslint/no-require-imports */
// The legacy catalogue must refuse an infeasible high-protein request instead
// of manufacturing a basket with kilos of a single ingredient.
process.env.NODE_ENV = "production";
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "lib", "meal-generator.ts"), "utf8")
  .replace(/^import \{ priceBasket \} from "@\/lib\/tesco-prices";\r?\n/, "const priceBasket = () => ({ subtotal: 0, unmatchedItems: [] });\n");
const moduleUnderTest = { exports: {} };
const localRequire = (id) => {
  if (id === "./varied-meal-catalogue" || id === "./meal-images" || id === "./ingredient-ledger") {
    const local = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(path.join(root, "lib", `${id.slice(2)}.ts`), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText;
    new Function("exports", "require", "module", code)(local.exports, require, local);
    return local.exports;
  }
  return require(id);
};
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText;
new Function("exports", "require", "module", output)(moduleUnderTest.exports, localRequire, moduleUnderTest);

const onePersonHighProteinPreferences = {
  userId: "regression-user", tastes: ["quick-minimal"], goal: "lose_weight", mealComplexity: "simple",
  macroTargets: { calories: 1830, protein: 216, carbs: 118, fat: 55 },
  profile: { dietaryMode: null, allergies: ["Dairy", "Shellfish", "Nuts", "Fish", "Sesame"], dislikes: [], cuisines: [], mealsPerDay: 5 },
};

const originalRandom = Math.random;
try {
  Math.random = () => 0.5;
  let refused = false;
  try {
    moduleUnderTest.exports.generateFallbackMealPlan(onePersonHighProteinPreferences);
  } catch (error) {
    refused = /No practical weekly (protein rotation|plan) is available/.test(String(error));
  }
  if (!refused) throw new Error("An infeasible target must be refused instead of creating an impractical basket.");

  const plan = moduleUnderTest.exports.generateFallbackMealPlan({
    ...onePersonHighProteinPreferences,
    macroTargets: { calories: 2000, protein: 160, carbs: 180, fat: 60 },
  });
  const items = moduleUnderTest.exports.buildShoppingList(plan);
  const quantity = (name) => items.find((item) => item.name === name)?.quantity ?? 0;
  const proteinFoods = ["Chicken breast", "Roast turkey slices", "Egg whites"];
  const totalProteinFoodWeight = proteinFoods.reduce((total, name) => total + quantity(name), 0);
  const animalProteinWeight = quantity("Chicken breast") + quantity("Roast turkey slices") + quantity("Egg whites");
  const distinctProteinIngredients = items.filter((item) => item.category === "Protein" && item.quantity > 0).length;

  if (distinctProteinIngredients < 4) throw new Error(`Expected at least four protein ingredients, received ${distinctProteinIngredients}.`);
  if (animalProteinWeight > 3600) throw new Error(`One-person animal protein foods total ${animalProteinWeight}g; plan selection is impractical. ${JSON.stringify({ items: items.filter((item) => item.category === "Protein").map((item) => [item.name, item.quantity]), meals: plan.days.map((day) => day.meals.map((meal) => meal.baseId)) })}`);
  if (totalProteinFoodWeight > 3600) throw new Error(`One-person chicken, turkey and egg whites total ${totalProteinFoodWeight}g; plan selection is impractical.`);
  const violations = moduleUnderTest.exports.practicalBasketViolations(plan);
  if (violations.length) throw new Error(`A generated practical plan breached a weekly ingredient limit: ${violations.join(" ")}`);
} finally {
  Math.random = originalRandom;
}

console.log("ingredient quantity regression probe: PASS");
