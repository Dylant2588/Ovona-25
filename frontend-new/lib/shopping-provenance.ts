import { buildFinalIngredientLedger, ingredientLedgerKey, type FinalMealForShopping } from "./ingredient-ledger.ts";

type SourceMeal = FinalMealForShopping & { title: string; baseId?: string; recipeVersion?: number };
export type ShoppingMealSource = { title: string; meals: number; quantity: number; unit: string; recipeId?: string; recipeVersion?: number };

/** Recipe identity, not a mutable title, groups known sources; legacy titles remain readable. */
export const shoppingSourceKey = (source: Pick<ShoppingMealSource, "title" | "recipeId" | "recipeVersion">) =>
  source.recipeId ? JSON.stringify(["recipe", source.recipeId, source.recipeVersion ?? null]) : JSON.stringify(["legacy", source.title]);

/** Explain the existing ledger; do not recalculate portions or infer ingredients. */
export function shoppingMealSources(days: readonly { meals: readonly SourceMeal[] }[]): Map<string, ShoppingMealSource[]> {
  const result = new Map<string, ShoppingMealSource[]>();
  for (const day of days) for (const meal of day.meals) {
    for (const item of buildFinalIngredientLedger([meal])) {
      const key = ingredientLedgerKey(item.name, item.unit);
      const sources = result.get(key) ?? [];
      const identity = meal.baseId ? { recipeId: meal.baseId, ...(meal.recipeVersion !== undefined ? { recipeVersion: meal.recipeVersion } : {}) } : {};
      const sourceKey = shoppingSourceKey({ title: meal.title, ...identity });
      const existing = sources.find(source => shoppingSourceKey(source) === sourceKey);
      if (existing) { existing.meals++; existing.quantity += item.quantity; }
      else sources.push({ title: meal.title, meals: 1, quantity: item.quantity, unit: item.unit, ...identity });
      result.set(key, sources);
    }
  }
  return result;
}

export const shoppingSourceLabel = (sources: readonly ShoppingMealSource[]) => sources.map(source =>
  `${source.title}${source.meals > 1 ? ` (${source.meals} meals)` : ""}`).join(", ");
