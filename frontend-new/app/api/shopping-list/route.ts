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

const shoppingListResponse = async (items: ShoppingListItem[], supabase: Awaited<ReturnType<typeof resolveRequestAuth>>["supabase"], userId: string) => {
  const [observationResponse, preferenceResponse] = await Promise.all([
    supabase.from("retailer_price_observations").select("retailer_id, retailer_name, ingredient_key, pack_size, pack_unit, unit_price, currency, estimated, source_reference, provenance_status, observed_at"),
    supabase.from("user_preferences").select("weekly_budget").eq("user_id", userId).maybeSingle(),
  ]);
  const comparison = observationResponse.error
    ? { status: "price_comparison_unavailable" as const, claimable: false as const, reasons: ["price_observations_unavailable"], unmatchedItems: [] }
    : compareRetailerBaskets(items, (observationResponse.data ?? []).map((row) => toObservation(row as Record<string, unknown>)).filter((row): row is RetailerObservation => row !== null), Number(preferenceResponse.data?.weekly_budget));
  return NextResponse.json({
    items,
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
    .select("meals")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .eq("day_id", "shopping-list")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items =
    (data?.meals as { items?: ShoppingListItem[] } | null)?.items ?? [];

  return shoppingListResponse(items, supabase, user.id);
}

export async function POST(request: NextRequest) {
  let body: { weekStart?: string; plan?: WeeklyMealPlan; locale?: string };
  try {
    body = (await request.json()) as {
      weekStart?: string;
      plan?: WeeklyMealPlan;
      locale?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { weekStart, plan, locale = "UK" } = body as {
    weekStart?: string;
    plan?: WeeklyMealPlan;
    locale?: string;
  };

  if (!plan) {
    return NextResponse.json(
      { error: "plan is required" },
      { status: 400 }
    );
  }

  const { supabase, session, user } = await resolveRequestAuth(request);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!session) {
    console.warn("[shopping-list] using bearer fallback auth");
  }

  const rawWeekStart = weekStart ?? plan.weekStart;
  if (!rawWeekStart) {
    return NextResponse.json(
      { error: "weekStart or plan.weekStart is required" },
      { status: 400 }
    );
  }
  let effectiveWeekStart: string;
  try {
    effectiveWeekStart = toISODate(rawWeekStart);
  } catch {
    return NextResponse.json({ error: "invalid weekStart" }, { status: 400 });
  }
  const workweekPlan: WeeklyMealPlan = {
    ...plan,
    days: (plan.days ?? []).slice(0, WORKDAY_COUNT),
  };
  const normalized = buildShoppingList(workweekPlan);

  await supabase
    .from("plan_history")
    .delete()
    .eq("user_id", user.id)
    .eq("week_start", effectiveWeekStart)
    .eq("day_id", "shopping-list");

  const { error } = await supabase.from("plan_history").insert({
    user_id: user.id,
    plan_id: plan.id ?? `plan-${effectiveWeekStart}`,
    day_id: "shopping-list",
    date: effectiveWeekStart,
    week_start: effectiveWeekStart,
    meals: { items: normalized, locale },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return shoppingListResponse(normalized, supabase, user.id);
}
