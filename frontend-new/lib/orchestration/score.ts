import type { CandidateScore, PlannerProfile, SelectedMeal, VerifiedCandidateMeal } from "./types.ts";
import { findIngredientTaxon, normalizeIngredient } from "../recipes/taxonomy.ts";
import { practicalIngredientLoad } from "./practical-ingredients.ts";

export type ScoreContext = Readonly<{
  selected: readonly SelectedMeal[];
  recentCandidateIds: readonly string[];
  recentSimilarityKeys?: readonly string[];
  previousRecipeIds?: readonly string[];
  recentProteinTypes?: readonly string[];
  recentCuisines?: readonly string[];
  recentFormats?: readonly string[];
}>;

const overlapCount = (candidate: VerifiedCandidateMeal, selected: readonly SelectedMeal[]) => {
  const used = new Set(selected.flatMap((meal) => meal.ingredients.map((ingredient) => ingredient.normalizedName)));
  return candidate.ingredients.filter((ingredient) => used.has(ingredient.normalizedName)).length;
};

const finite = (value: number) => Number.isFinite(value) ? value : 0;

const diversityPenalty = (candidate: VerifiedCandidateMeal, context: ScoreContext) => {
  const used = context.selected;
  const families = candidate.proteinFamilies?.length ? candidate.proteinFamilies : candidate.proteinType ? [candidate.proteinType] : [];
  const proteinRepeats = families.length
    ? used.filter(meal => (meal.proteinFamilies ?? (meal.proteinType ? [meal.proteinType] : [])).some(f => families.includes(f))).length +
      (context.recentProteinTypes ?? []).filter(protein => families.includes(protein)).length
    : 0;
  const cuisineRepeats = candidate.cuisine
    ? used.filter((meal) => meal.cuisine === candidate.cuisine).length +
      (context.recentCuisines ?? []).filter((cuisine) => cuisine === candidate.cuisine).length
    : 0;
  // Ingredient consolidation helps the basket, but it must never dominate
  // protein rotation. This is deliberately material: otherwise the greedy
  // scheduler keeps selecting chicken until the practicality guard rejects
  // the whole week.
  return -(proteinRepeats * 10 + cuisineRepeats * 0.25);
};

export const scoreCandidate = (profile: PlannerProfile, candidate: VerifiedCandidateMeal, context: ScoreContext): CandidateScore => {
  const recipeId = candidate.recipeId ?? candidate.similarityKey ?? candidate.id;
  const recent = context.recentCandidateIds.includes(candidate.id) ||
    (candidate.recipeVersion !== undefined && context.recentCandidateIds.includes(`${recipeId}:${candidate.recipeVersion}`)) ||
    (context.recentSimilarityKeys ?? []).includes(recipeId.toLowerCase());
  const targetCaloriesPerSlot = profile.calorieTarget / profile.hardConstraints.requiredSlots.length;
  const targetProteinPerSlot = profile.proteinTarget / profile.hardConstraints.requiredSlots.length;
  const calorieDistance = Math.abs(candidate.nutrition.calories - targetCaloriesPerSlot) / targetCaloriesPerSlot;
  const proteinDistance = Math.abs(candidate.nutrition.protein - targetProteinPerSlot) / targetProteinPerSlot;
  const preferred = profile.softPreferences.preferredMealTypes.some((value) => {
    const term = normalizeIngredient(value);
    return normalizeIngredient(candidate.cuisine ?? "") === term ||
      ` ${normalizeIngredient(candidate.title)} `.includes(` ${term} `);
  });
  const matchesFood = (value: string) => {
    const term = normalizeIngredient(value);
    const taxon = findIngredientTaxon(value);
    return candidate.ingredients.some(ingredient => (taxon && ingredient.normalizedName === taxon.id) ||
      normalizeIngredient(ingredient.normalizedName) === term ||
      ` ${normalizeIngredient(ingredient.name)} `.includes(` ${term} `));
  };
  const disliked = profile.softPreferences.dislikes.some(matchesFood);
  const liked = (profile.softPreferences.foodLikes ?? []).some(matchesFood);
  const practicalLoad = practicalIngredientLoad(candidate);
  const components = {
    nutrition: finite(profile.policy.scoreWeights.nutrition * Math.max(0, 1 - (calorieDistance + proteinDistance) / 2)),
    preference: (preferred ? profile.policy.scoreWeights.preference : 0) +
      (liked ? profile.policy.scoreWeights.preference / 2 : 0) -
      (disliked ? profile.policy.scoreWeights.preference * 2 : 0),
    reuse: finite(Math.min(4, profile.policy.scoreWeights.reuse * Math.min(1, overlapCount(candidate, context.selected) / Math.max(1, candidate.ingredients.length)))),
    prep: finite(profile.policy.scoreWeights.prep * Math.max(0, 1 - candidate.prepMinutes / Math.max(1, profile.hardConstraints.maxPrepMinutes))),
    cost: finite(profile.policy.scoreWeights.cost * Math.max(0, 1 - candidate.cost / 20)),
    repetition: (recent ? -profile.policy.scoreWeights.repetition : 0) -
      ((context.previousRecipeIds ?? []).includes(recipeId) ? profile.policy.scoreWeights.repetition * 4 : 0),
    diversity: diversityPenalty(candidate, context),
    practical: Number.isFinite(practicalLoad) ? -practicalLoad * profile.policy.scoreWeights.preference * 3 : -1_000_000,
  };
  const facts = [
    "target contribution",
    ...(components.reuse > 0 ? ["ingredient reuse"] : []),
    ...(candidate.prepMinutes <= 20 ? ["prep time"] : []),
    ...(candidate.cost <= 3 ? ["cost"] : []),
  ];
  // AI may only settle otherwise-near deterministic choices. It cannot create
  // a candidate or outweigh validated nutrition and hard constraints.
  const aiTieBreaker = candidate.aiPriority == null ? 0 : Math.max(0, 0.001 - candidate.aiPriority / 1_000_000);
  return { candidate, components, total: Object.values(components).reduce((sum, value) => sum + value, 0) + aiTieBreaker, facts };
};

export const rankCandidates = (profile: PlannerProfile, candidates: readonly VerifiedCandidateMeal[], context: ScoreContext): CandidateScore[] =>
  candidates.map((candidate) => scoreCandidate(profile, candidate, context)).sort((left, right) =>
    right.total - left.total || left.candidate.id.localeCompare(right.candidate.id),
  );
