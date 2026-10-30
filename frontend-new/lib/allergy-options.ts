import { canonicalAllergens, normalizeIngredient } from "./recipes/taxonomy.ts";

/** Display selection without rewriting precise saved restrictions into broader labels. */
export function allergyOptionSelected(values: string[], option: string): boolean {
  const categories = canonicalAllergens(option);
  return values.some(value => normalizeIngredient(value) === normalizeIngredient(option)
    || canonicalAllergens(value).some(category => categories.includes(category)));
}

export function toggleAllergyOption(values: string[], option: string): string[] {
  if (!allergyOptionSelected(values, option)) return [...values, option];
  return values.filter(value => !allergyOptionSelected([value], option));
}
