export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type ComplexityKey = "simple" | "normal" | "adventurous";
export type GoalType =
  | "lose_weight"
  | "save_time"
  | "calorie_count"
  | "lose"
  | "maintain"
  | "gain"
  | "recomp"
  | string;

export type DietaryMode =
  | "vegan"
  | "vegetarian"
  | "pescatarian"
  | "low_carb"
  | "high_protein";

export type MacroBreakdown = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type ProteinType = "poultry" | "red_meat" | "fish" | "seafood" | "plant" | "mixed";

export type MealInstance = {
  instanceId: string;
  baseId: string;
  mealSlot: MealSlot;
  title: string;
  description: string;
  steps?: string[];
  recipeSteps?: string[];
  tags: string[];
  image: string;
  readyInMinutes: number;
  portionMultiplier: number;
  baseMacros: MacroBreakdown;
  macros: MacroBreakdown;
  baseIngredients: IngredientLine[];
  ingredients: IngredientLine[];
  proteinType?: ProteinType;
};

export type DayPlan = {
  id: string;
  label: string;
  date: string;
  meals: MealInstance[];
  totals: MacroBreakdown;
};

export type WeeklyMealPlan = {
  id: string;
  userId?: string;
  weekStart: string;
  generatedAt: string;
  preferenceSignature: string;
  days: DayPlan[];
  weeklyTotals: MacroBreakdown;
};

export type MealHistorySummary = {
  lastGeneratedPlanId?: string;
  weeks: Array<{
    weekStart: string;
    proteinCounts: Record<string, number>;
    skippedMeals: number;
    eatenMeals: number;
    averageCalories: number;
  }>;
};

export type MacroTargets = {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
};

export type UserProfileInput = {
  locale?: string | null;
  timezone?: string | null;
  bodyWeightKg?: number | null;
  bodyFatPercent?: number | null;
  heightCm?: number | null;
  activityLevel?: string | null;
  dietaryMode?: DietaryMode | string | null;
  trainingSchedule?: string[];
  allergies?: string[];
  dislikes?: string[];
  cuisines?: string[];
  pantryStaples?: string[];
  household?: string[];
  deliveryPreferences?: string[];
  sleepHours?: number | null;
  stressLevel?: string | null;
  notes?: string | null;
  mealsPerDay?: 3 | 5 | null;
};

export type PreferencesInput = {
  userId?: string;
  tastes: string[];
  goal?: GoalType | null;
  mealComplexity?: ComplexityKey | null;
  macroTargets?: MacroTargets | null;
  profile?: UserProfileInput | null;
};

type BaseMeal = {
  id: string;
  name: string;
  description: string;
  steps?: string[];
  mealTypes: MealSlot[];
  tastes: string[];
  complexity: ComplexityKey;
  goalFit?: GoalType[];
  readyInMinutes: number;
  image: string;
  macros: MacroBreakdown;
  ingredients: IngredientLine[];
  proteinType?: ProteinType;
};

export type IngredientLine = {
  name: string;
  amount: number;
  unit: string;
  category?: string;
};

const MEAL_LIBRARY: BaseMeal[] = [
  {
    id: "blueberry-protein-oats",
    name: "Blueberry Protein Oats",
    description: "Overnight oats layered with chia, cinnamon, and fresh blueberries.",
    mealTypes: ["breakfast"],
    tastes: ["plant-forward", "quick-minimal", "meal-prep"],
    complexity: "simple",
    goalFit: ["lose_weight", "maintain", "calorie_count"],
    readyInMinutes: 5,
    image:
      "https://images.unsplash.com/photo-1505250469679-203ad9ced0cb?auto=format&fit=crop&w=600&q=60",
    macros: { calories: 380, protein: 27, carbs: 48, fat: 10 },
    ingredients: [
      { name: "Rolled oats", amount: 80, unit: "g", category: "Pantry" },
      { name: "Chia seeds", amount: 20, unit: "g", category: "Pantry" },
      { name: "Almond milk", amount: 240, unit: "ml", category: "Dairy" },
      { name: "Blueberries", amount: 75, unit: "g", category: "Produce" },
      { name: "Maple syrup", amount: 15, unit: "g", category: "Pantry" },
    ],
    proteinType: "plant",
  },
  {
    id: "sunrise-egg-wrap",
    name: "Sunrise Egg Wrap",
    description: "Scrambled eggs, smashed avocado, and veggies tucked into a whole-grain wrap.",
    mealTypes: ["breakfast"],
    tastes: ["high-protein", "comfort", "quick-minimal"],
    complexity: "simple",
    goalFit: ["gain", "save_time"],
    readyInMinutes: 12,
    image:
      "https://images.unsplash.com/photo-1495546968767-f0573cca821e?auto=format&fit=crop&w=600&q=60",
    macros: { calories: 420, protein: 32, carbs: 36, fat: 17 },
    ingredients: [
      { name: "Eggs", amount: 3, unit: "large", category: "Dairy" },
      { name: "Whole-grain wrap", amount: 1, unit: "piece", category: "Bakery" },
      { name: "Avocado", amount: 0.5, unit: "each", category: "Produce" },
      { name: "Spinach", amount: 40, unit: "g", category: "Produce" },
      { name: "Cherry tomatoes", amount: 60, unit: "g", category: "Produce" },
    ],
    proteinType: "poultry",
  },
  {
    id: "harissa-chicken-bowl",
    name: "Harissa Chicken Bowls",
    description: "Charred chicken, freekeh, and garlicky yogurt over greens.",
    mealTypes: ["lunch", "dinner"],
    tastes: ["high-protein", "meal-prep", "low-carb", "comfort"],
    complexity: "normal",
    goalFit: ["lose_weight", "recomp"],
    readyInMinutes: 30,
    image:
      "https://images.unsplash.com/photo-1608039829574-21c84fd37b6b?auto=format&fit=crop&w=600&q=60",
    macros: { calories: 520, protein: 45, carbs: 38, fat: 19 },
    ingredients: [
      { name: "Chicken breast", amount: 220, unit: "g", category: "Protein" },
      { name: "Freekeh or farro", amount: 80, unit: "g", category: "Pantry" },
      { name: "Harissa paste", amount: 20, unit: "g", category: "Pantry" },
      { name: "Baby greens", amount: 60, unit: "g", category: "Produce" },
      { name: "Greek yogurt", amount: 40, unit: "g", category: "Dairy" },
    ],
    proteinType: "poultry",
  },
  {
    id: "coconut-lime-salmon",
    name: "Coconut Lime Salmon",
    description: "Seared salmon in coconut broth with jasmine rice and snap peas.",
    mealTypes: ["lunch", "dinner"],
    tastes: ["comfort", "low-carb", "plant-forward"],
    complexity: "adventurous",
    goalFit: ["gain", "calorie_count"],
    readyInMinutes: 28,
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=60",
    macros: { calories: 610, protein: 40, carbs: 52, fat: 26 },
    ingredients: [
      { name: "Salmon fillet", amount: 200, unit: "g", category: "Protein" },
      { name: "Coconut milk", amount: 160, unit: "ml", category: "Pantry" },
      { name: "Jasmine rice", amount: 90, unit: "g", category: "Pantry" },
      { name: "Lime", amount: 1, unit: "each", category: "Produce" },
      { name: "Snap peas", amount: 80, unit: "g", category: "Produce" },
    ],
    proteinType: "fish",
  },
  {
    id: "miso-soba-salad",
    name: "Miso Soba Power Salad",
    description: "Buckwheat noodles tossed with tofu, crunchy veg, and ginger-miso dressing.",
    mealTypes: ["lunch", "dinner"],
    tastes: ["plant-forward", "meal-prep", "comfort"],
    complexity: "normal",
    goalFit: ["lose_weight", "save_time"],
    readyInMinutes: 20,
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=60",
    macros: { calories: 480, protein: 24, carbs: 62, fat: 16 },
    ingredients: [
      { name: "Soba noodles", amount: 100, unit: "g", category: "Pantry" },
      { name: "Tofu", amount: 180, unit: "g", category: "Protein" },
      { name: "Mixed vegetables", amount: 140, unit: "g", category: "Produce" },
      { name: "Miso paste", amount: 25, unit: "g", category: "Pantry" },
      { name: "Rice vinegar", amount: 15, unit: "ml", category: "Pantry" },
    ],
    proteinType: "plant",
  },
  {
    id: "chipotle-turkey-chili",
    name: "Chipotle Turkey Chili",
    description: "Smoky chili with black beans, roasted corn, and cilantro yogurt.",
    mealTypes: ["lunch", "dinner"],
    tastes: ["comfort", "meal-prep", "high-protein"],
    complexity: "simple",
    goalFit: ["lose_weight", "maintain"],
    readyInMinutes: 35,
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=60",
    macros: { calories: 455, protein: 42, carbs: 37, fat: 17 },
    ingredients: [
      { name: "Ground turkey", amount: 300, unit: "g", category: "Protein" },
      { name: "Black beans", amount: 200, unit: "g", category: "Pantry" },
      { name: "Diced tomatoes", amount: 200, unit: "g", category: "Pantry" },
      { name: "Chipotle peppers", amount: 20, unit: "g", category: "Pantry" },
      { name: "Corn kernels", amount: 120, unit: "g", category: "Produce" },
    ],
    proteinType: "poultry",
  },
  {
    id: "lemongrass-tofu-bowl",
    name: "Lemongrass Tofu Bowls",
    description: "Sticky lemongrass tofu, pickled veggies, and brown rice.",
    mealTypes: ["lunch", "dinner"],
    tastes: ["plant-forward", "quick-minimal", "meal-prep"],
    complexity: "normal",
    goalFit: ["save_time", "calorie_count"],
    readyInMinutes: 22,
    image:
      "https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=600&q=60",
    macros: { calories: 510, protein: 28, carbs: 60, fat: 18 },
    ingredients: [
      { name: "Extra-firm tofu", amount: 200, unit: "g", category: "Protein" },
      { name: "Brown rice", amount: 90, unit: "g", category: "Pantry" },
      { name: "Lemongrass paste", amount: 15, unit: "g", category: "Pantry" },
      { name: "Pickled vegetables", amount: 100, unit: "g", category: "Produce" },
      { name: "Cucumber", amount: 80, unit: "g", category: "Produce" },
    ],
    proteinType: "plant",
  },
  {
    id: "greek-yogurt-protein-pot",
    name: "Greek Yogurt Protein Pot",
    description: "Greek yogurt layered with whey, berries, and toasted seeds.",
    mealTypes: ["snack", "breakfast"],
    tastes: ["high-protein", "quick-minimal", "meal-prep"],
    complexity: "simple",
    goalFit: ["gain", "recomp", "maintain", "calorie_count"],
    readyInMinutes: 4,
    image:
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=60",
    macros: { calories: 280, protein: 32, carbs: 22, fat: 8 },
    ingredients: [
      { name: "Greek yogurt", amount: 220, unit: "g", category: "Dairy" },
      { name: "Whey protein", amount: 25, unit: "g", category: "Pantry" },
      { name: "Mixed berries", amount: 80, unit: "g", category: "Produce" },
      { name: "Pumpkin seeds", amount: 12, unit: "g", category: "Pantry" },
    ],
    proteinType: "mixed",
  },
  {
    id: "turkey-cottage-snack-plate",
    name: "Turkey & Cottage Snack Plate",
    description: "Lean turkey slices, cottage cheese, and crunchy cucumbers.",
    mealTypes: ["snack"],
    tastes: ["high-protein", "low-carb", "quick-minimal"],
    complexity: "simple",
    goalFit: ["gain", "recomp", "lose_weight"],
    readyInMinutes: 6,
    image:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=60",
    macros: { calories: 250, protein: 31, carbs: 9, fat: 10 },
    ingredients: [
      { name: "Roast turkey slices", amount: 120, unit: "g", category: "Protein" },
      { name: "Cottage cheese", amount: 150, unit: "g", category: "Dairy" },
      { name: "Cucumber", amount: 100, unit: "g", category: "Produce" },
      { name: "Olive oil", amount: 8, unit: "g", category: "Pantry" },
    ],
    proteinType: "poultry",
  },
  {
    id: "mediterranean-snack-box",
    name: "Mediterranean Snack Box",
    description: "Hummus, veggies, olives, and za'atar crisps.",
    mealTypes: ["snack", "lunch"],
    tastes: ["plant-forward", "quick-minimal", "comfort"],
    complexity: "simple",
    goalFit: ["lose_weight", "maintain"],
    readyInMinutes: 8,
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=60",
    macros: { calories: 320, protein: 12, carbs: 32, fat: 16 },
    ingredients: [
      { name: "Hummus", amount: 120, unit: "g", category: "Pantry" },
      { name: "Cucumber", amount: 80, unit: "g", category: "Produce" },
      { name: "Cherry tomatoes", amount: 70, unit: "g", category: "Produce" },
      { name: "Olives", amount: 40, unit: "g", category: "Pantry" },
      { name: "Za'atar crisps", amount: 50, unit: "g", category: "Bakery" },
    ],
    proteinType: "plant",
  },
  {
    id: "matcha-energizer",
    name: "Matcha Coconut Energizer",
    description: "Matcha chia pudding topped with toasted coconut.",
    mealTypes: ["snack", "breakfast"],
    tastes: ["quick-minimal", "plant-forward", "low-carb"],
    complexity: "simple",
    goalFit: ["save_time", "lose_weight"],
    readyInMinutes: 5,
    image:
      "https://images.unsplash.com/photo-1484980972926-edee96e0960d?auto=format&fit=crop&w=600&q=60",
    macros: { calories: 210, protein: 9, carbs: 18, fat: 11 },
    ingredients: [
      { name: "Chia seeds", amount: 35, unit: "g", category: "Pantry" },
      { name: "Light coconut milk", amount: 200, unit: "ml", category: "Pantry" },
      { name: "Matcha powder", amount: 4, unit: "g", category: "Pantry" },
      { name: "Shredded coconut", amount: 20, unit: "g", category: "Pantry" },
      { name: "Honey", amount: 15, unit: "g", category: "Pantry" },
    ],
    proteinType: "plant",
  },
  {
    id: "sheet-pan-fajitas",
    name: "Sheet-Pan Fajitas",
    description: "Fiery chicken, peppers, and onions with lime yogurt.",
    mealTypes: ["dinner"],
    tastes: ["comfort", "quick-minimal", "meal-prep"],
    complexity: "simple",
    goalFit: ["gain", "calorie_count"],
    readyInMinutes: 25,
    image:
      "https://images.unsplash.com/photo-1478144592103-25e218a04891?auto=format&fit=crop&w=600&q=60",
    macros: { calories: 590, protein: 48, carbs: 45, fat: 24 },
    ingredients: [
      { name: "Chicken thighs", amount: 320, unit: "g", category: "Protein" },
      { name: "Bell peppers", amount: 180, unit: "g", category: "Produce" },
      { name: "Red onion", amount: 70, unit: "g", category: "Produce" },
      { name: "Tortillas", amount: 3, unit: "piece", category: "Bakery" },
      { name: "Greek yogurt", amount: 60, unit: "g", category: "Dairy" },
    ],
    proteinType: "poultry",
  },
  {
    id: "thai-crunch-salad",
    name: "Thai Crunch Salad",
    description: "Shredded cabbage, herbs, and roasted shrimp with peanut dressing.",
    mealTypes: ["lunch", "dinner"],
    tastes: ["plant-forward", "low-carb", "comfort"],
    complexity: "adventurous",
    goalFit: ["lose_weight", "recomp"],
    readyInMinutes: 18,
    image:
      "https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=600&q=60",
    macros: { calories: 430, protein: 38, carbs: 24, fat: 22 },
    ingredients: [
      { name: "Shrimp", amount: 200, unit: "g", category: "Protein" },
      { name: "Cabbage", amount: 150, unit: "g", category: "Produce" },
      { name: "Carrots", amount: 80, unit: "g", category: "Produce" },
      { name: "Peanut butter", amount: 30, unit: "g", category: "Pantry" },
      { name: "Fresh herbs", amount: 20, unit: "g", category: "Produce" },
    ],
    proteinType: "seafood",
  },
  {
    id: "dark-chocolate-bites",
    name: "Dark Chocolate Walnut Bites",
    description: "Two-bite energy balls with cacao, walnuts, and espresso salt.",
    mealTypes: ["snack"],
    tastes: ["comfort", "low-carb", "meal-prep"],
    complexity: "simple",
    goalFit: ["save_time", "calorie_count"],
    readyInMinutes: 10,
    image:
      "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=600&q=60",
    macros: { calories: 190, protein: 6, carbs: 14, fat: 12 },
    ingredients: [
      { name: "Walnuts", amount: 80, unit: "g", category: "Pantry" },
      { name: "Dark chocolate", amount: 90, unit: "g", category: "Pantry" },
      { name: "Dates", amount: 70, unit: "g", category: "Produce" },
      { name: "Espresso powder", amount: 4, unit: "g", category: "Pantry" },
      { name: "Sea salt", amount: 2, unit: "g", category: "Pantry" },
    ],
    proteinType: "plant",
  },
  {
    id: "kimchi-fried-rice",
    name: "Kimchi Cauli Fried Rice",
    description: "Cauliflower rice with kimchi, edamame, and jammy eggs.",
    mealTypes: ["lunch", "dinner"],
    tastes: ["low-carb", "quick-minimal", "plant-forward"],
    complexity: "normal",
    goalFit: ["lose_weight", "save_time"],
    readyInMinutes: 17,
    image:
      "https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=600&q=60",
    macros: { calories: 410, protein: 29, carbs: 32, fat: 18 },
    ingredients: [
      { name: "Cauliflower rice", amount: 220, unit: "g", category: "Produce" },
      { name: "Kimchi", amount: 120, unit: "g", category: "Produce" },
      { name: "Edamame", amount: 100, unit: "g", category: "Frozen" },
      { name: "Eggs", amount: 2, unit: "large", category: "Dairy" },
      { name: "Scallions", amount: 30, unit: "g", category: "Produce" },
    ],
    proteinType: "mixed",
  },
];

const GOAL_MULTIPLIERS: Record<string, number> = {
  lose_weight: 0.92,
  lose: 0.92,
  save_time: 1,
  maintain: 1,
  calorie_count: 1.05,
  recomp: 1,
  gain: 1.12,
};

const SLOT_WEIGHTS: Record<MealSlot, number> = {
  breakfast: 0.9,
  lunch: 1.05,
  dinner: 1.15,
  snack: 0.6,
};

const SLOT_CALORIE_WEIGHTS: Record<MealSlot, number> = {
  breakfast: 0.95,
  lunch: 1.05,
  dinner: 1.2,
  snack: 0.55,
};

const COMPLEXITY_MULTIPLIERS: Record<ComplexityKey, number> = {
  simple: 0.95,
  normal: 1,
  adventurous: 1.08,
};

export const WORKDAY_COUNT = 5;
export const WORKDAY_MEAL_SLOTS: MealSlot[] = [
  "breakfast",
  "snack",
  "lunch",
  "snack",
  "dinner",
];
const BASE_MEAL_SLOTS: MealSlot[] = [...WORKDAY_MEAL_SLOTS];
const MACRO_RECONCILE_TOLERANCE = 0.3;
const MACRO_DEBUG_LOGS = process.env.NODE_ENV !== "production";

const randomId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const sumMacros = (items: MacroBreakdown[]): MacroBreakdown =>
  items.reduce(
    (acc, macro) => ({
      calories: acc.calories + macro.calories,
      protein: acc.protein + macro.protein,
      carbs: acc.carbs + macro.carbs,
      fat: acc.fat + macro.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

const scaleMacros = (macros: MacroBreakdown, multiplier: number): MacroBreakdown => ({
  calories: Math.round(macros.calories * multiplier),
  protein: Math.round(macros.protein * multiplier),
  carbs: Math.round(macros.carbs * multiplier),
  fat: Math.round(macros.fat * multiplier),
});

const scaleIngredients = (ingredients: IngredientLine[], multiplier: number): IngredientLine[] =>
  ingredients.map((ingredient) => ({
    ...ingredient,
    amount: Number((ingredient.amount * multiplier).toFixed(2)),
  }));

type NutritionUnit = "g" | "ml" | "piece" | "large";

type NutritionEntry = {
  aliases: string[];
  unit: NutritionUnit;
  servingSize: number;
  macros: MacroBreakdown;
};

type IndexedNutritionEntry = NutritionEntry & {
  normalizedAliases: string[];
};

type IngredientMacroDebug = {
  ingredient: IngredientLine;
  normalizedUnit: NutritionUnit | null;
  normalizedAmount: number;
  source: "db" | "fallback" | "invalid";
  matchedAlias?: string;
  macros: MacroBreakdown;
};

type MealMacroComputation = {
  fromIngredients: MacroBreakdown;
  resolved: MacroBreakdown;
  library: MacroBreakdown;
  usedLibraryFallback: boolean;
  ingredientBreakdown: IngredientMacroDebug[];
};

type MealFilterContext = {
  allergies: string[];
  dislikes: string[];
  cuisines: string[];
  dietaryMode: DietaryMode | null;
};

const MEAT_KEYWORDS = [
  "chicken",
  "turkey",
  "beef",
  "pork",
  "lamb",
  "steak",
  "sausage",
  "ham",
  "bacon",
];

const SEAFOOD_KEYWORDS = [
  "fish",
  "salmon",
  "cod",
  "shrimp",
  "prawn",
  "tuna",
  "mackerel",
  "sardine",
  "shellfish",
  "anchovy",
];

const DAIRY_EGG_HONEY_KEYWORDS = [
  "egg",
  "yogurt",
  "milk",
  "cheese",
  "butter",
  "whey",
  "honey",
  "cream",
  "cottage",
];

const NON_VEGETARIAN_KEYWORDS = [...MEAT_KEYWORDS, ...SEAFOOD_KEYWORDS];
const NON_VEGAN_KEYWORDS = [
  ...NON_VEGETARIAN_KEYWORDS,
  ...DAIRY_EGG_HONEY_KEYWORDS,
];

const ALLERGY_EXPANSION_RULES: Array<{ needle: string; keywords: string[] }> = [
  { needle: "shellfish", keywords: ["shellfish", "shrimp", "prawn", "crab", "lobster"] },
  { needle: "fish", keywords: ["fish", "salmon", "cod", "tuna", "mackerel", "anchovy"] },
  { needle: "dairy", keywords: ["dairy", "milk", "yogurt", "cheese", "whey", "butter", "cream"] },
  { needle: "lactose", keywords: ["dairy", "milk", "yogurt", "cheese", "whey", "butter"] },
  { needle: "nut", keywords: ["nut", "nuts", "peanut", "almond", "walnut", "cashew"] },
  { needle: "peanut", keywords: ["peanut", "groundnut"] },
  { needle: "soy", keywords: ["soy", "tofu", "edamame", "miso"] },
  { needle: "gluten", keywords: ["gluten", "wheat", "flour", "wrap", "tortilla", "farro", "freekeh", "soba"] },
  { needle: "egg", keywords: ["egg", "eggs"] },
  { needle: "sesame", keywords: ["sesame", "tahini"] },
];

const LOW_CARB_MAX_CARBS = 38;
const HIGH_PROTEIN_MIN_PROTEIN = 24;

const ZERO_MACROS: MacroBreakdown = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

const DEFAULT_MACROS_BY_CATEGORY: Record<string, MacroBreakdown> = {
  protein: { calories: 165, protein: 24, carbs: 2, fat: 6 },
  dairy: { calories: 110, protein: 8, carbs: 6, fat: 5 },
  produce: { calories: 32, protein: 1.3, carbs: 6, fat: 0.2 },
  pantry: { calories: 330, protein: 10, carbs: 48, fat: 10 },
  bakery: { calories: 270, protein: 8, carbs: 46, fat: 6 },
  frozen: { calories: 95, protein: 6, carbs: 9, fat: 3 },
  other: { calories: 120, protein: 5, carbs: 12, fat: 4 },
};

const NUTRITION_DB: NutritionEntry[] = [
  { aliases: ["rolled oats", "oats"], unit: "g", servingSize: 100, macros: { calories: 389, protein: 16.9, carbs: 66.3, fat: 6.9 } },
  { aliases: ["chia seeds", "chia"], unit: "g", servingSize: 100, macros: { calories: 486, protein: 16.5, carbs: 42.1, fat: 30.7 } },
  { aliases: ["almond milk"], unit: "ml", servingSize: 100, macros: { calories: 13, protein: 0.4, carbs: 0.3, fat: 1.1 } },
  { aliases: ["blueberries", "blueberry"], unit: "g", servingSize: 100, macros: { calories: 57, protein: 0.7, carbs: 14.5, fat: 0.3 } },
  { aliases: ["maple syrup"], unit: "g", servingSize: 100, macros: { calories: 260, protein: 0, carbs: 67, fat: 0 } },
  { aliases: ["eggs", "egg"], unit: "large", servingSize: 1, macros: { calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8 } },
  { aliases: ["whole-grain wrap", "whole grain wrap"], unit: "piece", servingSize: 1, macros: { calories: 170, protein: 6, carbs: 28, fat: 4 } },
  { aliases: ["avocado"], unit: "g", servingSize: 100, macros: { calories: 160, protein: 2, carbs: 8.5, fat: 14.7 } },
  { aliases: ["spinach"], unit: "g", servingSize: 100, macros: { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 } },
  { aliases: ["cherry tomatoes", "tomatoes"], unit: "g", servingSize: 100, macros: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 } },
  { aliases: ["chicken breast", "chicken fillet"], unit: "g", servingSize: 100, macros: { calories: 165, protein: 31, carbs: 0, fat: 3.6 } },
  { aliases: ["freekeh or farro", "freekeh", "farro"], unit: "g", servingSize: 100, macros: { calories: 340, protein: 12, carbs: 70, fat: 2.5 } },
  { aliases: ["harissa paste"], unit: "g", servingSize: 100, macros: { calories: 180, protein: 3.5, carbs: 22, fat: 8 } },
  { aliases: ["baby greens", "mixed greens"], unit: "g", servingSize: 100, macros: { calories: 20, protein: 2, carbs: 3.4, fat: 0.3 } },
  { aliases: ["greek yogurt"], unit: "g", servingSize: 100, macros: { calories: 73, protein: 10, carbs: 3.6, fat: 0.4 } },
  { aliases: ["salmon fillet", "salmon"], unit: "g", servingSize: 100, macros: { calories: 208, protein: 20, carbs: 0, fat: 13 } },
  { aliases: ["coconut milk"], unit: "ml", servingSize: 100, macros: { calories: 180, protein: 1.6, carbs: 2.8, fat: 18 } },
  { aliases: ["jasmine rice"], unit: "g", servingSize: 100, macros: { calories: 360, protein: 7, carbs: 80, fat: 0.6 } },
  { aliases: ["lime"], unit: "piece", servingSize: 1, macros: { calories: 20, protein: 0.4, carbs: 7, fat: 0.1 } },
  { aliases: ["snap peas"], unit: "g", servingSize: 100, macros: { calories: 42, protein: 2.8, carbs: 7.5, fat: 0.2 } },
  { aliases: ["soba noodles", "buckwheat noodles"], unit: "g", servingSize: 100, macros: { calories: 335, protein: 14, carbs: 70, fat: 2 } },
  { aliases: ["tofu", "extra-firm tofu"], unit: "g", servingSize: 100, macros: { calories: 144, protein: 17, carbs: 3, fat: 8 } },
  { aliases: ["mixed vegetables"], unit: "g", servingSize: 100, macros: { calories: 35, protein: 2, carbs: 6, fat: 0.4 } },
  { aliases: ["miso paste"], unit: "g", servingSize: 100, macros: { calories: 199, protein: 12, carbs: 25, fat: 6 } },
  { aliases: ["rice vinegar"], unit: "ml", servingSize: 100, macros: { calories: 18, protein: 0, carbs: 0.3, fat: 0 } },
  { aliases: ["ground turkey", "turkey mince"], unit: "g", servingSize: 100, macros: { calories: 170, protein: 22, carbs: 0, fat: 9 } },
  { aliases: ["black beans"], unit: "g", servingSize: 100, macros: { calories: 132, protein: 8.9, carbs: 23.7, fat: 0.5 } },
  { aliases: ["diced tomatoes"], unit: "g", servingSize: 100, macros: { calories: 30, protein: 1.3, carbs: 6, fat: 0.2 } },
  { aliases: ["chipotle peppers", "chipotle"], unit: "g", servingSize: 100, macros: { calories: 40, protein: 1.8, carbs: 8, fat: 0.7 } },
  { aliases: ["corn kernels", "sweetcorn"], unit: "g", servingSize: 100, macros: { calories: 96, protein: 3.4, carbs: 21, fat: 1.5 } },
  { aliases: ["brown rice"], unit: "g", servingSize: 100, macros: { calories: 365, protein: 7.5, carbs: 77, fat: 2.7 } },
  { aliases: ["lemongrass paste"], unit: "g", servingSize: 100, macros: { calories: 90, protein: 1, carbs: 17, fat: 1 } },
  { aliases: ["pickled vegetables", "pickles"], unit: "g", servingSize: 100, macros: { calories: 22, protein: 0.8, carbs: 4.5, fat: 0.2 } },
  { aliases: ["cucumber"], unit: "g", servingSize: 100, macros: { calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1 } },
  { aliases: ["whey protein", "protein powder"], unit: "g", servingSize: 30, macros: { calories: 120, protein: 24, carbs: 3, fat: 1.5 } },
  { aliases: ["mixed berries"], unit: "g", servingSize: 100, macros: { calories: 50, protein: 0.8, carbs: 12, fat: 0.3 } },
  { aliases: ["pumpkin seeds"], unit: "g", servingSize: 100, macros: { calories: 559, protein: 30, carbs: 11, fat: 49 } },
  { aliases: ["roast turkey slices", "turkey slices"], unit: "g", servingSize: 100, macros: { calories: 120, protein: 24, carbs: 2, fat: 2 } },
  { aliases: ["cottage cheese"], unit: "g", servingSize: 100, macros: { calories: 98, protein: 11, carbs: 3.4, fat: 4.3 } },
  { aliases: ["olive oil"], unit: "g", servingSize: 100, macros: { calories: 884, protein: 0, carbs: 0, fat: 100 } },
  { aliases: ["hummus"], unit: "g", servingSize: 100, macros: { calories: 166, protein: 8, carbs: 14, fat: 9.6 } },
  { aliases: ["olives", "olive"], unit: "g", servingSize: 100, macros: { calories: 145, protein: 1, carbs: 3.8, fat: 15 } },
  { aliases: ["za'atar crisps", "zaatar crisps", "crisps"], unit: "g", servingSize: 100, macros: { calories: 430, protein: 10, carbs: 62, fat: 15 } },
  { aliases: ["light coconut milk"], unit: "ml", servingSize: 100, macros: { calories: 70, protein: 0.7, carbs: 2.5, fat: 6.5 } },
  { aliases: ["matcha powder", "matcha"], unit: "g", servingSize: 100, macros: { calories: 324, protein: 30.6, carbs: 38.5, fat: 5.3 } },
  { aliases: ["shredded coconut"], unit: "g", servingSize: 100, macros: { calories: 660, protein: 7, carbs: 24, fat: 65 } },
  { aliases: ["honey"], unit: "g", servingSize: 100, macros: { calories: 304, protein: 0.3, carbs: 82, fat: 0 } },
  { aliases: ["chicken thighs"], unit: "g", servingSize: 100, macros: { calories: 209, protein: 26, carbs: 0, fat: 10.9 } },
  { aliases: ["bell peppers", "bell pepper", "pepper"], unit: "g", servingSize: 100, macros: { calories: 31, protein: 1, carbs: 6, fat: 0.3 } },
  { aliases: ["red onion", "onion"], unit: "g", servingSize: 100, macros: { calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1 } },
  { aliases: ["tortillas", "tortilla"], unit: "piece", servingSize: 1, macros: { calories: 130, protein: 3.5, carbs: 22, fat: 3.5 } },
  { aliases: ["shrimp", "prawns", "prawn"], unit: "g", servingSize: 100, macros: { calories: 99, protein: 24, carbs: 0.2, fat: 0.3 } },
  { aliases: ["cabbage"], unit: "g", servingSize: 100, macros: { calories: 25, protein: 1.3, carbs: 6, fat: 0.1 } },
  { aliases: ["carrots", "carrot"], unit: "g", servingSize: 100, macros: { calories: 41, protein: 0.9, carbs: 10, fat: 0.2 } },
  { aliases: ["peanut butter"], unit: "g", servingSize: 100, macros: { calories: 588, protein: 25, carbs: 20, fat: 50 } },
  { aliases: ["fresh herbs", "herbs"], unit: "g", servingSize: 100, macros: { calories: 36, protein: 3, carbs: 6, fat: 0.8 } },
  { aliases: ["walnuts", "walnut"], unit: "g", servingSize: 100, macros: { calories: 654, protein: 15.2, carbs: 13.7, fat: 65.2 } },
  { aliases: ["dark chocolate"], unit: "g", servingSize: 100, macros: { calories: 598, protein: 7.8, carbs: 45.9, fat: 42.6 } },
  { aliases: ["dates", "date"], unit: "g", servingSize: 100, macros: { calories: 282, protein: 2.5, carbs: 75, fat: 0.4 } },
  { aliases: ["espresso powder"], unit: "g", servingSize: 100, macros: { calories: 315, protein: 13, carbs: 57, fat: 2 } },
  { aliases: ["sea salt", "salt"], unit: "g", servingSize: 100, macros: { calories: 0, protein: 0, carbs: 0, fat: 0 } },
  { aliases: ["cauliflower rice", "cauliflower"], unit: "g", servingSize: 100, macros: { calories: 25, protein: 2, carbs: 5, fat: 0.3 } },
  { aliases: ["kimchi"], unit: "g", servingSize: 100, macros: { calories: 20, protein: 1.1, carbs: 3.6, fat: 0.5 } },
  { aliases: ["edamame"], unit: "g", servingSize: 100, macros: { calories: 121, protein: 11.9, carbs: 8.9, fat: 5.2 } },
  { aliases: ["scallions", "spring onion"], unit: "g", servingSize: 100, macros: { calories: 32, protein: 1.8, carbs: 7.3, fat: 0.2 } },
];

const normalizeLookupText = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeIngredientUnit = (value: string): NutritionUnit | null => {
  const unit = normalizeLookupText(value);
  if (["g", "gram", "grams", "kg", "kilogram", "kilograms"].includes(unit)) {
    return "g";
  }
  if (["ml", "milliliter", "milliliters", "l", "liter", "liters"].includes(unit)) {
    return "ml";
  }
  if (["piece", "pieces", "each", "unit"].includes(unit)) {
    return "piece";
  }
  if (unit === "large") {
    return "large";
  }
  return null;
};

const normalizeIngredientAmount = (amount: number, unit: string): number => {
  const normalizedUnit = normalizeLookupText(unit);
  if (["kg", "kilogram", "kilograms"].includes(normalizedUnit)) {
    return amount * 1000;
  }
  if (["l", "liter", "liters"].includes(normalizedUnit)) {
    return amount * 1000;
  }
  return amount;
};

const nutritionIndex: IndexedNutritionEntry[] = NUTRITION_DB.map((entry) => ({
  ...entry,
  normalizedAliases: entry.aliases.map(normalizeLookupText),
}));

const mealMacroCache = new Map<string, MealMacroComputation>();
const mealCorpusCache = new Map<string, string>();

const sumMacroParts = (a: MacroBreakdown, b: MacroBreakdown): MacroBreakdown => ({
  calories: a.calories + b.calories,
  protein: a.protein + b.protein,
  carbs: a.carbs + b.carbs,
  fat: a.fat + b.fat,
});

const multiplyMacros = (macros: MacroBreakdown, multiplier: number): MacroBreakdown => ({
  calories: macros.calories * multiplier,
  protein: macros.protein * multiplier,
  carbs: macros.carbs * multiplier,
  fat: macros.fat * multiplier,
});

const roundMacros = (macros: MacroBreakdown): MacroBreakdown => ({
  calories: Math.max(0, Math.round(macros.calories)),
  protein: Math.max(0, Math.round(macros.protein)),
  carbs: Math.max(0, Math.round(macros.carbs)),
  fat: Math.max(0, Math.round(macros.fat)),
});

const isCompatibleUnit = (entryUnit: NutritionUnit, ingredientUnit: NutritionUnit) =>
  entryUnit === ingredientUnit ||
  (entryUnit === "large" && ingredientUnit === "piece") ||
  (entryUnit === "piece" && ingredientUnit === "large");

const findNutritionEntry = (ingredientName: string): IndexedNutritionEntry | null => {
  const normalizedName = normalizeLookupText(ingredientName);
  if (!normalizedName) return null;
  const exact = nutritionIndex.find((entry) =>
    entry.normalizedAliases.some((alias) => alias === normalizedName)
  );
  if (exact) return exact;
  return (
    nutritionIndex.find((entry) =>
      entry.normalizedAliases.some(
        (alias) =>
          normalizedName.includes(alias) || alias.includes(normalizedName)
      )
    ) ?? null
  );
};

const fallbackCategoryMacros = (ingredient: IngredientLine) =>
  DEFAULT_MACROS_BY_CATEGORY[
    normalizeLookupText(ingredient.category ?? "other")
  ] ?? DEFAULT_MACROS_BY_CATEGORY.other;

const calculateIngredientMacrosDetailed = (
  ingredient: IngredientLine
): IngredientMacroDebug => {
  const entry = findNutritionEntry(ingredient.name);
  const normalizedUnit = normalizeIngredientUnit(ingredient.unit);
  const normalizedAmount = normalizeIngredientAmount(ingredient.amount, ingredient.unit);
  if (!normalizedUnit || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return {
      ingredient,
      normalizedUnit,
      normalizedAmount,
      source: "invalid",
      macros: ZERO_MACROS,
    };
  }

  if (entry && isCompatibleUnit(entry.unit, normalizedUnit)) {
    const multiplier = normalizedAmount / entry.servingSize;
    return {
      ingredient,
      normalizedUnit,
      normalizedAmount,
      source: "db",
      matchedAlias: entry.aliases[0],
      macros: multiplyMacros(entry.macros, multiplier),
    };
  }

  const fallback = fallbackCategoryMacros(ingredient);
  const defaultServing =
    normalizedUnit === "piece" || normalizedUnit === "large" ? 1 : 100;
  return {
    ingredient,
    normalizedUnit,
    normalizedAmount,
    source: "fallback",
    macros: multiplyMacros(fallback, normalizedAmount / defaultServing),
  };
};

const calculateMealMacrosDetailed = (ingredients: IngredientLine[]) => {
  const ingredientBreakdown = ingredients.map(calculateIngredientMacrosDetailed);
  const fromIngredients = roundMacros(
    ingredientBreakdown.reduce(
      (acc, item) => sumMacroParts(acc, item.macros),
      ZERO_MACROS
    )
  );
  return { ingredientBreakdown, fromIngredients };
};

const reconcileMealMacros = (
  computed: MacroBreakdown,
  library: MacroBreakdown
) => {
  const roundedComputed = roundMacros(computed);
  const roundedLibrary = roundMacros(library);
  if (roundedComputed.calories <= 0) {
    return {
      resolved: roundedLibrary,
      usedLibraryFallback: true,
    };
  }
  const calorieDelta =
    roundedLibrary.calories > 0
      ? Math.abs(roundedComputed.calories - roundedLibrary.calories) /
        roundedLibrary.calories
      : 0;
  const proteinDelta =
    roundedLibrary.protein > 0
      ? Math.abs(roundedComputed.protein - roundedLibrary.protein) /
        roundedLibrary.protein
      : 0;
  const usedLibraryFallback =
    calorieDelta > MACRO_RECONCILE_TOLERANCE ||
    proteinDelta > MACRO_RECONCILE_TOLERANCE;
  return {
    resolved: usedLibraryFallback ? roundedLibrary : roundedComputed,
    usedLibraryFallback,
  };
};

const mealMacroComputationFromIngredients = (meal: BaseMeal): MealMacroComputation => {
  const cached = mealMacroCache.get(meal.id);
  if (cached) return cached;
  const { ingredientBreakdown, fromIngredients } = calculateMealMacrosDetailed(
    meal.ingredients ?? []
  );
  const { resolved, usedLibraryFallback } = reconcileMealMacros(
    fromIngredients,
    meal.macros
  );
  const result: MealMacroComputation = {
    fromIngredients,
    resolved,
    library: roundMacros(meal.macros),
    usedLibraryFallback,
    ingredientBreakdown,
  };
  mealMacroCache.set(meal.id, result);
  return result;
};

const mealMacrosFromIngredients = (meal: BaseMeal): MacroBreakdown => {
  const computation = mealMacroComputationFromIngredients(meal);
  return computation.resolved;
};

const logMealMacroDebug = (
  meal: BaseMeal,
  computation: MealMacroComputation,
  portionMultiplier: number,
  afterPortion: MacroBreakdown
) => {
  if (!MACRO_DEBUG_LOGS) return;
  console.log("[macro-debug] meal-macros", {
    mealId: meal.id,
    mealName: meal.name,
    ingredientLookups: computation.ingredientBreakdown.map((item) => ({
      ingredient: item.ingredient.name,
      amount: item.ingredient.amount,
      unit: item.ingredient.unit,
      normalizedAmount: Number(item.normalizedAmount.toFixed(2)),
      normalizedUnit: item.normalizedUnit,
      source: item.source,
      matchedAlias: item.matchedAlias ?? null,
    })),
    ingredientMacros: computation.ingredientBreakdown.map((item) => ({
      ingredient: item.ingredient.name,
      source: item.source,
      macros: roundMacros(item.macros),
    })),
    totalBeforeMultiplier: computation.resolved,
    totalBeforeMultiplierFromIngredients: computation.fromIngredients,
    totalAfterMultiplier: afterPortion,
    portionMultiplier: Number(portionMultiplier.toFixed(3)),
    libraryMacros: computation.library,
    usedLibraryFallback: computation.usedLibraryFallback,
  });
};

const mealCorpus = (meal: BaseMeal): string => {
  const cached = mealCorpusCache.get(meal.id);
  if (cached) return cached;
  const corpus = normalizeLookupText(
    [
      meal.name,
      meal.description,
      ...meal.tastes,
      ...meal.ingredients.map((ingredient) => ingredient.name),
    ].join(" ")
  );
  mealCorpusCache.set(meal.id, corpus);
  return corpus;
};

const containsKeyword = (meal: BaseMeal, keyword: string) =>
  mealCorpus(meal).includes(normalizeLookupText(keyword));

const expandsSensitiveTerm = (term: string): string[] => {
  const normalized = normalizeLookupText(term);
  if (!normalized) return [];
  const expanded = new Set<string>([normalized]);
  ALLERGY_EXPANSION_RULES.forEach((rule) => {
    if (normalized.includes(rule.needle)) {
      rule.keywords.forEach((keyword) => expanded.add(keyword));
    }
  });
  return Array.from(expanded);
};

const normalizePreferenceTerms = (values?: string[] | null): string[] =>
  (values ?? [])
    .flatMap((value) => value.split(/[,;/]/))
    .map((value) => normalizeLookupText(value))
    .filter(Boolean);

const parseDietaryMode = (value?: string | null): DietaryMode | null => {
  const normalized = normalizeLookupText(value ?? "");
  if (!normalized) return null;
  if (normalized.includes("vegan")) return "vegan";
  if (normalized.includes("vegetarian")) return "vegetarian";
  if (normalized.includes("pescatarian") || normalized.includes("pescetarian")) {
    return "pescatarian";
  }
  if (normalized.includes("low carb") || normalized.includes("keto")) {
    return "low_carb";
  }
  if (normalized.includes("high protein")) {
    return "high_protein";
  }
  return null;
};

const inferDietaryMode = (prefs: PreferencesInput): DietaryMode | null => {
  const explicitMode = parseDietaryMode(prefs.profile?.dietaryMode ?? null);
  if (explicitMode) return explicitMode;
  if (prefs.tastes.includes("low-carb")) return "low_carb";
  if (prefs.tastes.includes("high-protein")) return "high_protein";

  const profileText = [
    prefs.profile?.notes ?? "",
    ...(prefs.profile?.household ?? []),
    ...(prefs.profile?.deliveryPreferences ?? []),
  ].join(" ");
  return parseDietaryMode(profileText);
};

const isMealCompatibleWithDietaryMode = (meal: BaseMeal, mode: DietaryMode): boolean => {
  const macros = mealMacrosFromIngredients(meal);
  switch (mode) {
    case "vegan":
      if (meal.proteinType && meal.proteinType !== "plant") return false;
      return !NON_VEGAN_KEYWORDS.some((keyword) => containsKeyword(meal, keyword));
    case "vegetarian":
      if (meal.proteinType && ["poultry", "red_meat", "fish", "seafood"].includes(meal.proteinType)) {
        return false;
      }
      return !NON_VEGETARIAN_KEYWORDS.some((keyword) => containsKeyword(meal, keyword));
    case "pescatarian":
      if (meal.proteinType && ["poultry", "red_meat"].includes(meal.proteinType)) {
        return false;
      }
      return !MEAT_KEYWORDS.some((keyword) => containsKeyword(meal, keyword));
    case "low_carb":
      return macros.carbs <= LOW_CARB_MAX_CARBS;
    case "high_protein":
      return macros.protein >= HIGH_PROTEIN_MIN_PROTEIN;
    default:
      return true;
  }
};

const buildMealFilterContext = (prefs: PreferencesInput): MealFilterContext => ({
  allergies: normalizePreferenceTerms(prefs.profile?.allergies),
  dislikes: normalizePreferenceTerms(prefs.profile?.dislikes),
  cuisines: normalizePreferenceTerms(prefs.profile?.cuisines),
  dietaryMode: inferDietaryMode(prefs),
});

const mealMatchesSensitiveTerms = (meal: BaseMeal, terms: string[]) =>
  terms.some((term) =>
    expandsSensitiveTerm(term).some((keyword) => containsKeyword(meal, keyword))
  );

const filterMealsByPreferences = (
  candidates: BaseMeal[],
  prefs: PreferencesInput
): BaseMeal[] => {
  const filters = buildMealFilterContext(prefs);
  if (!filters.allergies.length && !filters.dislikes.length && !filters.dietaryMode) {
    return candidates;
  }

  const allergySafe = filters.allergies.length
    ? candidates.filter((meal) => !mealMatchesSensitiveTerms(meal, filters.allergies))
    : candidates;

  const dietaryMode = filters.dietaryMode;
  const dietarySafe = dietaryMode
    ? allergySafe.filter((meal) =>
        isMealCompatibleWithDietaryMode(meal, dietaryMode)
      )
    : allergySafe;

  const dislikeSafe = filters.dislikes.length
    ? dietarySafe.filter((meal) => !mealMatchesSensitiveTerms(meal, filters.dislikes))
    : dietarySafe;

  return dislikeSafe;
};

const cuisinePreferenceKeywords = (value: string) => {
  const normalized = normalizeLookupText(value);
  if (!normalized) return [];
  if (normalized.includes("middle eastern")) {
    return ["middle eastern", "harissa", "za atar", "zaatar"];
  }
  return [normalized];
};

const mealMatchesCuisinePreferences = (meal: BaseMeal, cuisines: string[]) =>
  cuisines.some((cuisine) =>
    cuisinePreferenceKeywords(cuisine).some((keyword) => containsKeyword(meal, keyword))
  );

const PROTEIN_STEP_KEYWORDS = [
  "chicken",
  "turkey",
  "beef",
  "pork",
  "lamb",
  "salmon",
  "fish",
  "shrimp",
  "prawn",
  "tofu",
  "egg",
  "eggs",
  "beans",
  "edamame",
  "yogurt",
];

const CARB_STEP_KEYWORDS = [
  "rice",
  "oats",
  "noodles",
  "soba",
  "wrap",
  "tortilla",
  "farro",
  "freekeh",
  "potato",
  "bread",
];

const SAUCE_STEP_KEYWORDS = [
  "paste",
  "yogurt",
  "vinegar",
  "milk",
  "butter",
  "oil",
  "hummus",
  "peanut",
  "miso",
  "harissa",
  "chipotle",
  "honey",
];

const PRODUCE_STEP_KEYWORDS = [
  "tomato",
  "spinach",
  "greens",
  "cucumber",
  "pepper",
  "onion",
  "cabbage",
  "carrot",
  "berries",
  "lime",
  "kimchi",
  "herb",
];

const mealTitleFromSlot = (slot: MealSlot) =>
  `${slot.charAt(0).toUpperCase()}${slot.slice(1)} meal`;

const ingredientNamesMatching = (
  ingredients: IngredientLine[],
  keywords: string[],
  limit = 3
) => {
  const matches = ingredients
    .map((ingredient) => ingredient.name)
    .filter((name) => {
      const normalized = normalizeLookupText(name);
      return keywords.some((keyword) => normalized.includes(keyword));
    });
  return Array.from(new Set(matches)).slice(0, limit);
};

const formatIngredientSeries = (names: string[]) => {
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  const head = names.slice(0, -1).join(", ");
  const tail = names[names.length - 1];
  return `${head}, and ${tail}`;
};

const uniqueNonEmptySteps = (steps: string[]) =>
  Array.from(
    new Set(
      steps
        .map((step) => step.trim())
        .filter(Boolean)
    )
  );

export const buildRecipeSteps = (input: {
  mealSlot: MealSlot;
  title?: string;
  description?: string;
  readyInMinutes?: number;
  ingredients: IngredientLine[];
}): string[] => {
  const { mealSlot, description, ingredients, readyInMinutes, title } = input;
  const mealTitle = title?.trim() || mealTitleFromSlot(mealSlot);
  const prepIngredients = ingredients.slice(0, 4).map((ingredient) => ingredient.name);
  const proteinIngredients = ingredientNamesMatching(ingredients, PROTEIN_STEP_KEYWORDS, 2);
  const carbIngredients = ingredientNamesMatching(ingredients, CARB_STEP_KEYWORDS, 2);
  const sauceIngredients = ingredientNamesMatching(ingredients, SAUCE_STEP_KEYWORDS, 2);
  const produceIngredients = ingredientNamesMatching(ingredients, PRODUCE_STEP_KEYWORDS, 3);
  const prepLine = prepIngredients.length
    ? `Prep ${formatIngredientSeries(prepIngredients)} and measure the remaining ingredients.`
    : `Gather the ingredients for ${mealTitle.toLowerCase()}.`;

  if (mealSlot === "snack") {
    const snackSteps = [
      prepLine,
      carbIngredients.length
        ? `Layer or combine ${formatIngredientSeries(carbIngredients)} with ${formatIngredientSeries(
            proteinIngredients.length ? proteinIngredients : prepIngredients.slice(0, 2)
          )} in a bowl or container.`
        : `Combine the ingredients in a bowl and mix until evenly distributed.`,
      sauceIngredients.length
        ? `Stir in ${formatIngredientSeries(
            sauceIngredients
          )} to add flavor and moisture, then adjust to taste.`
        : `Taste and adjust seasoning or sweetness as needed.`,
      readyInMinutes
        ? `Serve immediately or chill briefly. This snack should be ready in about ${readyInMinutes} minutes.`
        : `Serve immediately or chill briefly before eating.`,
    ];
    return uniqueNonEmptySteps(snackSteps);
  }

  const savorySteps = [
    prepLine,
    carbIngredients.length
      ? `Cook ${formatIngredientSeries(
          carbIngredients
        )} according to package directions until tender.`
      : "",
    proteinIngredients.length
      ? `Cook ${formatIngredientSeries(
          proteinIngredients
        )} over medium-high heat until fully done and lightly browned.`
      : "",
    sauceIngredients.length
      ? `Whisk ${formatIngredientSeries(
          sauceIngredients
        )} together in a small bowl to create a quick sauce.`
      : "",
    produceIngredients.length
      ? `Add ${formatIngredientSeries(
          produceIngredients
        )} and cook briefly until just tender while keeping texture.`
      : "",
    description
      ? `Finish by combining everything, toss well, and plate. Goal vibe: ${description}`
      : `Combine all cooked components, toss together, and season to taste.`,
    readyInMinutes
      ? `Serve hot and enjoy. Total active time should be around ${readyInMinutes} minutes.`
      : `Serve warm and adjust portions as needed.`,
  ];

  return uniqueNonEmptySteps(savorySteps).slice(0, 6);
};

const normalizeProteinLabel = (value?: string | null): string | null => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === "seafood") return "fish";
  return normalized;
};

const proteinLabelFromMeal = (meal: Pick<MealInstance, "proteinType" | "tags">): string | null => {
  if (meal.proteinType) {
    const normalized = normalizeProteinLabel(meal.proteinType);
    if (normalized) return normalized;
  }
  const proteinTag =
    meal.tags?.find((tag) => tag.toLowerCase().startsWith("protein:")) ?? null;
  if (proteinTag) {
    const [, value] = proteinTag.split(":");
    return normalizeProteinLabel(value ?? null);
  }
  return null;
};

export type RotationHistoryEntry = {
  date: string;
  proteins: string[];
};

export const rotationHistoryFromPlan = (plan: WeeklyMealPlan | null): RotationHistoryEntry[] => {
  if (!plan) return [];
  return plan.days.map((day) => {
    const proteins = Array.from(
      new Set(
        day.meals
          .map((meal) => proteinLabelFromMeal(meal))
          .filter((value): value is string => Boolean(value))
      )
    );
    return {
      date: day.date,
      proteins,
    };
  });
};

const ensureBaseIngredients = (meal: MealInstance): IngredientLine[] => {
  if (meal.baseIngredients && meal.baseIngredients.length) {
    return meal.baseIngredients;
  }
  const multiplier = meal.portionMultiplier || 1;
  const fallback =
    meal.ingredients?.map((ingredient) => ({
      ...ingredient,
      amount: Number((ingredient.amount / multiplier).toFixed(2)),
    })) ?? [];
  meal.baseIngredients = fallback;
  return fallback;
};

const MIN_PORTION = 0.7;
const MAX_PORTION = 1.5;

const clampPortion = (value: number) =>
  Number(Math.min(MAX_PORTION, Math.max(MIN_PORTION, value)).toFixed(2));

const applyPortionMultiplier = (meal: MealInstance, multiplier: number) => {
  const nextMultiplier = clampPortion(multiplier);
  const baseIngredients = ensureBaseIngredients(meal);
  meal.portionMultiplier = nextMultiplier;
  meal.macros = scaleMacros(meal.baseMacros, nextMultiplier);
  meal.ingredients = scaleIngredients(baseIngredients, nextMultiplier);
};

type CompleteMacroTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const DEFAULT_MACRO_TARGETS: Record<string, CompleteMacroTargets> = {
  lose_weight: { calories: 1800, protein: 150, carbs: 180, fat: 60 },
  maintain: { calories: 2200, protein: 160, carbs: 220, fat: 75 },
  gain: { calories: 2800, protein: 180, carbs: 300, fat: 90 },
};

const normalizeGoalForDefaultTargets = (goal?: GoalType | null) => {
  const normalized = (goal ?? "maintain").toLowerCase();
  if (normalized === "lose" || normalized === "lose_weight") return "lose_weight";
  if (normalized === "gain") return "gain";
  return "maintain";
};

const hasNumericTargets = (targets?: MacroTargets | null) =>
  !!targets &&
  [targets.calories, targets.protein, targets.carbs, targets.fat].some(
    (value) => typeof value === "number"
  );

const computeDefaultMacroTargets = (prefs: PreferencesInput): MacroTargets => {
  const goal = normalizeGoalForDefaultTargets(prefs.goal);
  const defaults = DEFAULT_MACRO_TARGETS[goal] ?? DEFAULT_MACRO_TARGETS.maintain;
  return { ...defaults };
};

export const resolveMacroTargets = (prefs: PreferencesInput): MacroTargets => {
  const defaults = computeDefaultMacroTargets(prefs);
  if (!hasNumericTargets(prefs.macroTargets)) {
    return defaults;
  }
  const explicit = prefs.macroTargets ?? {};
  return {
    calories: explicit.calories ?? defaults.calories,
    protein: explicit.protein ?? defaults.protein,
    carbs: explicit.carbs ?? defaults.carbs,
    fat: explicit.fat ?? defaults.fat,
  };
};

const mealSlotsForPreferences = (prefs?: PreferencesInput): MealSlot[] => {
  const mealsPerDay = prefs?.profile?.mealsPerDay;
  if (mealsPerDay === 3) {
    return ["breakfast", "lunch", "dinner"];
  }
  return BASE_MEAL_SLOTS;
};

const calorieWeightsForSlots = (slots: MealSlot[]): number[] => {
  if (slots.length === 5) {
    return [0.9, 0.6, 1.05, 1.2, 0.55];
  }
  return slots.map((slot) => SLOT_CALORIE_WEIGHTS[slot] ?? 1);
};

const buildPreferenceSignature = (prefs: PreferencesInput) =>
  JSON.stringify({
    tastes: [...prefs.tastes].sort(),
    goal: prefs.goal ?? null,
    mealComplexity: prefs.mealComplexity ?? null,
    macroTargets: prefs.macroTargets
      ? {
          calories: prefs.macroTargets.calories ?? null,
          protein: prefs.macroTargets.protein ?? null,
          carbs: prefs.macroTargets.carbs ?? null,
          fat: prefs.macroTargets.fat ?? null,
        }
      : null,
    profile: prefs.profile ? buildProfileSignature(prefs.profile) : null,
  });

const buildProfileSignature = (profile: UserProfileInput) => ({
  locale: profile.locale ?? null,
  timezone: profile.timezone ?? null,
  bodyWeightKg: profile.bodyWeightKg ?? null,
  bodyFatPercent: profile.bodyFatPercent ?? null,
  heightCm: profile.heightCm ?? null,
  activityLevel: profile.activityLevel ?? null,
  dietaryMode: profile.dietaryMode ?? null,
  trainingSchedule: profile.trainingSchedule
    ? [...profile.trainingSchedule].sort()
    : null,
  allergies: profile.allergies ? [...profile.allergies].sort() : null,
  dislikes: profile.dislikes ? [...profile.dislikes].sort() : null,
  cuisines: profile.cuisines ? [...profile.cuisines].sort() : null,
  pantryStaples: profile.pantryStaples ? [...profile.pantryStaples].sort() : null,
  household: profile.household ? [...profile.household].sort() : null,
  deliveryPreferences: profile.deliveryPreferences
    ? [...profile.deliveryPreferences].sort()
    : null,
  sleepHours: profile.sleepHours ?? null,
  stressLevel: profile.stressLevel ?? null,
  mealsPerDay: profile.mealsPerDay ?? null,
});

const getStartOfWeek = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setHours(0, 0, 0, 0);
  d.setDate(diff);
  return d;
};

const addDays = (date: Date, amount: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
};

const computeMultiplier = (prefs: PreferencesInput, slot: MealSlot) => {
  if (slot !== "snack") {
    return 1;
  }
  const goalMultiplier = GOAL_MULTIPLIERS[prefs.goal ?? "maintain"] ?? 1;
  const complexityMultiplier = prefs.mealComplexity
    ? COMPLEXITY_MULTIPLIERS[prefs.mealComplexity] ?? 1
    : 1;
  return Number((goalMultiplier * complexityMultiplier * SLOT_WEIGHTS[slot]).toFixed(2));
};

const alignDayToTargets = (
  day: DayPlan,
  macroTargets: MacroTargets | null,
  slots: MealSlot[]
) => {
  const targetCalories = macroTargets?.calories;
  const targetProtein = macroTargets?.protein;
  if ((!targetCalories && !targetProtein) || day.meals.length === 0) return;

  const weights = calorieWeightsForSlots(slots.slice(0, day.meals.length));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;

  day.meals.forEach((meal, index) => {
    const weight = weights[index] ?? 1;
    const desiredCalories = targetCalories ? (targetCalories * weight) / totalWeight : null;
    const desiredProtein = targetProtein ? targetProtein / day.meals.length : null;

    const calorieScale =
      desiredCalories && meal.macros.calories > 0
        ? desiredCalories / meal.macros.calories
        : 1;
    const proteinScale =
      desiredProtein && meal.macros.protein > 0
        ? desiredProtein / meal.macros.protein
        : 1;

    // Protein is priority 1, calories are priority 2.
    const scale = Math.max(proteinScale || 1, calorieScale * 0.9);
    const boundedScale = Math.max(0.7, Math.min(1.35, scale));
    applyPortionMultiplier(meal, meal.portionMultiplier * boundedScale);
  });

  recalcDay(day);

  // Second pass: nudge calories back toward target while preserving most of the protein win.
  if (targetCalories && day.totals.calories > 0) {
    const correction = targetCalories / day.totals.calories;
    if (Math.abs(1 - correction) > 0.05) {
      const projectedProtein = day.totals.protein * correction;
      if (!targetProtein || projectedProtein >= targetProtein * 0.95) {
        const boundedCorrection = Math.max(0.85, Math.min(1.15, correction));
        day.meals.forEach((meal) => {
          applyPortionMultiplier(meal, meal.portionMultiplier * boundedCorrection);
        });
        recalcDay(day);
      }
    }
  }
};

const fatTargetForDay = (
  macroTargets: MacroTargets | null,
  mealCount: number
) => {
  if (typeof macroTargets?.fat !== "number" || macroTargets.fat <= 0) {
    return null;
  }
  return (macroTargets.fat * mealCount) / WORKDAY_MEAL_SLOTS.length;
};

const findLowerFatAlternative = (
  day: DayPlan,
  targetMealIndex: number,
  prefs: PreferencesInput
) => {
  const currentMeal = day.meals[targetMealIndex];
  if (!currentMeal) return null;
  const currentFat = currentMeal.baseMacros?.fat ?? currentMeal.macros.fat;
  const usedBaseIds = new Set(
    day.meals
      .filter((_, index) => index !== targetMealIndex)
      .map((meal) => meal.baseId)
  );
  const slotCandidates = MEAL_LIBRARY.filter(
    (meal) =>
      meal.mealTypes.includes(currentMeal.mealSlot) &&
      !usedBaseIds.has(meal.id)
  );
  const preferenceFiltered = filterMealsByPreferences(slotCandidates, prefs);
  const pool = preferenceFiltered.length ? preferenceFiltered : slotCandidates;
  const ranked = pool
    .map((meal) => {
      const macros = mealMacrosFromIngredients(meal);
      return { meal, macros };
    })
    .filter(({ meal, macros }) => meal.id !== currentMeal.baseId && macros.fat < currentFat)
    .sort((a, b) => {
      if (a.macros.fat !== b.macros.fat) {
        return a.macros.fat - b.macros.fat;
      }
      return b.macros.protein - a.macros.protein;
    });
  return ranked[0]?.meal ?? null;
};

const scoreMeal = (
  meal: BaseMeal,
  prefs: PreferencesInput,
  slot: MealSlot,
  targets: MacroTargets | null
) => {
  const macros = mealMacrosFromIngredients(meal);
  let score = 1 + Math.random();
  if (prefs.tastes.length && meal.tastes.some((taste) => prefs.tastes.includes(taste))) {
    score += 2;
  }
  if (prefs.goal && meal.goalFit?.includes(prefs.goal)) {
    score += 1.5;
  }
  if (prefs.mealComplexity && meal.complexity === prefs.mealComplexity) {
    score += 1;
  }
  if (prefs.profile?.cuisines?.length) {
    const preferredCuisines = normalizePreferenceTerms(prefs.profile.cuisines);
    if (preferredCuisines.length && mealMatchesCuisinePreferences(meal, preferredCuisines)) {
      score += 1.4;
    }
  }
  const targetProtein = targets?.protein;
  if (typeof targetProtein === "number" && targetProtein > 0) {
    const proteinDensity = macros.protein / Math.max(1, macros.calories);
    score += proteinDensity * 22;
    if (slot === "snack") {
      score += macros.protein * 0.18;
      if (targetProtein >= 170 && macros.protein >= 20) {
        score += 2.5;
      }
    }
  }
  return score;
};

const selectBaseMeal = (
  slot: MealSlot,
  prefs: PreferencesInput,
  targets: MacroTargets | null,
  excludeBaseIds?: Set<string>
) => {
  const excludedIds = excludeBaseIds ?? new Set<string>();
  const candidates = MEAL_LIBRARY.filter((meal) => meal.mealTypes.includes(slot));
  const uniqueCandidates = candidates.filter((meal) => !excludedIds.has(meal.id));
  const slotPool = uniqueCandidates.length ? uniqueCandidates : candidates;
  const filtered = filterMealsByPreferences(slotPool, prefs);
  const pool = filtered;
  const ranked = pool
    .map((meal) => ({ meal, score: scoreMeal(meal, prefs, slot, targets) }))
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) {
    console.warn(
      `No preference-safe meals available for slot "${slot}". Falling back to default candidate.`
    );
    return slotPool[0] ?? MEAL_LIBRARY[0];
  }
  const window = Math.min(5, ranked.length);
  const index = Math.floor(Math.random() * window);
  return ranked[index].meal;
};

type MealInstanceOptions = {
  excludeBaseIds?: Set<string>;
};

const createMealInstanceFromBase = (
  base: BaseMeal,
  slot: MealSlot,
  prefs: PreferencesInput,
  multiplierOverride?: number
): MealInstance => {
  const multiplier = clampPortion(multiplierOverride ?? computeMultiplier(prefs, slot));
  const baseIngredients = (base.ingredients ?? []).map((ingredient) => ({ ...ingredient }));
  const macroComputation = mealMacroComputationFromIngredients(base);
  const computedBaseMacros = macroComputation.resolved;
  const scaledMacros = scaleMacros(computedBaseMacros, multiplier);
  const recipeSteps =
    base.steps && base.steps.length
      ? uniqueNonEmptySteps(base.steps)
      : buildRecipeSteps({
          mealSlot: slot,
          title: base.name,
          description: base.description,
          readyInMinutes: base.readyInMinutes,
          ingredients: baseIngredients,
        });
  const meal: MealInstance = {
    instanceId: randomId(),
    baseId: base.id,
    mealSlot: slot,
    title: base.name,
    description: base.description,
    steps: recipeSteps,
    recipeSteps,
    tags: base.tastes,
    image: base.image,
    readyInMinutes: base.readyInMinutes,
    portionMultiplier: multiplier,
    baseMacros: { ...computedBaseMacros },
    macros: scaledMacros,
    baseIngredients,
    ingredients: scaleIngredients(baseIngredients, multiplier),
    proteinType: base.proteinType,
  };
  logMealMacroDebug(base, macroComputation, multiplier, scaledMacros);
  return meal;
};

const createMealInstance = (
  slot: MealSlot,
  prefs: PreferencesInput,
  targets: MacroTargets | null,
  options?: MealInstanceOptions
): MealInstance => {
  const base = selectBaseMeal(slot, prefs, targets, options?.excludeBaseIds);
  return createMealInstanceFromBase(base, slot, prefs);
};

const createDayMeals = (
  slots: MealSlot[],
  prefs: PreferencesInput,
  targets: MacroTargets | null
) => {
  const usedBaseIds = new Set<string>();
  return slots.map((slot) => {
    const meal = createMealInstance(slot, prefs, targets, {
      excludeBaseIds: usedBaseIds,
    });
    usedBaseIds.add(meal.baseId);
    return meal;
  });
};

const optimizeDayForTargets = (
  day: DayPlan,
  slots: MealSlot[],
  prefs: PreferencesInput,
  macroTargets: MacroTargets | null
) => {
  alignDayToTargets(day, macroTargets, slots);
  recalcDay(day);

  const targetFat = fatTargetForDay(macroTargets, day.meals.length);
  if (!targetFat) return;
  if (day.totals.fat <= targetFat * 1.15) return;

  const fattestMealIndex = day.meals.reduce((acc, meal, index, meals) => {
    const currentFat = meal.macros.fat ?? 0;
    const bestFat = meals[acc]?.macros.fat ?? 0;
    return currentFat > bestFat ? index : acc;
  }, 0);

  const replacementBase = findLowerFatAlternative(day, fattestMealIndex, prefs);
  if (!replacementBase) return;

  const currentMeal = day.meals[fattestMealIndex];
  day.meals[fattestMealIndex] = createMealInstanceFromBase(
    replacementBase,
    currentMeal.mealSlot,
    prefs,
    currentMeal.portionMultiplier
  );
  alignDayToTargets(day, macroTargets, slots);
  recalcDay(day);
};

const recalcDay = (day: DayPlan) => {
  day.totals = sumMacros(day.meals.map((meal) => meal.macros));
};

const clampDaysToWorkweek = (days: DayPlan[]) => days.slice(0, WORKDAY_COUNT);

const recalcWeek = (plan: WeeklyMealPlan) => {
  plan.days = clampDaysToWorkweek(plan.days);
  plan.weeklyTotals = sumMacros(plan.days.map((day) => day.totals));
  plan.generatedAt = new Date().toISOString();
};

const clonePlan = (plan: WeeklyMealPlan): WeeklyMealPlan =>
  JSON.parse(JSON.stringify(plan));

export const generateFallbackMealPlan = (prefs: PreferencesInput): WeeklyMealPlan => {
  const macroTargets = resolveMacroTargets(prefs);
  const slots = mealSlotsForPreferences(prefs);
  const signature = buildPreferenceSignature(prefs);
  const startOfWeek = getStartOfWeek();
  const fullDays: DayPlan[] = Array.from({ length: WORKDAY_COUNT }).map((_, index) => {
    const date = addDays(startOfWeek, index);
    const meals = createDayMeals(slots, prefs, macroTargets);
    const day: DayPlan = {
      id: randomId(),
      label: date.toLocaleDateString("en-US", { weekday: "long" }),
      date: date.toISOString(),
      meals,
      totals: sumMacros(meals.map((meal) => meal.macros)),
    };
    optimizeDayForTargets(day, slots, prefs, macroTargets);
    return day;
  });

  return {
    id: randomId(),
    userId: prefs.userId,
    weekStart: startOfWeek.toISOString(),
    generatedAt: new Date().toISOString(),
    preferenceSignature: signature,
    days: fullDays,
    weeklyTotals: sumMacros(fullDays.map((day) => day.totals)),
  };
};

const regenerateDayMeals = (
  day: DayPlan,
  prefs: PreferencesInput,
  macroTargets: MacroTargets | null
) => {
  const slots = mealSlotsForPreferences(prefs);
  day.meals = createDayMeals(slots, prefs, macroTargets);
  optimizeDayForTargets(day, slots, prefs, macroTargets);
  recalcDay(day);
};

export const regenerateDayInPlan = (
  plan: WeeklyMealPlan,
  dayIndex: number,
  prefs: PreferencesInput
): WeeklyMealPlan => {
  const next = clonePlan(plan);
  next.days = clampDaysToWorkweek(next.days);
  const day = next.days[dayIndex];
  if (!day) return plan;
  const macroTargets = resolveMacroTargets(prefs);
  regenerateDayMeals(day, prefs, macroTargets);
  recalcWeek(next);
  return next;
};

export const regenerateWeekInPlan = (
  plan: WeeklyMealPlan,
  prefs: PreferencesInput
): WeeklyMealPlan => {
  const next = clonePlan(plan);
  next.days = clampDaysToWorkweek(next.days);
  const macroTargets = resolveMacroTargets(prefs);
  next.days.forEach((day) => {
    regenerateDayMeals(day, prefs, macroTargets);
  });
  recalcWeek(next);
  return next;
};

export const swapMealInPlan = (
  plan: WeeklyMealPlan,
  dayIndex: number,
  mealIndex: number,
  prefs: PreferencesInput
): WeeklyMealPlan => {
  const next = clonePlan(plan);
  next.days = clampDaysToWorkweek(next.days);
  const day = next.days[dayIndex];
  if (!day) return plan;
  const slot = day.meals[mealIndex]?.mealSlot ?? "lunch";
  const macroTargets = resolveMacroTargets(prefs);
  const usedBaseIds = new Set(
    day.meals
      .filter((_, index) => index !== mealIndex)
      .map((meal) => meal.baseId)
  );
  day.meals[mealIndex] = createMealInstance(slot, prefs, macroTargets, {
    excludeBaseIds: usedBaseIds,
  });
  optimizeDayForTargets(day, mealSlotsForPreferences(prefs), prefs, macroTargets);
  recalcDay(day);
  recalcWeek(next);
  return next;
};

export const adjustMealPortion = (
  plan: WeeklyMealPlan,
  dayIndex: number,
  mealIndex: number,
  direction: "increase" | "decrease"
): WeeklyMealPlan => {
  const next = clonePlan(plan);
  next.days = clampDaysToWorkweek(next.days);
  const day = next.days[dayIndex];
  if (!day) return plan;
  const meal = day.meals[mealIndex];
  if (!meal) return plan;
  const multiplier = direction === "increase" ? 1.12 : 0.88;
  applyPortionMultiplier(meal, meal.portionMultiplier * multiplier);
  recalcDay(day);
  recalcWeek(next);
  return next;
};

export const preferenceSignatureFor = buildPreferenceSignature;

export type ShoppingListItem = {
  name: string;
  quantity: number;
  unit: string;
  category?: string;
  displayName?: string;
};

const COUNTABLE_SHOPPING_UNITS = new Set(["large", "each", "piece", "slice", "unit"]);

const canonicalShoppingUnit = (unit: string) => {
  const normalized = normalizeLookupText(unit);
  if (normalized === "each" || normalized === "unit" || normalized === "slice") {
    return "piece";
  }
  return normalized || unit;
};

const roundMetricQuantity = (value: number) => {
  if (value < 100) {
    return Math.round(value / 5) * 5;
  }
  if (value <= 1000) {
    return Math.round(value / 10) * 10;
  }
  return Math.round(value / 50) * 50;
};

const roundShoppingQuantity = (quantity: number, unit: string) => {
  const safeQuantity = Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
  const normalizedUnit = canonicalShoppingUnit(unit);
  if (COUNTABLE_SHOPPING_UNITS.has(normalizedUnit)) {
    return Math.ceil(safeQuantity);
  }
  if (normalizedUnit === "g" || normalizedUnit === "ml") {
    return Math.max(5, roundMetricQuantity(safeQuantity));
  }
  return Number(safeQuantity.toFixed(2));
};

const normalizeShoppingItem = (item: ShoppingListItem): ShoppingListItem => {
  const unit = canonicalShoppingUnit(item.unit);
  return {
    ...item,
    unit,
    quantity: roundShoppingQuantity(item.quantity, unit),
  };
};

export const buildShoppingList = (plan: WeeklyMealPlan): ShoppingListItem[] => {
  const map = new Map<string, ShoppingListItem>();
  plan.days.forEach((day) => {
    day.meals.forEach((meal) => {
      (meal.ingredients ?? []).forEach((ingredient) => {
        const unit = canonicalShoppingUnit(ingredient.unit);
        const key = `${ingredient.name.toLowerCase()}|${unit}|${
          ingredient.category ?? ""
        }`;
        const existing = map.get(key);
        const quantity = Number(ingredient.amount.toFixed(2));
        if (existing) {
          existing.quantity = Number((existing.quantity + quantity).toFixed(2));
        } else {
          map.set(key, {
            name: ingredient.name,
            unit,
            category: ingredient.category,
            quantity,
          });
        }
      });
    });
  });

  return Array.from(map.values())
    .map(normalizeShoppingItem)
    .sort((a, b) => {
    const categoryA = a.category ?? "Pantry";
    const categoryB = b.category ?? "Pantry";
    if (categoryA !== categoryB) {
      return categoryA.localeCompare(categoryB);
    }
    return a.name.localeCompare(b.name);
    });
};

export const normalizeShoppingList = async (
  items: ShoppingListItem[],
  locale = "UK"
): Promise<ShoppingListItem[]> => {
  if (!items.length) return items;
  try {
    const response = await fetch("/api/normalize-shopping-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, locale }),
    });
    let normalized = items;
    if (response.ok) {
      const data = (await response.json()) as { items?: ShoppingListItem[] };
      if (Array.isArray(data.items) && data.items.length) {
        normalized = data.items;
      }
    }
    return applyLocaleHeuristics(normalized, locale);
  } catch (error) {
    console.error("normalizeShoppingList error", error);
    return applyLocaleHeuristics(items, locale);
  }
};

const applyLocaleHeuristics = (items: ShoppingListItem[], locale: string) => {
  if (!items.length) return items;
  const normalized =
    locale.toLowerCase() === "uk" ? applyUkHeuristics(items) : items;
  return mergeSimilarItems(normalized);
};

const applyUkHeuristics = (items: ShoppingListItem[]): ShoppingListItem[] => {
  return items.map(normalizeShoppingItem);
};

const mergeSimilarItems = (items: ShoppingListItem[]): ShoppingListItem[] => {
  const map = new Map<string, ShoppingListItem>();
  items.forEach((item) => {
    const key = `${(item.displayName ?? item.name).toLowerCase()}|${item.unit}|${
      item.category ?? ""
    }`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity = Math.round(
        (existing.quantity + item.quantity) * 100
      ) / 100;
    } else {
      map.set(key, { ...item });
    }
  });
  return Array.from(map.values());
};
