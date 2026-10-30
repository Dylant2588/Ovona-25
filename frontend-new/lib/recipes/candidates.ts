import type { VerifiedCandidateMeal } from "../orchestration/types.ts";
import type { RecipeRecord, RecipeConstraints } from "./types.ts";
import { canonicalAllergens } from "./taxonomy.ts";

/** Variety evidence derives from reviewed exact ingredient identities, rather
 * than treating all poultry or every plant ingredient as one protein source. */
export function recipeProteinFamilies(recipe: RecipeRecord): string[] {
  const families: Record<string, string> = { chicken: "chicken", turkey: "turkey", egg: "egg", milk: "dairy", salmon: "fish", prawn: "shellfish", mussel: "shellfish", tofu: "soy", chickpea: "beans", black_beans: "beans", unreviewed_mashed_white_beans: "beans", unreviewed_pea_protein: "pea" };
  const found = recipe.ingredients.filter(i => i.reviewed).map(i => families[i.canonicalId]).filter((v): v is string => !!v);
  return [...new Set(found.length ? found : [recipe.proteinType])];
}

/** Mapping only: callers must apply approveRecipe with these constraints first. */
export function recipesToCandidates(recipes: readonly RecipeRecord[], constraints: RecipeConstraints): VerifiedCandidateMeal[] {
  return recipes.flatMap(recipe => recipe.slots.map(slot => ({
    id: `${recipe.id}:${slot}`, recipeId: recipe.id, recipeVersion: recipe.version, slot, title: recipe.title, verified: true as const,
    ...(typeof recipe.cuisine === "string" && recipe.cuisine.trim() ? { cuisine: recipe.cuisine.trim().toLowerCase() } : {}),
    ingredients: recipe.ingredients.map(ingredient => ({ name: ingredient.name, normalizedName: ingredient.canonicalId,
      quantity: ingredient.amount / recipe.servings, unit: ingredient.unit, pantry: false })),
    allergens: [...new Set(recipe.ingredients.flatMap(ingredient => [...ingredient.allergens, ...(ingredient.mayContain ?? [])])
      .flatMap(allergen => canonicalAllergens(allergen)))],
    dietaryTags: [...(constraints.dietaryModes ?? [])], nutrition: { ...recipe.macros },
    // No source prices exist here. Zero stays a neutral scheduler input.
    cost: 0, prepMinutes: recipe.readyInMinutes, servings: 1, similarityKey: recipe.id, proteinType: recipe.proteinType, proteinFamilies: recipeProteinFamilies(recipe), format: slot,
  })));
}
