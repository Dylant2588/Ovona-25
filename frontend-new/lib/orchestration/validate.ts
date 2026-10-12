import type { PlannerProfile, SelectedMeal, ScheduleViolation, WeekSchedule, WeekScheduleResult } from "./types.ts";

const MIN_PORTION_MULTIPLIER = 0.7;
const MAX_PORTION_MULTIPLIER = 1.5;

const totalsFor = (meals: readonly SelectedMeal[]) => meals.reduce(
  (totals, meal) => ({
    calories: totals.calories + meal.nutrition.calories * meal.nutritionPortionMultiplier,
    protein: totals.protein + meal.nutrition.protein * meal.nutritionPortionMultiplier,
  }),
  { calories: 0, protein: 0 },
);

const within = (value: number, target: number, band: { min: number; max: number }) => value >= target * band.min && value <= target * band.max;

const materialize = (meal: SelectedMeal, profile: PlannerProfile, multiplier: number): SelectedMeal => {
  const nutritionPortionMultiplier = Number(multiplier.toFixed(6));
  const householdPortionMultiplier = profile.householdSize;
  return {
    ...meal,
    nutritionPortionMultiplier,
    householdPortionMultiplier,
    servings: meal.recipeServings * nutritionPortionMultiplier * householdPortionMultiplier,
  };
};

const violationFor = (day: number, totals: { calories: number; protein: number }, profile: PlannerProfile): ScheduleViolation[] => [
  ...(!within(totals.calories, profile.calorieTarget, profile.hardConstraints.calorieBand)
    ? [{ day, code: "calories_out_of_band" as const, message: `Calories ${totals.calories.toFixed(2)} are outside the configured daily band.` }]
    : []),
  ...(!within(totals.protein, profile.proteinTarget, profile.hardConstraints.proteinBand)
    ? [{ day, code: "protein_out_of_band" as const, message: `Protein ${totals.protein.toFixed(2)} is outside the configured daily band.` }]
    : []),
];

const portionFactor = (totals: { calories: number; protein: number }, profile: PlannerProfile) => {
  if (totals.calories <= 0 || totals.protein <= 0) return null;
  const calorieInterval = [profile.calorieTarget * profile.hardConstraints.calorieBand.min / totals.calories, profile.calorieTarget * profile.hardConstraints.calorieBand.max / totals.calories];
  const proteinInterval = [profile.proteinTarget * profile.hardConstraints.proteinBand.min / totals.protein, profile.proteinTarget * profile.hardConstraints.proteinBand.max / totals.protein];
  const min = Math.max(MIN_PORTION_MULTIPLIER, calorieInterval[0]!, proteinInterval[0]!);
  const max = Math.min(MAX_PORTION_MULTIPLIER, calorieInterval[1]!, proteinInterval[1]!);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return null;
  return Math.min(max, Math.max(min, 1));
};

export const validateAndRepairWeek = (profile: PlannerProfile, schedule: WeekSchedule): WeekScheduleResult => {
  const violations: ScheduleViolation[] = [];
  if (schedule.days.length !== 7) {
    violations.push({ day: 0, code: "missing_slot", message: "A weekly schedule must contain exactly seven days." });
  }
  const repairedDays = schedule.days.map((day) => {
    for (const slot of new Set(profile.hardConstraints.requiredSlots)) {
      const requiredCount = profile.hardConstraints.requiredSlots.filter((required) => required === slot).length;
      const actualCount = day.meals.filter((meal) => meal.slot === slot).length;
      if (actualCount !== requiredCount) violations.push({ day: day.day, code: "missing_slot", message: `Expected ${requiredCount} ${slot} slot(s), found ${actualCount}.` });
    }
    for (const meal of day.meals) {
      if (meal.recipeServings <= 0 || meal.nutritionPortionMultiplier <= 0 || meal.householdPortionMultiplier !== profile.householdSize || meal.servings !== meal.recipeServings * meal.nutritionPortionMultiplier * meal.householdPortionMultiplier) {
        violations.push({ day: day.day, code: "hard_constraint_violation", message: `Invalid serving materialization for ${meal.candidateId}.` });
      }
    }
    let meals = [...day.meals];
    for (let attempt = 0; attempt <= profile.policy.repair.maxAttempts; attempt += 1) {
      const currentViolations = violationFor(day.day, totalsFor(meals), profile);
      if (!currentViolations.length) return { ...day, meals };
      if (attempt === profile.policy.repair.maxAttempts) {
        violations.push(...currentViolations, { day: day.day, code: "repair_exhausted", message: "Bounded nutrition repair could not meet daily bands." });
        return { ...day, meals };
      }
      const factor = portionFactor(totalsFor(meals), profile);
      if (factor === null) {
        violations.push(...currentViolations, { day: day.day, code: "repair_exhausted", message: "No safe individual portion adjustment can meet both daily bands." });
        return { ...day, meals };
      }
      meals = meals.map((meal) => materialize(meal, profile, meal.nutritionPortionMultiplier * factor));
    }
    return { ...day, meals };
  });
  return violations.length ? { ok: false, error: { code: "invalid_week", violations } } : { ok: true, value: { days: repairedDays } };
};
