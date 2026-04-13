import { NextRequest, NextResponse } from "next/server";
import {
  buildShoppingList,
  WORKDAY_COUNT,
  type ShoppingListItem,
  type WeeklyMealPlan,
} from "@/lib/meal-generator";
import { priceBasket } from "@/lib/tesco-prices";
import { resolveRequestAuth } from "@/lib/serverAuth";

const toISODate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("invalid date");
  }
  return parsed.toISOString().split("T")[0];
};

const shoppingListResponse = (items: ShoppingListItem[]) => {
  let basket:
    | ReturnType<typeof priceBasket>
    | null = null;
  try {
    basket = priceBasket(items);
  } catch (error) {
    console.error("shopping list pricing failed", error);
  }
  return NextResponse.json({
    items,
    pricing: {
      subtotal: basket?.subtotal ?? 0,
      freshCost: basket?.freshCost ?? 0,
      staplesCost: basket?.staplesCost ?? 0,
      itemCount: basket?.itemCount ?? items.length,
      unmatchedItems: basket?.unmatchedItems ?? [],
      itemPrices: (basket?.items ?? []).map((item) => ({
        ingredient: item.ingredient,
        packsNeeded: item.packsNeeded,
        packSize: item.packSize,
        totalCost: item.totalCost,
        matched: item.matched,
        amountNeeded: item.amountNeeded,
        amountToBuy: item.amountToBuy,
        unit: item.unit,
      })),
    },
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

  return shoppingListResponse(items);
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

  return shoppingListResponse(normalized);
}
