import assert from "node:assert/strict";
import test from "node:test";

import { normalizePlannerProfile } from "../../lib/orchestration/normalize-profile.ts";
import { orchestrateWeek } from "../../lib/orchestration/schedule.ts";
import { rankCandidates } from "../../lib/orchestration/score.ts";
import type { VerifiedCandidateMeal } from "../../lib/orchestration/types.ts";
import { validRawProfile } from "./fixtures.ts";

const candidate = (id: string, slot: VerifiedCandidateMeal["slot"], extra: Partial<VerifiedCandidateMeal> = {}): VerifiedCandidateMeal => ({
  id,
  slot,
  title: id,
  verified: true,
  ingredients: [{ name: `${id} ingredient`, normalizedName: `${id}-ingredient`, quantity: 100, unit: "g", pantry: false }],
  allergens: [],
  dietaryTags: ["vegetarian"],
  nutrition: { calories: 500, protein: 30, carbs: 50, fat: 15 },
  cost: 2,
  prepMinutes: 15,
  servings: 2,
  ...extra,
});

const profile = () => normalizePlannerProfile({ ...validRawProfile, calorieTarget: 2000, proteinTarget: 120 });

const completeCandidates = (): VerifiedCandidateMeal[] =>
  (["breakfast", "lunch", "dinner", "snack"] as const).flatMap((slot) =>
    Array.from({ length: 7 }, (_, day) => candidate(`${slot}-${String(day + 1).padStart(2, "0")}`, slot)),
  );

test("schedules byte-equivalent seven-day required slots with factual explanations", () => {
  const first = orchestrateWeek(profile(), completeCandidates(), []);
  const second = orchestrateWeek(profile(), completeCandidates(), []);

  assert.equal(first.ok, true);
  assert.deepEqual(first, second);
  if (!first.ok) return;
  assert.equal(first.value.days.length, 7);
  for (const day of first.value.days) {
    assert.deepEqual(day.meals.map((meal) => meal.slot).sort(), ["breakfast", "dinner", "lunch", "snack"]);
    assert.match(day.meals[0]!.explanation, /target contribution|ingredient reuse|prep time|cost/i);
  }
});

test("breaks equal score ties by candidate ID", () => {
  const ranked = rankCandidates(profile(), [candidate("zeta", "breakfast"), candidate("alpha", "breakfast")], {
    selected: [],
    recentCandidateIds: [],
  });
  assert.deepEqual(ranked.map((entry) => entry.candidate.id), ["alpha", "zeta"]);
});

test("rejects excess identical or similar meals but permits an explicitly linked leftover", () => {
  const repeated = Array.from({ length: 7 }, (_, index) => candidate(`same-${index}`, "breakfast", { similarityKey: "same" }));
  const noRepeat = orchestrateWeek(profile(), [...completeCandidates().filter((item) => item.slot !== "breakfast"), ...repeated], []);
  assert.equal(noRepeat.ok, false);

  const leftovers = [
    candidate("a-breakfast-source", "breakfast", { similarityKey: "stew", prepMinutes: 0 }),
    candidate("a-lunch-leftover", "lunch", { similarityKey: "stew", isLeftover: true, leftoverFromCandidateId: "a-breakfast-source" }),
  ];
  const practicalWeek = [
    ...Array.from({ length: 6 }, (_, index) => candidate(`z-breakfast-${index}`, "breakfast")),
    ...Array.from({ length: 7 }, (_, index) => candidate(`z-snack-${index}`, "snack")),
    ...Array.from({ length: 6 }, (_, index) => candidate(`z-lunch-${index}`, "lunch")),
    ...Array.from({ length: 7 }, (_, index) => candidate(`z-dinner-${index}`, "dinner")),
    ...leftovers,
  ];
  const permitted = orchestrateWeek(profile(), practicalWeek, []);
  assert.equal(permitted.ok, true);
  if (permitted.ok) assert.equal(permitted.value.days[0]!.meals.some((meal) => meal.candidateId === "a-lunch-leftover"), true);
});
