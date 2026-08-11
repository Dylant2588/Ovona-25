/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const sourcePath = path.join(__dirname, "..", "lib", "meal-generator.ts");
const source = fs
  .readFileSync(sourcePath, "utf8")
  .replace(
    /^import \{ priceBasket \} from "@\/lib\/tesco-prices";\r?\n/,
    "const priceBasket = () => ({ subtotal: 0, unmatchedItems: [] });\n"
  );
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2017,
  },
}).outputText;
const moduleUnderTest = { exports: {} };
new Function("exports", "require", "module", output)(
  moduleUnderTest.exports,
  require,
  moduleUnderTest
);

const basePreferences = {
  tastes: [],
  goal: "maintain",
  mealComplexity: "normal",
  profile: { mealsPerDay: 3 },
};

const softConflictPlan = moduleUnderTest.exports.generateFallbackMealPlan({
  ...basePreferences,
  profile: {
    ...basePreferences.profile,
    dislikes: ["blueberry", "egg", "yogurt", "chia"],
  },
});

if (
  softConflictPlan.days.length !== 5 ||
  !softConflictPlan.days.every((day) =>
    day.meals.some((meal) => meal.mealSlot === "breakfast")
  )
) {
  throw new Error("Conflicting dislikes should still yield a complete fallback plan.");
}

const allergySafePlan = moduleUnderTest.exports.generateFallbackMealPlan({
  ...basePreferences,
  profile: { ...basePreferences.profile, allergies: ["egg"] },
});

if (
  allergySafePlan.days.some((day) =>
    day.meals.some((meal) =>
      /egg/i.test(
        [meal.title, meal.description, ...meal.ingredients.map((ingredient) => ingredient.name)].join(
          " "
        )
      )
    )
  )
) {
  throw new Error("Allergy restrictions must never be relaxed.");
}

console.log("fallback regression probe: PASS");
