/**
 * OVONA INTEGRATION GUIDE
 * =======================
 * How to wire macro-enforcement.ts and tesco-prices.ts into your existing codebase.
 *
 * Drop both files into: frontend-new/FE/lib/
 *   - lib/macro-enforcement.ts
 *   - lib/tesco-prices.ts
 *
 * Then make these changes:
 */

// ─────────────────────────────────────────────────────────────────
// CHANGE 1: API route — Enforce macros after plan generation
// File: app/api/meal-plan/route.ts
// ─────────────────────────────────────────────────────────────────

// Add this import at the top:
import { enforceMacros, enforcementSummary } from "@/lib/macro-enforcement";

// Then modify the POST handler. Replace this section:
//
//   if (!openaiClient) {
//     const fallback = generateFallbackMealPlan(preferences);
//     return NextResponse.json({ plan: fallback, source: "fallback" });
//   }
//
//   try {
//     const plan = await requestAiPlan(preferences, rotationHistory);
//     return NextResponse.json({ plan, source: "openai" });
//   } catch (error) {
//     console.error("AI meal plan error", error);
//     const fallback = generateFallbackMealPlan(preferences);
//     return NextResponse.json({ plan: fallback, source: "fallback" });
//   }
//
// With this:

async function POST_updated(request: NextRequest) {
  // ... existing parsing code ...

  const targets = preferences.macroTargets ?? null;
  let plan: WeeklyMealPlan;
  let source: string;

  if (!openaiClient) {
    plan = generateFallbackMealPlan(preferences);
    source = "fallback";
  } else {
    try {
      plan = await requestAiPlan(preferences, rotationHistory);
      source = "openai";
    } catch (error) {
      console.error("AI meal plan error", error);
      plan = generateFallbackMealPlan(preferences);
      source = "fallback";
    }
  }

  // ★ NEW: Enforce macros regardless of source
  let enforcement = null;
  if (targets && (targets.calories || targets.protein)) {
    const result = enforceMacros(plan, targets);
    enforcement = {
      passed: result.passed,
      corrections: result.totalCorrections,
      summary: enforcementSummary(result),
      // Per-day details (optional, useful for debugging)
      days: result.dailyResults.map((d) => ({
        label: d.label,
        passed: d.passed,
        corrected: d.corrected,
      })),
    };

    if (!result.passed) {
      console.warn("Macro enforcement incomplete:", enforcement.summary);
    }
  }

  return NextResponse.json({ plan, source, enforcement });
}


// ─────────────────────────────────────────────────────────────────
// CHANGE 2: Shopping list route — Add pricing
// File: app/api/shopping-list/route.ts
// ─────────────────────────────────────────────────────────────────

// Add this import at the top:
import { priceBasket } from "@/lib/tesco-prices";

// In the POST handler, after you get the normalized items, add pricing:
//
// Replace:
//   return NextResponse.json({ items: normalized });
//
// With:

function shoppingListResponse(normalized: ShoppingListItem[]) {
  // ★ NEW: Price the basket
  const basket = priceBasket(normalized);

  return NextResponse.json({
    items: normalized,
    pricing: {
      subtotal: basket.subtotal,
      freshCost: basket.freshCost,
      staplesCost: basket.staplesCost,
      itemCount: basket.itemCount,
      unmatchedItems: basket.unmatchedItems,
      // Per-item pricing breakdown
      itemPrices: basket.items.map((item) => ({
        ingredient: item.ingredient,
        packsNeeded: item.packsNeeded,
        packSize: item.packSize,
        totalCost: item.totalCost,
        matched: item.matched,
      })),
    },
  });
}

// Also update the GET handler similarly — after loading cached items:
//
//   const items = (data?.meals as { items?: ShoppingListItem[] } | null)?.items ?? [];
//   const basket = priceBasket(items);
//   return NextResponse.json({ items, pricing: { subtotal: basket.subtotal, ... } });


// ─────────────────────────────────────────────────────────────────
// CHANGE 3: Fallback generator — Enforce macros there too
// File: lib/meal-generator.ts
// ─────────────────────────────────────────────────────────────────

// In generateFallbackMealPlan, the existing alignDayToTargets does a soft alignment.
// With the new enforcement layer, you can optionally run it after generation:
//
// Option A: Keep alignDayToTargets as-is, let the API route handle enforcement.
//           (Recommended — keeps meal-generator.ts pure, enforcement is one layer up)
//
// Option B: Import and call enforceMacros at the end of generateFallbackMealPlan:
//
//   import { enforceMacros } from "./macro-enforcement";
//
//   export const generateFallbackMealPlan = (prefs: PreferencesInput): WeeklyMealPlan => {
//     // ... existing code ...
//     const plan = { id: randomId(), ... };
//     if (macroTargets) enforceMacros(plan, macroTargets);
//     return plan;
//   };


// ─────────────────────────────────────────────────────────────────
// CHANGE 4: Frontend — Show pricing on the shopping list
// File: app/meals/page.tsx (wherever you render the shopping list)
// ─────────────────────────────────────────────────────────────────

// When you fetch the shopping list, the response will now include `pricing`.
// Example React usage:

/*
  const [basketTotal, setBasketTotal] = useState<number | null>(null);
  const [unmatchedItems, setUnmatchedItems] = useState<string[]>([]);

  // In your fetch handler:
  const res = await fetch(`/api/shopping-list?weekStart=${weekStart}`);
  const data = await res.json();
  setShoppingList(data.items);

  if (data.pricing) {
    setBasketTotal(data.pricing.subtotal);
    setUnmatchedItems(data.pricing.unmatchedItems ?? []);
  }

  // In your JSX:
  {basketTotal !== null && (
    <Box sx={{ mt: 2, p: 2, bgcolor: "background.paper", borderRadius: 2 }}>
      <Typography variant="h6">
        Estimated Basket: £{basketTotal.toFixed(2)}
      </Typography>
      {unmatchedItems.length > 0 && (
        <Typography variant="body2" color="text.secondary">
          {unmatchedItems.length} item(s) not priced: {unmatchedItems.join(", ")}
        </Typography>
      )}
    </Box>
  )}
*/


// ─────────────────────────────────────────────────────────────────
// CHANGE 5 (optional): Show enforcement result to user
// File: app/meals/page.tsx
// ─────────────────────────────────────────────────────────────────

// The meal plan API now returns `enforcement` alongside `plan`.
// You can show this as a confidence indicator:

/*
  const [enforcement, setEnforcement] = useState<any>(null);

  // After generating plan:
  const res = await fetch("/api/meal-plan", { method: "POST", ... });
  const data = await res.json();
  setPlan(data.plan);
  setEnforcement(data.enforcement);

  // In JSX — subtle confidence indicator:
  {enforcement && (
    <Chip
      size="small"
      color={enforcement.passed ? "success" : "warning"}
      label={
        enforcement.passed
          ? "Macros ✓"
          : `${enforcement.corrections} day(s) adjusted`
      }
    />
  )}
*/


// ─────────────────────────────────────────────────────────────────
// SUMMARY OF FILES TO CHANGE
// ─────────────────────────────────────────────────────────────────
//
// NEW FILES (drop in):
//   lib/macro-enforcement.ts    — Macro verification + auto-correction
//   lib/tesco-prices.ts         — Price database + basket calculator
//
// MODIFIED FILES (small changes):
//   app/api/meal-plan/route.ts  — Add enforceMacros() call after generation
//   app/api/shopping-list/route.ts — Add priceBasket() call, return pricing
//   app/meals/page.tsx          — Display basket total + enforcement status
//
// OPTIONAL:
//   lib/meal-generator.ts       — Can add enforcement there too (not needed if API does it)
//   backend/tesco_prices.json   — Can be retired (replaced by tesco-prices.ts)
//   backend/ingredients.py      — estimate_costs() no longer needed
//

export {};
