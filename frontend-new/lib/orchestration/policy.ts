import type { PlannerPolicy } from "./types.ts";

export const DEFAULT_PLANNER_POLICY: Readonly<PlannerPolicy> = Object.freeze({
  calorieBand: Object.freeze({ min: 0.95, max: 1.08 }),
  proteinBand: Object.freeze({ min: 0.98, max: 1.1 }),
  scoreWeights: Object.freeze({ nutrition: 40, preference: 20, reuse: 15, prep: 10, cost: 10, repetition: 5 }),
  repair: Object.freeze({ maxAttempts: 3 }),
  repetition: Object.freeze({ maxUsesPerWeek: 2 }),
  calorieTargetRange: Object.freeze({ min: 800, max: 6000 }),
  proteinTargetRange: Object.freeze({ min: 20, max: 400 }),
  maxPrepMinutes: 240,
  maxHouseholdSize: 20,
});
