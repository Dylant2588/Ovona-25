import type { IngredientLine, MealSlot, ProteinType } from "./meal-generator";

const ingredient = (name: string, amount: number, category = "Produce", unit = "g"): IngredientLine => ({ name, amount, unit, category });
const recipe = (id: string, name: string, mealTypes: MealSlot[], readyInMinutes: number, ingredients: IngredientLine[], steps: string[], proteinType: ProteinType = "poultry") => ({
  id, name, description: name + ", made with everyday ingredients.", mealTypes, readyInMinutes, ingredients, steps, proteinType,
  tastes: ["high-protein", "quick-minimal", "meal-prep"], complexity: "simple" as const,
  image: "", macros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
});

// Nutrition is calculated by the generator from measured ingredients, never
// from these titles or a fabricated high-protein nutrition label.
export const VARIED_MEALS = [
  recipe("spinach-egg-white-scramble", "Spinach Egg Scramble", ["breakfast"], 12,
    [ingredient("Egg whites", 300, "Protein"), ingredient("Eggs", 1, "Protein", "large"), ingredient("Spinach", 60), ingredient("Cherry tomatoes", 80), ingredient("Olive oil", 3, "Pantry")],
    ["Whisk the egg whites and whole egg together.", "Heat the oil in a non-stick pan. Add halved tomatoes and spinach; cook for 2 minutes.", "Add the eggs and gently stir over medium heat until fully set throughout. Serve immediately."], "mixed"),
  recipe("turkey-pepper-omelette", "Turkey & Pepper Omelette", ["breakfast"], 15,
    [ingredient("Egg whites", 200, "Protein"), ingredient("Roast turkey slices", 90, "Protein"), ingredient("Bell peppers", 80), ingredient("Scallions", 20), ingredient("Olive oil", 8, "Pantry")],
    ["Dice the pepper and slice the spring onions and ready-to-eat turkey.", "Heat the oil in a non-stick pan and soften the pepper and onions for 4 minutes.", "Add the turkey and egg whites. Cook gently until the egg is set throughout, then fold the omelette and serve."]),
  recipe("egg-white-oat-pancakes", "Banana Oat Pancakes", ["breakfast"], 18,
    [ingredient("Egg whites", 300, "Protein"), ingredient("Rolled oats", 25, "Pantry"), ingredient("Banana", 60), ingredient("Olive oil", 3, "Pantry")],
    ["Blend the oats into flour, then blend with the banana and egg whites.", "Brush a non-stick pan with the measured oil and heat over medium-low heat.", "Cook small pancakes for 3–4 minutes per side until firm and cooked throughout; work in batches."], "mixed"),
  recipe("egg-white-pepper-muffins", "Pepper & Egg Bites", ["snack"], 25,
    [ingredient("Egg whites", 280, "Protein"), ingredient("Eggs", 1, "Protein", "large"), ingredient("Bell peppers", 60), ingredient("Spinach", 30), ingredient("Olive oil", 3, "Pantry")],
    ["Heat the oven to 180°C. Grease a muffin tin with the measured oil.", "Finely chop the pepper and spinach and divide between the cups. Whisk the egg and whites, then pour over the vegetables.", "Bake for 18–20 minutes until fully set. Cool promptly and refrigerate if keeping for later."], "mixed"),
  recipe("turkey-cucumber-rolls", "Turkey Cucumber Rolls", ["snack"], 8,
    [ingredient("Roast turkey slices", 170, "Protein"), ingredient("Cucumber", 100), ingredient("Carrots", 60), ingredient("Olives", 25)],
    ["Wash the vegetables. Cut the cucumber and carrot into thin sticks.", "Wrap the ready-to-eat turkey slices around the vegetable sticks. Serve with the olives.", "Keep refrigerated if preparing ahead."]),
  recipe("chicken-pepper-skewers", "Chicken Pepper Skewers", ["snack"], 25,
    [ingredient("Chicken breast", 150, "Protein"), ingredient("Bell peppers", 100), ingredient("Olive oil", 5, "Pantry"), ingredient("Lime", 1, "Produce", "each")],
    ["Heat the oven to 200°C. Cut chicken and pepper into similar small pieces.", "Toss with the oil and lime juice and thread onto metal skewers. Place on a baking tray.", "Bake for 18–20 minutes, turning once, until the chicken is cooked throughout with no pink centre."]),
  recipe("chicken-tomato-pasta", "Chicken Tomato Pasta", ["lunch", "dinner"], 25,
    [ingredient("Chicken breast", 140, "Protein"), ingredient("Wholewheat pasta", 45, "Pantry"), ingredient("Diced tomatoes", 150), ingredient("Spinach", 50), ingredient("Olive oil", 8, "Pantry")],
    ["Boil the measured dry pasta according to the packet directions, then drain.", "Dice the chicken and pan-fry in the oil until cooked throughout. Add the tomatoes and simmer for 8 minutes.", "Stir in spinach until wilted, then toss with the cooked pasta."]),
  recipe("chicken-cabbage-noodles", "Chicken Noodle Stir-Fry", ["lunch", "dinner"], 25,
    [ingredient("Chicken breast", 140, "Protein"), ingredient("Soba noodles", 45, "Pantry"), ingredient("Cabbage", 120), ingredient("Carrots", 60), ingredient("Soy sauce", 10, "Pantry", "ml"), ingredient("Olive oil", 8, "Pantry")],
    ["Boil the measured dry noodles according to the packet and drain.", "Slice chicken, cabbage and carrots thinly. Heat the oil and cook the chicken until cooked throughout.", "Add vegetables and stir-fry for 5 minutes, then add the noodles and soy sauce and heat through."]),
  recipe("turkey-bean-lettuce-wraps", "Turkey & Bean Wraps", ["lunch", "dinner"], 12,
    [ingredient("Roast turkey slices", 160, "Protein"), ingredient("Black beans", 60, "Pantry"), ingredient("Tortillas", 1, "Bakery", "piece"), ingredient("Cherry tomatoes", 80), ingredient("Cucumber", 80), ingredient("Olive oil", 8, "Pantry")],
    ["Drain and rinse the cooked tinned black beans. Wash and chop the vegetables and toss with the measured oil.", "Warm the tortilla in a dry pan and heat the beans until piping hot.", "Fill the tortilla with beans, ready-to-eat turkey slices and vegetables, fold and serve."]),
  recipe("chicken-vegetable-soup", "Chicken & Vegetable Soup", ["lunch", "dinner"], 30,
    [ingredient("Chicken breast", 140, "Protein"), ingredient("Carrots", 100), ingredient("Cabbage", 100), ingredient("Brown rice", 35, "Pantry"), ingredient("Scallions", 20), ingredient("Olive oil", 8, "Pantry")],
    ["Rinse the dry brown rice. Put in a saucepan with 500ml water and the olive oil and bring to a simmer.", "Dice the chicken and vegetables. After 10 minutes add them to the rice, adding water if needed.", "Simmer for another 20 minutes until rice is tender and chicken cooked throughout. Season to taste and serve."]),
];


