import type { CandidateScore, PlannerProfile, SelectedMeal, VerifiedCandidateMeal } from "./types.ts";

export type ScoreContext = Readonly<{
  selected: readonly SelectedMeal[];
  recentCandidateIds: readonly string[];
}>;

const overlapCount = (candidate: VerifiedCandidateMeal, selected: readonly SelectedMeal[]) => {
  const used = new Set(selected.flatMap((meal) => meal.ingredients.map((ingredient) => ingredient.normalizedName)));
  return candidate.ingredients.filter((ingredient) => used.has(ingredient.normalizedName)).length;
};

const finite = (value: number) => Number.isFinite(value) ? value : 0;

export const scoreCandidate = (profile: PlannerProfile, candidate: VerifiedCandidateMeal, context: ScoreContext): CandidateScore => {
  const targetCaloriesPerSlot = profile.calorieTarget / profile.hardConstraints.requiredSlots.length;
  const targetProteinPerSlot = profile.proteinTarget / profile.hardConstraints.requiredSlots.length;
  const calorieDistance = Math.abs(candidate.nutrition.calories - targetCaloriesPerSlot) / targetCaloriesPerSlot;
  const proteinDistance = Math.abs(candidate.nutrition.protein - targetProteinPerSlot) / targetProteinPerSlot;
  const preferred = profile.softPreferences.preferredMealTypes.some((value) => candidate.title.toLowerCase().includes(value));
  const components = {
    nutrition: finite(profile.policy.scoreWeights.nutrition * Math.max(0, 1 - (calorieDistance + proteinDistance) / 2)),
    preference: preferred ? profile.policy.scoreWeights.preference : 0,
    reuse: finite(profile.policy.scoreWeights.reuse * Math.min(1, overlapCount(candidate, context.selected) / Math.max(1, candidate.ingredients.length))),
    prep: finite(profile.policy.scoreWeights.prep * Math.max(0, 1 - candidate.prepMinutes / Math.max(1, profile.hardConstraints.maxPrepMinutes))),
    cost: finite(profile.policy.scoreWeights.cost * Math.max(0, 1 - candidate.cost / 20)),
    repetition: context.recentCandidateIds.includes(candidate.id) ? -profile.policy.scoreWeights.repetition : 0,
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
