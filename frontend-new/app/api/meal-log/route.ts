import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAuth } from "@/lib/serverAuth";
import type { MealLogStatus } from "@/lib/meal-logs";
import { recordEatenMealHistory } from "@/lib/generation/meal-storage";

const mealLogStatuses = new Set<MealLogStatus>(["planned", "eaten", "skipped", "swapped"]);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { mealInstanceId, date, status, notes } = body as {
    mealInstanceId?: string;
    date?: string;
    status?: string;
    notes?: string | null;
  };

  if (
    typeof mealInstanceId !== "string" ||
    !mealInstanceId.trim() ||
    typeof date !== "string" ||
    !datePattern.test(date) ||
    Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
    typeof status !== "string" ||
    !mealLogStatuses.has(status as MealLogStatus) ||
    (notes !== undefined && notes !== null && typeof notes !== "string")
  ) {
    return NextResponse.json(
      { error: "Provide a meal instance, ISO date, and supported status" },
      { status: 400 }
    );
  }

  const { supabase, session, user } = await resolveRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!session) {
    console.warn("[meal-log] using bearer fallback auth");
  }

  const { error } = await supabase
    .from("meal_logs")
    .upsert(
      {
        user_id: user.id,
        meal_instance_id: mealInstanceId.trim(),
        date,
        status: status as MealLogStatus,
        notes: typeof notes === "string" ? notes.trim() || null : null,
      },
      { onConflict: "user_id,meal_instance_id,date" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (status === "eaten") {
    const { data: days, error: planError } = await supabase
      .from("plan_history")
      .select("meals")
      .eq("user_id", user.id)
      .eq("date", date);
    if (planError) {
      console.error("[meal-log] could not load approved meal for rotation history", planError);
      return NextResponse.json({ ok: true, rotationHistoryRecorded: false });
    }
    const meal = (days ?? []).flatMap((row) => {
      const stored = row.meals as { meals?: Array<{ instanceId?: string }> } | null;
      return stored?.meals ?? [];
    }).find((entry) => entry.instanceId === mealInstanceId.trim());
    if (!meal) {
      console.warn("[meal-log] no approved meal found for eaten rotation history", { mealInstanceId, date });
      return NextResponse.json({ ok: true, rotationHistoryRecorded: false });
    }
    try {
      await recordEatenMealHistory(user.id, date, meal, supabase as never);
    } catch (historyError) {
      console.error("[meal-log] eaten history failed", historyError);
      return NextResponse.json({ ok: true, rotationHistoryRecorded: false });
    }
  }

  return NextResponse.json({ ok: true });
}
