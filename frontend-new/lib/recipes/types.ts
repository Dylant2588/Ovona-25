export type RecipeMacros = { calories: number; protein: number; carbs: number; fat: number };
export type FoodState = "raw" | "cooked" | "drained" | "cooked_drained" | "as_sold";
export type FoodCompositionSnapshot = {
  id: string; revision: string; name: string; state: FoodState;
  basis: { amount: number; unit: "g" | "ml" | "each" }; macros: RecipeMacros;
  source: { publisher: string; dataset: string; version: string; reference: string; retrievedAt: string; licence: string; foodCode: string };
};
export type QuantityConversionEvidence = {
  densityGramsPerMl?: number;
  gramsPerUnit?: { unit: "each" | "large" | "piece"; grams: number };
  mlPerUnit?: { unit: "tbsp" | "tsp"; ml: number };
  reference: string;
};
export type IngredientNutritionEvidence = {
  food: FoodCompositionSnapshot; quantityState: FoodState; mappingReference: string; conversion?: QuantityConversionEvidence;
};
export type CalculatedNutritionEvidence = {
  policyVersion: "ingredient-v1"; servings: number; batchMacros: RecipeMacros; perServingMacros: RecipeMacros;
  lines: Array<{ ingredientIndex: number; foodId: string; foodRevision: string; sourceAmount: number; sourceUnit: "g" | "ml" | "each"; macros: RecipeMacros }>;
};
export type RecipeIngredient = {
  name: string; canonicalId: string; amount: number; unit: string;
  allergens: string[]; mayContain?: string[]; dietaryFlags: string[]; reviewed: boolean;
  nutrition?: IngredientNutritionEvidence;
};
export type RecipeRecord = {
  id: string; version: number; title: string; description: string;
  /** Optional curator-supplied cuisine; never inferred by AI during generation. */
  cuisine?: string;
  slots: Array<"breakfast" | "lunch" | "dinner" | "snack">;
  ingredients: RecipeIngredient[]; steps: string[]; servings: number;
  readyInMinutes: number; macros: RecipeMacros; proteinType: "poultry" | "red_meat" | "fish" | "seafood" | "plant" | "mixed"; image: string;
  source: { kind: "internal" | "licensed" | "public_domain"; reference: string; rights: string; reviewed: boolean };
  nutrition: { method: string; reference: string; reviewed: boolean; calculation?: CalculatedNutritionEvidence };
  review: { status: "pending_review" | "approved" | "rejected"; reviewedBy: string | null; reviewedAt: string | null };
};
export type ApprovalConstraints = {
  allergies?: string[]; dislikes?: string[]; dietaryMode?: string | null;
  dietaryModes?: string[]; neverFoods?: string[]; maxPrepMinutes?: number;
};
export type RecipeConstraints = ApprovalConstraints;
export type ApprovalReason = { code: string; message: string };
export type ApprovalResult = {
  approved: boolean; reasons: ApprovalReason[]; recipeId: string;
  recipeVersion: number; policyVersion: string;
};
