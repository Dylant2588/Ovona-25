import { filterEligibleCandidates } from "./eligibility.ts";
import { rankCandidates } from "./score.ts";
import { validateAndRepairWeek } from "./validate.ts";
import type { PlannerProfile, SelectedMeal, VerifiedCandidateMeal, WeekScheduleResult } from "./types.ts";

export type CandidateHistory = Readonly<{ recentCandidateIds?: readonly string[] }>;

const similarity = (candidate: VerifiedCandidateMeal) => candidate.similarityKey?.trim().toLowerCase() || candidate.id;

const canUseCandidate = (candidate: VerifiedCandidateMeal, selected: readonly SelectedMeal[], policy: PlannerProfile["policy"]) => {
  const candidateSimilarity = similarity(candidate);
  const exactUses = selected.filter((meal) => meal.candidateId === candidate.id).length;
  if (exactUses >= policy.repetition.maxUsesPerWeek) return false;
  const similar = selected.filter((meal) => meal.similarityKey === candidateSimilarity);
  if (!similar.length) return true;
  return candidate.isLeftover === true && !!candidate.leftoverFromCandidateId && selected.some((meal) => meal.candidateId === candidate.leftoverFromCandidateId);
};

const selectedMeal = (candidate: VerifiedCandidateMeal, score: ReturnType<typeof rankCandidates>[number], profile: PlannerProfile): SelectedMeal => {
  const recipeServings = candidate.servings;
  const nutritionPortionMultiplier = 1;
  const householdPortionMultiplier = profile.householdSize;
  const servings = recipeServings * nutritionPortionMultiplier * householdPortionMultiplier;
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
    servings,
    score,
    explanation: `Selected for ${score.facts.join(", ")}.`,
  };
};

export const orchestrateWeek = (
  profile: PlannerProfile,
  candidates: readonly unknown[],
  history: CandidateHistory = {},
): WeekScheduleResult => {
  const eligibility = filterEligibleCandidates(profile, candidates);
  if (!eligibility.eligible.length) {
    return { ok: false, error: { code: "insufficient_candidates", violations: [{ day: 1, code: "insufficient_candidates", message: "No hard-constraint-safe candidates are available." }] } };
  }
  const selected: SelectedMeal[] = [];
  const days = [];
  for (let day = 1; day <= 7; day += 1) {
    const meals: SelectedMeal[] = [];
    for (const slot of profile.hardConstraints.requiredSlots) {
      const slotCandidates = eligibility.eligible.filter((candidate) => candidate.slot === slot && canUseCandidate(candidate, selected, profile.policy));
      const ranked = rankCandidates(profile, slotCandidates, { selected, recentCandidateIds: history.recentCandidateIds ?? [] });
      const best = ranked[0];
      if (!best) {
        return { ok: false, error: { code: "insufficient_candidates", violations: [{ day, code: "insufficient_candidates", message: `No safe ${slot} candidate can fill day ${day}.` }] } };
      }
      const meal = selectedMeal(best.candidate, best, profile);
      selected.push(meal);
      meals.push(meal);
    }
    days.push({ day, meals });
  }
  return validateAndRepairWeek(profile, { days });
};
