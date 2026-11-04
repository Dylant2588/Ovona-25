import type { WeeklyMealPlan } from "./meal-generator.ts";
import { parsePlanScope, planDayCount, strictPlanDate, type PlanScope } from "./plan-scope.ts";

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export function revisionRows(plan: WeeklyMealPlan, owner: string, revision: string, anchor: string, enforcement: unknown = null) {
  return plan.days.map((day, index) => ({ user_id: owner, plan_id: revision, day_id: `${revision}:${index}`, date: strictPlanDate(day.date), week_start: anchor,
    meals: { ...day, planScope: parsePlanScope(plan.scope), revisionId: revision, planAnchor: anchor, preferenceSignature: plan.preferenceSignature, generatedAt: plan.generatedAt, enforcement } }));
}

/** Input is newest-first. A partial insert can never shadow an older complete revision. */
export function selectPlanRevision(rows: readonly unknown[], owner: string, scope: PlanScope, anchor: string): WeeklyMealPlan | null {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    if (!object(row) || typeof row.plan_id !== "string" || !object(row.meals) || !Array.isArray(row.meals.meals) ||
      (row.user_id !== undefined && row.user_id !== owner) || (row.week_start !== undefined && row.week_start !== anchor) ||
      (row.meals.planScope ?? "week") !== scope || ["shopping-list", "alternatives"].includes(String(row.day_id))) continue;
    const group = groups.get(row.plan_id) ?? []; group.push(row); groups.set(row.plan_id, group);
  }
  for (const [id, group] of groups) {
    if (group.length !== planDayCount(scope)) continue;
    group.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const payloads = group.map(row => row.meals as Record<string, unknown>);
    if (new Set(group.map(row => row.day_id)).size !== group.length || new Set(payloads.map(p => p.id)).size !== group.length) continue;
    try {
      if (group.some((row, index) => strictPlanDate(String(row.date)) !== new Date(Date.parse(anchor) + index * 86400000).toISOString().slice(0, 10))) continue;
      if (payloads.some((p, index) => !Array.isArray(p.meals) || !p.meals.length || !p.id ||
        (p.date !== undefined && strictPlanDate(String(p.date)) !== strictPlanDate(String(group[index].date))) ||
        (p.revisionId !== undefined && p.revisionId !== id) || (p.planAnchor !== undefined && p.planAnchor !== anchor))) continue;
      const days = payloads.map((p, index) => ({ ...p, date: String(group[index].date), id: String(p.id) })) as WeeklyMealPlan["days"];
      const totals = days.reduce((sum, day) => { for (const k of ["calories", "protein", "carbs", "fat"] as const) sum[k] += Number(day.totals?.[k] ?? 0); return sum; }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
      return { id, userId: owner, scope, weekStart: anchor, days, weeklyTotals: totals,
        preferenceSignature: String(payloads[0].preferenceSignature ?? ""), generatedAt: String(payloads[0].generatedAt ?? group[0].created_at ?? anchor) };
    } catch { /* malformed groups cannot become active */ }
  }
  return null;
}

type HistoryResult = { data: unknown[] | null; error: { message: string } | null };
type HistoryQuery = PromiseLike<HistoryResult> & { eq(key: string, value: string): HistoryQuery; order(key: string, options: { ascending: boolean }): HistoryQuery; range(from: number, to: number): HistoryQuery };
export type HistoryReader = { from(table: string): { select(columns: string): HistoryQuery } };
/** Page every matching anchor; fixed limits could hide a daily revision behind weekly history. */
export async function readPlanRevisions(database: HistoryReader, owner: string, anchor: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += 200) {
    const result = await database.from("plan_history").select("user_id,plan_id,day_id,date,week_start,meals,created_at")
      .eq("user_id", owner).eq("week_start", anchor).order("created_at", { ascending: false }).order("plan_id", { ascending: false }).range(offset, offset + 199);
    if (result.error) throw new Error(result.error.message);
    const page = result.data ?? []; rows.push(...page);
    if (page.length < 200) return rows;
  }
}
