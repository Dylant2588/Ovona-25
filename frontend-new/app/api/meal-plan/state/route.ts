import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  WORKDAY_COUNT,
  type MacroBreakdown,
  type WeeklyMealPlan,
} from "@/lib/meal-generator";
import type { EnforcementInfo } from "@/lib/macro-enforcement";

type StoredDay = {
  id: string;
  label: string;
  date: string;
  meals: WeeklyMealPlan["days"][number]["meals"];
  totals: MacroBreakdown;
  preferenceSignature?: string | null;
  enforcement?: EnforcementInfo | null;
};

const toISODate = (value: string) =>
  new Date(value).toISOString().split("T")[0];

const sumMacros = (items: MacroBreakdown[]): MacroBreakdown =>
  items.reduce(
    (acc, item) => ({
      calories: acc.calories + (item?.calories ?? 0),
      protein: acc.protein + (item?.protein ?? 0),
      carbs: acc.carbs + (item?.carbs ?? 0),
      fat: acc.fat + (item?.fat ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

export async function GET(request: NextRequest) {
  const weekStartParam = request.nextUrl.searchParams.get("weekStart");
  if (!weekStartParam) {
    return NextResponse.json(
      { error: "weekStart required" },
      { status: 400 }
    );
  }

  const weekStart = toISODate(weekStartParam);
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("plan_history")
    .select("plan_id, day_id, meals, date, week_start, created_at")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .order("date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const dayRows = (data ?? [])
    .filter((row) => row.day_id !== "shopping-list")
    .slice(0, WORKDAY_COUNT);

  if (!dayRows.length) {
    return NextResponse.json(
      { error: "no plan stored for week" },
      { status: 404 }
    );
  }

  const days: WeeklyMealPlan["days"] = dayRows.map((row) => {
    const payload = (row.meals as StoredDay | null) ?? null;
    return {
      id: payload?.id ?? row.day_id,
      label:
        payload?.label ??
        new Date(row.date).toLocaleDateString("en-US", {
          weekday: "long",
        }),
      date:
        payload?.date ??
        new Date(row.date).toISOString(),
      meals: payload?.meals ?? [],
      totals:
        payload?.totals ??
        sumMacros(
          (payload?.meals ?? []).map(
            (meal) => meal.macros as MacroBreakdown
          )
        ),
    };
  });

  const weeklyTotals = sumMacros(days.map((day) => day.totals));
  const firstDayPayload = (dayRows[0]?.meals as StoredDay | null) ?? null;
  const plan: WeeklyMealPlan = {
    id: dayRows[0]?.plan_id ?? `plan-${weekStart}`,
    userId: user.id,
    weekStart: new Date(weekStart).toISOString(),
    generatedAt:
      dayRows[0]?.created_at ?? new Date().toISOString(),
    preferenceSignature:
      (firstDayPayload?.preferenceSignature as string | null) ??
      "",
    days,
    weeklyTotals,
  };

  return NextResponse.json({
    plan,
    source: "storage",
    enforcement: firstDayPayload?.enforcement ?? null,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { weekStart, plan, enforcement } = body as {
    weekStart?: string;
    plan?: WeeklyMealPlan;
    enforcement?: EnforcementInfo | null;
  };

  if (!plan) {
    return NextResponse.json(
      { error: "plan is required" },
      { status: 400 }
    );
  }

  const effectiveWeekStart = toISODate(
    weekStart ?? plan.weekStart
  );
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const planId = plan.id ?? `plan-${effectiveWeekStart}`;
  const persistedDays = (plan.days ?? []).slice(0, WORKDAY_COUNT);
  const persistedTotals = sumMacros(
    persistedDays.map((day) => day.totals as MacroBreakdown)
  );

  const rows = persistedDays.map((day) => ({
    user_id: user.id,
    plan_id: planId,
    day_id: day.id,
    date: toISODate(day.date),
    week_start: effectiveWeekStart,
    meals: {
      id: day.id,
      label: day.label,
      date: day.date,
      meals: day.meals,
      totals: day.totals,
      preferenceSignature: plan.preferenceSignature ?? null,
      enforcement: enforcement ?? null,
    },
  }));

  // replace existing rows for the week to keep latest swaps/portions
  await supabase
    .from("plan_history")
    .delete()
    .eq("user_id", user.id)
    .eq("week_start", effectiveWeekStart);

  if (rows.length) {
    const { error } = await supabase
      .from("plan_history")
      .insert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  await supabase.from("meal_plans").upsert(
    {
      user_id: user.id,
      name:
        (plan as WeeklyMealPlan & { name?: string }).name ??
        `Week of ${effectiveWeekStart}`,
      week_start_date: effectiveWeekStart,
      total_calories: persistedTotals.calories ?? null,
    },
    { onConflict: "user_id,week_start_date" }
  );

  return NextResponse.json({ ok: true });
}
