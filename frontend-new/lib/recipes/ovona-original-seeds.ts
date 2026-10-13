import type { RecipeRecord } from "./types";

type Ingredient = RecipeRecord["ingredients"][number];
const ingredient = (name: string, canonicalId: string, amount: number, unit: Ingredient["unit"], allergens: string[] = [], dietaryFlags: string[] = []): Ingredient => ({
  name, canonicalId, amount, unit, allergens, dietaryFlags, reviewed: false,
});

const originalRecipe = (recipe: Omit<RecipeRecord, "source" | "nutrition" | "review">): RecipeRecord => ({
  ...recipe,
  source: { kind: "internal", reference: `ovona-original:${recipe.id}`, rights: "Original Ovona recipe draft; internal rights retained.", reviewed: false },
  nutrition: { method: "Measured ingredient calculation awaiting reviewer confirmation", reference: `ovona-original:${recipe.id}:nutrition`, reviewed: false },
  review: { status: "pending_review", reviewedBy: null, reviewedAt: null },
});

/**
 * Original recipe drafts. They deliberately enter the review queue rather than
 * the user-facing library; an operator must verify recipe, allergen, and
 * nutrition evidence before they can be approved for planning.
 */
export const OVONA_ORIGINAL_RECIPE_SEEDS: readonly RecipeRecord[] = [
  originalRecipe({
    id: "ovona-lemon-herb-chicken-rice", version: 1, title: "Lemon Herb Chicken Rice Bowl", description: "A bright weekday chicken bowl with rice, greens and lemon.",
    slots: ["lunch", "dinner"], servings: 1, readyInMinutes: 25, proteinType: "poultry", image: "/meal-illustrations/chicken-bowl.svg",
    ingredients: [ingredient("Chicken breast", "chicken-breast", 180, "g"), ingredient("Brown rice", "brown-rice", 60, "g"), ingredient("Broccoli", "broccoli", 150, "g"), ingredient("Lemon", "lemon", 0.5, "each"), ingredient("Olive oil", "olive-oil", 5, "g")],
    steps: ["Cook the rice according to its packet instructions.", "Season chicken with lemon zest and juice, then pan-cook until fully cooked through.", "Steam broccoli until tender, then serve with rice and chicken."],
    macros: { calories: 620, protein: 52, carbs: 60, fat: 17 },
  }),
  originalRecipe({
    id: "ovona-turkey-tomato-orzo", version: 1, title: "Turkey Tomato Orzo", description: "Lean turkey folded through tomato orzo and spinach.",
    slots: ["lunch", "dinner"], servings: 1, readyInMinutes: 25, proteinType: "poultry", image: "/meal-illustrations/turkey-pasta.svg",
    ingredients: [ingredient("Turkey mince", "turkey-mince", 180, "g"), ingredient("Orzo", "orzo", 70, "g", ["gluten"]), ingredient("Passata", "passata", 200, "g"), ingredient("Spinach", "spinach", 60, "g"), ingredient("Olive oil", "olive-oil", 5, "g")],
    steps: ["Cook orzo according to packet instructions.", "Brown turkey mince in olive oil until no pink remains.", "Simmer with passata, fold through spinach, then stir in the orzo."],
    macros: { calories: 610, protein: 48, carbs: 63, fat: 16 },
  }),
  originalRecipe({
    id: "ovona-salmon-sesame-greens", version: 1, title: "Salmon Sesame Greens", description: "Salmon with quick greens, edamame and rice.",
    slots: ["lunch", "dinner"], servings: 1, readyInMinutes: 22, proteinType: "fish", image: "/meal-illustrations/salmon-bowl.svg",
    ingredients: [ingredient("Salmon fillet", "salmon-fillet", 160, "g", ["fish"]), ingredient("Jasmine rice", "jasmine-rice", 60, "g"), ingredient("Edamame", "edamame", 100, "g", ["soy"]), ingredient("Spinach", "spinach", 80, "g"), ingredient("Sesame oil", "sesame-oil", 5, "g", ["sesame"])],
    steps: ["Cook rice according to packet instructions.", "Bake or pan-cook salmon until opaque and cooked through.", "Warm edamame and spinach with sesame oil, then serve alongside the salmon and rice."],
    macros: { calories: 650, protein: 47, carbs: 57, fat: 25 },
  }),
  originalRecipe({
    id: "ovona-greek-yogurt-berry-oats", version: 1, title: "Greek Yogurt Berry Oats", description: "Overnight oats with Greek yogurt, berries and chia.",
    slots: ["breakfast"], servings: 1, readyInMinutes: 8, proteinType: "mixed", image: "/meal-illustrations/oats-bowl.svg",
    ingredients: [ingredient("Greek yogurt", "greek-yogurt", 250, "g", ["milk"]), ingredient("Rolled oats", "rolled-oats", 55, "g", ["gluten"]), ingredient("Blueberries", "blueberries", 100, "g"), ingredient("Chia seeds", "chia-seeds", 10, "g"), ingredient("Honey", "honey", 8, "g")],
    steps: ["Stir yogurt, oats, chia and honey together in a jar.", "Fold through berries.", "Chill overnight or for at least four hours before eating."],
    macros: { calories: 485, protein: 32, carbs: 64, fat: 12 },
  }),
  originalRecipe({
    id: "ovona-cottage-cheese-crunch-pot", version: 1, title: "Cottage Cheese Crunch Pot", description: "A quick protein snack with cottage cheese, cucumber and seeds.",
    slots: ["snack"], servings: 1, readyInMinutes: 5, proteinType: "mixed", image: "/meal-illustrations/snack-box.svg",
    ingredients: [ingredient("Cottage cheese", "cottage-cheese", 220, "g", ["milk"]), ingredient("Cucumber", "cucumber", 120, "g"), ingredient("Pumpkin seeds", "pumpkin-seeds", 15, "g"), ingredient("Wholegrain crackers", "wholegrain-crackers", 30, "g", ["gluten"])],
    steps: ["Spoon cottage cheese into a bowl.", "Slice cucumber and arrange alongside.", "Top with pumpkin seeds and serve with crackers."],
    macros: { calories: 390, protein: 33, carbs: 31, fat: 15 },
  }),
];
