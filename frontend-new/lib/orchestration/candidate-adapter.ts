import type { GenerationSupabase, GenerationContext } from "@/lib/generation/types";
import type { PreferencesInput } from "@/lib/meal-generator";
import { normalizePlannerProfile } from "./normalize-profile.ts";
import type { PlannerProfile, VerifiedCandidateMeal } from "./types.ts";
import type { RecipeRecord, RecipeConstraints } from "../recipes/types.ts";
import { loadReviewedRecipes } from "../recipes/repository.ts";
import { approveRecipe } from "../recipes/approval.ts";
import { loadServerConstraints, mergeEffectiveConstraints, type ConstraintDatabase } from "../recipes/server-constraints.ts";
import { recipesToCandidates } from "../recipes/candidates.ts";

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
    const context: GenerationContext = options.context ?? await (await import("../generation/context-builder")).buildContext(userId, { ...options, supabase: database, constraints });
    const loaded = await loadReviewedRecipes(reader);
    if (!loaded.ok) return { ok: false, error: { statusCode: 503, code: loaded.code, reasons: loaded.reasons } };
    const planning = context.planningInput;
    const hardConstraints = mergeEffectiveConstraints(constraints, {
      allergies: planning ? [...planning.hardExclusions.allergies] : context.allergies,
      dietaryModes: planning ? [...planning.hardExclusions.dietaryRules] : [context.dietaryMode],
      neverFoods: planning ? [...planning.hardExclusions.neverFoods] : [],
      dislikes: planning ? [...planning.foodPreferences.dislikes] : context.dislikes,
      maxPrepMinutes: Math.min(planning?.mealConstraints.maxPrepMinutes ?? context.maxPrepMinutes, context.maxPrepMinutes),
    });
    const effectiveContext: GenerationContext = {
      ...context, allergies: [...(hardConstraints.allergies ?? [])], dislikes: [...(hardConstraints.dislikes ?? [])],
      dietaryMode: hardConstraints.dietaryModes?.find((rule) => rule !== "mixed") ?? "mixed",
      maxPrepMinutes: hardConstraints.maxPrepMinutes ?? context.maxPrepMinutes,
      ...(planning ? { planningInput: { ...planning,
        hardExclusions: { allergies: [...(hardConstraints.allergies ?? [])], dietaryRules: [...(hardConstraints.dietaryModes ?? [])], neverFoods: [...(hardConstraints.neverFoods ?? [])] },
        mealConstraints: { ...planning.mealConstraints, maxPrepMinutes: hardConstraints.maxPrepMinutes ?? context.maxPrepMinutes },
      } } : {}),
    };
    // Safety and practicality are admission rules. Soft dislikes remain available
    // to the scheduler as ranking signals and never masquerade as allergies.
    const recipes = loaded.recipes.filter((recipe) => approveRecipe(recipe, hardConstraints).approved);
    const candidates = recipesToCandidates(recipes, hardConstraints);
    const requiredSlots = context.slotLabels.map((slot) => slot.toLowerCase());
    const reasons = requiredSlots.filter((slot) => !candidates.some((candidate) => candidate.slot === slot))
      .map((slot) => `No reviewed ${slot} recipes meet your preferences. Add and review recipes before generating a plan.`);
    if (!candidates.length || reasons.length) return { ok: false, error: { statusCode: 422, code: "insufficient_reviewed_catalogue", reasons: reasons.length ? reasons : ["No reviewed recipes meet your saved restrictions."] } };
    // Shared approval applies dietary restrictions using reviewed ingredient evidence.
    const profile = normalizePlannerProfile({ calorieTarget: context.calorieTarget, proteinTarget: context.proteinTarget,
      allergies: hardConstraints.allergies,
      dislikes: hardConstraints.dislikes,
      foodLikes: context.planningInput?.foodPreferences.likes ?? options.preferences?.profile?.foodLikes,
      dietaryRules: hardConstraints.dietaryModes,
      maxPrepMinutes: hardConstraints.maxPrepMinutes,
      householdSize: 1, preferredMealTypes: planning?.foodPreferences.cuisines ?? context.cuisinePreferences, requiredSlots });
    const baseHistory = context.rotationHistory ?? { recentCandidateIds: [], recentSimilarityKeys: context.recentMealNames.map((name) => name.toLowerCase()), recentProteinTypes: context.recentProteinTypes };
    const history = planning ? { ...baseHistory,
      recentCandidateIds: [...new Set([...baseHistory.recentCandidateIds, ...planning.memory.rejectedRecipeIds])],
      recentSimilarityKeys: [...new Set([...(baseHistory.recentSimilarityKeys ?? []), ...planning.memory.rejectedSimilarityKeys])],
    } : baseHistory;
    return { ok: true, value: { context: effectiveContext, profile, candidates, recipes, constraints: hardConstraints, history } };
  } catch (error) {
    const failure = error as Error & { statusCode?: number; code?: string };
    return { ok: false, error: { statusCode: failure.statusCode ?? 503, code: failure.code ?? "recipe_library_unavailable", reasons: [failure.message] } };
  }
}
