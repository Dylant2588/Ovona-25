import type { GenerationSupabase } from "@/lib/generation/types";
import type { GenerationContext } from "@/lib/generation/types";
import type { PreferencesInput } from "@/lib/meal-generator";
import { normalizePlannerProfile } from "./normalize-profile.ts";
import { assertCompleteWeeklyAvailability, materializeVerifiedCatalogue, type CuratedVerifiedCandidateMeal } from "./verified-catalogue.ts";
import type { PlannerProfile } from "./types.ts";

export type DeterministicPlanningInput = Readonly<{
  profile: PlannerProfile;
  candidates: readonly CuratedVerifiedCandidateMeal[];
  history: Readonly<{ recentCandidateIds: readonly string[] }>;
}>;

export type DeterministicPlanningInputResult =
  | { ok: true; value: DeterministicPlanningInput }
  | { ok: false; error: Readonly<{ statusCode: 422; code: "INSUFFICIENT_VERIFIED_CATALOGUE"; reasons: readonly string[] }> };

const slotName = (value: string) => value.trim().toLowerCase() === "snack" ? "snack" : value.trim().toLowerCase();

/** Server-only boundary: generated and incomplete stored data is never safety-certified here. */
export const buildDeterministicPlanningInput = async (
  userId: string,
  options: { supabase?: GenerationSupabase; preferences?: PreferencesInput; context?: GenerationContext } = {},
): Promise<DeterministicPlanningInputResult> => {
  // Dynamic loading keeps the pure test boundary free of Next's runtime-only alias loader.
  const context = options.context ?? await import("../generation/context-builder").then(({ buildContext }) => buildContext(userId, options));
  const profile = normalizePlannerProfile({
    calorieTarget: context.calorieTarget,
    proteinTarget: context.proteinTarget,
    allergies: context.allergies,
    dislikes: context.dislikes,
    dietaryRules: context.dietaryMode === "mixed" ? [] : [context.dietaryMode],
    maxPrepMinutes: context.maxPrepMinutes,
    householdSize: options.preferences?.profile?.householdSize ?? 1,
    preferredMealTypes: context.cuisinePreferences,
    requiredSlots: [...new Set(context.slotLabels.map(slotName))],
  });
  const candidates = materializeVerifiedCatalogue();
  const availability = assertCompleteWeeklyAvailability(profile, candidates, profile.policy);
  if (!availability.ok) return availability;

  return {
    ok: true,
    value: Object.freeze({
      profile,
      candidates: availability.value,
      history: Object.freeze({ recentCandidateIds: Object.freeze([]) }),
    }),
  };
};
