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
const loadLocalModule = (id) => {
  if (id === "./varied-meal-catalogue" || id === "./meal-images" || id === "./ingredient-ledger") {
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
    `The production allergy profile must receive a feasible calorie/protein fallback plan: ${JSON.stringify(affectedProductionEnforcement)} ${JSON.stringify(
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
// Exercise selection independently of random ranking jitter. The constrained
// profile must have two different practical snack proteins without losing fit.
const originalRandom = Math.random;
try {
  for (const seed of [0, 0.25, 0.5, 0.75, 0.999]) {
    Math.random = () => seed;
    const plan = moduleUnderTest.exports.generateFallbackMealPlan(affectedProductionPreferences);
    const result = enforcementModule.exports.enforceMacros(plan, affectedProductionTargets);
    if (!result.passed) throw new Error(`Constrained fallback failed with random value ${seed}`);
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
      const mains = day.meals.filter(meal => ["lunch", "dinner"].includes(meal.mealSlot));
      if (mains[0].baseId === mains[1].baseId) throw new Error("Lunch and dinner must differ when viable alternatives exist.");
      if (day.meals.some(meal => !meal.image.startsWith("/images/meals/"))) throw new Error("Generated plans must persist illustrated placeholders.");
      const snacks = day.meals.filter((meal) => meal.mealSlot === "snack");
      if (snacks.length !== 2 || snacks[0].baseId === snacks[1].baseId) {
        throw new Error("Constrained days must offer two distinct snack recipes.");
      }
      if (snacks.some((meal) => /oat/i.test(meal.title))) {
        throw new Error("Poultry snacks must not be presented as oat pots.");
      }
      const breakfast = day.meals.find((meal) => meal.baseId === "turkey-rice-breakfast-bowl");
      if (breakfast && (breakfast.readyInMinutes < 35 ||
          !breakfast.recipeSteps.some((step) => /dry brown rice.*simmer/i.test(step)) ||
          !breakfast.recipeSteps.some((step) => /spinach.*rice/i.test(step)))) {
        throw new Error("Turkey rice breakfast must cook its dry rice and spinach within a truthful total time.");
      }
      const turkeySnack = snacks.find((meal) => meal.baseId === "turkey-tomato-snack-box");
      if (turkeySnack && (turkeySnack.readyInMinutes < 10 ||
          !turkeySnack.recipeSteps.some((step) => /rolled oats.*simmer/i.test(step)) ||
          !turkeySnack.recipeSteps.some((step) => /ready-to-eat roast turkey/i.test(step)))) {
        throw new Error("Turkey snack must prepare its oats and identify the already-cooked turkey.");
      }
      if (day.meals.some((meal) => forbiddenProductionTerms.test(
        [meal.title, meal.description, ...meal.ingredients.map((ingredient) => ingredient.name)].join(" ")
      ))) throw new Error("Variety must preserve hard allergies across every selection seed.");
    }
  }
} finally {
  Math.random = originalRandom;
}
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
