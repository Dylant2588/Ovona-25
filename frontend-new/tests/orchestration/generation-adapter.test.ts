import assert from "node:assert/strict";
import test from "node:test";
import { buildDeterministicPlanningInput } from "../../lib/orchestration/candidate-adapter.ts";
import {
  assertCompleteWeeklyAvailability,
  materializeVerifiedCatalogue,
} from "../../lib/orchestration/verified-catalogue.ts";
import { normalizePlannerProfile } from "../../lib/orchestration/normalize-profile.ts";
import { orchestrateWeek } from "../../lib/orchestration/schedule.ts";

const profile = normalizePlannerProfile({
  calorieTarget: 2200,
  proteinTarget: 160,
  householdSize: 1,
  maxPrepMinutes: 30,
  requiredSlots: ["breakfast", "lunch", "dinner", "snack"],
});

test("a provenance-complete curated catalogue schedules every slot for seven days", () => {
  const candidates = materializeVerifiedCatalogue();
  assert.equal(candidates.length, 28);
  assert.ok(candidates.every((candidate) => candidate.verified));
  assert.ok(candidates.every((candidate) => Object.isFrozen(candidate)));
  assert.ok(candidates.every((candidate) => Number.isFinite(candidate.nutrition.calories)));
  assert.ok(candidates.every((candidate) => candidate.ingredients.every((ingredient) => ingredient.quantity > 0 && ingredient.unit.length > 0)));
  assert.ok(candidates.every((candidate) => candidate.provenance.source === "ovona-curated-catalogue" && candidate.provenance.version));

  const availability = assertCompleteWeeklyAvailability(profile, candidates, profile.policy);
  assert.equal(availability.ok, true);
  if (!availability.ok) return;

  const schedule = orchestrateWeek(profile, availability.value);
  assert.equal(schedule.ok, true);
  if (schedule.ok) assert.equal(schedule.value.days.length, 7);
});

test("the adapter excludes untrusted stored concepts and returns truthful verified-catalogue insufficiency", async () => {
  const insufficient = materializeVerifiedCatalogue().filter((candidate) => candidate.slot !== "snack");
  const availability = assertCompleteWeeklyAvailability(profile, insufficient, profile.policy);
  assert.equal(availability.ok, false);
  if (!availability.ok) {
    assert.equal(availability.error.code, "INSUFFICIENT_VERIFIED_CATALOGUE");
    assert.match(availability.error.reasons.join(" "), /snack/i);
  }

  const result = await buildDeterministicPlanningInput("user-1", {
    context: {
      calorieTarget: 2200, proteinTarget: 160, carbTarget: 200, fatTarget: 70,
      dietaryMode: "mixed", allergies: [], dislikes: [], cuisinePreferences: [],
      maxPrepMinutes: 30, healthConditions: [], microTargets: {}, mealsPerDay: 5,
      slotLabels: ["Breakfast", "Snack", "Lunch", "Snack", "Dinner"], weeklyBudget: 55,
      recentMealNames: ["Unknown concept"], recentProteinTypes: [], slotBudgets: [],
    },
    preferences: { profile: { mealsPerDay: 5 } },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.candidates.length, 28);
    assert.ok(result.value.candidates.every((candidate) => candidate.id !== "llm-concept"));
  }
});
