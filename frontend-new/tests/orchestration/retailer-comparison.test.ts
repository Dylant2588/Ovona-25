import assert from "node:assert/strict";
import test from "node:test";
import { compareRetailerBaskets, type RetailerObservation } from "../../lib/retailer-comparison.ts";
import { acceptOperatorObservationBatch } from "../../lib/retailer-observation-adapters.ts";

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

test("missing retailer suitability is explicitly unverified and blocks restricted qualification", () => {
  const observations = [observation("alpha", 4), observation("bravo", 3)];
  const unrestricted = compareRetailerBaskets(items, observations, 10, now);
  assert.equal(unrestricted.dietaryStatus, "unverified");
  const restricted = compareRetailerBaskets(items, observations, 10, now, { allergies: ["milk"] });
  assert.equal(restricted.status, "price_comparison_unavailable");
  assert.equal(restricted.dietaryStatus, "unverified");
});

test("retailer restrictions are applied before price ranking including derivatives and exclusions", () => {
  const evidence = { status: "reviewed" as const, allergens: [], mayContain: [], ingredients: ["chicken"], dietaryTags: ["omnivore"] };
  const safe = [observation("alpha", 4, { suitability: evidence }), observation("bravo", 5, { suitability: evidence })];
  const unsafe = observation("alpha", 1, { suitability: { ...evidence, allergens: ["casein"] } });
  const result = compareRetailerBaskets(items, [...safe, unsafe], 10, now, { allergies: ["milk"] });
  assert.equal(result.status, "qualified");
  assert.equal(result.dietaryStatus, "verified");
  if (result.status === "qualified") assert.equal(result.lowestObservedCompleteBasket, 4);
  for (const constraints of [{ neverFoods: ["chicken"] }, { dietaryMode: "vegan" }, { allergies: ["unknown"] }]) {
    assert.equal(compareRetailerBaskets(items, safe, 10, now, constraints).status, "price_comparison_unavailable");
  }
  const breast = safe.map(o => ({ ...o, suitability: { ...evidence, ingredients: ["chicken breast"] } }));
  assert.equal(compareRetailerBaskets(items, breast, 10, now, { neverFoods: ["breast"] }).status, "price_comparison_unavailable");
});

test("operator evidence preserves reviewed suitability and rejects malformed declarations", () => {
  const suitability = { status: "reviewed" as const, allergens: [], mayContain: [], ingredients: ["chicken"], dietaryTags: [] };
  const batch = { adapterVersion: "1", importedBy: "operator", importBatchId: "batch", observations: [{ ...observation("alpha", 4), importedAt: now.toISOString(), suitability }] };
  const accepted = acceptOperatorObservationBatch(batch);
  assert.equal(accepted.ok, true);
  if (accepted.ok) assert.deepEqual(accepted.value.observations[0].suitability, suitability);
  for (const invalid of [{ status: "reviewed" }, { ...suitability, ingredients: [] }, { ...suitability, allergens: [null] }]) {
    assert.equal(acceptOperatorObservationBatch({ ...batch, observations: [{ ...batch.observations[0], suitability: invalid as never }] }).ok, false);
  }
});
