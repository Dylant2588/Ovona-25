import type { RecipeRecord, RecipeConstraints } from "./types.ts";
import type { PlannerMealSlot, WeekSchedule } from "../orchestration/types.ts";
import { recipeRecordErrors } from "./repository.ts";
import { approveRecipe, APPROVAL_POLICY_VERSION } from "./approval.ts";
import { CALCULATED_NUTRITION_METHOD, NUTRITION_POLICY_VERSION } from "./nutrition.ts";
import { canonicalAllergens } from "./taxonomy.ts";
import { recipesToCandidates, recipeProteinFamilies } from "./candidates.ts";
import { normalizePlannerProfile } from "../orchestration/normalize-profile.ts";
import { DEFAULT_PLANNER_POLICY } from "../orchestration/policy.ts";
import { orchestrateWeek } from "../orchestration/schedule.ts";

export type CoverageCohort = { id: string; calorieTarget: number; proteinTarget: number; dietaryMode: string; allergies: string[]; maxPrepMinutes: number; slots: PlannerMealSlot[] };
const THREE: PlannerMealSlot[] = ["breakfast", "lunch", "dinner"];
const FIVE: PlannerMealSlot[] = ["breakfast", "snack", "lunch", "snack", "dinner"];
const probe = (id: string, extra: Partial<CoverageCohort> = {}): CoverageCohort => ({ id, calorieTarget: 2000, proteinTarget: 150, dietaryMode: "mixed", allergies: [], maxPrepMinutes: 30, slots: [...THREE], ...extra });
export const DEFAULT_COVERAGE_COHORTS: readonly CoverageCohort[] = [
  probe("mixed-three"), probe("mixed-five", { slots: [...FIVE] }), probe("vegetarian-three", { dietaryMode: "vegetarian" }),
  probe("vegan-three", { dietaryMode: "vegan" }), probe("pescatarian-three", { dietaryMode: "pescatarian" }),
  probe("mixed-three-15min", { maxPrepMinutes: 15 }), probe("restrictive-five", { calorieTarget: 1830, proteinTarget: 216, slots: [...FIVE], allergies: ["Dairy", "Nuts", "Fish", "Shellfish", "Sesame"] }),
];
const SLOTS: readonly PlannerMealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
const DIETS = ["mixed", "omnivore", "vegan", "vegetarian", "pescatarian", "low_carb", "high_protein"];
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export function validateCoverageCohorts(value: unknown): asserts value is CoverageCohort[] {
  if (!Array.isArray(value) || !value.length || value.length > 20) throw new Error("Provide 1–20 coverage cohorts.");
  const ids = new Set<string>();
  for (const raw of value) {
    if (!object(raw) || typeof raw.id !== "string" || !raw.id.trim() || raw.id.length > 100 || ids.has(raw.id)) throw new Error("Each cohort needs a unique nonempty ID (up to 100 characters).");
    ids.add(raw.id);
    if (typeof raw.dietaryMode !== "string" || !DIETS.includes(raw.dietaryMode)) throw new Error(`Invalid dietary mode in ${raw.id}.`);
    if (!Array.isArray(raw.slots) || !raw.slots.length || raw.slots.length > 5 || raw.slots.some(slot => !SLOTS.includes(slot))) throw new Error(`Invalid required slot list in ${raw.id}.`);
    if (!Array.isArray(raw.allergies) || raw.allergies.length > 40 || raw.allergies.some(allergy => typeof allergy !== "string" || allergy.length > 160 || !canonicalAllergens(allergy).length)) throw new Error(`Invalid allergy evidence in ${raw.id}.`);
    if (typeof raw.calorieTarget !== "number" || typeof raw.proteinTarget !== "number" || typeof raw.maxPrepMinutes !== "number" || raw.maxPrepMinutes <= 0) throw new Error(`Invalid numeric target/preparation limit in ${raw.id}.`);
    normalizePlannerProfile({ ...raw, dietaryRules: [raw.dietaryMode], requiredSlots: raw.slots });
  }
}

type ProbeResult = { status: "feasible" | "not_feasible" | "indeterminate"; admittedRecipes: number; admittedCalculatedRecipes: number; admittedLegacyRecipes: number; reason?: string; violations?: readonly { day: number; code: string; message: string }[]; plan?: WeekSchedule };
type SlotCapacity = { dailyDemand: number; weeklyDemand: number; uniqueRecipes: number; calculatedUniqueRecipes: number };

/** Pure snapshot report. No database, environment reads, repairs or approvals. */
export function reportCatalogueCoverage(records: readonly unknown[], cohorts: readonly CoverageCohort[] = DEFAULT_COVERAGE_COHORTS) {
  if (!Array.isArray(records) || records.length > 500) throw new Error("Catalogue must be an array of at most 500 records.");
  validateCoverageCohorts(cohorts);
  const counts = { records: records.length, uniqueRecipeIds: 0, pending: 0, rejected: 0, malformed: 0, malformedApproved: 0, approvedLegacy: 0, approvedCalculated: 0, multipleApprovedVersions: [] as string[] };
  const valid: RecipeRecord[] = [];
  const issues: Array<{ index: number; recipeId: string | null; errors: string[] }> = [];
  const identities = new Set<string>();
  for (const [index, record] of records.entries()) {
    const errors = recipeRecordErrors(record);
    if (errors.length) {
      counts.malformed++;
      if (object(record) && object(record.review) && record.review.status === "approved") counts.malformedApproved++;
      issues.push({ index, recipeId: object(record) && typeof record.id === "string" ? record.id : null, errors }); continue;
    }
    const recipe = record as RecipeRecord; valid.push(recipe); identities.add(recipe.id);
    if (recipe.review.status === "pending_review") counts.pending++;
    else if (recipe.review.status === "rejected") counts.rejected++;
    else if (recipe.nutrition.method === CALCULATED_NUTRITION_METHOD) counts.approvedCalculated++;
    else counts.approvedLegacy++;
    const missing = recipe.ingredients.flatMap((ingredient, ingredientIndex) => ingredient.nutrition ? [] : [`Ingredient ${ingredientIndex + 1} (${ingredient.name}) has no exact nutrition mapping.`]);
    if (recipe.nutrition.method !== CALCULATED_NUTRITION_METHOD) missing.push("Legacy/estimated nutrition has no reproducible ingredient calculation.");
    if (missing.length) issues.push({ index, recipeId: recipe.id, errors: missing });
  }
  counts.uniqueRecipeIds = identities.size;
  const approvedVersions = new Map<string, Set<number>>();
  for (const recipe of valid.filter(recipe => recipe.review.status === "approved")) {
    const versions = approvedVersions.get(recipe.id) ?? new Set<number>(); versions.add(recipe.version); approvedVersions.set(recipe.id, versions);
  }
  counts.multipleApprovedVersions = [...approvedVersions].filter(([, versions]) => versions.size > 1).map(([id]) => id).sort();
  const results = cohorts.map(cohort => {
    const constraints: RecipeConstraints = { dietaryModes: [cohort.dietaryMode], allergies: cohort.allergies, maxPrepMinutes: cohort.maxPrepMinutes };
    const rejectionReasons: Record<string, number> = {};
    const admitted = valid.filter(recipe => {
      const checked = approveRecipe(recipe, constraints);
      for (const code of new Set(checked.reasons.map(reason => reason.code))) rejectionReasons[code] = (rejectionReasons[code] ?? 0) + 1;
      return checked.approved;
    });
    const calculated = admitted.filter(recipe => recipe.nutrition.method === CALCULATED_NUTRITION_METHOD);
    const profile = normalizePlannerProfile({ ...cohort, dietaryRules: [cohort.dietaryMode], requiredSlots: cohort.slots });
    const run = (recipes: RecipeRecord[]): ProbeResult => {
      const base = { admittedRecipes: new Set(recipes.map(recipe => recipe.id)).size, admittedCalculatedRecipes: new Set(recipes.filter(recipe => recipe.nutrition.method === CALCULATED_NUTRITION_METHOD).map(recipe => recipe.id)).size, admittedLegacyRecipes: new Set(recipes.filter(recipe => recipe.nutrition.method !== CALCULATED_NUTRITION_METHOD).map(recipe => recipe.id)).size };
      // loadReviewedRecipes rejects the entire runtime library when any approved
      // record is malformed. Do not turn a cleaned subset into a readiness pass.
      if (counts.malformedApproved) return { ...base, status: "not_feasible", reason: "invalid_recipe_library: malformed approved records block the production loader." };
      // A deterministic complexity guard protects this synchronous diagnostic.
      // It does not truncate candidates or claim a result the scheduler did not prove.
      const candidates = recipesToCandidates(recipes, constraints);
      const combinations = cohort.slots.reduce((product, slot) => product * candidates.filter(candidate => candidate.slot === slot).length, 1);
      if (combinations > 20_000) return { ...base, status: "indeterminate", reason: `Diagnostic search budget exceeded (${combinations} possible daily combinations; limit 20000). No feasibility claim made.` };
      const result = orchestrateWeek(profile, candidates, {});
      return result.ok ? { ...base, status: "feasible", plan: result.value } : { ...base, status: result.error.code === "planning_search_exhausted" ? "indeterminate" : "not_feasible", reason: result.error.code, violations: result.error.violations };
    };
    const slots = Object.fromEntries(SLOTS.map(slot => {
      const demand = cohort.slots.filter(required => required === slot).length;
      return [slot, { dailyDemand: demand, weeklyDemand: demand * 7, uniqueRecipes: new Set(admitted.filter(recipe => recipe.slots.includes(slot)).map(recipe => recipe.id)).size, calculatedUniqueRecipes: new Set(calculated.filter(recipe => recipe.slots.includes(slot)).map(recipe => recipe.id)).size }];
    })) as Record<PlannerMealSlot, SlotCapacity>;
    const sourceFamilies = new Set(admitted.flatMap(recipeProteinFamilies));
    const policyGaps = cohort.dietaryMode === "vegan" && cohort.slots.length > sourceFamilies.size * 2 ? ["Too few reviewed plant protein families for the daily variety limit of two meals per source; review suitable recipes with additional protein sources."] : [];
    return { id: cohort.id, cohort: { ...cohort, allergies: [...cohort.allergies], slots: [...cohort.slots] }, rejectionReasons, slots, policyGaps, legacyCompatible: run(admitted), calculatedOnly: run(calculated) };
  });
  return { reportVersion: "catalogue-coverage-v1", approvalPolicyVersion: APPROVAL_POLICY_VERSION, nutritionPolicyVersion: NUTRITION_POLICY_VERSION, schedulerPolicy: DEFAULT_PLANNER_POLICY, guarantees: { legacyCompatible: "Includes existing reviewed legacy nutrition attestations; not necessarily ingredient calculated.", calculatedOnly: "Only reviewed recipes with reproducible ingredient calculations." }, catalogue: counts, issues, cohorts: results };
}
