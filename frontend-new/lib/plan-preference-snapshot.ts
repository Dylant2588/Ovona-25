import type { WeeklyMealPlan } from "./meal-generator.ts";

/** Persistence and the browser cache must identify the same preference snapshot. */
export function planForPreferenceSnapshot(plan: WeeklyMealPlan, signature: string | null | undefined): WeeklyMealPlan {
  return signature ? { ...plan, preferenceSignature: signature } : plan;
}
