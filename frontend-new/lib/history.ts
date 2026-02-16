import type { MealInstance } from "./meal-generator";

export type StoredMealInstance = Pick<
  MealInstance,
  "instanceId" | "baseId" | "mealSlot" | "title" | "description" | "tags" | "image" | "readyInMinutes" | "portionMultiplier" | "baseMacros" | "macros" | "baseIngredients" | "ingredients" | "proteinType"
>;

export type MealHistoryEntry = {
  id: string;
  user_id: string;
  day_id: string;
  meal: StoredMealInstance;
  created_at: string;
};
