import { normalizeIngredient } from "./recipes/taxonomy.ts";

const departments = ["Produce", "Meat", "Fish & Seafood", "Dairy & Eggs", "Chilled", "Bakery", "Pantry", "Frozen", "Other"] as const;
type Department = typeof departments[number];
const rules: readonly [Department, RegExp][] = [
  ["Frozen", /\bfrozen\b/],
  ["Pantry", /\b(tinned|canned|dried|powder|protein|oil|vinegar|sauce|syrup|seeds?|oats|rice|pasta|noodles?|beans?|chickpeas?|passata|salt|cinnamon|paprika|water|olives|stock|broth|peanut butter|coconut milk)\b/],
  ["Meat", /\b(chicken|turkey|beef|pork|lamb|bacon|sausages?|duck)\b/],
  ["Fish & Seafood", /\b(salmon|tuna|cod|fish|prawns?|shrimp|mussels?|squid|crab)\b/],
  ["Chilled", /\b(tofu|tempeh|hummus)\b/],
  ["Dairy & Eggs", /\b(eggs?|milk|yogurt|yoghurt|cheese|butter|cream)\b/],
  ["Bakery", /\b(bread|wraps?|bagels?|tortillas?|pitta|pita)\b/],
  ["Produce", /\b(apples?|bananas?|berries|blueberries|limes?|lemons?|avocados?|tomatoes?|cucumbers?|broccoli|spinach|carrots?|cabbage|peppers?|courgettes?|onions?|scallions?|garlic|peas|celery|corn)\b/],
];

export function groupShoppingDepartments<T extends { name: string; category?: string }>(items: readonly T[]) {
  const groups = new Map<Department, T[]>();
  for (const item of items) {
    const name = normalizeIngredient(item.name);
    const supplied = departments.find(department => normalizeIngredient(department) === normalizeIngredient(item.category ?? ""));
    const category = rules.find(([, pattern]) => pattern.test(name))?.[0] ?? (supplied === "Produce" ? undefined : supplied) ?? "Other";
    const group = groups.get(category) ?? [];
    group.push(item);
    groups.set(category, group);
  }
  return departments.flatMap(category => {
    const group = groups.get(category);
    return group ? [{ category, items: group.sort((a, b) => a.name.localeCompare(b.name)) }] : [];
  });
}
