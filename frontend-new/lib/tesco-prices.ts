import type { ShoppingListItem } from "@/lib/meal-generator";

type PriceCategory = "fresh" | "staples";

type PriceEntry = {
  ingredient: string;
  aliases: string[];
  unit: "g" | "ml" | "piece" | "large";
  packSize: number;
  packPrice: number;
  category: PriceCategory;
};

export type PricedBasketLine = {
  ingredient: string;
  packsNeeded: number;
  packSize: string;
  totalCost: number;
  matched: boolean;
};

export type BasketPricing = {
  subtotal: number;
  freshCost: number;
  staplesCost: number;
  itemCount: number;
  unmatchedItems: string[];
  items: PricedBasketLine[];
};

const PRICE_DB: PriceEntry[] = [
  { ingredient: "Chicken breast", aliases: ["chicken breast", "chicken fillet"], unit: "g", packSize: 500, packPrice: 3.8, category: "fresh" },
  { ingredient: "Chicken thighs", aliases: ["chicken thighs"], unit: "g", packSize: 650, packPrice: 3.6, category: "fresh" },
  { ingredient: "Ground turkey", aliases: ["ground turkey", "turkey mince"], unit: "g", packSize: 500, packPrice: 4.2, category: "fresh" },
  { ingredient: "Salmon fillet", aliases: ["salmon fillet", "salmon"], unit: "g", packSize: 240, packPrice: 4.5, category: "fresh" },
  { ingredient: "Shrimp", aliases: ["shrimp", "prawns"], unit: "g", packSize: 300, packPrice: 4.8, category: "fresh" },
  { ingredient: "Eggs", aliases: ["eggs", "egg"], unit: "large", packSize: 6, packPrice: 2.1, category: "fresh" },
  { ingredient: "Greek yogurt", aliases: ["greek yogurt"], unit: "g", packSize: 500, packPrice: 1.75, category: "fresh" },
  { ingredient: "Cottage cheese", aliases: ["cottage cheese"], unit: "g", packSize: 300, packPrice: 1.6, category: "fresh" },
  { ingredient: "Tofu", aliases: ["tofu", "extra-firm tofu"], unit: "g", packSize: 280, packPrice: 2.0, category: "fresh" },
  { ingredient: "Whey protein", aliases: ["whey protein", "protein powder"], unit: "g", packSize: 1000, packPrice: 22, category: "staples" },
  { ingredient: "Rolled oats", aliases: ["rolled oats"], unit: "g", packSize: 1000, packPrice: 1.5, category: "staples" },
  { ingredient: "Almond milk", aliases: ["almond milk"], unit: "ml", packSize: 1000, packPrice: 1.8, category: "staples" },
  { ingredient: "Light coconut milk", aliases: ["light coconut milk", "coconut milk"], unit: "ml", packSize: 400, packPrice: 1.3, category: "staples" },
  { ingredient: "Brown rice", aliases: ["brown rice"], unit: "g", packSize: 1000, packPrice: 2.2, category: "staples" },
  { ingredient: "Jasmine rice", aliases: ["jasmine rice"], unit: "g", packSize: 1000, packPrice: 2.0, category: "staples" },
  { ingredient: "Soba noodles", aliases: ["soba noodles"], unit: "g", packSize: 300, packPrice: 1.9, category: "staples" },
  { ingredient: "Black beans", aliases: ["black beans"], unit: "g", packSize: 400, packPrice: 0.8, category: "staples" },
  { ingredient: "Peanut butter", aliases: ["peanut butter"], unit: "g", packSize: 340, packPrice: 2.5, category: "staples" },
  { ingredient: "Dark chocolate", aliases: ["dark chocolate"], unit: "g", packSize: 180, packPrice: 2.2, category: "staples" },
  { ingredient: "Walnuts", aliases: ["walnuts"], unit: "g", packSize: 200, packPrice: 2.9, category: "staples" },
  { ingredient: "Mixed berries", aliases: ["mixed berries", "blueberries"], unit: "g", packSize: 300, packPrice: 3.2, category: "fresh" },
  { ingredient: "Avocado", aliases: ["avocado"], unit: "piece", packSize: 2, packPrice: 1.8, category: "fresh" },
  { ingredient: "Cucumber", aliases: ["cucumber"], unit: "piece", packSize: 1, packPrice: 0.8, category: "fresh" },
  { ingredient: "Cherry tomatoes", aliases: ["cherry tomatoes", "tomatoes"], unit: "g", packSize: 250, packPrice: 1.2, category: "fresh" },
  { ingredient: "Spinach", aliases: ["spinach", "baby greens"], unit: "g", packSize: 200, packPrice: 1.25, category: "fresh" },
];

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const formatPack = (entry: PriceEntry) => `${entry.packSize}${entry.unit}`;

const unitsCompatible = (inputUnit: string, targetUnit: PriceEntry["unit"]) => {
  const from = normalize(inputUnit);
  if (from === targetUnit) return true;
  if ((from === "piece" || from === "each" || from === "unit") && (targetUnit === "piece" || targetUnit === "large")) {
    return true;
  }
  if (from === "large" && targetUnit === "piece") return true;
  return false;
};

const findEntry = (name: string) => {
  const candidate = normalize(name);
  return PRICE_DB.find((entry) =>
    entry.aliases.some((alias) => candidate.includes(normalize(alias)))
  );
};

export const priceBasket = (items: ShoppingListItem[]): BasketPricing => {
  const lines: PricedBasketLine[] = [];
  const unmatched = new Set<string>();
  let subtotal = 0;
  let freshCost = 0;
  let staplesCost = 0;

  items.forEach((item) => {
    const entry = findEntry(item.displayName ?? item.name);
    if (!entry || !unitsCompatible(item.unit, entry.unit)) {
      lines.push({
        ingredient: item.displayName ?? item.name,
        packsNeeded: 0,
        packSize: "-",
        totalCost: 0,
        matched: false,
      });
      unmatched.add(item.displayName ?? item.name);
      return;
    }

    const qty = Number.isFinite(item.quantity) ? Math.max(item.quantity, 0) : 0;
    const packsNeeded = Math.max(1, Math.ceil(qty / entry.packSize));
    const totalCost = Number((packsNeeded * entry.packPrice).toFixed(2));
    subtotal += totalCost;
    if (entry.category === "fresh") {
      freshCost += totalCost;
    } else {
      staplesCost += totalCost;
    }
    lines.push({
      ingredient: item.displayName ?? item.name,
      packsNeeded,
      packSize: formatPack(entry),
      totalCost,
      matched: true,
    });
  });

  return {
    subtotal: Number(subtotal.toFixed(2)),
    freshCost: Number(freshCost.toFixed(2)),
    staplesCost: Number(staplesCost.toFixed(2)),
    itemCount: items.length,
    unmatchedItems: Array.from(unmatched),
    items: lines,
  };
};

