export type RecipeMacros = { calories: number; protein: number; carbs: number; fat: number };
export type RecipeIngredient = {
  name: string; canonicalId: string; amount: number; unit: string;
  allergens: string[]; mayContain?: string[]; dietaryFlags: string[]; reviewed: boolean;
};
export type RecipeRecord = {
  id: string; version: number; title: string; description: string;
  slots: Array<"breakfast" | "lunch" | "dinner" | "snack">;
  ingredients: RecipeIngredient[]; steps: string[]; servings: number;
  readyInMinutes: number; macros: RecipeMacros; proteinType: "poultry" | "red_meat" | "fish" | "seafood" | "plant" | "mixed"; image: string;
  source: { kind: "internal" | "licensed" | "public_domain"; reference: string; rights: string; reviewed: boolean };
  nutrition: { method: string; reference: string; reviewed: boolean };
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
