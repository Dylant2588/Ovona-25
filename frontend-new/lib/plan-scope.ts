export type PlanScope = "day" | "week";
export function parsePlanScope(value: unknown): PlanScope {
  if (value === undefined || value === "week") return "week";
  if (value === "day") return "day";
  throw Object.assign(new Error("Choose day or week planning scope."), { statusCode: 400, code: "invalid_plan_scope" });
}
export const planDayCount = (scope: PlanScope) => scope === "day" ? 1 : 7;
export function strictPlanDate(value: string): string {
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(value)) || new Date(date).toISOString().slice(0, 10) !== date) {
    throw Object.assign(new Error("Choose a valid calendar date."), { statusCode: 400, code: "invalid_plan_date" });
  }
  return date;
}
export function planAnchor(scope: PlanScope, value: string): string {
  const date = new Date(`${strictPlanDate(value)}T00:00:00Z`);
  if (scope === "week") date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
export const planCacheKey = (owner: string, scope: PlanScope, anchor: string) => `ovona-plan:${owner}:${scope}:${planAnchor(scope, anchor)}`;
