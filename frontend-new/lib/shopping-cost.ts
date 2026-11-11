import type { ShoppingListItem } from "./meal-generator.ts";
import { ingredientLedgerKey } from "./ingredient-ledger.ts";
import { priceBasket } from "./tesco-prices.ts";

export type ShoppingCostEstimate = {
  status: "estimated" | "partial" | "unavailable";
  currency: "GBP" | null;
  purchaseSubtotal: number | null;
  consumedSubtotal: number | null;
  missingItems: string[];
  ownedIngredientKeys: string[];
  lines: Array<{ key: string; name: string; requiredQuantity: number; unit: string; matched: boolean; assumedOwned: boolean;
    packsNeeded: number | null; packSize: string | null; purchaseCost: number | null; consumedCost: number | null; reason?: string }>;
  source: { name: string; reference: string; region: "UK"; retailer: null; observedAt: null; calculatedAt: string; priceStatus: "date_unknown" };
  dietaryStatus: "unverified";
};

const money = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

/** Cost-only projection: never alters recipe quantities, nutrition or approval. */
export const estimateShoppingCost = (items: ShoppingListItem[], options: { currency: string; ownedIngredientKeys?: readonly string[]; now?: Date }): ShoppingCostEstimate => {
  const supported = options.currency === "GBP";
  const owned = new Set(options.ownedIngredientKeys ?? []);
  const priced = priceBasket(items, { strict: true });
  let purchase = 0; let consumed = 0; let knownPurchase = 0; let knownConsumed = 0;
  const lines = items.map((item, index) => {
    const key = ingredientLedgerKey(item.name, item.unit);
    const assumedOwned = owned.has(key);
    const line = priced.items[index];
    const matched = supported && line.matched;
    const purchaseCost = supported && assumedOwned ? 0 : matched ? line.totalCost : null;
    const consumedRaw = matched ? line.amountNeeded / line.amountToBuy * line.totalCost : null;
    if (purchaseCost !== null) { purchase += purchaseCost; knownPurchase++; }
    if (consumedRaw !== null) { consumed += consumedRaw; knownConsumed++; }
    return { key, name: item.displayName ?? item.name, requiredQuantity: item.quantity, unit: item.unit, matched, assumedOwned,
      packsNeeded: supported && assumedOwned ? 0 : matched ? line.packsNeeded : null,
      packSize: matched ? line.packSize : null, purchaseCost, consumedCost: consumedRaw === null ? null : money(consumedRaw),
      ...(!matched ? { reason: supported ? "No compatible price and pack assumption" : "Unsupported currency" } : {}) };
  });
  const missingItems = lines.filter(line => !line.matched).map(line => line.name);
  return {
    status: !supported || !knownPurchase && !knownConsumed ? "unavailable" : missingItems.length ? "partial" : "estimated",
    currency: supported ? "GBP" : null, purchaseSubtotal: knownPurchase ? money(purchase) : null,
    consumedSubtotal: knownConsumed ? money(consumed) : null, missingItems,
    ownedIngredientKeys: lines.filter(line => line.assumedOwned).map(line => line.key), lines,
    source: { name: "Ovona illustrative price catalogue", reference: "lib/tesco-prices.ts", region: "UK", retailer: null,
      observedAt: null, calculatedAt: (options.now ?? new Date()).toISOString(), priceStatus: "date_unknown" }, dietaryStatus: "unverified",
  };
};
