import assert from "node:assert/strict";
import test from "node:test";
import { groupShoppingDepartments } from "../../lib/shopping-departments.ts";

test("generic Produce metadata does not hide supermarket departments", () => {
  const items = [
    "Chicken breast", "Roast turkey slices", "Egg whites", "Salmon fillet",
    "Tinned tuna", "Frozen mixed berries", "Extra-firm tofu", "Whole-grain wraps",
    "Cherry tomatoes", "Olives", "Peanut butter", "Unclassified speciality",
  ].map(name => ({ name, quantity: 150, unit: "g", category: "Produce" }));
  const original = structuredClone(items);
  const groups = groupShoppingDepartments(items);
  assert.deepEqual(groups.map(({ category, items }) => [category, items.map(item => item.name)]), [
    ["Produce", ["Cherry tomatoes"]],
    ["Meat", ["Chicken breast", "Roast turkey slices"]],
    ["Fish & Seafood", ["Salmon fillet"]],
    ["Dairy & Eggs", ["Egg whites"]],
    ["Chilled", ["Extra-firm tofu"]],
    ["Bakery", ["Whole-grain wraps"]],
    ["Pantry", ["Olives", "Peanut butter", "Tinned tuna"]],
    ["Frozen", ["Frozen mixed berries"]],
    ["Other", ["Unclassified speciality"]],
  ]);
  assert.deepEqual(items, original);
  for (const item of items) assert.equal(groups.flatMap(group => group.items).filter(line => line === item).length, 1);
});

test("recognised supplied departments remain useful for unknown products and empty sections stay hidden", () => {
  assert.deepEqual(groupShoppingDepartments([{ name: "Speciality product", category: " bakery " }]), [
    { category: "Bakery", items: [{ name: "Speciality product", category: " bakery " }] },
  ]);
  assert.deepEqual(groupShoppingDepartments([]), []);
});
