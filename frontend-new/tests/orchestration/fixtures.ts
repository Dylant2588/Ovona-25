/** Deterministic planner fixtures. These deliberately have no runtime dependencies. */
export const validRawProfile = {
  calorieTarget: 2200,
  proteinTarget: 160,
  allergies: ["peanut"],
  dislikes: ["mushroom"],
  dietaryRules: ["vegetarian"],
  budgetSensitivity: "medium",
  maxPrepMinutes: 30,
  householdSize: 2,
  preferredMealTypes: ["mediterranean", "quick"],
  requiredSlots: ["breakfast", "lunch", "dinner", "snack"],
};

const baseCandidate = {
  verified: true,
  ingredients: [
    { name: "chickpeas", normalizedName: "chickpea", quantity: 200, unit: "g", pantry: false },
  ],
  allergens: [],
  dietaryTags: ["vegetarian"],
  nutrition: { calories: 500, protein: 30, carbs: 55, fat: 15 },
  cost: 2.5,
  prepMinutes: 20,
  servings: 2,
};

export const safeCandidates = [
  { ...baseCandidate, id: "safe-breakfast", slot: "breakfast", title: "Berry oats" },
  { ...baseCandidate, id: "safe-lunch", slot: "lunch", title: "Chickpea bowl" },
  { ...baseCandidate, id: "safe-dinner", slot: "dinner", title: "Lentil pasta" },
  { ...baseCandidate, id: "safe-snack", slot: "snack", title: "Yogurt and fruit" },
];

export const allergyProhibitedCandidate = {
  ...baseCandidate,
  id: "unsafe-peanut",
  slot: "snack",
  title: "Peanut snack",
  allergens: ["peanut"],
};

export const dietProhibitedCandidate = {
  ...baseCandidate,
  id: "unsafe-meat",
  slot: "dinner",
  title: "Chicken rice",
  dietaryTags: ["omnivore"],
};

export const incompleteUnverifiedCandidate = {
  id: "unverified-incomplete",
  slot: "lunch",
  title: "Unknown lunch",
  verified: false,
  ingredients: [],
  allergens: [],
  dietaryTags: [],
  nutrition: { calories: Number.NaN, protein: 0, carbs: 0, fat: 0 },
  cost: Number.NaN,
  prepMinutes: 10,
  servings: 0,
};

export const declaredLeftoverCandidate = {
  ...baseCandidate,
  id: "leftover-lentil-stew",
  slot: "lunch",
  title: "Leftover lentil stew",
  leftoverFromCandidateId: "safe-dinner",
  isLeftover: true,
};

export const normalizedIngredientAliases = [
  { name: "Chickpeas", normalizedName: "chickpea", quantity: 400, unit: "g", pantry: false },
  { name: "Chickpea", normalizedName: "chickpea", quantity: 1, unit: "can", pantry: false },
];

export const pantryIngredient = {
  name: "Olive oil",
  normalizedName: "olive oil",
  quantity: 15,
  unit: "ml",
  pantry: true,
};
