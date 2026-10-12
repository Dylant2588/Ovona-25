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
const loadLocalModule = (id) => {
  if (id === "./varied-meal-catalogue" || id === "./meal-images") {
    const local = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", "lib", `${id.slice(2)}.ts`), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
    }).outputText;
    new Function("exports", "require", "module", code)(local.exports, require, local);
    return local.exports;
  }
  return require(id);
};
new Function("exports", "require", "module", output)(
  moduleUnderTest.exports,
  loadLocalModule,
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
  softConflictPlan.days.length !== moduleUnderTest.exports.WORKDAY_COUNT ||
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

const affectedProductionTargets = moduleUnderTest.exports.resolveMacroTargets(affectedProductionPreferences);
enforcementModule.exports.enforceMacros(affectedProductionPlan, affectedProductionTargets);
const safeSnapshot = JSON.stringify(affectedProductionPlan.days.map(day => day.meals));
if (!enforcementModule.exports.enforceMacros(affectedProductionPlan, affectedProductionTargets).passed ||
    JSON.stringify(affectedProductionPlan.days.map(day => day.meals)) !== safeSnapshot) {
  throw new Error("Enforcement must preserve already passing safe meal portions.");
}
const staleTotalsPlan = JSON.parse(JSON.stringify(affectedProductionPlan));
staleTotalsPlan.days.forEach(day => day.meals.forEach(meal => {
  meal.baseMacros = { calories: 100, protein: 5, carbs: 10, fat: 2 };
  meal.macros = { ...meal.baseMacros };
}));
if (enforcementModule.exports.enforceMacros(staleTotalsPlan, affectedProductionTargets).passed) {
  throw new Error("Cached passing totals must not bypass checks of actual meal nutrition.");
}
const unsafePortionPlan = JSON.parse(JSON.stringify(affectedProductionPlan));
unsafePortionPlan.days[0].meals[0].portionMultiplier = 2;
const unsafePortionResult = enforcementModule.exports.enforceMacros(unsafePortionPlan, affectedProductionTargets);
if (
    (unsafePortionResult.passed && unsafePortionPlan.days[0].meals[0].portionMultiplier > 1.5)) {
  throw new Error("Passing totals must not bypass safe portion bounds.");
}

const originalRandom = Math.random;
try {
  for (const seed of [0, 0.25, 0.5, 0.75, 0.999]) {
    Math.random = () => seed;
    const plan = moduleUnderTest.exports.generateFallbackMealPlan(affectedProductionPreferences);
    if (!enforcementModule.exports.enforceMacros(plan, affectedProductionTargets).passed) throw new Error('Restricted variety must retain target fit.');
    const swapped = moduleUnderTest.exports.swapMealInPlan(plan, 0, 0, affectedProductionPreferences);
    if (swapped.days[0].meals[0].baseId === plan.days[0].meals[0].baseId) throw new Error("Swapping must exclude the current recipe when viable alternatives exist.");
    if (!enforcementModule.exports.enforceMacros(swapped, affectedProductionTargets).passed) throw new Error("Swapping must retain target fit.");
    if (swapped.days.flatMap(day => day.meals).some(meal => forbiddenProductionTerms.test(meal.ingredients.map(item => item.name).join(" ")))) throw new Error("Swapping must retain hard allergy exclusions.");
    const distinctRecipes = (slot) => new Set(plan.days.flatMap(day => day.meals.filter(meal => meal.mealSlot === slot).map(meal =>
      JSON.stringify([meal.baseIngredients.map(item => item.name).sort(), meal.recipeSteps])
    ))).size;
    if (distinctRecipes("breakfast") < 3 || distinctRecipes("snack") < 3 ||
        new Set(plan.days.flatMap(day => day.meals.filter(meal => ["lunch", "dinner"].includes(meal.mealSlot)).map(meal =>
          JSON.stringify([meal.baseIngredients.map(item => item.name).sort(), meal.recipeSteps])
        ))).size < 4) {
      throw new Error("Restricted weeks need materially different breakfast, snack and main recipes.");
    }

    for (const day of plan.days) {
      const mains = day.meals.filter(meal => ['lunch', 'dinner'].includes(meal.mealSlot));
      if (mains[0].baseId === mains[1].baseId) throw new Error('Daily mains must differ.');
      const snacks = day.meals.filter(meal => meal.mealSlot === 'snack');
      if (snacks.length !== 2 || snacks[0].baseId === snacks[1].baseId) throw new Error('Daily snacks must differ.');
      if (day.meals.some(meal => !meal.image.startsWith('/images/meals/'))) throw new Error('Generated artwork must persist.');
    }
  }
} finally { Math.random = originalRandom; }

console.log("fallback regression probe: PASS");
