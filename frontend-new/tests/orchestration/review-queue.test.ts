import assert from "node:assert/strict";
import test from "node:test";
import { reviewQueueEntries, reviewQueueKey } from "../../lib/recipes/review-queue.ts";
import { calculatedRecipe } from "./calculated-recipe-fixtures.ts";
import { recipeRecordErrors } from "../../lib/recipes/repository.ts";

test("mixed valid and malformed saved drafts retain usable entries without unsafe display fields", () => {
  const record = calculatedRecipe(); record.review = { status: "pending_review", reviewedBy: null, reviewedAt: null };
  record.source.reviewed = false; record.nutrition.reviewed = false; record.ingredients.forEach(ingredient => { ingredient.reviewed = false; });
  const good = { id: record.id, version: 1, record };
  const broken = { ...good, id: "broken", record: { ...record, id: "broken", slots: null, ingredients: {}, macros: null } };
  const entries = reviewQueueEntries([broken, good, null, { ...good, record: { ...record, description: {} } }]);
  assert.equal(entries.length, 4);
  assert.equal(entries[0].record, null); assert.match(entries[0].title, /broken/); assert.ok(entries[0].validationErrors.length);
  assert.equal(entries[1].record?.title, record.title); assert.deepEqual(entries[1].validationErrors, []);
  assert.equal(entries[2].record, null); assert.equal(entries[3].record, null);
  assert.deepEqual(reviewQueueEntries(null), []);
});

test("hostile enum JSON returns structural errors without object-to-string coercion", () => {
  const hostile = { toString: null };
  for (const field of ["proteinType", "source", "review", "ingredients"]) {
    const value = calculatedRecipe() as unknown as Record<string, unknown>;
    if (field === "source") (value.source as Record<string, unknown>).kind = hostile;
    else if (field === "review") (value.review as Record<string, unknown>).status = hostile;
    else if (field === "ingredients") ((value.ingredients as Array<Record<string, unknown>>)[0]).unit = hostile;
    else value[field] = hostile;
    assert.ok(recipeRecordErrors(value).length);
    assert.equal(reviewQueueEntries([{ id: value.id, version: value.version, record: value }])[0].record, null);
  }
});

test("legacy optional calculation/source objects never become renderable trusted evidence", () => {
  const record = calculatedRecipe(); record.review = { status: "pending_review", reviewedBy: null, reviewedAt: null };
  record.source.reviewed = false; record.nutrition.reviewed = false; record.ingredients.forEach(i => { i.reviewed = false; });
  record.nutrition.method = "legacy_measured";
  (record.nutrition.calculation!.batchMacros as unknown as Record<string, unknown>).calories = { bad: "object" };
  (record.ingredients[0].nutrition!.food as unknown as Record<string, unknown>).name = { bad: "object" };
  const entry = reviewQueueEntries([{ id: record.id, version: record.version, record }])[0];
  assert.ok(entry.record); assert.ok(entry.validationErrors.length);
  assert.equal(entry.record.nutrition.calculation, undefined);
  assert.equal(entry.record.ingredients[0].nutrition, undefined);
  assert.ok(record.ingredients[0].nutrition); // Display sanitation must not mutate saved input.
});

test("queue selection distinguishes pending versions and colon-containing recipe identities", () => {
  const record = calculatedRecipe(); record.id = "recipe:with:colons";
  record.review = { status: "pending_review", reviewedBy: null, reviewedAt: null };
  record.source.reviewed = false; record.nutrition.reviewed = false; record.ingredients.forEach(i => { i.reviewed = false; });
  const entries = reviewQueueEntries([1, 2].map(version => ({ id: record.id, version, record: { ...record, version } })));
  const keys = entries.map(reviewQueueKey);
  assert.equal(new Set(keys).size, 2);
  assert.equal(entries.find(entry => reviewQueueKey(entry) === keys[1])?.version, 2);
  assert.notEqual(reviewQueueKey({ id: "recipe:1", version: 2 }), reviewQueueKey({ id: "recipe", version: 12 }));
  assert.deepEqual(JSON.parse(keys[0]), [record.id, 1]);
});
