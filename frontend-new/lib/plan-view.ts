import type { WeeklyMealPlan } from "./meal-generator.ts";
import { parsePlanScope, planAnchor, planDayCount, type PlanScope } from "./plan-scope.ts";

/** A cache or response must belong to the requested owner and complete period. */
export function matchesPlanPeriod(plan: WeeklyMealPlan | null | undefined, owner: string, scope: PlanScope, anchor: string): boolean {
  try {
    return !!plan && plan.userId === owner && parsePlanScope(plan.scope) === scope &&
      plan.days.length === planDayCount(scope) && planAnchor(scope, plan.weekStart) === anchor &&
      plan.days.every((day, index) => day.date.slice(0, 10) === new Date(Date.parse(`${anchor}T00:00:00Z`) + index * 86400000).toISOString().slice(0, 10));
  } catch { return false; }
}
