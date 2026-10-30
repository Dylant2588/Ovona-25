export type FoodPreferenceLists = {
  dislikes: readonly string[];
  neverFoods: readonly string[];
  foodLikes: readonly string[];
};
export type FoodPreferenceDrafts = {
  dislikeInput: string;
  neverFoodInput: string;
  foodLikeInput: string;
};

const includeDraft = (values: readonly string[], draft: string): string[] => {
  const seen = new Set<string>();
  return [...values, draft].map(value => value.trim().replace(/\s+/g, " ")).filter(value => {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** Save includes visible text even when Enter has not yet created a chip.
 * Pure snapshot construction keeps the original form available after failures.
 */
export function foodPreferencesWithDrafts(lists: FoodPreferenceLists, drafts: FoodPreferenceDrafts) {
  return {
    dislikes: includeDraft(lists.dislikes, drafts.dislikeInput),
    neverFoods: includeDraft(lists.neverFoods, drafts.neverFoodInput),
    foodLikes: includeDraft(lists.foodLikes, drafts.foodLikeInput),
  };
}
