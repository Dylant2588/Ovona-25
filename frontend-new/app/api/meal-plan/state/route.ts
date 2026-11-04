import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { WeeklyMealPlan } from "@/lib/meal-generator";
import { resolveRequestAuth } from "@/lib/serverAuth";
import { writeApprovedPlan, approvalFailure } from "@/lib/recipes/plan-boundary";
import { recordAcceptedMealHistory } from "@/lib/generation/meal-storage";
import { parsePlanScope, strictPlanDate, planAnchor } from "@/lib/plan-scope";
import { readPlanRevisions, selectPlanRevision, revisionRows, type HistoryReader } from "@/lib/plan-revisions";

export async function GET(request: NextRequest) {
  try {
    const scope = parsePlanScope(request.nextUrl.searchParams.get("scope") ?? undefined);
    const raw = request.nextUrl.searchParams.get("weekStart");
    if (!raw) return NextResponse.json({ error: "weekStart required" }, { status: 400 });
    const anchor = strictPlanDate(raw);
    const { supabase, user, status } = await resolveRequestAuth(request);
    if (status === "transient") return NextResponse.json({ error: "auth unavailable" }, { status: 503 });
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const rows = await readPlanRevisions(supabase as unknown as HistoryReader, user.id, anchor);
    const plan = selectPlanRevision(rows, user.id, scope, anchor);
    if (!plan) return NextResponse.json({ error: "no complete plan stored for this scope and date" }, { status: 404 });
    return NextResponse.json({ plan, source: "storage", approval: "unchecked", enforcement: null });
  } catch (error) { const failure = approvalFailure(error); return NextResponse.json(failure.body, { status: failure.status }); }
}

export async function POST(request: NextRequest) {
  let body: { plan?: WeeklyMealPlan; weekStart?: string; enforcement?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (!body || !body.plan) return NextResponse.json({ error: "plan required" }, { status: 400 });
  const { supabase, user, status } = await resolveRequestAuth(request);
  if (status === "transient") return NextResponse.json({ error: "auth unavailable" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const plan = body.plan;
    const scope = parsePlanScope(plan.scope);
    const anchor = strictPlanDate(body.weekStart ?? plan.weekStart);
    if (strictPlanDate(plan.weekStart) !== anchor || planAnchor(scope, anchor) !== anchor) return NextResponse.json({ error: "plan anchor mismatch" }, { status: 400 });
    return await writeApprovedPlan(supabase as never, user.id, plan, async approved => {
      const saved = { ...approved, scope, id: randomUUID() };
      // One complete INSERT is the commit point. Never remove the previous revision.
      const inserted = await supabase.from("plan_history").insert(revisionRows(saved, user.id, saved.id, anchor, body.enforcement));
      if (inserted.error) return NextResponse.json({ error: "plan_save_failed", message: "Couldn't save the replacement. Your previous plan is unchanged." }, { status: 503 });
      const warnings: string[] = [];
      if (scope === "week") {
        try {
          const summary = await supabase.from("meal_plans").upsert({ user_id: user.id, name: `Week of ${anchor}`, week_start_date: anchor, total_calories: saved.weeklyTotals.calories }, { onConflict: "user_id,week_start_date" });
          if (summary.error) warnings.push("summary_not_updated");
        } catch { warnings.push("summary_not_updated"); }
      }
      try { await recordAcceptedMealHistory(user.id, saved, supabase as never); } catch { warnings.push("rotation_history_not_recorded"); }
      return NextResponse.json({ ok: true, plan: saved, warnings });
    });
  } catch (error) { const failure = approvalFailure(error); return NextResponse.json(failure.body, { status: failure.status }); }
}
