import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveNutritionBaseline } from "@/lib/meal-generator";
import type {
  GenerationContext,
  IngredientMacros,
  IngredientMicros,
  MealConcept,
  PortionedIngredient,
  PortionedMeal,
  SlotBudget,
} from "@/lib/generation/types";

type IngredientRecord = {
  name: string;
  category: string;
  unit: string;
  per_100g_calories: number;
  per_100g_protein: number;
  per_100g_carbs: number;
  per_100g_fat: number;
  per_100g_fibre: number;
  per_100g_iron_mg: number;
  per_100g_omega_3_g: number;
  per_100g_b12_mcg: number;
  per_100g_vitamin_d_mcg: number;
  per_100g_folate_mcg: number;
  per_100g_calcium_mg: number;
};

const ingredientCache = new Map<string, IngredientRecord | null>();

const defaultMacros = (): IngredientMacros => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
});

const defaultMicros = (): IngredientMicros => ({
  iron_mg: 0,
  omega_3_g: 0,
  b12_mcg: 0,
  vitamin_d_mcg: 0,
  folate_mcg: 0,
  calcium_mg: 0,
  fibre_g: 0,
});

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const proteinKeywords = [
  "chicken",
  "turkey",
  "beef",
  "salmon",
  "cod",
  "fish",
  "tuna",
  "egg",
  "tofu",
  "tempeh",
  "prawn",
  "shrimp",
  "yogurt",
  "cottage",
];

const carbKeywords = [
  "rice",
  "pasta",
  "oats",
  "bread",
  "wrap",
  "potato",
  "quinoa",
  "couscous",
  "beans",
  "lentils",
  "bagel",
  "banana",
  "berries",
];

const sauceKeywords = [
  "sauce",
  "oil",
  "vinegar",
  "paste",
  "honey",
  "syrup",
  "pesto",
  "harissa",
  "miso",
];

const vegetableKeywords = [
  "spinach",
  "broccoli",
  "pepper",
  "onion",
  "tomato",
  "carrot",
  "kale",
  "cucumber",
  "courgette",
  "zucchini",
  "mushroom",
  "cauliflower",
  "cabbage",
  "peas",
  "avocado",
];

const matchesAny = (name: string, keywords: string[]) =>
  keywords.some((keyword) => name.includes(keyword));

const classifyIngredient = (name: string, row: IngredientRecord | null) => {
  const normalized = normalize(name);
  const category = normalize(row?.category ?? "");
  const proteinPer100 = row?.per_100g_protein ?? 0;

  if (
    category.includes("protein") ||
    matchesAny(normalized, proteinKeywords) ||
    proteinPer100 >= 18
  ) {
    return "protein";
  }
  if (category.includes("produce") || matchesAny(normalized, vegetableKeywords)) {
    return "vegetable";
  }
  if (
    category.includes("pantry") ||
    category.includes("bakery") ||
    matchesAny(normalized, carbKeywords)
  ) {
    return "carb";
  }
  if (matchesAny(normalized, sauceKeywords)) {
    return "sauce";
  }
  return "other";
};

const findUnit = (row: IngredientRecord | null, fallbackName: string) => {
  const unit = normalize(row?.unit ?? "");
  if (unit === "ml") return "ml";
  if (["each", "piece", "slice", "large"].includes(unit)) return unit;
  if (/egg/.test(normalize(fallbackName))) return "large";
  if (/avocado|banana|wrap|slice|bagel|lemon|lime/.test(normalize(fallbackName))) {
    return "piece";
  }
  return "g";
};

const baseWeightForUnit = (amount: number, unit: string, name: string) => {
  if (unit === "ml" || unit === "g") return amount;
  if (unit === "large") return amount * 50;
  if (unit === "piece") {
    if (/avocado/.test(name)) return amount * 150;
    if (/lemon|lime/.test(name)) return amount * 70;
    if (/wrap/.test(name)) return amount * 65;
    if (/bagel/.test(name)) return amount * 90;
    return amount * 100;
  }
  if (unit === "slice") return amount * 30;
  return amount;
};

const amountFromWeight = (weight: number, unit: string, name: string) => {
  if (unit === "g" || unit === "ml") return weight;
  if (unit === "large") return weight / 50;
  if (unit === "piece") {
    if (/avocado/.test(name)) return weight / 150;
    if (/lemon|lime/.test(name)) return weight / 70;
    if (/wrap/.test(name)) return weight / 65;
    if (/bagel/.test(name)) return weight / 90;
    return weight / 100;
  }
  if (unit === "slice") return weight / 30;
  return weight;
};

const scaleMacrosFromRow = (row: IngredientRecord | null, weightInGramsOrMl: number) => {
  if (!row) return defaultMacros();
  const scale = weightInGramsOrMl / 100;
  return {
    calories: Number((row.per_100g_calories * scale).toFixed(2)),
    protein: Number((row.per_100g_protein * scale).toFixed(2)),
    carbs: Number((row.per_100g_carbs * scale).toFixed(2)),
    fat: Number((row.per_100g_fat * scale).toFixed(2)),
  };
};

const scaleMicrosFromRow = (row: IngredientRecord | null, weightInGramsOrMl: number) => {
  if (!row) return defaultMicros();
  const scale = weightInGramsOrMl / 100;
  return {
    iron_mg: Number((row.per_100g_iron_mg * scale).toFixed(4)),
    omega_3_g: Number((row.per_100g_omega_3_g * scale).toFixed(4)),
    b12_mcg: Number((row.per_100g_b12_mcg * scale).toFixed(4)),
    vitamin_d_mcg: Number((row.per_100g_vitamin_d_mcg * scale).toFixed(4)),
    folate_mcg: Number((row.per_100g_folate_mcg * scale).toFixed(4)),
    calcium_mg: Number((row.per_100g_calcium_mg * scale).toFixed(4)),
    fibre_g: Number((row.per_100g_fibre * scale).toFixed(4)),
  };
};

const sumIngredientMacros = (ingredients: PortionedIngredient[]): IngredientMacros =>
  ingredients.reduce(
    (acc, ingredient) => ({
      calories: Number((acc.calories + ingredient.macros.calories).toFixed(2)),
      protein: Number((acc.protein + ingredient.macros.protein).toFixed(2)),
      carbs: Number((acc.carbs + ingredient.macros.carbs).toFixed(2)),
      fat: Number((acc.fat + ingredient.macros.fat).toFixed(2)),
    }),
    defaultMacros()
  );

const sumIngredientMicros = (ingredients: PortionedIngredient[]): IngredientMicros =>
  ingredients.reduce(
    (acc, ingredient) => ({
      iron_mg: Number((acc.iron_mg + ingredient.micros.iron_mg).toFixed(4)),
      omega_3_g: Number((acc.omega_3_g + ingredient.micros.omega_3_g).toFixed(4)),
      b12_mcg: Number((acc.b12_mcg + ingredient.micros.b12_mcg).toFixed(4)),
      vitamin_d_mcg: Number((acc.vitamin_d_mcg + ingredient.micros.vitamin_d_mcg).toFixed(4)),
      folate_mcg: Number((acc.folate_mcg + ingredient.micros.folate_mcg).toFixed(4)),
      calcium_mg: Number((acc.calcium_mg + ingredient.micros.calcium_mg).toFixed(4)),
      fibre_g: Number((acc.fibre_g + ingredient.micros.fibre_g).toFixed(4)),
    }),
    defaultMicros()
  );

const rowFromDb = (row: Record<string, unknown>, fallbackName: string): IngredientRecord => ({
  name: typeof row.name === "string" ? row.name : fallbackName,
  category: typeof row.category === "string" ? row.category : "Other",
  unit: typeof row.unit === "string" ? row.unit : "g",
  per_100g_calories: toNumber(row.per_100g_calories),
  per_100g_protein: toNumber(row.per_100g_protein),
  per_100g_carbs: toNumber(row.per_100g_carbs),
  per_100g_fat: toNumber(row.per_100g_fat),
  per_100g_fibre: toNumber(row.per_100g_fibre),
  per_100g_iron_mg: toNumber(row.per_100g_iron_mg),
  per_100g_omega_3_g: toNumber(row.per_100g_omega_3_g),
  per_100g_b12_mcg: toNumber(row.per_100g_b12_mcg),
  per_100g_vitamin_d_mcg: toNumber(row.per_100g_vitamin_d_mcg),
  per_100g_folate_mcg: toNumber(row.per_100g_folate_mcg),
  per_100g_calcium_mg: toNumber(row.per_100g_calcium_mg),
});

const rowFromBaseline = (name: string): IngredientRecord | null => {
  const baseline = resolveNutritionBaseline(name);
  if (!baseline) return null;
  return {
    name: baseline.name,
    category: "Other",
    unit: baseline.unit,
    per_100g_calories: baseline.per100g.calories,
    per_100g_protein: baseline.per100g.protein,
    per_100g_carbs: baseline.per100g.carbs,
    per_100g_fat: baseline.per100g.fat,
    per_100g_fibre: 0,
    per_100g_iron_mg: 0,
    per_100g_omega_3_g: 0,
    per_100g_b12_mcg: 0,
    per_100g_vitamin_d_mcg: 0,
    per_100g_folate_mcg: 0,
    per_100g_calcium_mg: 0,
  };
};

const hasUsableMacros = (record: IngredientRecord) =>
  record.per_100g_calories > 0 ||
  record.per_100g_protein > 0 ||
  record.per_100g_carbs > 0 ||
  record.per_100g_fat > 0;

const lookupIngredient = async (
  name: string,
  supabase: SupabaseClient
): Promise<IngredientRecord | null> => {
  const key = normalize(name);
  if (ingredientCache.has(key)) {
    return ingredientCache.get(key) ?? null;
  }

  const { data: exactData, error: exactError } = await supabase
    .from("ingredients")
    .select("*")
    .eq("name", name)
    .limit(1);

  if (!exactError && Array.isArray(exactData) && exactData.length) {
    const exactRecord = rowFromDb(exactData[0] as Record<string, unknown>, name);
    const resolved = hasUsableMacros(exactRecord) ? exactRecord : rowFromBaseline(name);
    ingredientCache.set(key, resolved);
    return resolved;
  }

  const { data, error } = await supabase
    .from("ingredients")
    .select("*")
    .ilike("name", `%${name}%`)
    .limit(1);

  if (!error && Array.isArray(data) && data.length) {
    const record = rowFromDb(data[0] as Record<string, unknown>, name);
    const resolved = hasUsableMacros(record) ? record : rowFromBaseline(name);
    ingredientCache.set(key, resolved);
    return resolved;
  }

  const baseline = rowFromBaseline(name);
  ingredientCache.set(key, baseline);
  return baseline;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const updateIngredientTotals = (
  ingredient: PortionedIngredient,
  row: IngredientRecord | null
) => {
  const weight = baseWeightForUnit(ingredient.amount, ingredient.unit, normalize(ingredient.name));
  ingredient.macros = scaleMacrosFromRow(row, weight);
  ingredient.micros = scaleMicrosFromRow(row, weight);
};

const totalCalories = (ingredients: PortionedIngredient[]) =>
  ingredients.reduce((sum, ingredient) => sum + ingredient.macros.calories, 0);

const sumWeeklyMicros = (plan: PortionedMeal[]): IngredientMicros =>
  plan.reduce(
    (acc, meal) => ({
      iron_mg: acc.iron_mg + meal.totalMicros.iron_mg,
      omega_3_g: acc.omega_3_g + meal.totalMicros.omega_3_g,
      b12_mcg: acc.b12_mcg + meal.totalMicros.b12_mcg,
      vitamin_d_mcg: acc.vitamin_d_mcg + meal.totalMicros.vitamin_d_mcg,
      folate_mcg: acc.folate_mcg + meal.totalMicros.folate_mcg,
      calcium_mg: acc.calcium_mg + meal.totalMicros.calcium_mg,
      fibre_g: acc.fibre_g + meal.totalMicros.fibre_g,
    }),
    defaultMicros()
  );

export async function calculatePortions(
  meal: MealConcept,
  slotBudget: SlotBudget,
  supabase: SupabaseClient
): Promise<PortionedMeal> {
  const ingredientsWithRows = await Promise.all(
    meal.ingredients.map(async (name) => ({
      name,
      row: await lookupIngredient(name, supabase),
    }))
  );

  const classified = ingredientsWithRows.map(({ name, row }) => ({
    name,
    row,
    role: classifyIngredient(name, row),
    unit: findUnit(row, name),
  }));

  const proteinCandidates = classified
    .filter((entry) => entry.role === "protein")
    .sort(
      (a, b) => (b.row?.per_100g_protein ?? 0) - (a.row?.per_100g_protein ?? 0)
    );
  const primaryProtein = proteinCandidates[0] ?? classified[0];

  const portioned: PortionedIngredient[] = classified.map((entry) => {
    let amount = 40;
    if (entry.role === "sauce") amount = entry.unit === "ml" ? 15 : 12;
    if (entry.role === "vegetable") amount = entry.unit === "g" ? 130 : 1;
    if (entry.role === "carb") amount = entry.unit === "g" ? 75 : 1;
    if (entry.role === "protein") amount = entry.unit === "g" ? 120 : 2;

    return {
      name: entry.row?.name ?? entry.name,
      amount,
      unit: entry.unit,
      category: entry.row?.category ?? "Other",
      macros: defaultMacros(),
      micros: defaultMicros(),
    };
  });

  const proteinTarget = Math.max(12, slotBudget.protein);
  const proteinDensity = Math.max(1, primaryProtein.row?.per_100g_protein ?? 20);
  const proteinWeight = clamp((proteinTarget / proteinDensity) * 100, 70, 320);
  const proteinAmount = amountFromWeight(
    proteinWeight,
    findUnit(primaryProtein.row, primaryProtein.name),
    normalize(primaryProtein.name)
  );

  const primaryIndex = portioned.findIndex(
    (entry) => normalize(entry.name) === normalize(primaryProtein.name)
  );
  if (primaryIndex >= 0) {
    portioned[primaryIndex].amount = Number(proteinAmount.toFixed(2));
  }

  const rowMap = new Map(
    ingredientsWithRows.map((entry) => [normalize(entry.name), entry.row] as const)
  );
  portioned.forEach((entry) => {
    const row = rowMap.get(normalize(entry.name)) ?? null;
    updateIngredientTotals(entry, row);
  });

  const carbCandidate = classified.find((entry) => entry.role === "carb");
  if (carbCandidate) {
    const carbIndex = portioned.findIndex(
      (entry) => normalize(entry.name) === normalize(carbCandidate.name)
    );
    if (carbIndex >= 0) {
      const currentCalories = totalCalories(portioned);
      const remaining = slotBudget.calories - currentCalories;
      const carbDensity = Math.max(1, carbCandidate.row?.per_100g_calories ?? 120);
      const extraWeight = clamp((remaining / carbDensity) * 100, 0, 250);
      if (extraWeight > 0) {
        const baseWeight = baseWeightForUnit(
          portioned[carbIndex].amount,
          portioned[carbIndex].unit,
          normalize(portioned[carbIndex].name)
        );
        const nextWeight = baseWeight + extraWeight;
        portioned[carbIndex].amount = Number(
          amountFromWeight(
            nextWeight,
            portioned[carbIndex].unit,
            normalize(portioned[carbIndex].name)
          ).toFixed(2)
        );
        const row = rowMap.get(normalize(portioned[carbIndex].name)) ?? null;
        updateIngredientTotals(portioned[carbIndex], row);
      }
    }
  }

  const totals = sumIngredientMacros(portioned);
  const slotDelta = slotBudget.calories - totals.calories;
  if (Math.abs(slotDelta) > slotBudget.calories * 0.1) {
    const scale = clamp(slotBudget.calories / Math.max(1, totals.calories), 0.85, 1.2);
    portioned.forEach((ingredient) => {
      if (ingredient.unit === "ml" && classifyIngredient(ingredient.name, null) === "sauce") {
        return;
      }
      ingredient.amount = Number((ingredient.amount * scale).toFixed(2));
      const row = rowMap.get(normalize(ingredient.name)) ?? null;
      updateIngredientTotals(ingredient, row);
    });
  }

  const totalMacros = sumIngredientMacros(portioned);
  const totalMicros = sumIngredientMicros(portioned);

  return {
    concept: meal,
    ingredients: portioned,
    totalMacros,
    totalMicros,
    slot: meal.slot,
    day: meal.day ?? 1,
  };
}

function adjustForMicroDeficit(
  plan: PortionedMeal[],
  micro: keyof IngredientMicros,
  deficit: number
): void {
  const candidates: Array<{
    meal: PortionedMeal;
    ingredient: PortionedIngredient;
    density: number;
  }> = [];

  plan.forEach((meal) => {
    meal.ingredients.forEach((ingredient) => {
      const microValue = ingredient.micros[micro];
      const density = microValue / Math.max(1, ingredient.amount);
      if (density > 0) {
        candidates.push({ meal, ingredient, density });
      }
    });
  });

  candidates.sort((a, b) => b.density - a.density);
  let remaining = deficit;

  for (const candidate of candidates) {
    if (remaining <= 0) break;

    const ingredient = candidate.ingredient;
    const maxAmount = ingredient.amount * 1.3;
    const proposedAmount = Math.min(maxAmount, ingredient.amount * 1.12);
    if (proposedAmount <= ingredient.amount) continue;

    const scale = proposedAmount / ingredient.amount;
    ingredient.amount = Number(proposedAmount.toFixed(2));
    ingredient.macros = {
      calories: Number((ingredient.macros.calories * scale).toFixed(2)),
      protein: Number((ingredient.macros.protein * scale).toFixed(2)),
      carbs: Number((ingredient.macros.carbs * scale).toFixed(2)),
      fat: Number((ingredient.macros.fat * scale).toFixed(2)),
    };
    ingredient.micros = {
      iron_mg: Number((ingredient.micros.iron_mg * scale).toFixed(4)),
      omega_3_g: Number((ingredient.micros.omega_3_g * scale).toFixed(4)),
      b12_mcg: Number((ingredient.micros.b12_mcg * scale).toFixed(4)),
      vitamin_d_mcg: Number((ingredient.micros.vitamin_d_mcg * scale).toFixed(4)),
      folate_mcg: Number((ingredient.micros.folate_mcg * scale).toFixed(4)),
      calcium_mg: Number((ingredient.micros.calcium_mg * scale).toFixed(4)),
      fibre_g: Number((ingredient.micros.fibre_g * scale).toFixed(4)),
    };

    const carbIngredient = candidate.meal.ingredients.find((entry) => entry.macros.carbs > 8);
    if (carbIngredient) {
      const calorieOffset = ingredient.macros.calories * 0.08;
      const carbCalories = Math.max(1, carbIngredient.macros.calories);
      const reductionScale = clamp((carbCalories - calorieOffset) / carbCalories, 0.85, 1);
      carbIngredient.amount = Number((carbIngredient.amount * reductionScale).toFixed(2));
      carbIngredient.macros = {
        calories: Number((carbIngredient.macros.calories * reductionScale).toFixed(2)),
        protein: Number((carbIngredient.macros.protein * reductionScale).toFixed(2)),
        carbs: Number((carbIngredient.macros.carbs * reductionScale).toFixed(2)),
        fat: Number((carbIngredient.macros.fat * reductionScale).toFixed(2)),
      };
      carbIngredient.micros = {
        iron_mg: Number((carbIngredient.micros.iron_mg * reductionScale).toFixed(4)),
        omega_3_g: Number((carbIngredient.micros.omega_3_g * reductionScale).toFixed(4)),
        b12_mcg: Number((carbIngredient.micros.b12_mcg * reductionScale).toFixed(4)),
        vitamin_d_mcg: Number((carbIngredient.micros.vitamin_d_mcg * reductionScale).toFixed(4)),
        folate_mcg: Number((carbIngredient.micros.folate_mcg * reductionScale).toFixed(4)),
        calcium_mg: Number((carbIngredient.micros.calcium_mg * reductionScale).toFixed(4)),
        fibre_g: Number((carbIngredient.micros.fibre_g * reductionScale).toFixed(4)),
      };
    }

    candidate.meal.totalMacros = sumIngredientMacros(candidate.meal.ingredients);
    candidate.meal.totalMicros = sumIngredientMicros(candidate.meal.ingredients);
    remaining -= ingredient.micros[micro] * 0.12;
  }
}

export async function applyHealthAdjustments(
  weekPlan: PortionedMeal[],
  context: GenerationContext
): Promise<PortionedMeal[]> {
  const adjusted = weekPlan.map((meal) => ({
    ...meal,
    ingredients: meal.ingredients.map((ingredient) => ({
      ...ingredient,
      macros: { ...ingredient.macros },
      micros: { ...ingredient.micros },
    })),
    totalMacros: { ...meal.totalMacros },
    totalMicros: { ...meal.totalMicros },
  }));

  const weeklyMicros = sumWeeklyMicros(adjusted);
  const fiveDayMultiplier = 5;

  const targets: Array<{ key: keyof IngredientMicros; target?: number }> = [
    { key: "iron_mg", target: context.microTargets.iron_mg },
    { key: "omega_3_g", target: context.microTargets.omega_3_g },
    { key: "b12_mcg", target: context.microTargets.b12_mcg },
    { key: "vitamin_d_mcg", target: context.microTargets.vitamin_d_mcg },
    { key: "folate_mcg", target: context.microTargets.folate_mcg },
    { key: "calcium_mg", target: context.microTargets.calcium_mg },
    { key: "fibre_g", target: context.microTargets.fibre_g },
  ];

  targets.forEach(({ key, target }) => {
    if (!target || target <= 0) return;
    const current = weeklyMicros[key];
    const weeklyTarget = target * fiveDayMultiplier;
    if (current < weeklyTarget * 0.85) {
      adjustForMicroDeficit(adjusted, key, weeklyTarget - current);
    }
  });

  return adjusted;
}
