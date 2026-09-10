export type PlannerMealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export type PlannerPolicy = {
  calorieBand: { min: number; max: number };
  proteinBand: { min: number; max: number };
  scoreWeights: { nutrition: number; preference: number; reuse: number; prep: number; cost: number; repetition: number };
  repair: { maxAttempts: number };
  repetition: { maxUsesPerWeek: number };
  calorieTargetRange: { min: number; max: number };
  proteinTargetRange: { min: number; max: number };
  maxPrepMinutes: number;
  maxHouseholdSize: number;
};

export type HardPlannerConstraints = {
  allergies: readonly string[];
  dietaryRules: readonly string[];
  requiredSlots: readonly PlannerMealSlot[];
  calorieBand: Readonly<{ min: number; max: number }>;
  proteinBand: Readonly<{ min: number; max: number }>;
  maxPrepMinutes: number;
};

export type SoftPlannerPreferences = {
  dislikes: readonly string[];
  tastes: readonly string[];
  budgetSensitivity: "low" | "medium" | "high";
  preferredMealTypes: readonly string[];
};

export type PlannerProfile = Readonly<{
  calorieTarget: number;
  proteinTarget: number;
  householdSize: number;
  hardConstraints: Readonly<HardPlannerConstraints>;
  softPreferences: Readonly<SoftPlannerPreferences>;
  policy: Readonly<PlannerPolicy>;
}>;

export type VerifiedIngredient = {
  name: string;
  normalizedName: string;
  quantity: number;
  unit: string;
  pantry: boolean;
};

export type VerifiedCandidateMeal = {
  id: string;
  slot: PlannerMealSlot;
  title: string;
  verified: true;
  ingredients: readonly VerifiedIngredient[];
  allergens: readonly string[];
  dietaryTags: readonly string[];
  nutrition: Readonly<{ calories: number; protein: number; carbs: number; fat: number }>;
  cost: number;
  prepMinutes: number;
  servings: number;
  isLeftover?: boolean;
  leftoverFromCandidateId?: string;
};

export type CandidateExclusion = { candidateId: string; reason: string };
export type OrchestrationResult<T> = { ok: true; value: T } | { ok: false; error: PlannerInputError };

export class PlannerInputError extends Error {
  readonly statusCode = 400;
  readonly code: string;
  readonly field?: string;

  constructor(code: string, message: string, field?: string) {
    super(message);
    this.name = "PlannerInputError";
    this.code = code;
    this.field = field;
  }
}

export class PlannerInsufficiencyError extends Error {
  readonly statusCode = 422;
  readonly exclusions: readonly CandidateExclusion[];

  constructor(exclusions: readonly CandidateExclusion[]) {
    super("No candidates satisfy the planner's hard constraints.");
    this.name = "PlannerInsufficiencyError";
    this.exclusions = exclusions;
  }
}
