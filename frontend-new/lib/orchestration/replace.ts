import { filterEligibleCandidates } from "./eligibility.ts";
import { rankCandidates, type ScoreContext } from "./score.ts";
import type { CandidateHistory } from "./schedule.ts";
import { validateAndRepairWeek } from "./validate.ts";
import type { PlannerMealSlot, PlannerPolicy, PlannerProfile, SelectedMeal, VerifiedCandidateMeal, WeekSchedule, WeekScheduleResult } from "./types.ts";

export type MealReplacementTarget = Readonly<{ day: number; slot: PlannerMealSlot }>;

const similarity = (candidate: VerifiedCandidateMeal) => candidate.similarityKey?.trim().toLowerCase() || candidate.id;

const selectedMeal = (candidate: VerifiedCandidateMeal, score: ReturnType<typeof rankCandidates>[number], profile: PlannerProfile): SelectedMeal => {
  const recipeServings = candidate.servings;
  const nutritionPortionMultiplier = 1;
  const householdPortionMultiplier = profile.householdSize;
  return {
    candidateId: candidate.id,
    slot: candidate.slot,
    title: candidate.title,
    similarityKey: similarity(candidate),
    ingredients: candidate.ingredients.map((ingredient) => ({ ...ingredient })),
    nutrition: { ...candidate.nutrition },
    cost: candidate.cost,
    prepMinutes: candidate.prepMinutes,
    isLeftover: candidate.isLeftover === true,
    ...(candidate.leftoverFromCandidateId ? { leftoverFromCandidateId: candidate.leftoverFromCandidateId } : {}),
    recipeServings,
    nutritionPortionMultiplier,
    householdPortionMultiplier,
    servings: recipeServings * nutritionPortionMultiplier * householdPortionMultiplier,
    score,
    explanation: `Selected for ${score.facts.join(", ")}.`,
  };
};

const replacementFailure = (code: string, day: number, message: string): WeekScheduleResult => ({
  ok: false,
  error: { code, violations: [{ day, code: "insufficient_candidates", message }] },
});

const canUseReplacement = (candidate: VerifiedCandidateMeal, selected: readonly SelectedMeal[], policy: PlannerPolicy) => {
  if (selected.filter((meal) => meal.candidateId === candidate.id).length >= policy.repetition.maxUsesPerWeek) return false;
  const candidateSimilarity = similarity(candidate);
  const similar = selected.filter((meal) => meal.similarityKey === candidateSimilarity);
  return !similar.length || (candidate.isLeftover === true && !!candidate.leftoverFromCandidateId && selected.some((meal) => meal.candidateId === candidate.leftoverFromCandidateId));
};

/** Replaces a single typed day/slot without rebuilding or mutating the rest of the week. */
export const replaceMeal = (
  result: WeekSchedule,
  target: MealReplacementTarget,
  candidates: readonly unknown[],
  profile: PlannerProfile,
  history: CandidateHistory = {},
  policy: PlannerPolicy = profile.policy,
): WeekScheduleResult => {
  const targetDay = result.days.find((day) => day.day === target.day);
  const oldMeal = targetDay?.meals.find((meal) => meal.slot === target.slot);
  if (!targetDay || !oldMeal) return replacementFailure("replacement_target_not_found", target.day, "The requested meal slot does not exist in this week.");

  const effectiveProfile: PlannerProfile = { ...profile, policy };
  const contextSelected = result.days.flatMap((day) => day.meals).filter((meal) => meal !== oldMeal);
  const eligibility = filterEligibleCandidates(effectiveProfile, candidates);
  const safeAlternatives = eligibility.eligible.filter((candidate) =>
    candidate.slot === target.slot && candidate.id !== oldMeal.candidateId && canUseReplacement(candidate, contextSelected, policy),
  );
  const context: ScoreContext = { selected: contextSelected, recentCandidateIds: history.recentCandidateIds ?? [] };
  const best = rankCandidates(effectiveProfile, safeAlternatives, context)[0];
  if (!best) return replacementFailure("insufficient_replacement_candidates", target.day, "No safe alternative can replace the requested meal slot.");

  const replacement = selectedMeal(best.candidate, best, effectiveProfile);
  const replacementWeek: WeekSchedule = {
    days: result.days.map((day) => day === targetDay ? {
      ...day,
      meals: day.meals.map((meal) => meal === oldMeal ? replacement : meal),
    } : day),
  };
  const validated = validateAndRepairWeek(effectiveProfile, replacementWeek);
  if (!validated.ok) return { ok: false, error: { code: "replacement_validation_failed", violations: validated.error.violations } };

  // A replacement may not silently repair another slot; preserve all non-target selections exactly.
  for (const day of result.days) {
    for (const meal of day.meals) {
      if (day === targetDay && meal === oldMeal) continue;
      const validatedMeal = validated.value.days.find((item) => item.day === day.day)?.meals.find((item) => item.slot === meal.slot);
      if (validatedMeal !== meal) return replacementFailure("replacement_validation_failed", target.day, "The replacement would alter another scheduled meal.");
    }
  }
  return validated;
};
