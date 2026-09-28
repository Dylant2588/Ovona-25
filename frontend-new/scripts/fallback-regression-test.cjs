/* eslint-disable @typescript-eslint/no-require-imports */
process.env.NODE_ENV = "production";
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

const enforcementSource = fs.readFileSync(
  path.join(__dirname, "..", "lib", "macro-enforcement.ts"),
  "utf8"
);
const enforcementOutput = ts.transpileModule(enforcementSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2017,
  },
}).outputText;
const enforcementModule = { exports: {} };
new Function("exports", "require", "module", enforcementOutput)(
  enforcementModule.exports,
  (id) => (id === "@/lib/meal-generator" ? moduleUnderTest.exports : require(id)),
  enforcementModule
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

// Older profiles can serialize the same selection as a text column rather
// than a Postgres text[] value. It must be treated as an allergy, not crash
// fallback generation or be silently discarded.
const legacyAllergyPlan = moduleUnderTest.exports.generateFallbackMealPlan({
  ...basePreferences,
  profile: { ...basePreferences.profile, allergies: "Eggs" },
});

if (
  legacyAllergyPlan.days.some((day) =>
    day.meals.some((meal) =>
      /egg/i.test(
        [meal.title, meal.description, ...meal.ingredients.map((ingredient) => ingredient.name)].join(
          " "
        )
      )
    )
  )
) {
  throw new Error("Serialized allergy strings must remain hard exclusions.");
}

// This represents the exact values the meals page serializes after reading
// legacy/null/malformed Supabase fields: unsafe array-like values become empty
// arrays, delimited taste strings become arrays, and numeric strings become numbers.
const legacyClientNormalizedPreferences = {
  userId: "test-user",
  tastes: ["quick", "high protein"],
  goal: null,
  mealComplexity: null,
  macroTargets: { calories: 2200, protein: 160, carbs: null, fat: null },
  profile: {
    locale: "UK",
    timezone: null,
    bodyWeightKg: null,
    bodyFatPercent: null,
    heightCm: null,
    activityLevel: null,
    dietaryMode: "mixed",
    trainingSchedule: [],
    allergies: [],
    dislikes: [],
    cuisines: [],
    pantryStaples: [],
    household: [],
    deliveryPreferences: [],
    sleepHours: null,
    stressLevel: null,
    notes: null,
    mealsPerDay: 5,
  },
};

const legacyPlan = moduleUnderTest.exports.generateFallbackMealPlan(
  legacyClientNormalizedPreferences
);
const legacyTargets = moduleUnderTest.exports.resolveMacroTargets(
  legacyClientNormalizedPreferences
);
const legacyEnforcement = enforcementModule.exports.toEnforcementInfo(
  enforcementModule.exports.enforceMacros(legacyPlan, legacyTargets)
);

if (!legacyPlan.days.length || !["verified", "adjusted", "failed"].includes(legacyEnforcement.status)) {
  throw new Error("Client-normalized legacy preferences must complete fallback and enforcement.");
}

const affectedProductionPreferences = {
  userId: "test-user",
  tastes: ["quick-minimal"],
  goal: "lose_weight",
  mealComplexity: "simple",
  macroTargets: { calories: 1830, protein: 216, carbs: 118, fat: 55 },
  profile: {
    dietaryMode: null,
    allergies: ["Dairy", "Shellfish", "Nuts", "Fish", "Sesame"],
    dislikes: [],
    cuisines: ["Mediterranean", "Asian", "Mexican", "Indian", "British"],
    mealsPerDay: 5,
  },
};

const affectedProductionPlan = moduleUnderTest.exports.generateFallbackMealPlan(affectedProductionPreferences);
const affectedProductionTargets = moduleUnderTest.exports.resolveMacroTargets(
  affectedProductionPreferences
);
const affectedProductionEnforcement = enforcementModule.exports.enforceMacros(
  affectedProductionPlan,
  affectedProductionTargets
);
const forbiddenProductionTerms = /dairy|milk|yogurt|whey|cheese|butter|cream|shellfish|shrimp|prawn|fish|salmon|nut|almond|sesame|tahini/i;

if (
  affectedProductionPlan.days.some((day) =>
    day.meals.some((meal) =>
      forbiddenProductionTerms.test(
        [meal.title, meal.description, ...meal.ingredients.map((ingredient) => ingredient.name)].join(
          " "
        )
      )
    )
  )
) {
  throw new Error("Production preference fallback must preserve every hard allergy exclusion.");
}

if (!affectedProductionEnforcement.passed) {
  throw new Error(
    `The production allergy profile must receive a feasible calorie/protein fallback plan: ${JSON.stringify(
      affectedProductionPlan.days.map((day) => ({ totals: day.totals, meals: day.meals.map((meal) => meal.baseId) }))
    )}`
  );
}

if (
  affectedProductionPlan.days.some(
    (day) =>
      day.totals.calories < affectedProductionTargets.calories * 0.95 ||
      day.totals.calories > affectedProductionTargets.calories * 1.08 ||
      day.totals.protein < affectedProductionTargets.protein * 0.98 ||
      day.totals.protein > affectedProductionTargets.protein * 1.1
  )
) {
  throw new Error("A passing production fallback must actually meet its calorie and protein bounds.");
}

const infeasiblePlan = JSON.parse(JSON.stringify(affectedProductionPlan));
infeasiblePlan.days.forEach((day) => {
  day.meals.forEach((meal) => {
    meal.portionMultiplier = 1;
    meal.baseMacros = { calories: 100, protein: 5, carbs: 10, fat: 2 };
    meal.macros = { ...meal.baseMacros };
  });
  day.totals = { calories: 500, protein: 25, carbs: 50, fat: 10 };
});
const infeasibleEnforcement = enforcementModule.exports.enforceMacros(
  infeasiblePlan,
  affectedProductionTargets
);
if (
  infeasibleEnforcement.passed ||
  infeasiblePlan.days.some(
    (day) =>
      day.totals.calories !== 500 ||
      day.totals.protein !== 25 ||
      day.meals.some((meal) => meal.portionMultiplier !== 1)
  )
) {
  throw new Error("Failed enforcement must preserve its original, transparent infeasible plan.");
}

console.log("fallback regression probe: PASS");
