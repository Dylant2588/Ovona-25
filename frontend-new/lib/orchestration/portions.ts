import type { PlannerProfile, VerifiedCandidateMeal } from "./types.ts";

export type PortionLimit = { amounts: readonly number[]; max: number };
const MIN = 0.7, MAX = 1.5;

/** Bounded convex projection for independent meal portions. The calorie and
 * protein targets constrain the day; they do not require every meal to scale
 * by the same factor. All returned values are checked again after rounding. */
export function solveMealPortions(profile: PlannerProfile, meals: readonly VerifiedCandidateMeal[], limits: readonly PortionLimit[] = []): number[] | null {
  if (!meals.length || meals.length > 8) return null;
  const calories = meals.map(m => m.nutrition.calories), protein = meals.map(m => m.nutrition.protein);
  if (![...calories, ...protein].every(v => Number.isFinite(v) && v >= 0)) return null;
  if (limits.some(l => l.amounts.length !== meals.length || !Number.isFinite(l.max) || l.max < 0 || l.amounts.some(v => !Number.isFinite(v) || v < 0))) return null;
  const cMin = profile.calorieTarget * profile.hardConstraints.calorieBand.min;
  const cMax = profile.calorieTarget * profile.hardConstraints.calorieBand.max;
  const pMin = profile.proteinTarget * profile.hardConstraints.proteinBand.min;
  const pMax = profile.proteinTarget * profile.hardConstraints.proteinBand.max;
  // Exact continuous-knapsack upper bounds cheaply reject impossible meal
  // combinations before iterative projection. Relaxing the other constraints
  // makes these safe bounds, never a reason to reject a feasible combination.
  const upperBound = (reward: readonly number[], cost: readonly number[], budget: number) => {
    let remaining = budget - cost.reduce((s, v) => s + v * MIN, 0);
    if (remaining < -1e-7) return -Infinity;
    let total = reward.reduce((s, v) => s + v * MIN, 0);
    const order = reward.map((_, i) => i).sort((a, b) => (cost[b] === 0 ? Infinity : reward[b] / cost[b]) - (cost[a] === 0 ? Infinity : reward[a] / cost[a]));
    for (const i of order) {
      const delta = cost[i] === 0 ? MAX - MIN : Math.min(MAX - MIN, Math.max(0, remaining) / cost[i]);
      total += reward[i] * delta; remaining -= cost[i] * delta;
    }
    return total;
  };
  if (upperBound(protein, calories, cMax) < pMin - 1e-7 || upperBound(calories, protein, pMax) < cMin - 1e-7 ||
      limits.some(limit => upperBound(protein, limit.amounts, limit.max) < pMin - 1e-7 || upperBound(calories, limit.amounts, limit.max) < cMin - 1e-7)) return null;
  const dot = (a: readonly number[], x: readonly number[]) => a.reduce((s, v, i) => s + v * x[i], 0);
  const roundedOkay = (x: readonly number[]) => {
    const c = meals.reduce((s, m, i) => s + Math.round(m.nutrition.calories * x[i]), 0);
    const p = meals.reduce((s, m, i) => s + Math.round(m.nutrition.protein * x[i]), 0);
    return c >= cMin && c <= cMax && p >= pMin && p <= pMax;
  };
  // Tight high-protein targets may have room for a calorie rounding margin
  // but not for simultaneous protein headroom (or vice versa).
  for (const [calorieMargin, proteinMargin] of [[0.51, 0.51], [0.51, 0], [0, 0.51], [0, 0]]) {
    const cm = Math.min(meals.length * calorieMargin, (cMax - cMin) / 4);
    const pm = Math.min(meals.length * proteinMargin, (pMax - pMin) / 4);
    const constraints = [
      { amounts: calories, max: cMax - cm }, { amounts: calories.map(v => -v), max: -(cMin + cm) },
      { amounts: protein, max: pMax - pm }, { amounts: protein.map(v => -v), max: -(pMin + pm) }, ...limits,
    ].map(l => ({ ...l, norm: l.amounts.reduce((s, v) => s + v * v, 0) }));
    if (constraints.some(l => dot(l.amounts, l.amounts.map(v => v >= 0 ? MIN : MAX)) > l.max + 1e-7)) continue;
    let x = meals.map(() => 1);
    const corrections = Array.from({ length: constraints.length + 1 }, () => meals.map(() => 0));
    for (let iteration = 0; iteration < 180; iteration++) {
      for (let j = 0; j <= constraints.length; j++) {
        const y = x.map((v, i) => v + corrections[j][i]);
        let next: number[];
        if (j === constraints.length) next = y.map(v => Math.min(MAX, Math.max(MIN, v)));
        else {
          const l = constraints[j], excess = dot(l.amounts, y) - l.max;
          next = excess > 0 && l.norm > 0 ? y.map((v, i) => v - excess / l.norm * l.amounts[i]) : y;
        }
        corrections[j] = y.map((v, i) => v - next[i]); x = next;
      }
      const result = x.map(v => Number(v.toFixed(6)));
      if (result.every(v => v >= MIN && v <= MAX) && constraints.every(l => dot(l.amounts, result) <= l.max + 1e-7) && roundedOkay(result)) return result;
    }
  }
  return null;
}
