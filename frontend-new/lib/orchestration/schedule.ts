import { parsePlanScope, planDayCount, type PlanScope } from "../plan-scope.ts";
import { filterEligibleCandidates } from "./eligibility.ts";
import { rankCandidates } from "./score.ts";
import { validateAndRepairWeek } from "./validate.ts";
import { hasPracticalIngredientBasket, unavoidablePracticalViolations, remainingPortionLimits } from "./practical-ingredients.ts";
import { solveMealPortions } from "./portions.ts";
import type { PlannerProfile, SelectedMeal, VerifiedCandidateMeal, WeekSchedule, WeekScheduleResult } from "./types.ts";

export type CandidateHistory = Readonly<{ recentCandidateIds?: readonly string[]; recentSimilarityKeys?: readonly string[]; recentProteinTypes?: readonly string[]; recentCuisines?: readonly string[]; recentFormats?: readonly string[]; previousDayRecipeIds?: readonly (readonly string[])[]; differentFromDays?: readonly (readonly string[])[] }>;
export type SearchBudget = { maxNodes?: number; maxMilliseconds?: number; now?: () => number };

/** Sum daily errors, rather than cancelling an under-target day with an over-target day. */
export const calorieDeviationFor = (profile: PlannerProfile, schedule: WeekSchedule) => schedule.days.reduce((sum, day) =>
  sum + Math.abs(day.meals.reduce((total, meal) => total + Math.round(meal.nutrition.calories * meal.nutritionPortionMultiplier), 0) - profile.calorieTarget) / profile.calorieTarget, 0);

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
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return null;
  return Number(Math.min(max, Math.max(min, profile.calorieTarget / totals.calories)).toFixed(6));
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
  dayCount: number,
  improvePortions: boolean,
  hasTime: () => boolean,
): SelectedMeal[] | null => {
  const slots = profile.hardConstraints.requiredSlots;
  const result: { meals: SelectedMeal[] | null } = { meals: null };
  const visit = (index: number, choices: VerifiedCandidateMeal[]): boolean => {
    if (!canSearch()) return false;
    if (index === slots.length) {
      if (excludedDays.has(JSON.stringify(choices.map(candidate => candidate.id).sort()))) return false;
      const shared = portionMultiplierFor(profile, choices);
      const limits = remainingPortionLimits(profile, selected, choices, spreadBudgets ? dayCount - dayIndex : 1);
      // The API and approval boundary store rounded macros for each meal.
      // A shared portion can meet continuous bands yet fail those final totals.
      const sharedCalories = shared === null ? 0 : choices.reduce((s, m) => s + Math.round(m.nutrition.calories * shared), 0);
      const sharedProtein = shared === null ? 0 : choices.reduce((s, m) => s + Math.round(m.nutrition.protein * shared), 0);
      const continuousCalories = shared === null ? 0 : choices.reduce((s, m) => s + m.nutrition.calories * shared, 0);
      const continuousProtein = shared === null ? 0 : choices.reduce((s, m) => s + m.nutrition.protein * shared, 0);
      const sharedFits = shared !== null &&
        shared >= .7 && shared <= 1.5 &&
        continuousCalories >= profile.calorieTarget * profile.hardConstraints.calorieBand.min &&
        continuousCalories <= profile.calorieTarget * profile.hardConstraints.calorieBand.max &&
        continuousProtein >= profile.proteinTarget * profile.hardConstraints.proteinBand.min &&
        continuousProtein <= profile.proteinTarget * profile.hardConstraints.proteinBand.max &&
        sharedCalories >= profile.calorieTarget * profile.hardConstraints.calorieBand.min &&
        sharedCalories <= profile.calorieTarget * profile.hardConstraints.calorieBand.max &&
        sharedProtein >= profile.proteinTarget * profile.hardConstraints.proteinBand.min &&
        sharedProtein <= profile.proteinTarget * profile.hardConstraints.proteinBand.max &&
        limits.every(l => l.amounts.reduce((s, v) => s + v * shared, 0) <= l.max);
      const sharedPortions = sharedFits ? choices.map(() => shared!) : null;
      const independent = (!sharedFits || (improvePortions && sharedCalories !== profile.calorieTarget))
        ? solveMealPortions(profile, choices, limits, { canContinue: hasTime }) : null;
      const independentError = independent ? Math.abs(choices.reduce((s, m, i) => s + Math.round(m.nutrition.calories * independent[i]), 0) - profile.calorieTarget) : Infinity;
      const multipliers = independent && (!sharedPortions || independentError < Math.abs(sharedCalories - profile.calorieTarget)) ? independent : sharedPortions;
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
  scope: PlanScope = "week",
  budget: SearchBudget = {},
): WeekScheduleResult => {
  const dayCount = planDayCount(parsePlanScope(scope));
  const eligibility = filterEligibleCandidates(profile, candidates);
  if (!eligibility.eligible.length) {
    return { ok: false, error: { code: "insufficient_candidates", violations: [{ day: 1, code: "insufficient_candidates", message: "No hard-constraint-safe candidates are available." }] } };
  }
  const unavoidable = unavoidablePracticalViolations(profile, eligibility.eligible, dayCount);
  if (unavoidable.length) return { ok: false, error: { code: "insufficient_candidates", violations: unavoidable.map(limit => ({ day: 0, code: "practical_quantity_exceeded",
    message: `${limit.label} would require at least ${Math.ceil(limit.grams!)}g per week even at the smallest portion, above the ${limit.maxGrams}g practical limit.` })) } };
  // Weekly caps require revisiting earlier days. Committing the first feasible
  // day forever can consume an ingredient or recipe needed later in the week.
  const now = budget.now ?? Date.now;
  const bounded = (value: number | undefined, maximum: number) => value === undefined || !Number.isFinite(value) ? maximum : Math.max(0, Math.min(maximum, Math.floor(value)));
  const deadline = now() + bounded(budget.maxMilliseconds, 5000);
  let nodes = bounded(budget.maxNodes, 150_000);
  let truncated = false;
  let deepestDay = 1;
  const canSearch = () => {
    if (--nodes < 0 || now() > deadline) { truncated = true; return false; }
    return true;
  };
  type Days = Array<{ day: number; meals: SelectedMeal[] }>;
  let incumbent: WeekSchedule | null = null;
  let incumbentError = Infinity, incumbentSoft = -Infinity, incumbentIdentity = "";
  let improving = false;
  const consider = (schedule: WeekSchedule) => {
    const error = calorieDeviationFor(profile, schedule);
    const soft = schedule.days.flatMap(day => day.meals).reduce((sum, meal) => sum + meal.score.total, 0);
    const identity = JSON.stringify(schedule.days.map(day => day.meals.map(meal => [meal.candidateId, meal.nutritionPortionMultiplier])));
    if (error < incumbentError || (error === incumbentError && (soft > incumbentSoft || (soft === incumbentSoft && identity < incumbentIdentity)))) {
      incumbent = schedule; incumbentError = error; incumbentSoft = soft; incumbentIdentity = identity;
    }
  };
  const roundedValid = (schedule: WeekSchedule) => schedule.days.every(day => {
    if (day.meals.some(m => !Number.isFinite(m.nutritionPortionMultiplier) || m.nutritionPortionMultiplier < .7 || m.nutritionPortionMultiplier > 1.5 ||
      m.servings !== m.recipeServings * m.nutritionPortionMultiplier * m.householdPortionMultiplier)) return false;
    const c = day.meals.reduce((s, m) => s + Math.round(m.nutrition.calories * m.nutritionPortionMultiplier), 0);
    const p = day.meals.reduce((s, m) => s + Math.round(m.nutrition.protein * m.nutritionPortionMultiplier), 0);
    return c >= profile.calorieTarget * profile.hardConstraints.calorieBand.min && c <= profile.calorieTarget * profile.hardConstraints.calorieBand.max &&
      p >= profile.proteinTarget * profile.hardConstraints.proteinBand.min && p <= profile.proteinTarget * profile.hardConstraints.proteinBand.max;
  });
  const visitWeek = (days: Days, selected: SelectedMeal[]): boolean => {
    if (days.length === dayCount) {
      if (history.differentFromDays?.length === dayCount && history.differentFromDays.every((ids, index) =>
        JSON.stringify([...ids].map(id => id.toLowerCase()).sort()) === JSON.stringify(days[index].meals.map(meal => meal.similarityKey.toLowerCase()).sort()))) return false;
      const checked = validateAndRepairWeek(profile, { days }, scope);
      if (checked.ok && roundedValid(checked.value)) consider(checked.value);
      // Establish an incumbent quickly. Once all daily integer totals hit the
      // target, no calorie improvement exists; soft ties retain traversal order.
      return !!incumbent && (!improving || incumbentError === 0);
    }
    if (!canSearch()) return false;
    const day = days.length + 1;
    deepestDay = Math.max(deepestDay, day);
    const excluded = new Set<string>();
    for (let attempt = 0; attempt < 16; attempt++) {
      if (!canSearch()) return false;
      // Search the full day pool under fair budgets first; falling back inside
      // the first combination would spend future days' allowance too early.
      const hasTime = () => now() <= deadline;
      const meals = selectDay(profile, eligibility.eligible, selected, history, profile.policy.repetition.maxUsesPerWeek, day - 1, excluded, canSearch, true, dayCount, improving, hasTime)
        ?? selectDay(profile, eligibility.eligible, selected, history, profile.policy.repetition.maxUsesPerWeek + 1, day - 1, excluded, canSearch, true, dayCount, improving, hasTime)
        ?? selectDay(profile, eligibility.eligible, selected, history, profile.policy.repetition.maxUsesPerWeek, day - 1, excluded, canSearch, false, dayCount, improving, hasTime)
        ?? selectDay(profile, eligibility.eligible, selected, history, profile.policy.repetition.maxUsesPerWeek + 1, day - 1, excluded, canSearch, false, dayCount, improving, hasTime);
      if (!meals) return false;
      excluded.add(JSON.stringify(meals.map(meal => meal.candidateId).sort()));
      const result = visitWeek([...days, { day, meals }], [...selected, ...meals]);
      if (result) return result;
    }
    truncated = true;
    return false;
  };
  visitWeek([], []);
  if (incumbent && incumbentError > 0) { improving = true; visitWeek([], []); }
  if (incumbent) return { ok: true, value: incumbent };
  return { ok: false, error: { code: truncated ? "planning_search_exhausted" : "insufficient_candidates", violations: [{ day: deepestDay, code: "insufficient_candidates",
    message: truncated
      ? "A complete practical, macro-feasible week was not found within the bounded search."
      : `No complete practical, macro-feasible week can be built from the reviewed catalogue (day ${deepestDay}).` }] } };
};
