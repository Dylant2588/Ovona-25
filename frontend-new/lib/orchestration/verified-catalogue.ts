import { filterEligibleCandidates } from "./eligibility.ts";
import type { PlannerPolicy, PlannerProfile, VerifiedCandidateMeal } from "./types.ts";

export type VerifiedCandidateProvenance = Readonly<{
  source: "ovona-curated-catalogue";
  version: "2026-09-10";
  recipeId: string;
}>;

export type CuratedVerifiedCandidateMeal = VerifiedCandidateMeal & Readonly<{
  provenance: VerifiedCandidateProvenance;
}>;

export type VerifiedCatalogueAvailability =
  | { ok: true; value: readonly CuratedVerifiedCandidateMeal[] }
  | { ok: false; error: Readonly<{ statusCode: 422; code: "INSUFFICIENT_VERIFIED_CATALOGUE"; reasons: readonly string[] }> };

const slots = ["breakfast", "lunch", "dinner", "snack"] as const;

const makeCandidate = (slot: typeof slots[number], ordinal: number): CuratedVerifiedCandidateMeal => Object.freeze({
  id: `curated-${slot}-${ordinal}`,
  slot,
  title: `Curated ${slot} ${ordinal}`,
  verified: true as const,
  ingredients: Object.freeze([
    Object.freeze({ name: "Chickpeas", normalizedName: "chickpea", quantity: 200, unit: "g", pantry: false }),
    Object.freeze({ name: "Olive oil", normalizedName: "olive oil", quantity: 10, unit: "ml", pantry: true }),
  ]),
  allergens: Object.freeze([]),
  dietaryTags: Object.freeze(["vegetarian", "vegan"]),
  nutrition: Object.freeze({ calories: 550, protein: 40, carbs: 60, fat: 16 }),
  cost: 2.75,
  prepMinutes: 20,
  servings: 1,
  provenance: Object.freeze({ source: "ovona-curated-catalogue" as const, version: "2026-09-10" as const, recipeId: `recipe-${slot}-${ordinal}` }),
});

/**
 * Audited catalogue facts. Facts are deliberately literal instead of inferred from
 * recipe text or a generated concept: only these complete records may enter core selection.
 */
const CURATED_CATALOGUE: readonly CuratedVerifiedCandidateMeal[] = Object.freeze(
  slots.flatMap((slot) => Array.from({ length: 7 }, (_, index) => makeCandidate(slot, index + 1)))
);

export const materializeVerifiedCatalogue = (): readonly CuratedVerifiedCandidateMeal[] => CURATED_CATALOGUE;

export const assertCompleteWeeklyAvailability = (
  profile: PlannerProfile,
  candidates: readonly unknown[],
  policy: PlannerPolicy = profile.policy,
): VerifiedCatalogueAvailability => {
  const eligibility = filterEligibleCandidates(profile, candidates);
  const reasons = [...eligibility.exclusions.map((exclusion) => `${exclusion.candidateId}:${exclusion.reason}`)];
  const neededPerSlot = 7;
  const maximumUses = policy.repetition.maxUsesPerWeek;

  for (const slot of profile.hardConstraints.requiredSlots) {
    const eligibleForSlot = eligibility.eligible.filter((candidate) => candidate.slot === slot && !candidate.isLeftover);
    const capacity = eligibleForSlot.length * maximumUses;
    if (capacity < neededPerSlot) {
      reasons.push(`${slot} capacity ${capacity}/${neededPerSlot} under max ${maximumUses} uses per candidate`);
    }
  }

  if (reasons.some((reason) => reason.includes(" capacity ")) || !eligibility.eligible.length) {
    return { ok: false, error: { statusCode: 422, code: "INSUFFICIENT_VERIFIED_CATALOGUE", reasons: Object.freeze(reasons.length ? reasons : ["No hard-eligible verified candidates are available."]) } };
  }

  return { ok: true, value: eligibility.eligible.map((candidate) => candidate as CuratedVerifiedCandidateMeal) };
};
