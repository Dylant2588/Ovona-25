import test from "node:test";
import assert from "node:assert/strict";
import { approveRecipe, validateMealAgainstRecipe, validatePlanAgainstRecipes, validateSocialMeal } from "../../lib/recipes/approval.ts";
import { reviewedMeal, reviewedRecipe } from "./recipe-fixtures.ts";
test("approved evidence admits safe two-serving recipe once and scales trusted portions", () => {
  const recipe = reviewedRecipe(), meal = reviewedMeal();
  assert.equal(meal.ingredients[0].amount, 200);
  meal.portionMultiplier = 1.25;
  meal.ingredients.forEach(i => { i.amount *= 1.25; });
  meal.macros = { calories: 375, protein: 50, carbs: 6, fat: 13 };
  const checked = validateMealAgainstRecipe(meal, recipe, {});
  assert.equal(checked.approved, true);
  assert.equal(checked.meal?.macros.calories, 375);
});
test("all allergies map conservatively; unknown allergies and dietary modes reject", () => {
  const r = reviewedRecipe();
  for (const allergy of ["dragon fruit", "unrecognized compound"]) assert.equal(approveRecipe(r, { allergies: [allergy] }).approved, false);
  assert.equal(approveRecipe(r, { dietaryMode: "vegan" }).approved, false);
  assert.equal(approveRecipe(r, { dietaryModes: ["omnivore", "vegetarian"] }).approved, false);
  assert.equal(approveRecipe(r, { dietaryMode: "invented" }).approved, false);
  assert.equal(approveRecipe(r, { dislikes: ["chicken"] }).approved, false);
  assert.equal(approveRecipe(r, { maxPrepMinutes: 10 }).approved, false);
});
test("milk, egg and wheat cannot hide allergen evidence behind reviewed flags", () => {
  for (const [name, id, allergen] of [["Milk", "milk", "milk"], ["Eggs", "egg", "eggs"], ["Pasta", "wheat", "gluten"]]) {
    const recipe = reviewedRecipe();
    recipe.ingredients = [{ name, canonicalId: id, amount: 100, unit: "g", allergens: [], dietaryFlags: ["animal_product"], reviewed: true }];
    assert.equal(approveRecipe(recipe).approved, false);
    recipe.ingredients[0].allergens = [allergen];
    recipe.ingredients[0].dietaryFlags = id === "wheat" ? [] : ["animal_product"];
    assert.equal(approveRecipe(recipe, { allergies: [allergen === "milk" ? "dairy" : allergen] }).approved, false);
  }
});
test("unreviewed, unknown and cross-contact ingredients reject", () => {
  const recipe = reviewedRecipe();
  recipe.ingredients[0].mayContain = ["peanuts"];
  assert.equal(approveRecipe(recipe, { allergies: ["nuts"] }).approved, false);
  recipe.ingredients[0].name = "Mystery protein";
  assert.equal(approveRecipe(recipe).approved, false);
  const pending = reviewedRecipe(); pending.review.status = "pending_review";
  assert.equal(approveRecipe(pending).approved, false);
});
test("changed ingredients, methods, macros, versions and unsafe portions never retain approval", () => {
  const mutations = [
    (m: ReturnType<typeof reviewedMeal>) => { m.ingredients[0].name = "Peanut butter"; },
    (m: ReturnType<typeof reviewedMeal>) => { m.steps[0] = "Changed method"; },
    (m: ReturnType<typeof reviewedMeal>) => { m.macros.calories = 100; },
    (m: ReturnType<typeof reviewedMeal>) => { m.recipeVersion = 2; },
    (m: ReturnType<typeof reviewedMeal>) => { m.portionMultiplier = 2; },
  ];
  for (const mutate of mutations) { const meal = reviewedMeal(); mutate(meal); assert.equal(validateMealAgainstRecipe(meal, reviewedRecipe()).approved, false); }
});
test("final portion dietary thresholds and malformed untrusted plans fail closed", () => {
  const recipe = reviewedRecipe(); recipe.macros.carbs = 25;
  const meal = reviewedMeal(); meal.baseMacros.carbs = 25; meal.portionMultiplier = 1.5; meal.ingredients.forEach(i => { i.amount *= 1.5; });
  meal.macros = { calories: 450, protein: 60, carbs: 38, fat: 15 };
  assert.equal(validateMealAgainstRecipe(meal, recipe, { dietaryMode: "low_carb" }).approved, false);
  for (const days of [[null], [{ meals: [null] }], [{ meals: [{ baseId: "missing" }] }]]) assert.equal(validatePlanAgainstRecipes(days as never, [recipe]).approved, false);
});
test("a meal out is a narrow nutrition-unknown exception, never an unchecked recipe", () => {
  const socialMeal = {
    baseId: "social-meal", mealSlot: "dinner", title: "Meal out", portionMultiplier: 1,
    mealKind: "social" as const, nutritionStatus: "unknown" as const,
    ingredients: [], baseIngredients: [],
    macros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    baseMacros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  };
  assert.equal(validateSocialMeal(socialMeal).approved, true);
  assert.equal(validatePlanAgainstRecipes([{ meals: [socialMeal] }], [reviewedRecipe()]).approved, true);
  assert.equal(validateSocialMeal({ ...socialMeal, macros: { ...socialMeal.macros, calories: 600 } }).approved, false);
  assert.equal(validateSocialMeal({ ...socialMeal, title: "Unchecked dinner" }).approved, false);
});
