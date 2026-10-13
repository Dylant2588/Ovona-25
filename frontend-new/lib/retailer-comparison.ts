import type { ShoppingListItem } from "@/lib/meal-generator";

export type RetailerObservation = Readonly<{
  retailerId: string;
  retailerName: string;
  ingredientKey: string;
  packSize: number;
  packUnit: string;
  unitPrice: number;
  currency: string;
  estimated: boolean;
  sourceReference: string;
  provenanceStatus: "operator_imported" | "licensed_feed";
  observedAt: string;
}>;

export type QualifiedRetailerComparison = Readonly<{
  status: "qualified";
  claimable: true;
  currency: string;
  bestRetailer: Readonly<{ id: string; name: string }>;
  lowestObservedCompleteBasket: number;
  withinBudget: boolean;
  retailers: readonly Readonly<{ id: string; name: string; total: number }>[];
}>;

export type UnavailableRetailerComparison = Readonly<{
  status: "price_comparison_unavailable";
  claimable: false;
  reasons: readonly string[];
  unmatchedItems: readonly string[];
}>;

export type RetailerComparison = QualifiedRetailerComparison | UnavailableRetailerComparison;

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
const compatibleUnit = (required: string, pack: string) => {
  const left = normalize(required);
  const right = normalize(pack);
  return left === right || (["piece", "large"].includes(left) && ["piece", "large"].includes(right));
};
const amount = (item: ShoppingListItem) => Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 0;
const unavailable = (reasons: readonly string[], unmatchedItems: readonly string[]): UnavailableRetailerComparison => ({
  status: "price_comparison_unavailable", claimable: false,
  reasons: [...new Set(reasons)], unmatchedItems: [...new Set(unmatchedItems)],
});

const validObservation = (observation: RetailerObservation, now: Date) => {
  const observedAt = Date.parse(observation.observedAt);
  return Boolean(
    observation.retailerId.trim() && observation.retailerName.trim() && observation.ingredientKey.trim() &&
    observation.sourceReference.trim() && ["operator_imported", "licensed_feed"].includes(observation.provenanceStatus) &&
    /^[A-Z]{3}$/.test(observation.currency) && Number.isFinite(observation.packSize) && observation.packSize > 0 &&
    Number.isFinite(observation.unitPrice) && observation.unitPrice >= 0 && !observation.estimated &&
    Number.isFinite(observedAt) && observedAt <= now.getTime() && now.getTime() - observedAt <= MAX_AGE_MS,
  );
};

/**
 * Returns retailer pricing only when every requested line has fresh,
 * retailer-provenanced evidence at every retailer being compared.
 */
export function compareRetailerBaskets(
  items: readonly ShoppingListItem[],
  observations: readonly RetailerObservation[],
  weeklyBudget: number | null | undefined,
  now = new Date(),
): RetailerComparison {
  if (!items.length) return unavailable(["no_shopping_items"], []);
  const invalidItems = items.filter((item) => !amount(item));
  if (invalidItems.length) return unavailable(["invalid_shopping_requirement"], invalidItems.map((item) => item.displayName ?? item.name));

  const qualified = observations.filter((observation) => validObservation(observation, now));
  const retailerIds = [...new Set(qualified.map((observation) => observation.retailerId))];
  const reasons: string[] = [];
  if (retailerIds.length < 2) reasons.push("fewer_than_two_comparable_retailers");
  const unmatched = new Set<string>();
  const baskets: Array<{ id: string; name: string; total: number; currency: string }> = [];

  for (const retailerId of retailerIds) {
    const retailerObservations = qualified.filter((observation) => observation.retailerId === retailerId);
    const retailerName = retailerObservations[0]?.retailerName ?? retailerId;
    let total = 0;
    for (const item of items) {
      const matches = retailerObservations.filter((observation) =>
        normalize(observation.ingredientKey) === normalize(item.displayName ?? item.name) && compatibleUnit(item.unit, observation.packUnit),
      );
      if (!matches.length) {
        unmatched.add(item.displayName ?? item.name);
        continue;
      }
      const bestPack = [...matches].sort((left, right) => left.unitPrice - right.unitPrice || left.packSize - right.packSize)[0]!;
      total += Math.ceil(amount(item) / bestPack.packSize) * bestPack.unitPrice;
    }
    baskets.push({ id: retailerId, name: retailerName, total: Number(total.toFixed(2)), currency: retailerObservations[0]?.currency ?? "" });
  }

  const currencies = new Set(baskets.map((basket) => basket.currency));
  if (currencies.size !== 1) reasons.push("currency_mismatch");
  if (unmatched.size) reasons.push("incomplete_retailer_coverage");
  if (reasons.length) return unavailable(reasons, [...unmatched]);

  const retailers = baskets.sort((left, right) => left.total - right.total || left.name.localeCompare(right.name));
  const best = retailers[0]!;
  return {
    status: "qualified", claimable: true, currency: best.currency,
    bestRetailer: { id: best.id, name: best.name },
    lowestObservedCompleteBasket: best.total,
    withinBudget: typeof weeklyBudget === "number" && Number.isFinite(weeklyBudget) && weeklyBudget > 0 ? best.total <= weeklyBudget : false,
    retailers: retailers.map(({ id, name, total }) => ({ id, name, total })),
  };
}
