import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAuth } from "@/lib/serverAuth";
import { recordRejectedMealHistory } from "@/lib/generation/meal-storage";

const reasons = new Set(["not_interested", "too_time_consuming", "ingredient_dislike", "other"]);

export async function POST(request: NextRequest) {
  let body: { weekStart?: string; mealInstanceId?: string; reason?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (!body.weekStart || !body.mealInstanceId || !body.reason || !reasons.has(body.reason)) {
    return NextResponse.json({ error: "A week, meal, and valid reason are required." }, { status: 400 });
  }
  const { supabase, user, status } = await resolveRequestAuth(request);
  if (status === "transient") return NextResponse.json({ error: "auth unavailable" }, { status: 503 });
  if (status === "unauthorized" || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("plan_history").select("date, meals").eq("user_id", user.id).eq("week_start", body.weekStart);
  if (error) return NextResponse.json({ error: "Unable to verify the saved meal." }, { status: 500 });
  let found: { date: string; meal: unknown } | null = null;
  for (const row of data ?? []) {
    const payload = row.meals as { meals?: Array<{ instanceId?: string }> } | null;
    const meal = payload?.meals?.find((candidate) => candidate?.instanceId === body.mealInstanceId);
    if (meal && typeof row.date === "string") { found = { date: row.date, meal }; break; }
  }
  if (!found) return NextResponse.json({ error: "That meal is no longer in your saved plan." }, { status: 404 });
  try {
    await recordRejectedMealHistory(user.id, found.date, found.meal, body.reason, supabase as never);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[meal-feedback/reject]", error);
    return NextResponse.json({ error: "Unable to save this meal feedback." }, { status: 500 });
  }
}
