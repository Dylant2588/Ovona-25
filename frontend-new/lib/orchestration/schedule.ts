import { filterEligibleCandidates } from "./eligibility.ts";
import { rankCandidates } from "./score.ts";
import { validateAndRepairWeek } from "./validate.ts";
import { hasPracticalIngredientBasket } from "./practical-ingredients.ts";
import type { PlannerProfile, SelectedMeal, VerifiedCandidateMeal, WeekScheduleResult } from "./types.ts";

export type CandidateHistory = Readonly<{ recentCandidateIds?: readonly string[]; recentSimilarityKeys?: readonly string[]; recentProteinTypes?: readonly string[]; recentCuisines?: readonly string[]; recentFormats?: readonly string[] }>;

const similarity = (candidate: VerifiedCandidateMeal) => candidate.similarityKey?.trim().toLowerCase() || candidate.id;
const MAX_SAME_PROTEIN_PER_DAY = 2;

// Protein types come from reviewed recipe metadata. Normalising here makes the
// daily variety rule robust to casing/whitespace differences and means a
// missing value cannot silently evade the cap.
const proteinType = (meal: Pick<VerifiedCandidateMeal, "proteinType">) =>
  meal.proteinType?.trim().toLowerCase() || "other";

const canUseCandidate = (
  candidate: VerifiedCandidateMeal,
  selected: readonly Pick<SelectedMeal, "candidateId" | "similarityKey">[],
  policy: PlannerProfile["policy"],
  maximumUses = policy.repetition.maxUsesPerWeek,
) => {
  const exactUses = selected.filter((meal) => meal.candidateId === candidate.id).length;
  const similarUses = selected.filter((meal) => meal.similarityKey === similarity(candidate)).length;
  if (exactUses >= maximumUses) return false;
  if (similarUses < maximumUses) return true;
  return candidate.isLeftover === true && !!candidate.leftoverFromCandidateId &&
    selected.some((meal) => meal.candidateId === candidate.leftoverFromCandidateId);
};

const isRecentMatch = (candidate: VerifiedCandidateMeal, history: CandidateHistory) =>
  (history.recentCandidateIds ?? []).includes(candidate.id) || (history.recentSimilarityKeys ?? []).includes(similarity(candidate));

const selectedMeal = (candidate: VerifiedCandidateMeal, score: ReturnType<typeof rankCandidates>[number], profile: PlannerProfile,
  scarcityFallback = false, nutritionPortionMultiplier = 1): SelectedMeal => {
  const recipeServings = candidate.servings;
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
    proteinType: candidate.proteinType,
    cuisine: candidate.cuisine,
    format: candidate.format,
    isLeftover: candidate.isLeftover === true,
    ...(candidate.leftoverFromCandidateId ? { leftoverFromCandidateId: candidate.leftoverFromCandidateId } : {}),
    recipeServings,
    nutritionPortionMultiplier,
    householdPortionMultiplier,
    servings,
    score,
    explanation: `Selected for ${score.facts.join(", ")}.${scarcityFallback ? " Reused once more because the reviewed safe catalogue for this slot is limited." : ""}`,
  };
};

const portionMultiplierFor = (profile: PlannerProfile, meals: readonly VerifiedCandidateMeal[]) => {
  const totals = meals.reduce((sum, meal) => ({
    calories: sum.calories + meal.nutrition.calories,
    protein: sum.protein + meal.nutrition.protein,
  }), { calories: 0, protein: 0 });
  if (totals.calories <= 0 || totals.protein <= 0) return null;
  const calorie = profile.hardConstraints.calorieBand;
  const protein = profile.hardConstraints.proteinBand;
  const min = Math.max(0.7, profile.calorieTarget * calorie.min / totals.calories, profile.proteinTarget * protein.min / totals.protein);
  const max = Math.min(1.5, profile.calorieTarget * calorie.max / totals.calories, profile.proteinTarget * protein.max / totals.protein);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max + 0.000001) return null;
  return Math.min(max, Math.max(min, 1));
};

const selectDay = (
  profile: PlannerProfile,
  eligible: readonly VerifiedCandidateMeal[],
  selected: readonly SelectedMeal[],
  history: CandidateHistory,
  maximumUses: number,
): SelectedMeal[] | null => {
  const slots = profile.hardConstraints.requiredSlots;
  const result: { meals: SelectedMeal[] | null } = { meals: null };
  const visit = (index: number, choices: VerifiedCandidateMeal[]): boolean => {
    if (index === slots.length) {
      const multiplier = portionMultiplierFor(profile, choices);
      if (multiplier === null) return false;
      let running = [...selected];
      const meals = choices.map((candidate) => {
        const score = rankCandidates(profile, [candidate], {
          selected: running,
          recentCandidateIds: history.recentCandidateIds ?? [],
          recentProteinTypes: history.recentProteinTypes,
          recentCuisines: history.recentCuisines,
          recentFormats: history.recentFormats,
        })[0]!;
        const meal = selectedMeal(candidate, score, profile,
          maximumUses > profile.policy.repetition.maxUsesPerWeek, multiplier);
        running.push(meal);
        return meal;
      });
      if (!hasPracticalIngredientBasket([...selected, ...meals], profile)) return false;
      result.meals = meals;
      return true;
    }
    const slot = slots[index]!;
    const used = [...selected, ...choices.map((candidate) => ({ candidateId: candidate.id, similarityKey: similarity(candidate) }))];
    const pool = eligible.filter((candidate) => candidate.slot === slot &&
      !choices.some((chosen) => similarity(chosen) === similarity(candidate) &&
        !(candidate.isLeftover === true && candidate.leftoverFromCandidateId === chosen.id)) &&
      // Two uses can support leftovers and familiar staples; a third turns a
      // daily plan into a turkey/chicken-heavy repeat rather than variety.
      choices.filter((chosen) => proteinType(chosen) === proteinType(candidate)).length < MAX_SAME_PROTEIN_PER_DAY &&
      canUseCandidate(candidate, used, profile.policy, maximumUses));
    const fresh = pool.filter((candidate) => !isRecentMatch(candidate, history));
    // Ranking here only controls traversal. Full scores are recalculated with the
    // actual within-day context at the leaf above.
    const ranked = rankCandidates(profile, fresh.length ? fresh : pool, {
      selected,
      recentCandidateIds: history.recentCandidateIds ?? [],
      recentProteinTypes: history.recentProteinTypes,
      recentCuisines: history.recentCuisines,
      recentFormats: history.recentFormats,
    });
    // Prefer an as-yet underused protein source before considering the general
    // score. This preserves variety early in the week and leaves enough of
    // each practical ingredient allowance for later days.
    const proteinUses = new Map<string, number>();
    selected.forEach((meal) => {
      const type = proteinType(meal);
      proteinUses.set(type, (proteinUses.get(type) ?? 0) + 1);
    });
    const ordered = [...ranked].sort((left, right) => {
      const leftProteinType = proteinType(left.candidate);
      const rightProteinType = proteinType(right.candidate);
      const difference = (proteinUses.get(leftProteinType) ?? 0) - (proteinUses.get(rightProteinType) ?? 0);
      return difference || right.total - left.total;
    });
    for (const ranked of ordered) {
      if (visit(index + 1, [...choices, ranked.candidate])) return true;
    }
    return false;
  };
  visit(0, []);
  return result.meals;
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
    // Select a complete day before committing it. A greedy slot-by-slot choice
    // can exhaust the protein/calorie intersection even when an approved,
    // safe five-meal combination exists.
    const meals = selectDay(profile, eligibility.eligible, selected, history, profile.policy.repetition.maxUsesPerWeek)
      ?? selectDay(profile, eligibility.eligible, selected, history, profile.policy.repetition.maxUsesPerWeek + 1);
    if (!meals) {
      return { ok: false, error: { code: "insufficient_candidates", violations: [{ day, code: "insufficient_candidates", message: `No safe, macro-feasible day ${day} can be built from the reviewed catalogue.` }] } };
    }
    selected.push(...meals);
    days.push({ day, meals });
  }
  return validateAndRepairWeek(profile, { days });
};
