export type FinalMealIngredient = {
  name: string;
  amount: number;
  unit: string;
  category?: string;
};

export type FinalMealForShopping = {
  mealKind?: "recipe" | "social";
  ingredients?: FinalMealIngredient[];
};

export type IngredientLedgerItem = {
  name: string;
  displayName: string;
  quantity: number;
  amountNeeded: number;
  unit: string;
  category?: string;
};

const SHOPPING_NAME_ALIASES: Record<string, string> = {
  "turkey mince": "ground turkey",
  // Food form is part of identity: fresh/unspecified tuna is not canned tuna,
  // and tofu firmness affects both preparation and purchasing requirements.
  "tinned tuna": "canned tuna",
  "tuna canned": "canned tuna",
  "extra firm tofu": "extra-firm tofu",
  scallions: "spring onions",
  "spring onion": "spring onions",
  "whole grain wrap": "whole-grain wraps",
  "whole grain wraps": "whole-grain wraps",
  "whole-grain wrap": "whole-grain wraps",
  "whole wheat wrap": "whole-wheat wraps",
  "whole wheat wraps": "whole-wheat wraps",
  "whole-wheat wrap": "whole-wheat wraps",
  "bell pepper": "bell peppers",
};

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

const canonicalUnit = (unit: string) => {
  const normalized = normalize(unit);
  // A slice is not interchangeable with a whole piece of the same named food.
  if (normalized === "each" || normalized === "unit") return "piece";
  if (normalized === "kg") return "g";
  if (normalized === "l") return "ml";
  return normalized || unit;
};

const canonicalName = (name: string) => {
  const normalized = normalize(name);
  return SHOPPING_NAME_ALIASES[normalized] ?? normalized;
};

/** Shared identity for totals and their meal provenance, including exact SI units. */
export const ingredientLedgerKey = (name: string, unit: string) => `${canonicalName(name)}|${canonicalUnit(unit)}`;

/**
 * Sums exactly the materialized ingredients on the meals a person approved.
 * This deliberately has no nutrition, substitution, or portion-scaling logic:
 * those decisions happen before a meal becomes part of the plan.
 */
export const buildFinalIngredientLedger = (
  meals: FinalMealForShopping[]
): IngredientLedgerItem[] => {
  const ledger = new Map<string, IngredientLedgerItem>();

  meals.forEach((meal) => {
    if (meal.mealKind === "social") return;
    (meal.ingredients ?? []).forEach((ingredient) => {
      const unit = canonicalUnit(ingredient.unit);
      const key = ingredientLedgerKey(ingredient.name, unit);
      // Only exact SI conversions are implicit. Do not infer mass/volume,
      // spoon/count sizes or raw/cooked yields from an ingredient name.
      const scale = ["kg", "l"].includes(normalize(ingredient.unit)) ? 1000 : 1;
      const quantity = (Number.isFinite(ingredient.amount) ? ingredient.amount : 0) * scale;
      const existing = ledger.get(key);
      if (existing) {
        existing.quantity += quantity;
        existing.amountNeeded = existing.quantity;
        if (!existing.category && ingredient.category) existing.category = ingredient.category;
        return;
      }
      ledger.set(key, {
        name: ingredient.name,
        displayName: ingredient.name,
        unit,
        category: ingredient.category,
        quantity,
        amountNeeded: quantity,
      });
    });
  });

  // Suppress binary arithmetic noise once, after summing. A fixed decimal
  // cutoff would silently turn small positive recipe requirements into zero.
  return Array.from(ledger.values()).map(item => {
    const quantity = Number(item.quantity.toPrecision(15));
    return { ...item, quantity, amountNeeded: quantity };
  }).sort((a, b) => {
    const categoryA = a.category ?? "Pantry";
    const categoryB = b.category ?? "Pantry";
    return categoryA === categoryB ? a.name.localeCompare(b.name) : categoryA.localeCompare(categoryB);
  });
};
