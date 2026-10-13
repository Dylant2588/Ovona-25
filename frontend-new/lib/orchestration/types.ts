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
  /** Explicitly verified similarity group; absence means the candidate ID is its group. */
  similarityKey?: string;
  /** A bounded AI ordering hint after server-side recipe/version resolution. */
  aiPriority?: number;
  proteinType?: string;
  cuisine?: string;
  format?: string;
};

export type SelectedMealServing = {
  recipeServings: number;
  nutritionPortionMultiplier: number;
  householdPortionMultiplier: number;
  servings: number;
};

export type ScoreComponents = Readonly<{
  nutrition: number;
  preference: number;
  reuse: number;
  prep: number;
  cost: number;
  repetition: number;
  diversity: number;
}>;

export type CandidateScore = Readonly<{
  candidate: VerifiedCandidateMeal;
  components: ScoreComponents;
  total: number;
  facts: readonly string[];
}>;

export type SelectedMeal = Readonly<{
  candidateId: string;
  slot: PlannerMealSlot;
  title: string;
  similarityKey: string;
  ingredients: readonly VerifiedIngredient[];
  nutrition: Readonly<{ calories: number; protein: number; carbs: number; fat: number }>;
  cost: number;
  prepMinutes: number;
  proteinType?: string;
  cuisine?: string;
  format?: string;
  isLeftover: boolean;
  leftoverFromCandidateId?: string;
  score: CandidateScore;
  explanation: string;
} & SelectedMealServing>;

export type ScheduledDay = Readonly<{
  day: number;
  meals: readonly SelectedMeal[];
}>;

export type ScheduleViolation = Readonly<{
  day: number;
  code: "missing_slot" | "calories_out_of_band" | "protein_out_of_band" | "hard_constraint_violation" | "repair_exhausted" | "insufficient_candidates";
  message: string;
}>;

export type WeekSchedule = Readonly<{ days: readonly ScheduledDay[] }>;
export type WeekScheduleResult = { ok: true; value: WeekSchedule } | { ok: false; error: Readonly<{ code: string; violations: readonly ScheduleViolation[] }> };

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
