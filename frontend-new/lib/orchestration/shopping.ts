import type { ShoppingListItem } from "../meal-generator";
import type { WeekSchedule } from "./types.ts";

export type OrchestrationShoppingLine = Readonly<ShoppingListItem & {
  normalizedName: string;
  pantry: boolean;
  sourceMealIds: readonly string[];
}>;

export type OrchestrationShoppingList = Readonly<{
  buyItems: readonly OrchestrationShoppingLine[];
  pantryItems: readonly OrchestrationShoppingLine[];
}>;

type MutableLine = { -readonly [Key in keyof Omit<OrchestrationShoppingLine, "sourceMealIds">]: OrchestrationShoppingLine[Key] } & { sourceMealIds: string[] };

const normalized = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
const finitePositive = (value: number) => Number.isFinite(value) && value > 0;

/**
 * Materializes a shopping list from the schedule's already household-scaled servings.
 * Ingredient quantities are per recipe serving, so household size must never be read here.
 */
export const buildOrchestrationShoppingList = (result: WeekSchedule): OrchestrationShoppingList => {
  const lines = new Map<string, MutableLine>();

  for (const day of result.days) {
    for (const meal of day.meals) {
      if (!finitePositive(meal.servings)) continue;
      for (const ingredient of meal.ingredients) {
        if (!finitePositive(ingredient.quantity)) continue;
        const normalizedName = normalized(ingredient.normalizedName);
        const unit = ingredient.unit.trim();
        if (!normalizedName || !unit) continue;
        const pantry = ingredient.pantry;
        const key = `${normalizedName}|${normalized(unit)}|${pantry ? "pantry" : "buy"}`;
        const quantity = Number((ingredient.quantity * meal.servings).toFixed(6));
        const existing = lines.get(key);
        if (existing) {
          existing.quantity = Number((existing.quantity + quantity).toFixed(6));
          existing.amountNeeded = existing.quantity;
          existing.amountToBuy = existing.quantity;
          if (!existing.sourceMealIds.includes(meal.candidateId)) existing.sourceMealIds.push(meal.candidateId);
          continue;
        }
        lines.set(key, {
          name: ingredient.name,
          displayName: ingredient.name,
          normalizedName,
          quantity,
          amountNeeded: quantity,
          amountToBuy: quantity,
          unit,
          pantry,
          sourceMealIds: [meal.candidateId],
        });
      }
    }
  }

  const allLines = [...lines.values()].map((line) => ({ ...line, sourceMealIds: [...line.sourceMealIds] }));
  return {
    buyItems: allLines.filter((line) => !line.pantry),
    pantryItems: allLines.filter((line) => line.pantry),
  };
};
