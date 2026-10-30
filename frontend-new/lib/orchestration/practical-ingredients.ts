import type { PlannerProfile, SelectedMeal, VerifiedCandidateMeal } from "./types.ts";
import type { PortionLimit } from "./portions.ts";

// Per-adult weekly caps for concentrated proteins. Exact display names retain
// distinctions that the safety taxonomy intentionally groups (egg whites/eggs).
// Check both names and IDs; never infer that every broad egg is an egg white.
const WEEKLY_PROTEIN_INGREDIENT_LIMITS = [
  { label: "Chicken", pattern: /\bchicken(?:[\s_-]|$)/i, maxGrams: 1400 },
  { label: "Turkey", pattern: /\bturkey(?:[\s_-]|$)/i, maxGrams: 1200 },
  { label: "Egg whites", pattern: /\begg[\s_-]whites?\b/i, maxGrams: 1000 },
] as const;

export type PracticalIngredientViolation = Readonly<{ label: string; grams: number | null; maxGrams: number; unsupportedUnit?: string }>;

/** Share of scarce weekly ingredient allowances consumed by one base serving. */
export function practicalIngredientLoad(candidate: Pick<VerifiedCandidateMeal, "ingredients">): number {
  return WEEKLY_PROTEIN_INGREDIENT_LIMITS.reduce((total, limit) => total + candidate.ingredients.reduce((sum, ingredient) => {
    if (!(limit.pattern.test(ingredient.name) || limit.pattern.test(ingredient.normalizedName))) return sum;
    const unit = ingredient.unit.trim().toLowerCase();
    return sum + (unit === "g" ? ingredient.quantity : unit === "kg" ? ingredient.quantity * 1000 : Infinity) / limit.maxGrams;
  }, 0), 0);
}

export const practicalIngredientViolations = (
  meals: readonly Pick<SelectedMeal, "ingredients" | "nutritionPortionMultiplier" | "householdPortionMultiplier">[],
  householdSize = 1,
): PracticalIngredientViolation[] => {
  const totals = WEEKLY_PROTEIN_INGREDIENT_LIMITS.map((limit) => ({ ...limit, maxGrams: limit.maxGrams * householdSize, grams: 0 }));
  const unresolved: PracticalIngredientViolation[] = [];
  meals.forEach((meal) => meal.ingredients.forEach((ingredient) => {
    const unit = ingredient.unit.trim().toLowerCase();
    const matchingLimit = totals.find((limit) => limit.pattern.test(ingredient.name) || limit.pattern.test(ingredient.normalizedName));
    if (!matchingLimit) return;
    const amount = ingredient.quantity * (unit === "kg" ? 1000 : 1) * meal.nutritionPortionMultiplier * meal.householdPortionMultiplier;
    if ((unit !== "g" && unit !== "kg") || !Number.isFinite(amount) || amount <= 0) {
      unresolved.push({ label: matchingLimit.label, grams: null, maxGrams: matchingLimit.maxGrams, unsupportedUnit: unit });
      return;
    }
    matchingLimit.grams += amount;
  }));
  return [...unresolved, ...totals.filter((limit) => limit.grams > limit.maxGrams).map(({ label, grams, maxGrams }) => ({ label, grams, maxGrams }))];
};

export const hasPracticalIngredientBasket = (
  meals: readonly Pick<SelectedMeal, "ingredients" | "nutritionPortionMultiplier" | "householdPortionMultiplier">[],
  profile: PlannerProfile,
) => practicalIngredientViolations(meals, profile.householdSize).length === 0;

/** Conservative lower bound: ignore repetition and use the smallest allowed
 * portion. If even this exceeds a cap, searching different orders cannot help. */
export function unavoidablePracticalViolations(profile: PlannerProfile, candidates: readonly VerifiedCandidateMeal[]): PracticalIngredientViolation[] {
  return WEEKLY_PROTEIN_INGREDIENT_LIMITS.flatMap(limit => {
    let minimum = 0;
    for (const slot of profile.hardConstraints.requiredSlots) {
      const options = candidates.filter(candidate => candidate.slot === slot);
      if (!options.length) return [];
      minimum += Math.min(...options.map(candidate => candidate.ingredients.reduce((sum, ingredient) => {
        const unit = ingredient.unit.trim().toLowerCase();
        if (!(limit.pattern.test(ingredient.name) || limit.pattern.test(ingredient.normalizedName)) || !["g", "kg"].includes(unit)) return sum;
        return sum + ingredient.quantity * (unit === "kg" ? 1000 : 1);
      }, 0)));
    }
    const grams = minimum * 0.7 * 7 * profile.householdSize;
    const maxGrams = limit.maxGrams * profile.householdSize;
    return grams > maxGrams ? [{ label: limit.label, grams, maxGrams }] : [];
  });
}

export function remainingPortionLimits(profile: PlannerProfile, selected: readonly Pick<SelectedMeal, "ingredients" | "nutritionPortionMultiplier" | "householdPortionMultiplier">[], choices: readonly VerifiedCandidateMeal[], daysRemaining = 1): PortionLimit[] {
  return WEEKLY_PROTEIN_INGREDIENT_LIMITS.map(limit => {
    const mass = (items: readonly { name: string; normalizedName: string; quantity: number; unit: string }[]) => items.reduce((sum, item) => {
      if (!(limit.pattern.test(item.name) || limit.pattern.test(item.normalizedName))) return sum;
      const unit = item.unit.trim().toLowerCase();
      return sum + (unit === "g" ? item.quantity : unit === "kg" ? item.quantity * 1000 : Number.NaN);
    }, 0);
    const used = selected.reduce((sum, meal) => sum + mass(meal.ingredients) * meal.nutritionPortionMultiplier * meal.householdPortionMultiplier, 0);
    return { amounts: choices.map(choice => mass(choice.ingredients) * profile.householdSize), max: Math.max(0, limit.maxGrams * profile.householdSize - used) / daysRemaining };
  });
}
