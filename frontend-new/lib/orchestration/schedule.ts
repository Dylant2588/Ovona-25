import { filterEligibleCandidates } from "./eligibility.ts";
import { rankCandidates } from "./score.ts";
import { validateAndRepairWeek } from "./validate.ts";
import { hasPracticalIngredientBasket, unavoidablePracticalViolations, remainingPortionLimits } from "./practical-ingredients.ts";
import { solveMealPortions } from "./portions.ts";
import type { PlannerProfile, SelectedMeal, VerifiedCandidateMeal, WeekScheduleResult } from "./types.ts";

export type CandidateHistory = Readonly<{ recentCandidateIds?: readonly string[]; recentSimilarityKeys?: readonly string[]; recentProteinTypes?: readonly string[]; recentCuisines?: readonly string[]; recentFormats?: readonly string[]; previousDayRecipeIds?: readonly (readonly string[])[]; differentFromDays?: readonly (readonly string[])[] }>;

const similarity = (candidate: VerifiedCandidateMeal) => candidate.similarityKey?.trim().toLowerCase() || candidate.id;
const MAX_SAME_PROTEIN_PER_DAY = 2;

// Protein types come from reviewed recipe metadata. Normalising here makes the
// daily variety rule robust to casing/whitespace differences and means a
// missing value cannot silently evade the cap.
const proteinType = (meal: Pick<VerifiedCandidateMeal, "proteinType">) =>
  meal.proteinType?.trim().toLowerCase() || "other";
const proteinFamilies = (meal: Pick<VerifiedCandidateMeal, "proteinType" | "proteinFamilies">) =>
  meal.proteinFamilies?.length ? [...new Set(meal.proteinFamilies.map(v => v.trim().toLowerCase()).filter(Boolean))] : [proteinType(meal)];

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
    proteinFamilies: candidate.proteinFamilies,
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
  dayIndex: number,
  excludedDays: ReadonlySet<string>,
  canSearch: () => boolean,
  spreadBudgets: boolean,
): SelectedMeal[] | null => {
  const slots = profile.hardConstraints.requiredSlots;
  const result: { meals: SelectedMeal[] | null } = { meals: null };
  const visit = (index: number, choices: VerifiedCandidateMeal[]): boolean => {
    if (!canSearch()) return false;
    if (index === slots.length) {
      if (excludedDays.has(JSON.stringify(choices.map(candidate => candidate.id).sort()))) return false;
      const shared = portionMultiplierFor(profile, choices);
      const limits = remainingPortionLimits(profile, selected, choices, spreadBudgets ? 7 - dayIndex : 1);
      // The API and approval boundary store rounded macros for each meal.
      // A shared portion can meet continuous bands yet fail those final totals.
      const sharedCalories = shared === null ? 0 : choices.reduce((s, m) => s + Math.round(m.nutrition.calories * shared), 0);
      const sharedProtein = shared === null ? 0 : choices.reduce((s, m) => s + Math.round(m.nutrition.protein * shared), 0);
      const sharedFits = shared !== null &&
        sharedCalories >= profile.calorieTarget * profile.hardConstraints.calorieBand.min &&
        sharedCalories <= profile.calorieTarget * profile.hardConstraints.calorieBand.max &&
        sharedProtein >= profile.proteinTarget * profile.hardConstraints.proteinBand.min &&
        sharedProtein <= profile.proteinTarget * profile.hardConstraints.proteinBand.max &&
        limits.every(l => l.amounts.reduce((s, v) => s + v * shared, 0) <= l.max);
      const multipliers = sharedFits ? choices.map(() => shared!) : solveMealPortions(profile, choices, limits);
      if (!multipliers) return false;
      const running = [...selected];
      const meals = choices.map((candidate, index) => {
        const score = rankCandidates(profile, [candidate], {
          selected: running,
          recentCandidateIds: history.recentCandidateIds ?? [],
          recentSimilarityKeys: history.recentSimilarityKeys,
          previousRecipeIds: history.previousDayRecipeIds?.[dayIndex],
          recentProteinTypes: history.recentProteinTypes,
          recentCuisines: history.recentCuisines,
          recentFormats: history.recentFormats,
        })[0]!;
        const meal = selectedMeal(candidate, score, profile,
          maximumUses > profile.policy.repetition.maxUsesPerWeek, multipliers[index]);
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
      proteinFamilies(candidate).every(family => choices.filter(chosen => proteinFamilies(chosen).includes(family)).length < MAX_SAME_PROTEIN_PER_DAY) &&
      canUseCandidate(candidate, used, profile.policy, maximumUses));
    // Ranking here only controls traversal. Full scores are recalculated with the
    // actual within-day context at the leaf above. Recency is ranking guidance,
    // not an exclusion: fresh choices may not complete a macro-feasible day.
    const ranked = rankCandidates(profile, pool, {
      selected,
      recentCandidateIds: history.recentCandidateIds ?? [],
      recentSimilarityKeys: history.recentSimilarityKeys,
      previousRecipeIds: history.previousDayRecipeIds?.[dayIndex],
      recentProteinTypes: history.recentProteinTypes,
      recentCuisines: history.recentCuisines,
      recentFormats: history.recentFormats,
    });
    // Prefer an as-yet underused protein source before considering the general
    // score. This preserves variety early in the week and leaves enough of
    // each practical ingredient allowance for later days.
    const proteinUses = new Map<string, number>();
    selected.forEach((meal) => {
      for (const family of proteinFamilies(meal)) proteinUses.set(family, (proteinUses.get(family) ?? 0) + 1);
    });
    const ordered = [...ranked].sort((left, right) => {
      const previous = history.previousDayRecipeIds?.[dayIndex] ?? [];
      const repeatedDayRecipe = Number(previous.includes(left.candidate.recipeId ?? left.candidate.similarityKey ?? left.candidate.id)) -
        Number(previous.includes(right.candidate.recipeId ?? right.candidate.similarityKey ?? right.candidate.id));
      const difference = Math.max(...proteinFamilies(left.candidate).map(f => proteinUses.get(f) ?? 0)) - Math.max(...proteinFamilies(right.candidate).map(f => proteinUses.get(f) ?? 0));
      return repeatedDayRecipe || difference || right.total - left.total;
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
  const unavoidable = unavoidablePracticalViolations(profile, eligibility.eligible);
  if (unavoidable.length) return { ok: false, error: { code: "insufficient_candidates", violations: unavoidable.map(limit => ({ day: 0, code: "practical_quantity_exceeded",
    message: `${limit.label} would require at least ${Math.ceil(limit.grams!)}g per week even at the smallest portion, above the ${limit.maxGrams}g practical limit.` })) } };
  // Weekly caps require revisiting earlier days. Committing the first feasible
  // day forever can consume an ingredient or recipe needed later in the week.
  const deadline = Date.now() + 5000;
  let nodes = 150_000;
  let truncated = false;
  let deepestDay = 1;
  const canSearch = () => {
    if (--nodes < 0 || Date.now() > deadline) { truncated = true; return false; }
    return true;
  };
  type Days = Array<{ day: number; meals: SelectedMeal[] }>;
  const visitWeek = (days: Days, selected: SelectedMeal[]): WeekScheduleResult | null => {
    if (!canSearch()) return null;
    if (days.length === 7) {
      if (history.differentFromDays?.length === 7 && history.differentFromDays.every((ids, index) =>
        JSON.stringify([...ids].map(id => id.toLowerCase()).sort()) === JSON.stringify(days[index].meals.map(meal => meal.similarityKey.toLowerCase()).sort()))) return null;
      const checked = validateAndRepairWeek(profile, { days });
      return checked.ok ? checked : null;
    }
    const day = days.length + 1;
    deepestDay = Math.max(deepestDay, day);
    const excluded = new Set<string>();
    for (let attempt = 0; attempt < 16; attempt++) {
      if (!canSearch()) return null;
      // Search the full day pool under fair budgets first; falling back inside
      // the first combination would spend future days' allowance too early.
      const meals = selectDay(profile, eligibility.eligible, selected, history, profile.policy.repetition.maxUsesPerWeek, day - 1, excluded, canSearch, true)
        ?? selectDay(profile, eligibility.eligible, selected, history, profile.policy.repetition.maxUsesPerWeek + 1, day - 1, excluded, canSearch, true)
        ?? selectDay(profile, eligibility.eligible, selected, history, profile.policy.repetition.maxUsesPerWeek, day - 1, excluded, canSearch, false)
        ?? selectDay(profile, eligibility.eligible, selected, history, profile.policy.repetition.maxUsesPerWeek + 1, day - 1, excluded, canSearch, false);
      if (!meals) return null;
      excluded.add(JSON.stringify(meals.map(meal => meal.candidateId).sort()));
      const result = visitWeek([...days, { day, meals }], [...selected, ...meals]);
      if (result) return result;
    }
    truncated = true;
    return null;
  };
  const result = visitWeek([], []);
  if (result) return result;
  return { ok: false, error: { code: truncated ? "planning_search_exhausted" : "insufficient_candidates", violations: [{ day: deepestDay, code: "insufficient_candidates",
    message: truncated
      ? "A complete practical, macro-feasible week was not found within the bounded search."
      : `No complete practical, macro-feasible week can be built from the reviewed catalogue (day ${deepestDay}).` }] } };
};
