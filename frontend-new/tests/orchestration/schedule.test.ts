import assert from "node:assert/strict";
import test from "node:test";

import { normalizePlannerProfile } from "../../lib/orchestration/normalize-profile.ts";
import { orchestrateWeek } from "../../lib/orchestration/schedule.ts";
import { rankCandidates } from "../../lib/orchestration/score.ts";
import { validateAndRepairWeek } from "../../lib/orchestration/validate.ts";
import type { VerifiedCandidateMeal } from "../../lib/orchestration/types.ts";
import { validRawProfile } from "./fixtures.ts";

const proteinFor = (id: string) => ["chicken", "turkey", "fish", "beef", "tofu", "eggs"][
  Number.parseInt(id.match(/(\d+)/)?.[1] ?? "0", 10) % 6
];

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
  proteinType: proteinFor(id),
  ...extra,
});

const profile = () => normalizePlannerProfile({ ...validRawProfile, calorieTarget: 2000, proteinTarget: 120 });

const completeCandidates = (): VerifiedCandidateMeal[] =>
  (["breakfast", "lunch", "dinner", "snack"] as const).flatMap((slot) =>
    Array.from({ length: 7 }, (_, day) => candidate(`${slot}-${String(day + 1).padStart(2, "0")}`, slot)),
  );

test("schedules byte-equivalent seven-day required slots with factual explanations", () => {
  const first = orchestrateWeek(profile(), completeCandidates(), {});
  const second = orchestrateWeek(profile(), completeCandidates(), {});

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

test("revisits earlier days instead of exhausting the week's ingredient allowance greedily", () => {
  const p = normalizePlannerProfile({ calorieTarget: 800, proteinTarget: 60, requiredSlots: ["breakfast"], householdSize: 1, maxPrepMinutes: 30 });
  const options = [
    candidate("a-concentrated", "breakfast", { proteinType: "mixed", ingredients: [{ name: "Egg whites", normalizedName: "egg", quantity: 450, unit: "g", pantry: false }] }),
    candidate("b-lighter", "breakfast", { proteinType: "mixed", ingredients: [{ name: "Egg whites", normalizedName: "egg", quantity: 100, unit: "g", pantry: false }] }),
    candidate("c-alternative", "breakfast", { proteinType: "mixed", ingredients: [{ name: "Chickpeas", normalizedName: "chickpea", quantity: 100, unit: "g", pantry: false }] }),
  ].map(c => ({ ...c, servings: 1, nutrition: { calories: 800, protein: 60, carbs: 60, fat: 10 }, dietaryTags: [] }));
  const result = orchestrateWeek(p, options);
  assert.equal(result.ok, true, JSON.stringify(result));
  if (result.ok) {
    const meals = result.value.days.flatMap(day => day.meals);
    assert.equal(meals.length, 7);
    assert.equal(meals.filter(meal => meal.candidateId === "a-concentrated").length, 1);
    assert.ok(meals.flatMap(meal => meal.ingredients.map(i => i.normalizedName === "egg" ? i.quantity * meal.nutritionPortionMultiplier : 0)).reduce((a, b) => a + b, 0) <= 1000);
  }
});

test("recent safe meals remain available when fresh choices cannot meet daily targets", () => {
  const safe = completeCandidates();
  const recentBreakfasts = safe.filter((meal) => meal.slot === "breakfast");
  const history = {
    recentCandidateIds: recentBreakfasts.map((meal) => meal.id),
    recentSimilarityKeys: recentBreakfasts.map((meal) => meal.id),
  };
  // At any allowed shared portion, this fresh breakfast makes the day's
  // calorie/protein intervals incompatible. Safe recent breakfasts still fit.
  const fresh = candidate("fresh-breakfast", "breakfast", {
    nutrition: { calories: 1000, protein: 1, carbs: 200, fat: 20 },
    proteinType: "plant",
  });
  const result = orchestrateWeek(profile(), [...safe, fresh], history);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.days.length, 7);
  for (const day of result.value.days) {
    assert.equal(day.meals.length, 4);
    assert.ok(day.meals.some((meal) => history.recentCandidateIds.includes(meal.candidateId)));
    assert.ok(day.meals.every((meal) => meal.candidateId !== fresh.id));
    const totals = day.meals.reduce((sum, meal) => ({
      calories: sum.calories + meal.nutrition.calories * meal.nutritionPortionMultiplier,
      protein: sum.protein + meal.nutrition.protein * meal.nutritionPortionMultiplier,
    }), { calories: 0, protein: 0 });
    assert.ok(totals.calories >= 1900 && totals.calories <= 2160);
    assert.ok(totals.protein >= 117.6 && totals.protein <= 132);
    assert.ok(day.meals.every((meal) => meal.nutritionPortionMultiplier >= 0.7 && meal.nutritionPortionMultiplier <= 1.5));
  }
  const unsafeRecent = safe.map((meal) => meal.slot === "breakfast"
    ? { ...meal, allergens: ["peanut"] }
    : meal);
  assert.equal(orchestrateWeek(profile(), [...unsafeRecent, fresh], history).ok, false);
});

test("five-meal profiles retain two distinct snacks and reject a missing snack", () => {
  const fiveMealProfile = normalizePlannerProfile({ ...validRawProfile, calorieTarget: 2500, proteinTarget: 150,
    requiredSlots: ["breakfast", "snack", "lunch", "snack", "dinner"] });
  const candidates = [...completeCandidates(), ...Array.from({ length: 7 }, (_, day) => candidate(`extra-snack-${day}`, "snack"))];
  const result = orchestrateWeek(fiveMealProfile, candidates);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  for (const day of result.value.days) {
    const snacks = day.meals.filter((meal) => meal.slot === "snack");
    assert.equal(day.meals.length, 5);
    assert.equal(snacks.length, 2);
    assert.notEqual(snacks[0].candidateId, snacks[1].candidateId);
  }
  const incomplete = { days: result.value.days.map((day, index) => index === 0 ? { ...day, meals: day.meals.filter((_, mealIndex) => mealIndex !== 1) } : day) };
  assert.equal(validateAndRepairWeek(fiveMealProfile, incomplete).ok, false);
});

test("never schedules a protein source more than twice in one day", () => {
  const fiveMealProfile = normalizePlannerProfile({ ...validRawProfile, calorieTarget: 2500, proteinTarget: 150,
    requiredSlots: ["breakfast", "snack", "lunch", "snack", "dinner"] });
  const candidates = (['breakfast', 'snack', 'lunch', 'dinner'] as const).flatMap((slot) =>
    Array.from({ length: 14 }, (_, index) => candidate(`${slot}-varied-${index + 1}`, slot)));
  const result = orchestrateWeek(fiveMealProfile, candidates);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  for (const day of result.value.days) {
    const countByProtein = new Map<string, number>();
    day.meals.forEach((meal) => {
      const protein = meal.proteinType?.trim().toLowerCase() || "other";
      countByProtein.set(protein, (countByProtein.get(protein) ?? 0) + 1);
    });
    assert.ok([...countByProtein.values()].every((count) => count <= 2));
  }
});

test("fails safely when the only macro-feasible day would use one protein three times", () => {
  const fiveMealProfile = normalizePlannerProfile({ ...validRawProfile, calorieTarget: 2500, proteinTarget: 150,
    requiredSlots: ["breakfast", "snack", "lunch", "snack", "dinner"] });
  const turkeyOnly = [
    candidate("turkey-breakfast", "breakfast", { proteinType: "Turkey" }),
    candidate("turkey-snack-one", "snack", { proteinType: " turkey " }),
    candidate("turkey-snack-two", "snack", { proteinType: "TURKEY" }),
    candidate("turkey-lunch", "lunch", { proteinType: "turkey" }),
    candidate("turkey-dinner", "dinner", { proteinType: "turkey" }),
  ];
  const result = orchestrateWeek(fiveMealProfile, turkeyOnly);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "insufficient_candidates");
});

test("treats a missing protein type as one capped fallback category", () => {
  const fiveMealProfile = normalizePlannerProfile({ ...validRawProfile, calorieTarget: 2500, proteinTarget: 150,
    requiredSlots: ["breakfast", "snack", "lunch", "snack", "dinner"] });
  const unknownProteinOnly = [
    candidate("unknown-breakfast", "breakfast", { proteinType: undefined }),
    candidate("unknown-snack-one", "snack", { proteinType: undefined }),
    candidate("unknown-snack-two", "snack", { proteinType: undefined }),
    candidate("unknown-lunch", "lunch", { proteinType: undefined }),
    candidate("unknown-dinner", "dinner", { proteinType: undefined }),
  ];
  assert.equal(orchestrateWeek(fiveMealProfile, unknownProteinOnly).ok, false);
});

test("uses one bounded extra repeat when a reviewed snack catalogue is scarce", () => {
  const fiveMealProfile = normalizePlannerProfile({ ...validRawProfile, calorieTarget: 2500, proteinTarget: 150,
    requiredSlots: ["breakfast", "snack", "lunch", "snack", "dinner"] });
  // Six recipes cover twelve of fourteen snack placements under the standard
  // two-use policy, so the final day must exercise the bounded third use.
  const snacks = Array.from({ length: 6 }, (_, index) => candidate(`scarce-snack-${index + 1}`, "snack"));
  const result = orchestrateWeek(fiveMealProfile, [...completeCandidates().filter((item) => item.slot !== "snack"), ...snacks]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const selectedSnacks = result.value.days.flatMap((day) => day.meals.filter((meal) => meal.slot === "snack"));
  assert.equal(selectedSnacks.length, 14);
  assert.ok(selectedSnacks.every((meal) => selectedSnacks.filter((other) => other.candidateId === meal.candidateId).length <= 3));
  assert.ok(result.value.days.every((day) => {
    const snackIds = day.meals.filter((meal) => meal.slot === "snack").map((meal) => meal.candidateId);
    return new Set(snackIds).size === snackIds.length;
  }));
  assert.ok(selectedSnacks.some((meal) => meal.explanation.includes("catalogue for this slot is limited")));
});

test("rejects excess identical or similar meals but permits an explicitly linked leftover", () => {
  const repeated = Array.from({ length: 7 }, (_, index) => candidate(`same-${index}`, "breakfast", { similarityKey: "same" }));
  const noRepeat = orchestrateWeek(profile(), [...completeCandidates().filter((item) => item.slot !== "breakfast"), ...repeated], {});
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
  const permitted = orchestrateWeek(profile(), practicalWeek, {});
  assert.equal(permitted.ok, true);
  if (permitted.ok) assert.equal(permitted.value.days[0]!.meals.some((meal) => meal.candidateId === "a-lunch-leftover"), true);
});
