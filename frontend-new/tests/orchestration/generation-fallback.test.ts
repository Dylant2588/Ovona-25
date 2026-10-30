import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";
import { reviewedRecipe } from "./reviewed-recipe-fixture.ts";
import { normalizePlannerProfile } from "../../lib/orchestration/normalize-profile.ts";
import { recipesToCandidates } from "../../lib/recipes/candidates.ts";
import { orchestrateWeek } from "../../lib/orchestration/schedule.ts";
import { approvePlanForUser, MealApprovalError } from "../../lib/recipes/plan-boundary.ts";
import { resolveReviewedProposal } from "../../lib/generation/ai-proposal.ts";
import { practicalIngredientViolations } from "../../lib/orchestration/practical-ingredients.ts";
import { sameRecipeDays } from "../../lib/generation/previous-plan.ts";
import type { WeeklyMealPlan } from "../../lib/meal-generator.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const constraints = { allergies: ["milk"], maxPrepMinutes: 30 };
const recipes = (["breakfast", "lunch", "dinner"] as const).flatMap((slot, index) => Array.from({ length: 3 }, (_, n) => ({
  ...reviewedRecipe(), id: `${slot}-${n}`, slots: [slot],
  ingredients: [{ name: ["Chickpeas", "Tofu", "Eggs"][index], canonicalId: ["chickpea", "tofu", "egg"][index], amount: 100, unit: "g",
    allergens: index === 1 ? ["soy"] : index === 2 ? ["eggs"] : [], dietaryFlags: index === 2 ? ["animal_product"] : [], reviewed: true }],
})));
const profile = normalizePlannerProfile({ calorieTarget: 1650, proteinTarget: 120, allergies: ["milk"], maxPrepMinutes: 30, requiredSlots: ["breakfast", "lunch", "dinner"] });

function entry(proposal: unknown, options: { exhaustRanked?: boolean; failApproval?: boolean } = {}) {
  const calls = { ai: 0, schedules: 0, approvals: 0 };
  const candidates = recipesToCandidates(recipes, constraints);
  const code = ts.transpileModule(fs.readFileSync("lib/generation/generate-plan.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const generationModule = { exports: {} as { generateWeeklyPlanWithArtifacts(id: string, options: unknown): Promise<{ weeklyPlan: WeeklyMealPlan }> } };
  const deps: Record<string, unknown> = {
    crypto: require("node:crypto"),
    "@/lib/meal-images": { imageForMeal: () => "/images/meals/bowl.svg" },
    "@/lib/meal-generator": { preferenceSignatureFor: () => "test-signature" },
    "@/lib/supabaseServer": { supabaseServer: () => { throw Error("No network in regression"); } },
    "@/lib/orchestration/candidate-adapter": { buildDeterministicPlanningInput: async () => ({ ok: true, value: {
      context: {}, profile, candidates, recipes, history: { recentCandidateIds: ["history-only"] },
    } }) },
    "@/lib/orchestration/schedule": { orchestrateWeek: (...args: Parameters<typeof orchestrateWeek>) => {
      calls.schedules++;
      if (options.exhaustRanked && calls.schedules === 1) return { ok: false, error: { code: "planning_search_exhausted", violations: [] } };
      return orchestrateWeek(...args);
    } },
    "./ai-proposal": { requestReviewedProposal: async () => { calls.ai++; return proposal; }, resolveReviewedProposal },
    "./previous-plan.ts": { loadPreviousPlanRotation: async () => ({ recentCandidateIds: [], recentSimilarityKeys: [], previousDayRecipeIds: [] }), sameRecipeDays },
    "../orchestration/practical-ingredients.ts": { practicalIngredientViolations },
    "@/lib/recipes/plan-boundary": { MealApprovalError, approvePlanForUser: async (db: never, id: string, plan: WeeklyMealPlan) => {
      calls.approvals++;
      if (options.failApproval) throw new MealApprovalError("meal_approval_failed", ["Changed saved restrictions"]);
      return approvePlanForUser(db, id, plan, undefined, {
        constraints: async () => constraints,
        recipes: async () => ({ ok: true as const, recipes }),
        context: async () => ({ calorieTarget: 1650, proteinTarget: 120, mealsPerDay: 3 }),
      });
    } },
  };
  new Function("require", "module", "exports", code)((id: string) => {
    if (!(id in deps)) throw Error(`Unexpected generation dependency: ${id}`);
    return deps[id];
  }, generationModule, generationModule.exports);
  return { run: () => generationModule.exports.generateWeeklyPlanWithArtifacts("user-1", { supabase: {} }), calls };
}

test("actual generation falls back for unavailable, refused and unsafe AI output, retaining real final approval", async () => {
  const original = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "synthetic-test-key-no-network";
  try {
    for (const response of [
      { ok: false, error: { code: "ai_proposal_timeout" } },
      { ok: false, error: { code: "ai_proposal_refused" } },
      { ok: true, value: { choices: [] } },
      { ok: true, value: { choices: recipesToCandidates(recipes, constraints).map(c => ({ slot: c.id, recipeId: "invented", recipeVersion: 1 })) } },
    ]) {
      const h = entry(response); const result = await h.run();
      assert.equal(result.weeklyPlan.days.length, 7);
      assert.equal(result.weeklyPlan.days.flatMap(day => day.meals).length, 21);
      assert.equal(h.calls.ai, 1); assert.equal(h.calls.approvals, 1);
      assert.ok(result.weeklyPlan.days.flatMap(day => day.meals).every(m => recipes.some(r => r.id === m.baseId)));
    }
  } finally { if (original === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = original; }
});

test("actual generation without AI retries exhausted ranking but never bypasses final approval", async () => {
  const original = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const h = entry(null, { exhaustRanked: true }); await h.run();
    assert.equal(h.calls.ai, 0); assert.equal(h.calls.schedules, 2); assert.equal(h.calls.approvals, 1);
    await assert.rejects(entry(null, { failApproval: true }).run(), { code: "meal_approval_failed" });
  } finally { if (original !== undefined) process.env.OPENAI_API_KEY = original; }
});

test("shared portions cannot admit a day whose individually rounded calories exceed approval bands", () => {
  const p = normalizePlannerProfile({ calorieTarget: 1830, proteinTarget: 216, requiredSlots: ["breakfast", "lunch", "dinner"] });
  const candidates = recipesToCandidates(recipes, constraints).map(c => ({ ...c, nutrition: { calories: 2000 / 3, protein: 215 / 3, carbs: 10, fat: 5 } }));
  const result = orchestrateWeek(p, candidates);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  for (const day of result.value.days) {
    const calories = day.meals.reduce((n, m) => n + Math.round(m.nutrition.calories * m.nutritionPortionMultiplier), 0);
    const protein = day.meals.reduce((n, m) => n + Math.round(m.nutrition.protein * m.nutritionPortionMultiplier), 0);
    assert.ok(calories <= 1830 * 1.08 && calories >= 1830 * 0.95);
    assert.ok(protein >= 216 * 0.98 && protein <= 216 * 1.1);
  }
});
