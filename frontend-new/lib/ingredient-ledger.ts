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
  "tinned tuna": "tuna",
  tuna: "tuna",
  "tuna canned": "tuna",
  "extra firm tofu": "tofu",
  "firm tofu": "tofu",
  scallions: "spring onions",
  "spring onion": "spring onions",
  "whole grain wrap": "whole-grain wrap",
  "whole grain wraps": "whole-grain wraps",
  "whole wheat wrap": "whole-grain wrap",
  "whole wheat wraps": "whole-grain wraps",
  "bell pepper": "bell peppers",
  peppers: "bell peppers",
  "chopped tomatoes": "diced tomatoes",
};

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

const canonicalUnit = (unit: string) => {
  const normalized = normalize(unit);
  if (normalized === "each" || normalized === "unit" || normalized === "slice") return "piece";
  return normalized || unit;
};

const canonicalName = (name: string) => {
  const normalized = normalize(name);
  return SHOPPING_NAME_ALIASES[normalized] ?? normalized;
};

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
      const key = `${canonicalName(ingredient.name)}|${unit}`;
      const quantity = Number(
        (Number.isFinite(ingredient.amount) ? ingredient.amount : 0).toFixed(4)
      );
      const existing = ledger.get(key);
      if (existing) {
        existing.quantity = Number((existing.quantity + quantity).toFixed(4));
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

  return Array.from(ledger.values()).sort((a, b) => {
    const categoryA = a.category ?? "Pantry";
    const categoryB = b.category ?? "Pantry";
    return categoryA === categoryB ? a.name.localeCompare(b.name) : categoryA.localeCompare(categoryB);
  });
};
