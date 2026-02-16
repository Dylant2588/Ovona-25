import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  buildShoppingList,
  WORKDAY_COUNT,
  type ShoppingListItem,
  type WeeklyMealPlan,
} from "@/lib/meal-generator";
import { priceBasket } from "@/lib/tesco-prices";

const NORMALIZE_TIMEOUT_MS = 5000;

const toISODate = (value: string) =>
  new Date(value).toISOString().split("T")[0];

const normalizeViaApi = async (
  items: ShoppingListItem[],
  locale: string,
  origin: string
): Promise<ShoppingListItem[]> => {
  if (!items.length) return items;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NORMALIZE_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${origin}/api/normalize-shopping-list`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, locale }),
        cache: "no-store",
        signal: controller.signal,
      }
    );
    if (response.ok) {
      const data = (await response.json()) as {
        items?: ShoppingListItem[];
      };
      if (Array.isArray(data.items) && data.items.length) {
        return data.items;
      }
    }
  } catch (error) {
    console.error("normalizeViaApi failed", error);
  } finally {
    clearTimeout(timeoutId);
  }
  return items;
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

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const effectiveWeekStart = toISODate(weekStart ?? plan.weekStart);
  const workweekPlan: WeeklyMealPlan = {
    ...plan,
    days: (plan.days ?? []).slice(0, WORKDAY_COUNT),
  };
  const baseItems = buildShoppingList(workweekPlan);
  const normalized = await normalizeViaApi(
    baseItems,
    locale,
    request.nextUrl.origin
  );

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
