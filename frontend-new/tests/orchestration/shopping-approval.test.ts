import assert from "node:assert/strict";
import test from "node:test";
import { approvedShoppingItems } from "../../lib/shopping-approval.ts";
import { reviewedPlan } from "./reviewed-recipe-fixture.ts";
import type { PreferencesInput, ShoppingListItem } from "../../lib/meal-generator.ts";

test("shopping approval cannot survive a swap, preference change, failed check or session change", () => {
  const plan = reviewedPlan();
  plan.userId = "owner";
  const preferences: PreferencesInput = { tastes: [], profile: { allergies: [] } };
  const items = [{ name: "Chicken", quantity: 200, unit: "g" }] as ShoppingListItem[];
  const approval = { plan, preferences };
  const view = (p = plan, prefs = preferences, checked: typeof approval | null = approval, user: string | null = "owner", loading = false) =>
    approvedShoppingItems(items, p, prefs, checked, user, loading);
  assert.equal(view(), items);
  assert.deepEqual(view({ ...plan }), []); // Same plan ID, changed meal snapshot.
  assert.deepEqual(view(plan, { ...preferences, profile: { allergies: ["milk"] } }), []);
  assert.deepEqual(view(plan, preferences, null), []);
  assert.deepEqual(view(plan, preferences, approval, null), []);
  assert.deepEqual(view(plan, preferences, approval, "another-user"), []);
  assert.deepEqual(view(plan, preferences, approval, "owner", true), []);
  assert.equal(items[0].quantity, 200);
});
