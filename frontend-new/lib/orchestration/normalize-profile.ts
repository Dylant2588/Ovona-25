import { DEFAULT_PLANNER_POLICY } from "./policy.ts";
import type { PlannerMealSlot, PlannerPolicy, PlannerProfile } from "./types.ts";
import { PlannerInputError } from "./types.ts";

type RawRecord = Record<string, unknown>;
const SLOT_NAMES: readonly PlannerMealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

const asRecord = (value: unknown): RawRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as RawRecord : {};

const normalizedStrings = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return [...new Set(values.filter((item): item is string => typeof item === "string").map((item) => item.trim().toLowerCase()).filter(Boolean))];
};

const requiredNumber = (value: unknown, field: string, min: number, max: number, integer = false): number => {
  const numberValue = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  if (!Number.isFinite(numberValue) || numberValue < min || numberValue > max || (integer && !Number.isInteger(numberValue))) {
    throw new PlannerInputError("invalid_planner_profile", `${field} must be a finite value between ${min} and ${max}.`, field);
  }
  return numberValue;
};

const freezeProfile = (profile: PlannerProfile): PlannerProfile => Object.freeze({
  ...profile,
  hardConstraints: Object.freeze({
    ...profile.hardConstraints,
    allergies: Object.freeze([...profile.hardConstraints.allergies]),
    dietaryRules: Object.freeze([...profile.hardConstraints.dietaryRules]),
    requiredSlots: Object.freeze([...profile.hardConstraints.requiredSlots]),
    calorieBand: Object.freeze({ ...profile.hardConstraints.calorieBand }),
    proteinBand: Object.freeze({ ...profile.hardConstraints.proteinBand }),
  }),
  softPreferences: Object.freeze({
    ...profile.softPreferences,
    dislikes: Object.freeze([...profile.softPreferences.dislikes]),
    tastes: Object.freeze([...profile.softPreferences.tastes]),
    preferredMealTypes: Object.freeze([...profile.softPreferences.preferredMealTypes]),
  }),
  policy: Object.freeze({ ...profile.policy }),
});

export const normalizePlannerProfile = (raw: unknown, policy: PlannerPolicy = DEFAULT_PLANNER_POLICY): PlannerProfile => {
  const input = asRecord(raw);
  const legacyProfile = asRecord(input.profile);
  const targets = asRecord(input.macroTargets);
  const calorieTarget = requiredNumber(input.calorieTarget ?? targets.calories, "calorieTarget", policy.calorieTargetRange.min, policy.calorieTargetRange.max);
  const proteinTarget = requiredNumber(input.proteinTarget ?? targets.protein, "proteinTarget", policy.proteinTargetRange.min, policy.proteinTargetRange.max);
  const maxPrepMinutes = requiredNumber(input.maxPrepMinutes ?? legacyProfile.maxPrepMinutes ?? policy.maxPrepMinutes, "maxPrepMinutes", 0, policy.maxPrepMinutes, true);
  const householdSize = requiredNumber(input.householdSize ?? legacyProfile.householdSize ?? 1, "householdSize", 1, policy.maxHouseholdSize, true);
  const rawSlots = input.requiredSlots ?? legacyProfile.requiredSlots;
  const slotValues = Array.isArray(rawSlots) ? rawSlots : typeof rawSlots === "string" ? rawSlots.split(",") : [];
  const requiredSlots = slotValues.filter((slot): slot is string => typeof slot === "string").map((slot) => slot.trim().toLowerCase()).filter((slot): slot is PlannerMealSlot => SLOT_NAMES.includes(slot as PlannerMealSlot));
  const resolvedSlots = requiredSlots.length ? requiredSlots : [...SLOT_NAMES];
  const budget = input.budgetSensitivity;
  const budgetSensitivity = budget === "low" || budget === "high" || budget === "medium" ? budget : "medium";

  return freezeProfile({
    calorieTarget,
    proteinTarget,
    householdSize,
    hardConstraints: {
      allergies: normalizedStrings(input.allergies ?? legacyProfile.allergies),
      dietaryRules: normalizedStrings(input.dietaryRules ?? input.dietaryMode ?? legacyProfile.dietaryMode),
      requiredSlots: resolvedSlots,
      calorieBand: policy.calorieBand,
      proteinBand: policy.proteinBand,
      maxPrepMinutes,
    },
    softPreferences: {
      dislikes: normalizedStrings(input.dislikes ?? legacyProfile.dislikes),
      tastes: normalizedStrings(input.tastes),
      budgetSensitivity,
      preferredMealTypes: normalizedStrings(input.preferredMealTypes ?? legacyProfile.cuisines),
    },
    policy,
  });
};
