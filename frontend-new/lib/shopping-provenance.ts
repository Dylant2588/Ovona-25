import { buildFinalIngredientLedger, ingredientLedgerKey, type FinalMealForShopping } from "./ingredient-ledger.ts";

type SourceMeal = FinalMealForShopping & { title: string };
export type ShoppingMealSource = { title: string; meals: number; quantity: number; unit: string };

/** Explain the existing ledger; do not recalculate portions or infer ingredients. */
export function shoppingMealSources(days: readonly { meals: readonly SourceMeal[] }[]): Map<string, ShoppingMealSource[]> {
  const result = new Map<string, ShoppingMealSource[]>();
  for (const day of days) for (const meal of day.meals) {
    for (const item of buildFinalIngredientLedger([meal])) {
      const key = ingredientLedgerKey(item.name, item.unit);
      const sources = result.get(key) ?? [];
      const existing = sources.find(source => source.title === meal.title);
      if (existing) { existing.meals++; existing.quantity += item.quantity; }
      else sources.push({ title: meal.title, meals: 1, quantity: item.quantity, unit: item.unit });
      result.set(key, sources);
    }
  }
  return result;
}

export const shoppingSourceLabel = (sources: readonly ShoppingMealSource[]) => sources.map(source =>
  `${source.title}${source.meals > 1 ? ` (${source.meals} meals)` : ""}`).join(", ");
