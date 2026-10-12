import assert from "node:assert/strict";
import test from "node:test";
import { imageForMeal, fallbackImageForMeal, imageAfterFailure } from "../../lib/meal-images.ts";

test("dish families resolve to distinct illustrated artwork", () => {
  const names = ["Berry overnight oats", "Egg toast", "Chicken pasta", "Chicken wrap", "Lentil soup", "Green salad", "Rice bowl", "Turkey snack box", "Roast chicken"];
  assert.equal(new Set(names.map(title => imageForMeal({ title, mealSlot: "lunch" }))).size, names.length);
});
test("missing and unsuitable images use relevant local illustrations", () => {
  for (const image of [undefined, "", "javascript:alert(1)", "data:image/svg+xml,anything", "//evil.example/a", "/uploads/unknown.svg", "https://images.unsplash.com/photo-123"]) {
    assert.equal(imageForMeal({ title: "Egg toast", mealSlot: "breakfast", image }), "/images/meals/eggs.svg");
  }
  assert.equal(imageForMeal({ title: "Pasta", mealSlot: "lunch", image: "/images/meals/soup.svg" }), "/images/meals/soup.svg");
  assert.equal(imageForMeal({ title: "Pasta", mealSlot: "lunch", image: "https://cdn.example.com/meal.png" }), "https://cdn.example.com/meal.png");
});
test("image load errors fall back once, then stop", () => {
  const fallback = fallbackImageForMeal({ title: "Pasta", mealSlot: "lunch" });
  assert.equal(imageAfterFailure("https://cdn.example.com/missing.png", fallback), fallback);
  assert.equal(imageAfterFailure(fallback, fallback), null);
});
