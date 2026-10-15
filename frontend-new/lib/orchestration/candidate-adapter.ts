import type { GenerationSupabase, GenerationContext } from "@/lib/generation/types";
import type { PreferencesInput } from "@/lib/meal-generator";
import { normalizePlannerProfile } from "./normalize-profile.ts";
import type { PlannerProfile, VerifiedCandidateMeal } from "./types.ts";
import type { RecipeRecord, RecipeConstraints } from "../recipes/types.ts";
import { loadReviewedRecipes } from "../recipes/repository.ts";
import { approveRecipe } from "../recipes/approval.ts";
import { loadServerConstraints, type ConstraintDatabase } from "../recipes/server-constraints.ts";

export type DeterministicPlanningInput = Readonly<{
  context: GenerationContext; profile: PlannerProfile; candidates: readonly VerifiedCandidateMeal[];
  recipes: readonly RecipeRecord[]; constraints: RecipeConstraints;
  history: Readonly<{ recentCandidateIds: readonly string[]; recentSimilarityKeys?: readonly string[]; recentProteinTypes?: readonly string[]; recentCuisines?: readonly string[]; recentFormats?: readonly string[] }>;
}>;
export type DeterministicPlanningInputResult = { ok: true; value: DeterministicPlanningInput } |
  { ok: false; error: Readonly<{ statusCode: number; code: string; reasons: readonly string[] }> };

export async function buildDeterministicPlanningInput(userId: string,
  options: { supabase?: GenerationSupabase; preferences?: PreferencesInput; context?: GenerationContext } = {},
): Promise<DeterministicPlanningInputResult> {
  try {
    const database: GenerationSupabase = options.supabase ?? await (await import("../supabaseServer")).supabaseServer();
    const reader = database as unknown as ConstraintDatabase;
    const constraints = await loadServerConstraints(reader, userId, options.preferences);
    const context: GenerationContext = options.context ?? await (await import("../generation/context-builder")).buildContext(userId, { ...options, supabase: database });
    constraints.maxPrepMinutes = Math.min(constraints.maxPrepMinutes ?? context.maxPrepMinutes, context.maxPrepMinutes);
    const loaded = await loadReviewedRecipes(reader);
    if (!loaded.ok) return { ok: false, error: { statusCode: 503, code: loaded.code, reasons: loaded.reasons } };
    const planning = context.planningInput;
    const hardConstraints = planning ? {
      allergies: [...planning.hardExclusions.allergies],
      dietaryModes: [...planning.hardExclusions.dietaryRules],
      neverFoods: [...planning.hardExclusions.neverFoods],
      maxPrepMinutes: planning.mealConstraints.maxPrepMinutes,
    } : constraints;
    // Safety and practicality are admission rules. Soft dislikes remain available
    // to the scheduler as ranking signals and never masquerade as allergies.
    const recipes = loaded.recipes.filter((recipe) => approveRecipe(recipe, hardConstraints).approved);
    const candidates: VerifiedCandidateMeal[] = recipes.flatMap((recipe) => recipe.slots.map((slot) => ({
      id: `${recipe.id}:${slot}`, slot, title: recipe.title, verified: true as const,
      ingredients: recipe.ingredients.map((ingredient) => ({ name: ingredient.name, normalizedName: ingredient.canonicalId,
        quantity: ingredient.amount / recipe.servings, unit: ingredient.unit, pantry: false })),
      allergens: [...new Set(recipe.ingredients.flatMap((ingredient) => ingredient.allergens))],
      dietaryTags: [], nutrition: { ...recipe.macros },
      // Unknown pricing is neutral during selection; never displayed as a cost estimate.
      cost: 0, prepMinutes: recipe.readyInMinutes, servings: 1, similarityKey: recipe.id, proteinType: recipe.proteinType, format: slot,
    })));
    const requiredSlots = context.slotLabels.map((slot) => slot.toLowerCase());
    const reasons = requiredSlots.filter((slot) => !candidates.some((candidate) => candidate.slot === slot))
      .map((slot) => `No reviewed ${slot} recipes meet your preferences. Add and review recipes before generating a plan.`);
    if (!candidates.length || reasons.length) return { ok: false, error: { statusCode: 422, code: "insufficient_reviewed_catalogue", reasons: reasons.length ? reasons : ["No reviewed recipes meet your saved restrictions."] } };
    // Shared approval applies dietary restrictions using reviewed ingredient evidence.
    const profile = normalizePlannerProfile({ calorieTarget: context.calorieTarget, proteinTarget: context.proteinTarget,
      allergies: planning ? [...planning.hardExclusions.allergies] : constraints.allergies,
      dislikes: planning ? [...planning.foodPreferences.dislikes] : constraints.dislikes,
      dietaryRules: planning ? [...planning.hardExclusions.dietaryRules] : constraints.dietaryModes,
      maxPrepMinutes: planning?.mealConstraints.maxPrepMinutes ?? constraints.maxPrepMinutes,
      householdSize: 1, preferredMealTypes: context.cuisinePreferences, requiredSlots });
    const baseHistory = context.rotationHistory ?? { recentCandidateIds: [], recentSimilarityKeys: context.recentMealNames.map((name) => name.toLowerCase()), recentProteinTypes: context.recentProteinTypes };
    const history = planning ? { ...baseHistory,
      recentCandidateIds: [...new Set([...baseHistory.recentCandidateIds, ...planning.memory.rejectedRecipeIds])],
      recentSimilarityKeys: [...new Set([...(baseHistory.recentSimilarityKeys ?? []), ...planning.memory.rejectedSimilarityKeys])],
    } : baseHistory;
    return { ok: true, value: { context, profile, candidates, recipes, constraints: hardConstraints, history } };
  } catch (error) {
    const failure = error as Error & { statusCode?: number; code?: string };
    return { ok: false, error: { statusCode: failure.statusCode ?? 503, code: failure.code ?? "recipe_library_unavailable", reasons: [failure.message] } };
  }
}
