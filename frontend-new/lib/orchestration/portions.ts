import type { PlannerProfile, VerifiedCandidateMeal } from "./types.ts";

export type PortionLimit = { amounts: readonly number[]; max: number };
export type PortionOptions = {
  bounds?: readonly { min: number; max: number }[];
  /** A scheduler may stop work sooner; this cannot increase the solver budget. */
  canContinue?: () => boolean;
};
const MIN = 0.7, MAX = 1.5;
type PortionMeal = Pick<VerifiedCandidateMeal, "nutrition">;

/** Bounded calorie-directed half-space projection. Non-convergence is not a
 * proof of infeasibility; tighter probes never discard a verified fallback. */
export function solveMealPortions(profile: PlannerProfile, meals: readonly PortionMeal[], limits: readonly PortionLimit[] = [], options: PortionOptions = {}): number[] | null {
  if (!meals.length || meals.length > 8) return null;
  const calories = meals.map(m => m.nutrition.calories), protein = meals.map(m => m.nutrition.protein);
  if (![...calories, ...protein].every(v => Number.isFinite(v) && v >= 0)) return null;
  if (limits.some(l => l.amounts.length !== meals.length || !Number.isFinite(l.max) || l.max < 0 || l.amounts.some(v => !Number.isFinite(v) || v < 0))) return null;
  const bounds = options.bounds ?? meals.map(() => ({ min: MIN, max: MAX }));
  if (bounds.length !== meals.length || bounds.some(b => !Number.isFinite(b.min) || !Number.isFinite(b.max) || b.min < MIN || b.max > MAX || b.min > b.max)) return null;
  const cMin = profile.calorieTarget * profile.hardConstraints.calorieBand.min, cMax = profile.calorieTarget * profile.hardConstraints.calorieBand.max;
  const pMin = profile.proteinTarget * profile.hardConstraints.proteinBand.min, pMax = profile.proteinTarget * profile.hardConstraints.proteinBand.max;
  const dot = (a: readonly number[], x: readonly number[]) => a.reduce((s, v, i) => s + v * x[i], 0);
  const total = (a: readonly number[], x: readonly number[]) => a.reduce((s, v, i) => s + Math.round(v * x[i]), 0);
  const error = (x: readonly number[]) => Math.abs(total(calories, x) - profile.calorieTarget);
  const materialize = (x: readonly number[]) => x.map((v, i) => bounds[i].min === bounds[i].max ? bounds[i].min : Number(v.toFixed(6)));
  const original = [
    { amounts: calories, max: cMax }, { amounts: calories.map(v => -v), max: -cMin },
    { amounts: protein, max: pMax }, { amounts: protein.map(v => -v), max: -pMin }, ...limits,
  ];
  const valid = (x: readonly number[]) => x.every((v, i) => Number.isFinite(v) && v >= bounds[i].min && v <= bounds[i].max) &&
    original.every(l => dot(l.amounts, x) <= l.max + 1e-7) &&
    total(calories, x) >= cMin && total(calories, x) <= cMax && total(protein, x) >= pMin && total(protein, x) <= pMax;
  // Relaxed continuous-knapsack bounds reject impossible combinations cheaply.
  const upperBound = (reward: readonly number[], cost: readonly number[], budget: number) => {
    let remaining = budget - cost.reduce((s, v, i) => s + v * bounds[i].min, 0);
    if (remaining < -1e-7) return -Infinity;
    let sum = reward.reduce((s, v, i) => s + v * bounds[i].min, 0);
    const order = reward.map((_, i) => i).sort((a, b) => (cost[b] === 0 ? Infinity : reward[b] / cost[b]) - (cost[a] === 0 ? Infinity : reward[a] / cost[a]));
    for (const i of order) {
      const delta = cost[i] === 0 ? bounds[i].max - bounds[i].min : Math.min(bounds[i].max - bounds[i].min, Math.max(0, remaining) / cost[i]);
      sum += reward[i] * delta; remaining -= cost[i] * delta;
    }
    return sum;
  };
  if (upperBound(protein, calories, cMax) < pMin - 1e-7 || upperBound(calories, protein, pMax) < cMin - 1e-7 ||
      limits.some(l => upperBound(protein, l.amounts, l.max) < pMin - 1e-7 || upperBound(calories, l.amounts, l.max) < cMin - 1e-7)) return null;

  const project = (lo: number, hi: number, start: readonly number[]): number[] | null => {
    if (lo > hi) return null;
    // The same relaxed bounds apply to each narrower objective interval. Do
    // not spend projection iterations when even the relaxation cannot fit.
    if (upperBound(protein, calories, hi) < pMin - 1e-7 || upperBound(calories, protein, pMax) < lo - 1e-7) return null;
    for (const [calorieMargin, proteinMargin] of [[0.51, 0.51], [0.51, 0], [0, 0.51], [0, 0]]) {
      const cm = Math.min(meals.length * calorieMargin, (hi - lo) / 4), pm = Math.min(meals.length * proteinMargin, (pMax - pMin) / 4);
      if (upperBound(protein, calories, hi - cm) < pMin + pm - 1e-7 || upperBound(calories, protein, pMax - pm) < lo + cm - 1e-7) continue;
      const constraints = [
        { amounts: calories, max: hi - cm }, { amounts: calories.map(v => -v), max: -(lo + cm) },
        { amounts: protein, max: pMax - pm }, { amounts: protein.map(v => -v), max: -(pMin + pm) }, ...limits,
      ].map(l => ({ ...l, norm: dot(l.amounts, l.amounts) }));
      if (constraints.some(l => dot(l.amounts, l.amounts.map((v, i) => v >= 0 ? bounds[i].min : bounds[i].max)) > l.max + 1e-7)) continue;
      let x = start.map((v, i) => Math.min(bounds[i].max, Math.max(bounds[i].min, v)));
      const corrections = Array.from({ length: constraints.length + 1 }, () => meals.map(() => 0));
      for (let iteration = 0; iteration < 180; iteration++) {
        if (options.canContinue && !options.canContinue()) return null;
        for (let j = 0; j <= constraints.length; j++) {
          const y = x.map((v, i) => v + corrections[j][i]);
          let next: number[];
          if (j === constraints.length) next = y.map((v, i) => Math.min(bounds[i].max, Math.max(bounds[i].min, v)));
          else {
            const l = constraints[j], excess = dot(l.amounts, y) - l.max;
            next = excess > 0 && l.norm > 0 ? y.map((v, i) => v - excess / l.norm * l.amounts[i]) : y;
          }
          corrections[j] = y.map((v, i) => v - next[i]); x = next;
        }
        const result = materialize(x);
        if (valid(result) && constraints.every(l => dot(l.amounts, result) <= l.max + 1e-7)) return result;
      }
    }
    return null;
  };
  // Per-meal rounding differs from the continuous sum. Cross only nearby
  // rounding thresholds and verify every original constraint after each move.
  const polish = (initial: number[]) => {
    let best = initial;
    for (let pass = 0; pass < meals.length * 2 && error(best) > 0; pass++) {
      let improved = false;
      for (let i = 0; i < meals.length; i++) {
        if (!calories[i] || bounds[i].min === bounds[i].max) continue;
        const direction = Math.sign(profile.calorieTarget - total(calories, best));
        const nextMacro = Math.round(calories[i] * best[i]) + direction;
        const threshold = (nextMacro - direction * .499999) / calories[i];
        const next = [...best];
        next[i] = direction > 0 ? Math.ceil(threshold * 1e6) / 1e6 : Math.floor(threshold * 1e6) / 1e6;
        if (valid(next) && error(next) < error(best)) { best = next; improved = true; }
      }
      if (!improved) break;
    }
    return best;
  };
  const start = meals.map(() => 1);
  const exact = project(profile.calorieTarget, profile.calorieTarget, start);
  let best = exact ? polish(exact) : null;
  if (best && error(best) === 0) return best;
  const fallback = project(cMin, cMax, start);
  if (fallback) {
    const candidate = polish(fallback);
    if (!best || error(candidate) < error(best)) best = candidate;
  }
  if (!best) return null;
  // These finite probes return the nearest verified point found, not a global
  // optimum certificate or a proof that an exact target is infeasible.
  let low = 0, high = Math.max(Math.abs(dot(calories, best) - profile.calorieTarget), error(best)) + meals.length * .51;
  for (let probe = 0; probe < 12 && error(best) > 0; probe++) {
    if (options.canContinue && !options.canContinue()) break;
    const radius = (low + high) / 2;
    const candidate = project(Math.max(cMin, profile.calorieTarget - radius), Math.min(cMax, profile.calorieTarget + radius), best);
    if (candidate) {
      high = radius;
      const improved = polish(candidate);
      if (error(improved) < error(best)) best = improved;
    } else low = radius;
  }
  return best;
}
