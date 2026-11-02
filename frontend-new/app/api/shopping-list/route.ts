import { NextRequest, NextResponse } from "next/server";
import {
  buildShoppingList,
  WORKDAY_COUNT,
  type ShoppingListItem,
  type WeeklyMealPlan,
} from "@/lib/meal-generator";
import { compareRetailerBaskets, type RetailerObservation } from "@/lib/retailer-comparison";
import { resolveRequestAuth } from "@/lib/serverAuth";

const toISODate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("invalid date");
  }
  return parsed.toISOString().split("T")[0];
};

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && !!value.trim();

/** Validate the materialized ingredient contract without re-scaling or inventing recipe data. */
const completeDays = (value: unknown, weekStart: string): value is WeeklyMealPlan["days"] => {
  if (!Array.isArray(value) || value.length !== WORKDAY_COUNT) return false;
  const dayIds = new Set<string>();
  const dates = new Set<string>();
  for (const day of value) {
    if (!object(day) || !text(day.id) || dayIds.has(day.id) || !text(day.date) || !Array.isArray(day.meals) || !day.meals.length || day.meals.length > 12) return false;
    let date: string;
    try { date = toISODate(day.date); } catch { return false; }
    const index = Math.round((new Date(date).getTime() - new Date(weekStart).getTime()) / 86400000);
    if (index < 0 || index >= WORKDAY_COUNT || dates.has(date)) return false;
    dates.add(date); dayIds.add(day.id);
    for (const meal of day.meals) {
      if (!object(meal)) return false;
      if (meal.mealKind === "social") continue;
      if (!Array.isArray(meal.ingredients) || !meal.ingredients.length || meal.ingredients.length > 200 || meal.ingredients.some(i =>
        !object(i) || !text(i.name) || !text(i.unit) || typeof i.amount !== "number" || !Number.isFinite(i.amount) || i.amount < 0)) return false;
    }
  }
  return true;
};

const toObservation = (row: Record<string, unknown>): RetailerObservation | null => {
  const text = (value: unknown) => typeof value === "string" ? value : "";
  const number = (value: unknown) => typeof value === "number" ? value : Number(value);
  const provenance = text(row.provenance_status);
  if (provenance !== "operator_imported" && provenance !== "licensed_feed") return null;
  return {
    retailerId: text(row.retailer_id), retailerName: text(row.retailer_name), ingredientKey: text(row.ingredient_key),
    packSize: number(row.pack_size), packUnit: text(row.pack_unit), unitPrice: number(row.unit_price), currency: text(row.currency),
    estimated: row.estimated === true, sourceReference: text(row.source_reference), provenanceStatus: provenance, observedAt: text(row.observed_at),
  };
};

const shoppingListResponse = async (
  items: ShoppingListItem[],
  supabase: Awaited<ReturnType<typeof resolveRequestAuth>>["supabase"],
  userId: string,
  planId?: string
) => {
  const [observationResponse, preferenceResponse] = await Promise.all([
    supabase.from("retailer_price_observations").select("retailer_id, retailer_name, ingredient_key, pack_size, pack_unit, unit_price, currency, estimated, source_reference, provenance_status, observed_at"),
    supabase.from("user_preferences").select("weekly_budget").eq("user_id", userId).maybeSingle(),
  ]);
  const comparison = observationResponse.error
    ? { status: "price_comparison_unavailable" as const, claimable: false as const, reasons: ["price_observations_unavailable"], unmatchedItems: [] }
    : compareRetailerBaskets(items, (observationResponse.data ?? []).map((row) => toObservation(row as Record<string, unknown>)).filter((row): row is RetailerObservation => row !== null), Number(preferenceResponse.data?.weekly_budget));
  return NextResponse.json({
    items,
    planId: planId ?? null,
    priceComparison: comparison,
  });
};

export async function GET(request: NextRequest) {
  const weekStartParam = request.nextUrl.searchParams.get("weekStart");
  if (!weekStartParam) {
    return NextResponse.json(
      { error: "weekStart required" },
      { status: 400 }
    );
  }
  let weekStart: string;
  try {
    weekStart = toISODate(weekStartParam);
  } catch {
    return NextResponse.json({ error: "invalid weekStart" }, { status: 400 });
  }
  const { supabase, session, user } = await resolveRequestAuth(request);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!session) {
    console.warn("[shopping-list] using bearer fallback auth");
  }

  const { data, error } = await supabase
    .from("plan_history")
    .select("meals,plan_id,day_id,date,created_at")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // A shopping cache is not authoritative: it may belong to an earlier plan
  // or a late request. Rebuild only from the latest owner's actual meal rows.
  const mealRows = (data ?? []).filter(row => row.day_id !== "shopping-list" && row.day_id !== "alternatives");
  if (!mealRows.length) return NextResponse.json({ error: "no_plan_for_week" }, { status: 404 });
  const planId = mealRows[0].plan_id;
  const days = mealRows.filter(row => row.plan_id === planId)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map(row => object(row.meals) ? { ...row.meals, id: row.day_id, date: row.date } : null);
  if (!text(planId) || !completeDays(days, weekStart)) {
    return NextResponse.json({ error: "incomplete_stored_plan", message: "A complete current week is required to build its shopping list." }, { status: 409 });
  }
  const plan = { id: planId, userId: user.id, weekStart, days } as WeeklyMealPlan;
  return shoppingListResponse(buildShoppingList(plan), supabase, user.id, planId);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!object(body) || !object(body.plan)) {
    return NextResponse.json(
      { error: "plan is required" },
      { status: 400 }
    );
  }
  const { plan, weekStart } = body;

  const { supabase, session, user } = await resolveRequestAuth(request);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!text(plan.userId) || !text(plan.id)) return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  if (plan.userId !== user.id) return NextResponse.json({ error: "plan_owner_mismatch" }, { status: 403 });
  if (!session) {
    console.warn("[shopping-list] using bearer fallback auth");
  }

  const rawWeekStart = weekStart ?? plan.weekStart;
  if (!text(rawWeekStart) || !text(plan.weekStart)) {
    return NextResponse.json(
      { error: "weekStart or plan.weekStart is required" },
      { status: 400 }
    );
  }
  let effectiveWeekStart: string;
  try {
    effectiveWeekStart = toISODate(rawWeekStart);
    if (toISODate(plan.weekStart) !== effectiveWeekStart) throw new Error("week mismatch");
  } catch {
    return NextResponse.json({ error: "invalid weekStart" }, { status: 400 });
  }
  if (!completeDays(plan.days, effectiveWeekStart)) return NextResponse.json({ error: "invalid_plan", message: "A complete week with valid final ingredient quantities is required." }, { status: 400 });
  // POST is an ephemeral projection of the caller's current plan. It must not
  // persist a second independently writable source of shopping quantities.
  return shoppingListResponse(buildShoppingList(plan as unknown as WeeklyMealPlan), supabase, user.id, plan.id);
}
