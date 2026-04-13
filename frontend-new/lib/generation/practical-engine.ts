import type { SupabaseClient } from "@supabase/supabase-js";
import { priceBasket } from "@/lib/tesco-prices";
import type { ShoppingListItem } from "@/lib/meal-generator";
import type {
  PortionedMeal,
  PracticalOutput,
  ShoppingItem,
} from "@/lib/generation/types";

type AggregatedItem = {
  name: string;
  total: number;
  unit: string;
  category: string;
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const substitutionMap: Record<string, string> = {
  "salmon fillet": "chicken thighs",
  "smoked salmon": "tinned tuna",
  "cod fillet": "chicken thighs",
  shrimp: "chicken thighs",
  prawns: "chicken thighs",
  "sirloin steak": "ground turkey",
  "beef steak": "ground turkey",
  tempeh: "tofu",
};

const isCountableUnit = (unit: string) =>
  ["large", "each", "piece", "slice", "unit"].includes(unit.toLowerCase());

export function humaniseAmount(amount: number, unit: string): string {
  if (isCountableUnit(unit)) {
    return `${Math.max(1, Math.round(amount))}`;
  }
  if (unit === "g") {
    if (amount <= 10) return `${Math.round(amount)}g`;
    if (amount <= 50) return `${Math.round(amount / 5) * 5}g`;
    if (amount <= 200) return `${Math.round(amount / 10) * 10}g`;
    if (amount <= 500) return `${Math.round(amount / 25) * 25}g`;
    return `${Math.round(amount / 50) * 50}g`;
  }
  if (unit === "ml") {
    if (amount <= 30) return `${Math.round(amount / 5) * 5}ml`;
    if (amount <= 100) return `${Math.round(amount / 10) * 10}ml`;
    if (amount <= 500) return `${Math.round(amount / 25) * 25}ml`;
    return `${Math.round(amount / 50) * 50}ml`;
  }
  return `${Math.round(amount * 10) / 10} ${unit}`;
}

function aggregateIngredients(plan: PortionedMeal[]): Map<string, AggregatedItem> {
  const map = new Map<string, AggregatedItem>();

  for (const meal of plan) {
    for (const ingredient of meal.ingredients) {
      const key = `${normalize(ingredient.name)}|${ingredient.unit.toLowerCase()}`;
      const existing = map.get(key);
      if (existing) {
        existing.total += ingredient.amount;
      } else {
        map.set(key, {
          name: ingredient.name,
          total: ingredient.amount,
          unit: ingredient.unit,
          category: ingredient.category || "Other",
        });
      }
    }
  }

  return map;
}

const aggregateToShoppingItems = (aggregated: Map<string, AggregatedItem>): ShoppingListItem[] =>
  Array.from(aggregated.values()).map((item) => ({
    name: item.name,
    displayName: item.name,
    quantity: Number(item.total.toFixed(4)),
    amountNeeded: Number(item.total.toFixed(4)),
    unit: item.unit,
    category: item.category,
  }));

const toOutputShoppingItems = (
  items: ShoppingListItem[],
  basket: ReturnType<typeof priceBasket>
): ShoppingItem[] => {
  const lines = new Map<string, ReturnType<typeof priceBasket>["items"][number]>();
  basket.items.forEach((line) => lines.set(normalize(line.ingredient), line));

  return items.map((item) => {
    const line = lines.get(normalize(item.displayName ?? item.name));
    const matched = Boolean(line?.matched);
    const packSize = line?.packSize ?? "";
    const parsedPackSize = Number(packSize.replace(/[^\d.]/g, "")) || item.quantity;
    return {
      name: item.displayName ?? item.name,
      amountNeeded: item.amountNeeded ?? item.quantity,
      amountToBuy: line?.amountToBuy ?? (item.amountNeeded ?? item.quantity),
      unit: item.unit,
      category: item.category ?? "Other",
      pricePerPack:
        matched && line?.packsNeeded
          ? Number((line.totalCost / Math.max(1, line.packsNeeded)).toFixed(2))
          : 0,
      packSize: parsedPackSize,
      packsNeeded: line?.packsNeeded ?? 0,
      totalPrice: matched ? line?.totalCost ?? 0 : 0,
    };
  });
};

const applySubstitution = (plan: PortionedMeal[], from: string, to: string) => {
  const fromNormalized = normalize(from);
  plan.forEach((meal) => {
    meal.ingredients.forEach((ingredient) => {
      if (normalize(ingredient.name) === fromNormalized) {
        ingredient.name = to;
      }
    });
    meal.concept.ingredients = meal.concept.ingredients.map((ingredientName) =>
      normalize(ingredientName) === fromNormalized ? to : ingredientName
    );
  });
};

export async function optimiseAndPrice(
  plan: PortionedMeal[],
  budget: number,
  supabase: SupabaseClient
): Promise<PracticalOutput> {
  void supabase;
  const adjustedPlan = plan.map((meal) => ({
    ...meal,
    concept: { ...meal.concept, ingredients: [...meal.concept.ingredients] },
    ingredients: meal.ingredients.map((ingredient) => ({ ...ingredient })),
  }));
  const substitutionsMade: string[] = [];

  let aggregated = aggregateIngredients(adjustedPlan);
  let shoppingItems = aggregateToShoppingItems(aggregated);
  let basket = priceBasket(shoppingItems);
  let weeklyTotal = basket.subtotal;
  let safety = 0;

  while (weeklyTotal > budget && safety < 8) {
    safety += 1;
    const expensiveMatched = [...basket.items]
      .filter((item) => item.matched && item.totalCost > 0)
      .sort((a, b) => b.totalCost - a.totalCost);

    const target = expensiveMatched.find((item) => {
      const substitute = substitutionMap[normalize(item.ingredient)];
      return Boolean(substitute);
    });
    if (!target) break;

    const replacement = substitutionMap[normalize(target.ingredient)];
    if (!replacement) break;

    applySubstitution(adjustedPlan, target.ingredient, replacement);
    substitutionsMade.push(
      `Swapped ${target.ingredient} for ${replacement} to reduce weekly cost.`
    );

    aggregated = aggregateIngredients(adjustedPlan);
    shoppingItems = aggregateToShoppingItems(aggregated);
    const nextBasket = priceBasket(shoppingItems);
    if (nextBasket.subtotal >= basket.subtotal) {
      break;
    }
    basket = nextBasket;
    weeklyTotal = basket.subtotal;
  }

  const shoppingList = toOutputShoppingItems(shoppingItems, basket);
  weeklyTotal = basket.subtotal;

  return {
    adjustedPlan,
    shoppingList,
    weeklyTotal,
    substitutionsMade,
  };
}
