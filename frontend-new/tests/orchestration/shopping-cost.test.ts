import assert from "node:assert/strict";
import test from "node:test";
import { priceBasket, type PriceEntry } from "../../lib/tesco-prices.ts";
import { estimateShoppingCost } from "../../lib/shopping-cost.ts";
import { ingredientLedgerKey } from "../../lib/ingredient-ledger.ts";

const item = (name: string, quantity: number, unit = "g") => ({ name, quantity, unit, category: "Pantry" });
const catalogue: PriceEntry[] = [{ ingredient: "Chicken breast", aliases: [], unit: "g", packSize: 600, packPrice: 6, category: "fresh" },
  { ingredient: "Tofu", aliases: [], unit: "g", packSize: 500, packPrice: 2, category: "fresh" }];

test("strict pricing reuses pack ceilings, compatible SI units and preserves exact requirements", () => {
  const input = [item("Chicken breast", 550), item("Tofu", .9, "kg")]; const original = structuredClone(input);
  const priced = priceBasket(input, { strict: true, catalogue });
  assert.equal(priced.items[0].packsNeeded, 1); assert.equal(priced.items[0].amountToBuy, 600);
  assert.equal(priced.items[1].packsNeeded, 2); assert.equal(priced.items[1].amountToBuy, 1000);
  assert.equal(priced.subtotal, 10); assert.deepEqual(input, original);
  const oil = priceBasket([item("Olive oil", .55, "l")], { strict: true });
  assert.equal(oil.items[0].packsNeeded, 2); assert.equal(oil.items[0].amountNeeded, 550);
});

test("strict pricing rejects fuzzy, ambiguous form, unsupported conversion and invalid data", () => {
  for (const entry of [item("Pea protein powder", 30), item("Protein powder", 30), item("Tuna", 100), item("Fresh tuna", 100),
    item("Mixed berries", 100), item("Chicken breast cooked", 100), item("Olive oil", 10), item("Apple", 80),
    item("Prawns cooked", 100), item("Light cream cheese", 100), item("Extra-firm tofu", 100), item("Ground beef", 100),
    item("Dark chocolate", 100), item("Milk", 100, "ml"), item("Greek yogurt", 100),
    item("Chicken breast", 1, "serving"), item("Chicken breast", 1, "jar"), item("Chicken breast", 1, "unknown"),
    item("Chicken breast", 0), item("Chicken breast", -1), item("Chicken breast", Number.NaN)]) {
    assert.equal(priceBasket([entry], { strict: true }).items[0].matched, false, JSON.stringify(entry));
  }
  assert.equal(priceBasket([item("Chicken breast", 10)], { strict: true, catalogue: [{ ...catalogue[0], packSize: 0 }] }).items[0].matched, false);
  assert.equal(priceBasket([item("Chicken breast", 10)], { strict: true, catalogue: [{ ...catalogue[0], packPrice: -1 }] }).items[0].matched, false);
  const tiny = priceBasket([item("Chicken breast", .00004)], { strict: true });
  assert.equal(tiny.items[0].amountNeeded, .00004); assert.equal(tiny.items[0].packsNeeded, 1);
  // Existing consumers retain their explicitly legacy behaviour.
  assert.equal(priceBasket([item("Chicken breast cooked", 100)]).items[0].matched, true);
});

test("cost projection separates purchase packs from food used and explicit pantry ownership", () => {
  const input = [item("Chicken breast", 550)]; const now = new Date("2026-11-11T12:00:00Z");
  const result = estimateShoppingCost(input, { currency: "GBP", now });
  assert.equal(result.status, "estimated"); assert.equal(result.purchaseSubtotal, 5.5); assert.equal(result.consumedSubtotal, 3.03);
  assert.deepEqual(result.ownedIngredientKeys, []); assert.equal(result.lines[0].requiredQuantity, 550);
  const owned = estimateShoppingCost(input, { currency: "GBP", ownedIngredientKeys: [ingredientLedgerKey("Chicken breast", "g")] });
  assert.equal(owned.purchaseSubtotal, 0); assert.equal(owned.consumedSubtotal, 3.03); assert.equal(owned.lines[0].assumedOwned, true);
  assert.equal(owned.lines[0].packsNeeded, 0);
  assert.equal(result.source.observedAt, null); assert.equal(result.source.priceStatus, "date_unknown");
  assert.equal(result.source.calculatedAt, now.toISOString()); assert.equal(result.source.retailer, null);
  assert.equal(result.dietaryStatus, "unverified");
});

test("unknown prices and currencies remain explicit instead of a fabricated full basket", () => {
  const unknown = item("Pea protein powder", 40);
  const partial = estimateShoppingCost([item("Chicken breast", 100), unknown], { currency: "GBP" });
  assert.equal(partial.status, "partial"); assert.equal(partial.purchaseSubtotal, 5.5); assert.deepEqual(partial.missingItems, [unknown.name]);
  assert.equal(partial.lines[1].purchaseCost, null); assert.equal(partial.lines[1].consumedCost, null);
  const missing = estimateShoppingCost([unknown], { currency: "GBP" });
  assert.equal(missing.status, "unavailable"); assert.equal(missing.purchaseSubtotal, null); assert.equal(missing.consumedSubtotal, null);
  const ownedUnknown = estimateShoppingCost([unknown], { currency: "GBP", ownedIngredientKeys: [ingredientLedgerKey(unknown.name, unknown.unit)] });
  assert.equal(ownedUnknown.purchaseSubtotal, 0); assert.equal(ownedUnknown.consumedSubtotal, null); assert.notEqual(ownedUnknown.status, "estimated");
  const other = estimateShoppingCost([item("Chicken breast", 100)], { currency: "USD" });
  assert.equal(other.status, "unavailable"); assert.equal(other.currency, null); assert.equal(other.purchaseSubtotal, null);
});
