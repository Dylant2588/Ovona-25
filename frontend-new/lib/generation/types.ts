import type { SupabaseClient } from "@supabase/supabase-js";
import type { MacroBreakdown, WeeklyMealPlan } from "@/lib/meal-generator";

export type MicroTargets = {
  iron_mg?: number;
  omega_3_g?: number;
  b12_mcg?: number;
  vitamin_d_mcg?: number;
  folate_mcg?: number;
  calcium_mg?: number;
  fibre_g?: number;
};

export type SlotBudget = {
  label: string;
  calories: number;
  protein: number;
};

export type GenerationContext = {
  calorieTarget: number;
  proteinTarget: number;
  carbTarget: number;
  fatTarget: number;
  dietaryMode: string;
  allergies: string[];
  dislikes: string[];
  cuisinePreferences: string[];
  maxPrepMinutes: number;
  healthConditions: string[];
  microTargets: MicroTargets;
  mealsPerDay: number;
  slotLabels: string[];
  weeklyBudget: number;
  recentMealNames: string[];
  recentProteinTypes: string[];
  slotBudgets: SlotBudget[];
};

export type MealConcept = {
  name: string;
  ingredients: string[];
  steps: string[];
  cuisine: string;
  protein_type: string;
  slot: string;
  prep_minutes: number;
  day?: number;
  for_day?: number;
  for_slot?: string;
};

export type NutritionistOutput = {
  meals: MealConcept[];
  alternatives: MealConcept[];
  source: "db" | "llm" | "fallback";
};

export type ValidationResult = {
  meal: MealConcept;
  validIngredients: string[];
  unknownIngredients: string[];
  allergenFlags: string[];
};

export type IngredientMicros = {
  iron_mg: number;
  omega_3_g: number;
  b12_mcg: number;
  vitamin_d_mcg: number;
  folate_mcg: number;
  calcium_mg: number;
  fibre_g: number;
};

export type IngredientMacros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type PortionedIngredient = {
  name: string;
  amount: number;
  unit: string;
  category: string;
  macros: IngredientMacros;
  micros: IngredientMicros;
};

export type PortionedMeal = {
  concept: MealConcept;
  ingredients: PortionedIngredient[];
  totalMacros: IngredientMacros;
  totalMicros: IngredientMicros;
  slot: string;
  day: number;
};

export type ShoppingItem = {
  name: string;
  amountNeeded: number;
  amountToBuy: number;
  unit: string;
  category: string;
  pricePerPack: number;
  packSize: number;
  packsNeeded: number;
  totalPrice: number;
};

export type PracticalOutput = {
  adjustedPlan: PortionedMeal[];
  shoppingList: ShoppingItem[];
  weeklyTotal: number;
  substitutionsMade: string[];
};

export type GenerationArtifacts = {
  context: GenerationContext;
  practical: PracticalOutput;
  alternatives: MealConcept[];
  source: NutritionistOutput["source"];
  weeklyPlan: WeeklyMealPlan;
};

export type GenerationSupabase = SupabaseClient;

export type FinalMealTotals = MacroBreakdown;
