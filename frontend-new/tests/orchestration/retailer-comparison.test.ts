import assert from "node:assert/strict";
import test from "node:test";
import { compareRetailerBaskets, type RetailerObservation } from "../../lib/retailer-comparison.ts";

const now = new Date("2026-10-13T12:00:00.000Z");
const items = [{ name: "Chicken", displayName: "Chicken", quantity: 500, unit: "g" }];
const observation = (retailerId: string, unitPrice: number, extra: Partial<RetailerObservation> = {}): RetailerObservation => ({
  retailerId, retailerName: retailerId, ingredientKey: "chicken", packSize: 500, packUnit: "g", unitPrice, currency: "GBP", estimated: false,
  sourceReference: "feed-row", provenanceStatus: "licensed_feed", observedAt: "2026-10-13T11:00:00.000Z", ...extra,
});

test("compares fully sourced, fresh retailer baskets and evaluates budget after meal selection", () => {
  const result = compareRetailerBaskets(items, [observation("alpha", 4), observation("bravo", 3)], 3.5, now);
  assert.equal(result.status, "qualified");
  if (result.status === "qualified") {
    assert.equal(result.bestRetailer.id, "bravo");
    assert.equal(result.lowestObservedCompleteBasket, 3);
    assert.equal(result.withinBudget, true);
  }
});

test("never exposes a price claim from stale, estimated, partial, or single-retailer evidence", () => {
  for (const observations of [
    [observation("alpha", 4)],
    [observation("alpha", 4, { observedAt: "2026-10-12T11:59:59.000Z" }), observation("bravo", 3)],
    [observation("alpha", 4, { estimated: true }), observation("bravo", 3)],
    [observation("alpha", 4), observation("bravo", 3, { ingredientKey: "tofu" })],
  ]) {
    const result = compareRetailerBaskets(items, observations, 10, now);
    assert.equal(result.status, "price_comparison_unavailable");
    if (result.status === "price_comparison_unavailable") {
      assert.equal("bestRetailer" in result, false);
      assert.equal("lowestObservedCompleteBasket" in result, false);
      assert.equal("withinBudget" in result, false);
    }
  }
});
