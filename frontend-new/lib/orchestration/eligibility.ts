import type { CandidateExclusion, PlannerProfile, VerifiedCandidateMeal } from "./types.ts";
import { PlannerInsufficiencyError } from "./types.ts";

const normalize = (value: string) => value.trim().toLowerCase();
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isFiniteNonNegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);

export const isVerifiedCandidate = (candidate: unknown): candidate is VerifiedCandidateMeal => {
  if (!isRecord(candidate) || candidate.verified !== true || typeof candidate.id !== "string" || !candidate.id.trim() ||
    !["breakfast", "lunch", "dinner", "snack"].includes(candidate.slot as string) || typeof candidate.title !== "string" || !candidate.title.trim() ||
    !Array.isArray(candidate.ingredients) || candidate.ingredients.length === 0 || !isStringArray(candidate.allergens) || !isStringArray(candidate.dietaryTags) ||
    !isRecord(candidate.nutrition) || !isFiniteNonNegative(candidate.cost) || !isFiniteNonNegative(candidate.prepMinutes) ||
    !isFiniteNonNegative(candidate.servings) || candidate.servings <= 0) {
    return false;
  }

  const nutrition = candidate.nutrition;
  if (![nutrition.calories, nutrition.protein, nutrition.carbs, nutrition.fat].every(isFiniteNonNegative) || !isFiniteNonNegative(nutrition.calories) || nutrition.calories <= 0) {
    return false;
  }

  return candidate.ingredients.every((ingredient) =>
    isRecord(ingredient) && typeof ingredient.name === "string" && ingredient.name.trim().length > 0 &&
    typeof ingredient.normalizedName === "string" && ingredient.normalizedName.trim().length > 0 &&
    isFiniteNonNegative(ingredient.quantity) && ingredient.quantity > 0 && typeof ingredient.unit === "string" && ingredient.unit.trim().length > 0 &&
    typeof ingredient.pantry === "boolean"
  );
};

export type CandidateEligibilityResult = {
  eligible: VerifiedCandidateMeal[];
  exclusions: CandidateExclusion[];
  error?: PlannerInsufficiencyError;
};

export const filterEligibleCandidates = (profile: PlannerProfile, candidates: readonly unknown[]): CandidateEligibilityResult => {
  const eligible: VerifiedCandidateMeal[] = [];
  const exclusions: CandidateExclusion[] = [];
  const blockedAllergens = new Set(profile.hardConstraints.allergies.map(normalize));
  const requiredDietaryRules = new Set(profile.hardConstraints.dietaryRules.map(normalize));

  for (const rawCandidate of candidates) {
    const candidateId = isRecord(rawCandidate) && typeof rawCandidate.id === "string" ? rawCandidate.id : "unknown";
    if (!isVerifiedCandidate(rawCandidate)) {
      exclusions.push({ candidateId, reason: "unverified_or_incomplete" });
      continue;
    }
    if (rawCandidate.allergens.map(normalize).some((allergen) => blockedAllergens.has(allergen))) {
      exclusions.push({ candidateId: rawCandidate.id, reason: "allergen_conflict" });
      continue;
    }
    const candidateDiet = new Set(rawCandidate.dietaryTags.map(normalize));
    if ([...requiredDietaryRules].some((rule) => !candidateDiet.has(rule))) {
      exclusions.push({ candidateId: rawCandidate.id, reason: "dietary_conflict" });
      continue;
    }
    if (rawCandidate.prepMinutes > profile.hardConstraints.maxPrepMinutes) {
      exclusions.push({ candidateId: rawCandidate.id, reason: "prep_time_exceeded" });
      continue;
    }
    eligible.push(rawCandidate);
  }

  return eligible.length ? { eligible, exclusions } : {
    eligible,
    exclusions,
    error: new PlannerInsufficiencyError(exclusions),
  };
};
