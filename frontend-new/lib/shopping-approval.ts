import type { PreferencesInput, ShoppingListItem, WeeklyMealPlan } from "./meal-generator.ts";

export type ShoppingApproval = { plan: WeeklyMealPlan; preferences: PreferencesInput | null };

/** Approval applies to this exact projection and preference snapshot, never just a reused plan ID. */
export function approvedShoppingItems(items: ShoppingListItem[], plan: WeeklyMealPlan | null,
  preferences: PreferencesInput | null, approval: ShoppingApproval | null, userId: string | null,
  authLoading: boolean): ShoppingListItem[] {
  return !authLoading && !!userId && plan?.userId === userId && approval?.plan === plan &&
    approval?.preferences === preferences ? items : [];
}
