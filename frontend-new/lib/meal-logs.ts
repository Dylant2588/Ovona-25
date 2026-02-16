export type MealLogStatus = "planned" | "eaten" | "skipped" | "swapped";

export type MealLogEntry = {
  id: string;
  user_id: string;
  meal_instance_id: string;
  status: MealLogStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  date: string;
};
