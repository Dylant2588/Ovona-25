import { readOnboardingMeta } from "@/lib/onboarding-meta";
import type { PreferencesInput } from "@/lib/meal-generator";
import { supabaseServer } from "@/lib/supabaseServer";
import type {
  GenerationContext,
  GenerationSupabase,
  MicroTargets,
  SlotBudget,
} from "@/lib/generation/types";

type PreferencesRow = Record<string, unknown> | null;
type ProfileRow = Record<string, unknown> | null;

const DEFAULT_TARGETS = {
  lose_weight: { calories: 1800, protein: 150, carbs: 180, fat: 60 },
  maintain: { calories: 2200, protein: 160, carbs: 220, fat: 75 },
  gain: { calories: 2800, protein: 180, carbs: 300, fat: 90 },
  recomp: { calories: 2300, protein: 175, carbs: 210, fat: 75 },
} as const;

const ACTIVITY_MULTIPLIER: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  lightly_active: 1.375,
  moderate: 1.55,
  active: 1.55,
  intense: 1.725,
  very_active: 1.725,
};

const parseString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const parseNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      )
    );
  }
  if (typeof value === "string" && value.trim()) {
    return Array.from(
      new Set(
        value
          .split(/[,;\n]/)
          .map((entry) => entry.trim())
          .filter(Boolean)
      )
    );
  }
  return [];
};

const normalizeGoal = (value: unknown): keyof typeof DEFAULT_TARGETS => {
  const goal = parseString(value).toLowerCase();
  if (goal === "lose" || goal === "lose_weight") return "lose_weight";
  if (goal === "gain" || goal === "build_muscle") return "gain";
  if (goal === "recomp" || goal === "body_recomposition") return "recomp";
  return "maintain";
};

const normalizeDietaryMode = (value: unknown) => {
  const normalized = parseString(value).toLowerCase();
  if (!normalized || normalized === "mixed") return "mixed";
  if (normalized.includes("vegan")) return "vegan";
  if (normalized.includes("vegetarian")) return "vegetarian";
  if (normalized.includes("pesc")) return "pescatarian";
  return "mixed";
};

const deriveHealthConditions = (
  preferences: PreferencesRow,
  profile: ProfileRow
): string[] => {
  const fromPreferences = toStringArray(
    preferences?.health_conditions ?? preferences?.conditions ?? null
  );
  const fromProfile = toStringArray(
    profile?.health_conditions ?? profile?.conditions ?? null
  );
  const combined = [...fromPreferences, ...fromProfile].map((entry) =>
    entry.toLowerCase()
  );
  return Array.from(new Set(combined));
};

const deriveMicroTargets = (healthConditions: string[]): MicroTargets => {
  const targets: MicroTargets = { fibre_g: 30 };
  if (healthConditions.includes("anaemia")) {
    targets.iron_mg = 18;
    targets.b12_mcg = 2.4;
    targets.folate_mcg = 400;
  }
  if (healthConditions.includes("pcos")) {
    targets.fibre_g = Math.max(30, targets.fibre_g ?? 30);
    targets.omega_3_g = Math.max(1.2, targets.omega_3_g ?? 0);
  }
  if (healthConditions.includes("osteoporosis")) {
    targets.calcium_mg = 1200;
    targets.vitamin_d_mcg = 10;
  }
  if (healthConditions.includes("pregnancy")) {
    targets.folate_mcg = 600;
    targets.iron_mg = 27;
    targets.calcium_mg = Math.max(1000, targets.calcium_mg ?? 0);
  }
  if (healthConditions.includes("diabetes")) {
    targets.fibre_g = Math.max(35, targets.fibre_g ?? 30);
  }
  return targets;
};

const deriveProteinPerKg = (goal: keyof typeof DEFAULT_TARGETS) => {
  if (goal === "lose_weight") return 2.1;
  if (goal === "gain") return 2.0;
  if (goal === "recomp") return 2.2;
  return 1.8;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const deriveCalculatedTargets = (
  preferences: PreferencesRow,
  profile: ProfileRow
) => {
  const goal = normalizeGoal(preferences?.goal);
  const defaults = DEFAULT_TARGETS[goal];

  const explicitCalories = parseNumber(preferences?.target_calories);
  const explicitProtein = parseNumber(preferences?.target_protein);
  const explicitCarbs = parseNumber(preferences?.target_carbs);
  const explicitFat = parseNumber(preferences?.target_fat);

  if (
    explicitCalories &&
    explicitProtein &&
    explicitCarbs &&
    explicitFat
  ) {
    return {
      calories: explicitCalories,
      protein: explicitProtein,
      carbs: explicitCarbs,
      fat: explicitFat,
      goal,
    };
  }

  const weightKg = parseNumber(profile?.body_weight_kg) ?? 75;
  const heightCm = parseNumber(profile?.height_cm) ?? 175;
  const age = clamp(parseNumber(profile?.age) ?? 30, 18, 80);
  const activityRaw = parseString(profile?.activity_level).toLowerCase();
  const activity = ACTIVITY_MULTIPLIER[activityRaw] ?? ACTIVITY_MULTIPLIER.light;

  const mifflinSexConstant = -78;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + mifflinSexConstant;
  const tdee = bmr * activity;

  const calorieMultiplier =
    goal === "lose_weight" ? 0.82 : goal === "gain" ? 1.12 : goal === "recomp" ? 0.95 : 1;
  const calories = Math.max(
    1400,
    Math.round((explicitCalories ?? tdee * calorieMultiplier) / 10) * 10
  );
  const protein = Math.round(explicitProtein ?? weightKg * deriveProteinPerKg(goal));
  const fat = Math.max(45, Math.round(explicitFat ?? (calories * 0.27) / 9));
  const carbs = Math.max(
    70,
    Math.round(explicitCarbs ?? (calories - protein * 4 - fat * 9) / 4)
  );

  return {
    calories: Number.isFinite(calories) ? calories : defaults.calories,
    protein: Number.isFinite(protein) ? protein : defaults.protein,
    carbs: Number.isFinite(carbs) ? carbs : defaults.carbs,
    fat: Number.isFinite(fat) ? fat : defaults.fat,
    goal,
  };
};

const resolveMealsPerDay = (preferences: PreferencesRow, profile: ProfileRow) => {
  const prefMeals = parseNumber(preferences?.meals_per_day);
  if (prefMeals === 3 || prefMeals === 5) return prefMeals;
  const profileMeals = parseNumber(profile?.meals_per_day);
  if (profileMeals === 3 || profileMeals === 5) return profileMeals;
  const onboarding = readOnboardingMeta(
    typeof profile?.notes === "string" ? profile.notes : null
  );
  if (onboarding?.mealsPerDay === 3 || onboarding?.mealsPerDay === 5) {
    return onboarding.mealsPerDay;
  }
  return 5;
};

const resolveMaxPrepMinutes = (preferences: PreferencesRow, profile: ProfileRow) => {
  const explicit = parseNumber(preferences?.max_prep_minutes);
  if (explicit && explicit > 0) return explicit;
  const onboarding = readOnboardingMeta(
    typeof profile?.notes === "string" ? profile.notes : null
  );
  if (onboarding?.cookingTime === "under_10") return 10;
  if (onboarding?.cookingTime === "10_15") return 15;
  if (onboarding?.cookingTime === "15_30") return 30;
  return 15;
};

const resolveSlotLabels = (mealsPerDay: number) =>
  mealsPerDay === 3
    ? ["Breakfast", "Lunch", "Dinner"]
    : ["Breakfast", "Snack", "Lunch", "Snack", "Dinner"];

const slotBudgetTemplate = (slotLabels: string[]): number[] => {
  if (slotLabels.length === 3) {
    return [0.26, 0.32, 0.32];
  }
  return [0.18, 0.09, 0.25, 0.11, 0.27];
};

const buildSlotBudgets = (
  calories: number,
  protein: number,
  slotLabels: string[]
): SlotBudget[] => {
  const template = slotBudgetTemplate(slotLabels);
  const allocatedCalories = 0.9;
  const allocatedProtein = 0.9;
  return slotLabels.map((label, index) => {
    const weight = template[index] ?? 0;
    return {
      label,
      calories: Math.round(calories * allocatedCalories * weight),
      protein: Math.round(protein * allocatedProtein * weight),
    };
  });
};

const fetchRecentHistory = async (
  userId: string,
  supabase: GenerationSupabase
) => {
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data, error } = await supabase
    .from("user_meal_history")
    .select("meal_name, protein_type, date")
    .eq("user_id", userId)
    .gte("date", twoWeeksAgo.toISOString().split("T")[0])
    .order("date", { ascending: false });

  if (error || !Array.isArray(data)) {
    if (error) {
      console.warn("[context-builder] user_meal_history unavailable:", error.message);
    }
    return { recentMealNames: [] as string[], recentProteinTypes: [] as string[] };
  }

  const recentMealNames = Array.from(
    new Set(
      data
        .map((row) => parseString((row as Record<string, unknown>).meal_name))
        .filter(Boolean)
    )
  );

  const recentProteinTypes = Array.from(
    new Set(
      data
        .filter((row) => {
          const dateValue = parseString((row as Record<string, unknown>).date);
          if (!dateValue) return false;
          const parsed = new Date(dateValue);
          return !Number.isNaN(parsed.getTime()) && parsed >= oneWeekAgo;
        })
        .map((row) => parseString((row as Record<string, unknown>).protein_type).toLowerCase())
        .filter(Boolean)
    )
  );

  return { recentMealNames, recentProteinTypes };
};

const parseAllergyRows = (rows: unknown): string[] => {
  if (!Array.isArray(rows)) return [];
  const values = rows
    .map((row) => {
      if (!row || typeof row !== "object") return "";
      const record = row as Record<string, unknown>;
      return (
        parseString(record.allergy_name) ||
        parseString(record.allergy) ||
        parseString(record.allergen) ||
        parseString(record.name)
      );
    })
    .filter(Boolean);
  return Array.from(new Set(values));
};

export async function buildContext(
  userId: string,
  options?: { supabase?: GenerationSupabase; preferences?: PreferencesInput }
): Promise<GenerationContext> {
  const supabase = options?.supabase ?? (await supabaseServer());
  const requestedPreferences = options?.preferences;

  const [prefRes, profileRes, allergyRes, history] = await Promise.all([
    supabase.from("user_preferences").select("*").eq("user_id", userId).limit(1),
    supabase.from("profiles").select("*").eq("id", userId).limit(1),
    supabase.from("user_allergies").select("*").eq("user_id", userId),
    fetchRecentHistory(userId, supabase),
  ]);

  const preferences = ((prefRes.data ?? [])[0] as PreferencesRow) ?? null;
  const profile = ((profileRes.data ?? [])[0] as ProfileRow) ?? null;

  if (prefRes.error) {
    console.warn("[context-builder] user_preferences query failed:", prefRes.error.message);
  }
  if (profileRes.error) {
    console.warn("[context-builder] profiles query failed:", profileRes.error.message);
  }
  if (allergyRes.error) {
    console.warn("[context-builder] user_allergies query failed:", allergyRes.error.message);
  }

  const requestedTargets = requestedPreferences?.macroTargets;
  const targetSource: Record<string, unknown> = {
    ...(preferences ?? {}),
    goal: requestedPreferences?.goal ?? preferences?.goal,
    target_calories: requestedTargets?.calories ?? preferences?.target_calories,
    target_protein: requestedTargets?.protein ?? preferences?.target_protein,
    target_carbs: requestedTargets?.carbs ?? preferences?.target_carbs,
    target_fat: requestedTargets?.fat ?? preferences?.target_fat,
  };
  const targets = deriveCalculatedTargets(targetSource, profile);
  const requestedProfile = requestedPreferences?.profile;
  const dietaryMode = normalizeDietaryMode(
    requestedProfile?.dietaryMode ??
      preferences?.dietary_mode ??
      preferences?.lifestyle ??
      profile?.dietary_mode ??
      null
  );
  const healthConditions = deriveHealthConditions(preferences, profile);
  const microTargets = deriveMicroTargets(healthConditions);

  let carbTarget = targets.carbs;
  if (healthConditions.includes("pcos")) {
    carbTarget = Math.max(90, Math.round(carbTarget * 0.8));
  }

  const preferencesAllergies = toStringArray(preferences?.allergies);
  const profileAllergies = toStringArray(profile?.allergies);
  const tableAllergies = parseAllergyRows(allergyRes.data ?? []);
  const allergies = Array.from(
    new Set(
      [...(requestedProfile?.allergies ?? []), ...preferencesAllergies, ...profileAllergies, ...tableAllergies].map(
        (entry) => entry.toLowerCase()
      )
    )
  );

  const dislikes = Array.from(
    new Set(
      [...(requestedProfile?.dislikes ?? []), ...toStringArray(profile?.dislikes)].map((entry) =>
        entry.toLowerCase()
      )
    )
  );

  const cuisines = Array.from(
    new Set(
      [
        ...(requestedProfile?.cuisines ?? []),
        ...toStringArray(preferences?.cuisine_preferences),
        ...toStringArray(preferences?.cuisines),
        ...toStringArray(profile?.cuisines),
      ].map((entry) => entry.toLowerCase())
    )
  );

  const mealsPerDay = requestedProfile?.mealsPerDay ?? resolveMealsPerDay(preferences, profile);
  const slotLabels = resolveSlotLabels(mealsPerDay);
  const slotBudgets = buildSlotBudgets(targets.calories, targets.protein, slotLabels);

  const weeklyBudgetRaw = parseNumber(preferences?.weekly_budget);
  const weeklyBudget = weeklyBudgetRaw && weeklyBudgetRaw > 0 ? weeklyBudgetRaw : 55;

  return {
    calorieTarget: targets.calories,
    proteinTarget: targets.protein,
    carbTarget,
    fatTarget: targets.fat,
    dietaryMode,
    allergies,
    dislikes,
    cuisinePreferences: cuisines,
    maxPrepMinutes: resolveMaxPrepMinutes(preferences, profile),
    healthConditions,
    microTargets,
    mealsPerDay,
    slotLabels,
    weeklyBudget,
    recentMealNames: history.recentMealNames,
    recentProteinTypes: history.recentProteinTypes,
    slotBudgets,
  };
}
