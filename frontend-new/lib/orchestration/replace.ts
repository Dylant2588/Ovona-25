import type { PlanScope } from "../plan-scope.ts";
import { filterEligibleCandidates } from "./eligibility.ts";
import { rankCandidates, type ScoreContext } from "./score.ts";
import type { CandidateHistory } from "./schedule.ts";
import { validateAndRepairWeek } from "./validate.ts";
import { remainingPortionLimits } from "./practical-ingredients.ts";
import { solveMealPortions } from "./portions.ts";
import type { PlannerMealSlot, PlannerPolicy, PlannerProfile, SelectedMeal, VerifiedCandidateMeal, WeekSchedule, WeekScheduleResult } from "./types.ts";

export type MealReplacementTarget = Readonly<{ day: number; slot: PlannerMealSlot }>;

const similarity = (candidate: VerifiedCandidateMeal) => candidate.similarityKey?.trim().toLowerCase() || candidate.id;

const selectedMeal = (candidate: VerifiedCandidateMeal, score: ReturnType<typeof rankCandidates>[number], profile: PlannerProfile, nutritionPortionMultiplier: number): SelectedMeal => {
  const recipeServings = candidate.servings;
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
    proteinType: candidate.proteinType,
    proteinFamilies: candidate.proteinFamilies,
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
  scope: PlanScope = "week",
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
  const ranked = rankCandidates(effectiveProfile, safeAlternatives, context);
  if (!ranked.length) return replacementFailure("insufficient_replacement_candidates", target.day, "No safe alternative can replace the requested meal slot.");
  const otherDays = result.days.filter(day => day !== targetDay).flatMap(day => day.meals);
  const families = (meal: Pick<VerifiedCandidateMeal, "proteinType" | "proteinFamilies">) => meal.proteinFamilies?.length
    ? [...new Set(meal.proteinFamilies.map(f => f.trim().toLowerCase()).filter(Boolean))] : [meal.proteinType?.trim().toLowerCase() || "other"];
  const targetIndex = targetDay.meals.indexOf(oldMeal);
  let incumbent: WeekSchedule | null = null, bestError = Infinity;
  const deadline = Date.now() + 5000;
  for (const alternative of ranked) {
    if (Date.now() > deadline) break;
    if (families(alternative.candidate).some(family => targetDay.meals.filter(meal => meal !== oldMeal && families(meal).includes(family)).length >= 2)) continue;
    const choices = targetDay.meals.map(meal => meal === oldMeal ? alternative.candidate : meal);
    const portions = solveMealPortions(effectiveProfile, choices, remainingPortionLimits(effectiveProfile, otherDays, choices), {
      bounds: targetDay.meals.map(meal => meal === oldMeal ? { min: .7, max: 1.5 } : { min: meal.nutritionPortionMultiplier, max: meal.nutritionPortionMultiplier }),
      canContinue: () => Date.now() <= deadline,
    });
    if (!portions) continue;
    const replacement = selectedMeal(alternative.candidate, alternative, effectiveProfile, portions[targetIndex]);
    const replacementWeek: WeekSchedule = {
      days: result.days.map(day => day === targetDay ? { ...day, meals: day.meals.map(meal => meal === oldMeal ? replacement : meal) } : day),
    };
    const validated = validateAndRepairWeek(effectiveProfile, replacementWeek, scope);
    if (!validated.ok) continue;
    // Compare by position: two snack slots must retain their own identities.
    const immutable = result.days.every((day, dayIndex) => day.meals.every((meal, mealIndex) =>
      (day === targetDay && meal === oldMeal) || validated.value.days[dayIndex]?.meals[mealIndex] === meal));
    if (!immutable) continue;
    const safe = validated.value.days.every(day => {
      const calories = day.meals.reduce((s, m) => s + Math.round(m.nutrition.calories * m.nutritionPortionMultiplier), 0);
      const protein = day.meals.reduce((s, m) => s + Math.round(m.nutrition.protein * m.nutritionPortionMultiplier), 0);
      return day.meals.every(m => Number.isFinite(m.nutritionPortionMultiplier) && m.nutritionPortionMultiplier >= .7 && m.nutritionPortionMultiplier <= 1.5) &&
        calories >= profile.calorieTarget * profile.hardConstraints.calorieBand.min && calories <= profile.calorieTarget * profile.hardConstraints.calorieBand.max &&
        protein >= profile.proteinTarget * profile.hardConstraints.proteinBand.min && protein <= profile.proteinTarget * profile.hardConstraints.proteinBand.max;
    });
    if (!safe) continue;
    const newDay = validated.value.days.find(day => day.day === target.day)!;
    const error = Math.abs(newDay.meals.reduce((s, m) => s + Math.round(m.nutrition.calories * m.nutritionPortionMultiplier), 0) - profile.calorieTarget);
    // Ranked traversal supplies the soft-score/stable-ID tie break.
    if (error < bestError) { incumbent = validated.value; bestError = error; }
    if (bestError === 0) break;
  }
  if (incumbent) return { ok: true, value: incumbent };
  return replacementFailure("replacement_validation_failed", target.day, "No safe portion can replace this meal without changing another scheduled meal.");
};
