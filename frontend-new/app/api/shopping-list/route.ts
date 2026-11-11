import { parsePlanScope, planDayCount } from "@/lib/plan-scope";
import { readPlanRevisions, selectPlanRevision, type HistoryReader } from "@/lib/plan-revisions";
import { NextRequest, NextResponse } from "next/server";
import {
  buildShoppingList,
  type ShoppingListItem,
  type WeeklyMealPlan,
} from "@/lib/meal-generator";
import { compareRetailerBaskets, type RetailerObservation } from "@/lib/retailer-comparison";
import { resolveRequestAuth } from "@/lib/serverAuth";
import { approvePlanForUser, approvalFailure } from "@/lib/recipes/plan-boundary";
import { loadServerConstraints, type ConstraintDatabase } from "@/lib/recipes/server-constraints";
import type { RecipeReader } from "@/lib/recipes/repository";
import type { RecipeConstraints } from "@/lib/recipes/types";
import { estimateShoppingCost } from "@/lib/shopping-cost";
import { ingredientLedgerKey } from "@/lib/ingredient-ledger";

type CostOptions = { currency: string; ownedIngredientKeys: string[] };
const defaultCostOptions: CostOptions = { currency: "GBP", ownedIngredientKeys: [] };

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
const completeDays = (value: unknown, weekStart: string, count = 7): value is WeeklyMealPlan["days"] => {
  if (!Array.isArray(value) || value.length !== count) return false;
  const dayIds = new Set<string>();
  const dates = new Set<string>();
  for (const day of value) {
    if (!object(day) || !text(day.id) || dayIds.has(day.id) || !text(day.date) || !Array.isArray(day.meals) || !day.meals.length || day.meals.length > 12) return false;
    let date: string;
    try { date = toISODate(day.date); } catch { return false; }
    const index = Math.round((new Date(date).getTime() - new Date(weekStart).getTime()) / 86400000);
    if (index < 0 || index >= count || dates.has(date)) return false;
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
  constraints: RecipeConstraints,
  planId?: string,
  costOptions: CostOptions = defaultCostOptions
) => {
  const [observationResponse, preferenceResponse] = await Promise.all([
    supabase.from("retailer_price_observations").select("retailer_id, retailer_name, ingredient_key, pack_size, pack_unit, unit_price, currency, estimated, source_reference, provenance_status, observed_at"),
    supabase.from("user_preferences").select("weekly_budget").eq("user_id", userId).maybeSingle(),
  ]);
  const comparison = observationResponse.error
    ? { status: "price_comparison_unavailable" as const, claimable: false as const, dietaryStatus: "unverified" as const, reasons: ["price_observations_unavailable"], unmatchedItems: [] }
    : compareRetailerBaskets(items, (observationResponse.data ?? []).map((row) => toObservation(row as Record<string, unknown>)).filter((row): row is RetailerObservation => row !== null), Number(preferenceResponse.data?.weekly_budget), new Date(), constraints);
  return NextResponse.json({
    items,
    planId: planId ?? null,
    priceComparison: comparison,
    costEstimate: estimateShoppingCost(items, costOptions),
  });
};

/** Use one authoritative constraint snapshot for recipe approval and product evaluation. */
const approvedShoppingResponse = async (plan: WeeklyMealPlan, supabase: Awaited<ReturnType<typeof resolveRequestAuth>>["supabase"], userId: string, costOptions: CostOptions = defaultCostOptions) => {
  try {
    const constraints = await loadServerConstraints(supabase as unknown as ConstraintDatabase, userId);
    const approved = await approvePlanForUser(supabase as unknown as RecipeReader, userId, plan, undefined, { constraints: async () => constraints });
    const items = buildShoppingList(approved);
    const allowedKeys = new Set(items.map(item => ingredientLedgerKey(item.name, item.unit)));
    if (costOptions.ownedIngredientKeys.some(key => !allowedKeys.has(key))) {
      return NextResponse.json({ error: "invalid_owned_ingredient_keys", message: "Owned ingredients must belong to the current approved shopping list." }, { status: 400 });
    }
    return await shoppingListResponse(items, supabase, userId, constraints, plan.id, costOptions);
  } catch (error) {
    const failure = approvalFailure(error);
    return NextResponse.json(failure.body, { status: failure.status });
  }
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

  try {
    const scope = parsePlanScope(request.nextUrl.searchParams.get("scope") ?? undefined);
    const rows = await readPlanRevisions(supabase as unknown as HistoryReader, user.id, weekStart);
    const plan = selectPlanRevision(rows, user.id, scope, weekStart);
    if (!plan) return NextResponse.json({ error: rows.length ? "incomplete_stored_plan" : "no_plan_for_week" }, { status: rows.length ? 409 : 404 });
    if (!completeDays(plan.days, weekStart, planDayCount(scope))) return NextResponse.json({ error: "incomplete_stored_plan" }, { status: 409 });
    return approvedShoppingResponse(plan, supabase, user.id);
  } catch (error) {
    const failure = approvalFailure(error); return NextResponse.json(failure.body, { status: failure.status });
  }
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
  if (body.currency !== undefined && (typeof body.currency !== "string" || !body.currency.trim() || body.currency.length > 12)) {
    return NextResponse.json({ error: "invalid_currency" }, { status: 400 });
  }
  if (body.ownedIngredientKeys !== undefined && (!Array.isArray(body.ownedIngredientKeys) || body.ownedIngredientKeys.length > 500 ||
    body.ownedIngredientKeys.some(key => typeof key !== "string" || !key.trim() || key.length > 300))) {
    return NextResponse.json({ error: "invalid_owned_ingredient_keys" }, { status: 400 });
  }
  const costOptions: CostOptions = { currency: body.currency === undefined ? "GBP" : body.currency as string,
    ownedIngredientKeys: [...new Set((body.ownedIngredientKeys ?? []) as string[])] };

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
  let count: number;
  try { count = planDayCount(parsePlanScope(plan.scope)); } catch { return NextResponse.json({ error: "invalid_plan_scope" }, { status: 400 }); }
  if (!completeDays(plan.days, effectiveWeekStart, count)) return NextResponse.json({ error: "invalid_plan", message: "A complete week with valid final ingredient quantities is required." }, { status: 400 });
  // POST is an ephemeral projection of the caller's current plan. It must not
  // persist a second independently writable source of shopping quantities.
  return approvedShoppingResponse(plan as unknown as WeeklyMealPlan, supabase, user.id, costOptions);
}
