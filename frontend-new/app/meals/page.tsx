"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import NextLink from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import RestaurantMenuRoundedIcon from "@mui/icons-material/RestaurantMenuRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import SetMealRoundedIcon from "@mui/icons-material/SetMealRounded";
import NatureRoundedIcon from "@mui/icons-material/NatureRounded";
import LunchDiningRoundedIcon from "@mui/icons-material/LunchDiningRounded";
import LocalDiningRoundedIcon from "@mui/icons-material/LocalDiningRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Checkbox,
  Collapse,
  CircularProgress,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  FormGroup,
  Grid,
  Radio,
  RadioGroup,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  useMediaQuery,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import type { TooltipProps } from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabaseClient";
import {
  buildShoppingList,
  generateFallbackMealPlan,
  preferenceSignatureFor,
  regenerateDayInPlan,
  regenerateWeekInPlan,
  resolveMacroTargets,
  rotationHistoryFromPlan,
  swapMealInPlan,
  WORKDAY_COUNT,
  type MacroTargets,
  type MacroBreakdown,
  type PreferencesInput,
  type RotationHistoryEntry,
  type MealHistorySummary,
  type ShoppingListItem,
  type IngredientLine,
  type WeeklyMealPlan,
} from "@/lib/meal-generator";
import type { StoredMealInstance } from "@/lib/history";
import { readOnboardingMeta, type OnboardingMeta } from "@/lib/onboarding-meta";
import {
  enforceMacros,
  toEnforcementInfo,
  type EnforcementInfo,
} from "@/lib/macro-enforcement";
import { priceBasket } from "@/lib/tesco-prices";

type RawPreferences = {
  taste_preferences: string[] | string | null;
  goal: string | null;
  meal_complexity: number | null;
  lifestyle: string | null;
  cuisines: string | null;
  allergies: string | null;
  target_calories: number | null;
  target_protein: number | null;
  target_carbs: number | null;
  target_fat: number | null;
};

type ProfileRow = {
  locale: string | null;
  timezone: string | null;
  body_weight_kg: number | null;
  body_fat_percent: number | null;
  height_cm: number | null;
  activity_level: string | null;
  training_schedule: string[] | null;
  allergies: string[] | null;
  dislikes: string[] | null;
  cuisines: string[] | null;
  pantry_staples: string[] | null;
  household: string[] | null;
  delivery_preferences: string[] | null;
  sleep_hours: number | null;
  stress_level: string | null;
  notes: string | null;
};

type BasketPricingLine = {
  ingredient: string;
  packsNeeded: number;
  packSize: string;
  totalCost: number;
  matched: boolean;
};

type BasketPricing = {
  subtotal: number;
  freshCost: number;
  staplesCost: number;
  itemCount: number;
  unmatchedItems: string[];
  itemPrices: BasketPricingLine[];
};

type DietaryModeOption = "mixed" | "pescatarian" | "vegetarian" | "vegan";

type PreferencePanelState = {
  dietaryMode: DietaryModeOption;
  allergies: string[];
  dislikes: string[];
  cuisines: string[];
};

type UserAllergyRow = {
  [key: string]: unknown;
};

type PlanMeal = WeeklyMealPlan["days"][number]["meals"][number];

type ToastSeverity = "success" | "error" | "info";

type ToastState = {
  open: boolean;
  message: string;
  severity: ToastSeverity;
  actionLabel?: string;
};

const complexityFromInt = (value: number | null | undefined): PreferencesInput["mealComplexity"] => {
  if (value === 1) return "simple";
  if (value === 2) return "normal";
  if (value === 3) return "adventurous";
  return null;
};

const parseTasteArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    return value
      .replace(/[{}"]/g, "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const parseNumberField = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasAnyTarget = (targets: MacroTargets | null | undefined) =>
  !!targets && Object.values(targets).some((value) => typeof value === "number");

const formatNumber = (value: number | null | undefined) =>
  typeof value === "number" ? value.toLocaleString() : null;

const ensureStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
  }
  return [];
};

const goalLabels: Record<string, string> = {
  lose_weight: "Lose weight",
  save_time: "Save time",
  calorie_count: "Stay on calorie target",
  lose: "Lose weight",
  maintain: "Maintain",
  gain: "Build muscle",
  recomp: "Body recomposition",
};

const complexityLabels: Record<string, string> = {
  simple: "Simple & quick",
  normal: "Balanced effort",
  adventurous: "Adventurous cook",
};

const macroDisplay = [
  { key: "calories", label: "Calories", unit: "calories" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
] as const;

const chartColors = {
  calories: "#f97316",
  protein: "#38bdf8",
  carbs: "#fbbf24",
  fat: "#f472b6",
};

const DIETARY_MODE_OPTIONS: Array<{ value: DietaryModeOption; label: string }> = [
  { value: "mixed", label: "Mixed" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
];

const ALLERGY_OPTIONS = [
  "Dairy",
  "Gluten",
  "Nuts",
  "Fish",
  "Shellfish",
  "Eggs",
  "Soy",
  "Sesame",
] as const;

const CUISINE_OPTIONS = [
  "Mediterranean",
  "Asian",
  "Mexican",
  "Indian",
  "British",
  "American",
  "Middle Eastern",
] as const;

const uniqueStrings = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const parseDelimitedList = (value: string | null | undefined): string[] =>
  value
    ? uniqueStrings(
        value
          .split(/[,;/\n]/)
          .map((item) => item.trim())
          .filter(Boolean)
      )
    : [];

const normalizeDietaryModeValue = (value?: string | null): DietaryModeOption => {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("vegan")) return "vegan";
  if (normalized.includes("vegetarian")) return "vegetarian";
  if (normalized.includes("pescatarian") || normalized.includes("pescetarian")) {
    return "pescatarian";
  }
  return "mixed";
};

const normalizeUserAllergyRows = (rows: UserAllergyRow[] | null): string[] => {
  if (!Array.isArray(rows) || !rows.length) return [];
  return uniqueStrings(
    rows
      .map((row) => {
        if (typeof row.allergy === "string") return row.allergy;
        if (typeof row.allergen === "string") return row.allergen;
        if (typeof row.name === "string") return row.name;
        const dynamic = Object.entries(row).find(
          ([key, value]) =>
            typeof value === "string" && key.toLowerCase().includes("allerg")
        );
        return typeof dynamic?.[1] === "string" ? dynamic[1] : "";
      })
      .map((value) => value.trim())
      .filter(Boolean)
  );
};

const calorieStatusMeta = (dayCalories: number, targetCalories?: number | null) => {
  if (typeof targetCalories !== "number" || targetCalories <= 0) {
    return { color: "#64748b", label: "No target", delta: null as number | null };
  }
  const delta = Math.abs(dayCalories - targetCalories) / targetCalories;
  if (delta <= 0.1) {
    return { color: "#22c55e", label: "On target", delta };
  }
  if (delta <= 0.2) {
    return { color: "#f59e0b", label: "Near target", delta };
  }
  return { color: "#ef4444", label: "Off target", delta };
};

const macroStatusMeta = (enforcement: EnforcementInfo) => {
  const failedDays = enforcement.days.filter((day) => day.status === "partial").length;
  const adjustedDays = enforcement.days.filter((day) => day.status === "adjusted").length;
  const legacyStatus =
    enforcement.status ??
    (!enforcement.passed ? "failed" : enforcement.corrections > 0 ? "adjusted" : "verified");
  if (failedDays > 0 || (failedDays === 0 && adjustedDays === 0 && legacyStatus === "failed")) {
    const failedCount = failedDays || 1;
    return {
      color: "error" as const,
      label: `${failedCount} day(s) couldn't meet targets`,
      icon: <ErrorOutlineRoundedIcon fontSize="small" />,
    };
  }
  if (
    adjustedDays > 0 ||
    (failedDays === 0 && adjustedDays === 0 && legacyStatus === "adjusted")
  ) {
    return {
      color: "warning" as const,
      label: "Macros verified ✓ (portions adjusted)",
      icon: <WarningAmberRoundedIcon fontSize="small" />,
    };
  }
  return {
    color: "success" as const,
    label: "Macros verified ✓",
    icon: <CheckCircleOutlineRoundedIcon fontSize="small" />,
  };
};

const dayEnforcementMeta = (
  day: EnforcementInfo["days"][number] | null
) => {
  if (!day) return null;
  const status = day.status ?? (!day.passed ? "partial" : day.corrected ? "adjusted" : "verified");
  if (status === "partial") {
    return { color: "#ef4444", label: "Needs different meals" };
  }
  if (status === "adjusted") {
    return { color: "#f59e0b", label: "Adjusted" };
  }
  return { color: "#22c55e", label: "On target" };
};

const MacroTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
  if (!active || !payload?.length) return null;
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1,
        bgcolor: "rgba(15,15,30,0.92)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      {payload.map((entry) => (
        <Typography key={entry.name} variant="body2">
          {entry.name}: {entry.value}
        </Typography>
      ))}
    </Box>
  );
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const addDays = (date: Date, amount: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
};

const sumMacroBreakdowns = (items: MacroBreakdown[]): MacroBreakdown =>
  items.reduce(
    (acc, item) => ({
      calories: acc.calories + (item?.calories ?? 0),
      protein: acc.protein + (item?.protein ?? 0),
      carbs: acc.carbs + (item?.carbs ?? 0),
      fat: acc.fat + (item?.fat ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

const cloneWeeklyPlan = (plan: WeeklyMealPlan): WeeklyMealPlan =>
  JSON.parse(JSON.stringify(plan)) as WeeklyMealPlan;

const enforcePlanMacros = (
  plan: WeeklyMealPlan,
  prefs: PreferencesInput
): { plan: WeeklyMealPlan; enforcement: EnforcementInfo } => {
  const nextPlan = cloneWeeklyPlan(plan);
  const targets = resolveMacroTargets(prefs);
  const result = enforceMacros(nextPlan, targets);
  return {
    plan: nextPlan,
    enforcement: toEnforcementInfo(result),
  };
};

const weekStartISO = (value: string) => {
  const date = new Date(value);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().split("T")[0];
};

const storageKeyFor = (userId: string) => `ovona-meal-plan-${userId}`;
const onboardingSkipKeyFor = (userId: string) => `ovona-onboarding-skipped-${userId}`;
const onboardingMetaKeyFor = (userId: string) => `ovona-onboarding-meta-${userId}`;
const readOnboardingMetaFromStorage = (userId: string): OnboardingMeta | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(onboardingMetaKeyFor(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OnboardingMeta;
    const meta: OnboardingMeta = {};
    if (
      parsed?.cookingTime === "under_10" ||
      parsed?.cookingTime === "10_15" ||
      parsed?.cookingTime === "15_30"
    ) {
      meta.cookingTime = parsed.cookingTime;
    }
    if (parsed?.mealsPerDay === 3 || parsed?.mealsPerDay === 5) {
      meta.mealsPerDay = parsed.mealsPerDay;
    }
    return Object.keys(meta).length ? meta : null;
  } catch {
    return null;
  }
};
const runAsync = (fn: () => void) => {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(fn);
  } else {
    setTimeout(fn, 0);
  }
};
const toDateOnly = (value: string) => new Date(value).toISOString().split("T")[0];

const formatIngredientLine = (item: IngredientLine) => {
  const amount = Number.isFinite(item.amount) ? Number(item.amount) : null;
  const unit = (item.unit ?? "").trim();
  const compactUnit = ["g", "kg", "ml", "l"].includes(unit.toLowerCase());
  const amountText =
    amount !== null ? `${amount % 1 === 0 ? amount : amount.toFixed(1)}` : "";
  const quantity = `${amountText}${
    unit ? (compactUnit ? unit : ` ${unit}`) : ""
  }`.trim();
  return quantity ? `${quantity} ${item.name}` : item.name;
};

const SHOPPING_CATEGORY_ORDER = [
  "protein",
  "dairy",
  "produce",
  "pantry",
  "bakery",
  "frozen",
] as const;

const shoppingCategoryRank = (category: string) => {
  const normalized = category.trim().toLowerCase();
  if (normalized.startsWith("protein")) return 0;
  if (normalized.startsWith("dairy")) return 1;
  if (normalized.startsWith("produce")) return 2;
  if (normalized.startsWith("pantry")) return 3;
  if (normalized.startsWith("bakery")) return 4;
  if (normalized.startsWith("frozen")) return 5;
  return SHOPPING_CATEGORY_ORDER.length;
};

const shoppingItemKey = (item: ShoppingListItem) =>
  `${(item.displayName ?? item.name).trim().toLowerCase()}|${item.quantity}|${item.unit}|${
    item.category ?? "Pantry"
  }`;

const formatGbp = (value: number) => `£${value.toFixed(2)}`;

const SHOPPING_COUNTABLE_UNITS = new Set(["large", "each", "piece", "slice", "unit"]);

const singularize = (value: string) =>
  value.toLowerCase().endsWith("s") ? value.slice(0, -1) : value;

const pluralize = (value: string, count: number) => {
  if (count === 1) return singularize(value);
  const singular = singularize(value);
  return singular.toLowerCase().endsWith("s") ? singular : `${singular}s`;
};

const sanitizeShoppingName = (value: string) =>
  value
    .replace(/^\d+\s*(x|×)?\s*\d*\s*(g|kg|ml|l)?\s*/i, "")
    .replace(/\b(pack|packs|dozen|large)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim() || value.trim();

const roundMetricShoppingValue = (value: number) => {
  if (value < 100) return Math.round(value / 5) * 5;
  if (value <= 1000) return Math.round(value / 10) * 10;
  return Math.round(value / 50) * 50;
};

const shoppingDisplayLine = (item: ShoppingListItem) => {
  const rawName = sanitizeShoppingName(item.name);
  const unit = (item.unit ?? "").trim().toLowerCase();
  const quantity = Math.max(0, Number(item.quantity ?? 0));
  const whole = Number.isFinite(quantity) ? Math.ceil(quantity) : 0;
  if ((unit === "large" || unit === "piece") && /egg/i.test(rawName)) {
    return { amount: `${whole}`, name: whole === 1 ? "Egg" : "Eggs" };
  }
  if (SHOPPING_COUNTABLE_UNITS.has(unit)) {
    return { amount: `${whole}`, name: pluralize(rawName, whole) };
  }
  if (unit === "g" || unit === "ml" || unit === "kg" || unit === "l") {
    const metricQuantity =
      unit === "g" || unit === "ml"
        ? roundMetricShoppingValue(quantity)
        : Number(quantity.toFixed(2));
    const prettyQuantity =
      Number.isInteger(metricQuantity)
        ? metricQuantity.toString()
        : metricQuantity.toFixed(1);
    return { amount: `${prettyQuantity}${unit}`, name: rawName };
  }
  const prettyQuantity =
    Number.isInteger(quantity) ? quantity.toString() : quantity.toFixed(1);
  return { amount: `${prettyQuantity} ${unit}`.trim(), name: rawName };
};

const buildLocalBasketPricing = (items: ShoppingListItem[]): BasketPricing | null => {
  try {
    const basket = priceBasket(items);
    return {
      subtotal: basket.subtotal,
      freshCost: basket.freshCost,
      staplesCost: basket.staplesCost,
      itemCount: basket.itemCount,
      unmatchedItems: basket.unmatchedItems,
      itemPrices: basket.items.map((item) => ({
        ingredient: item.ingredient,
        packsNeeded: item.packsNeeded,
        packSize: item.packSize,
        totalCost: item.totalCost,
        matched: item.matched,
      })),
    };
  } catch (error) {
    console.error("Local basket pricing failed", error);
    return null;
  }
};

const mealSlotLabel = (slot: string) =>
  slot.charAt(0).toUpperCase() + slot.slice(1);

const mealSlotDisplayLabel = (
  slot: string,
  mealIndex: number,
  meals: WeeklyMealPlan["days"][number]["meals"]
) => {
  if (slot !== "snack") return mealSlotLabel(slot);
  const snackNumber = meals
    .slice(0, mealIndex + 1)
    .filter((meal) => meal.mealSlot === "snack").length;
  return `Snack ${snackNumber}`;
};

const mealSlotColor = (slot: string) => {
  if (slot === "breakfast") return "#60a5fa";
  if (slot === "snack") return "#4ade80";
  if (slot === "lunch") return "#fb923c";
  if (slot === "dinner") return "#c084fc";
  return "#94a3b8";
};

const mealMacroLine = (meal: PlanMeal) =>
  `${meal.macros.calories} kcal • ${meal.macros.protein}g protein`;

const normalizeSteps = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((step): step is string => typeof step === "string")
        .map((step) => step.trim())
        .filter(Boolean)
    : [];

const resolveRecipeSteps = (meal: PlanMeal) => {
  const steps = normalizeSteps((meal as PlanMeal & { steps?: string[] }).steps);
  if (steps.length) return steps;
  const recipeSteps = normalizeSteps(meal.recipeSteps);
  if (recipeSteps.length) return recipeSteps;
  return [];
};

const proteinTypeMeta = (proteinType?: PlanMeal["proteinType"]) => {
  switch (proteinType) {
    case "plant":
      return { label: "Plant", icon: <NatureRoundedIcon fontSize="small" /> };
    case "fish":
      return { label: "Fish", icon: <SetMealRoundedIcon fontSize="small" /> };
    case "seafood":
      return { label: "Seafood", icon: <SetMealRoundedIcon fontSize="small" /> };
    case "poultry":
      return { label: "Poultry", icon: <LunchDiningRoundedIcon fontSize="small" /> };
    case "red_meat":
      return { label: "Red meat", icon: <LocalDiningRoundedIcon fontSize="small" /> };
    default:
      return { label: "Mixed", icon: <LunchDiningRoundedIcon fontSize="small" /> };
  }
};

const panelStateFromPreferences = (prefs: PreferencesInput | null): PreferencePanelState => {
  const profile = prefs?.profile;
  return {
    dietaryMode: normalizeDietaryModeValue(profile?.dietaryMode ?? null),
    allergies: uniqueStrings(profile?.allergies ?? []),
    dislikes: uniqueStrings(profile?.dislikes ?? []),
    cuisines: uniqueStrings(profile?.cuisines ?? []),
  };
};

const LOADING_STEPS = [
  { id: "cache", label: "Checking your preferences" },
  { id: "ai", label: "Crafting your meals" },
  { id: "ingredients", label: "Gathering ingredients" },
] as const;
const AI_CLIENT_TIMEOUT_MS = 12000;

export default function MealsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [preferences, setPreferences] = useState<PreferencesInput | null>(null);
  const [preferenceTastes, setPreferenceTastes] = useState<string[]>([]);
  const [plan, setPlan] = useState<WeeklyMealPlan | null>(null);
  const [prefLoading, setPrefLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(true);
  const [planLoadingElapsedMs, setPlanLoadingElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [normalizedList, setNormalizedList] = useState<ShoppingListItem[] | null>(null);
  const [normalizingList, setNormalizingList] = useState(false);
  const [shoppingListError, setShoppingListError] = useState<string | null>(null);
  const [shoppingReloadToken, setShoppingReloadToken] = useState(0);
  const [shoppingExpanded, setShoppingExpanded] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [clientReady, setClientReady] = useState(false);
  const planLoadingRef = useRef(planLoading);
  const planLoadingStartedAtRef = useRef<number>(Date.now());
  const macroTargets = preferences ? resolveMacroTargets(preferences) : null;
  const hasMacroTargets = hasAnyTarget(macroTargets);
  const profileLocale = preferences?.profile?.locale ?? "UK";
  const preferenceSignature = useMemo(
    () => (preferences ? preferenceSignatureFor(preferences) : null),
    [preferences]
  );
  const planSignatureRef = useRef<string | null>(null);
  const [mealHistorySummary, setMealHistorySummary] = useState<MealHistorySummary | null>(null);
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null);
  const [preferencesPanelOpen, setPreferencesPanelOpen] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesNotice, setPreferencesNotice] = useState<string | null>(null);
  const [showCustomizePrompt, setShowCustomizePrompt] = useState(false);
  const [preferencesPanelState, setPreferencesPanelState] = useState<PreferencePanelState>({
    dietaryMode: "mixed",
    allergies: [],
    dislikes: [],
    cuisines: [],
  });
  const [dislikeInput, setDislikeInput] = useState("");
  const [enforcement, setEnforcement] = useState<EnforcementInfo | null>(null);
  const [basketPricing, setBasketPricing] = useState<BasketPricing | null>(null);
  const [regeneratingWeek, setRegeneratingWeek] = useState(false);
  const [regeneratingDayIndex, setRegeneratingDayIndex] = useState<number | null>(null);
  const [swappingMealId, setSwappingMealId] = useState<string | null>(null);
  const toastActionRef = useRef<(() => void) | null>(null);
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: "",
    severity: "info",
  });
  const historyInsights = useMemo(() => {
    if (!mealHistorySummary || !mealHistorySummary.weeks.length) {
      return null;
    }
    const recentWeek = mealHistorySummary.weeks[0];
    const totalMeals =
      mealHistorySummary.weeks.reduce((acc, week) => acc + week.eatenMeals + week.skippedMeals, 0) ||
      0;
    const topProteins = Object.entries(recentWeek.proteinCounts || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const leastServed = Object.entries(recentWeek.proteinCounts || {})
      .sort((a, b) => a[1] - b[1])
      .find((entry) => entry[1] > 0);
    return {
      trackedWeeks: mealHistorySummary.weeks.length,
      recentWeek,
      totalMeals,
      topProteins,
      leastServed,
    };
  }, [mealHistorySummary]);

  const showToast = (
    message: string,
    severity: ToastSeverity,
    options?: { actionLabel?: string; onAction?: () => void }
  ) => {
    toastActionRef.current = options?.onAction ?? null;
    setToast({
      open: true,
      message,
      severity,
      actionLabel: options?.actionLabel,
    });
  };

  const closeToast = () => {
    toastActionRef.current = null;
    setToast((prev) => ({ ...prev, open: false }));
  };

  const runToastAction = () => {
    const action = toastActionRef.current;
    closeToast();
    if (action) {
      action();
    }
  };

  const retryShoppingList = () => {
    setShoppingListError(null);
    setShoppingReloadToken((prev) => prev + 1);
  };

  const loadingMessage = useMemo(() => {
    if (planLoadingElapsedMs >= 15000) {
      return "Almost there...";
    }
    if (planLoadingElapsedMs >= 5000) {
      return "This is taking longer than usual...";
    }
    return "Generating your meal plan...";
  }, [planLoadingElapsedMs]);

  useEffect(() => {
    if (!preferences) return;
    setPreferencesPanelState(panelStateFromPreferences(preferences));
  }, [preferences]);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    const onboardingState = searchParams.get("onboarding");
    const skipKey = onboardingSkipKeyFor(user.id);

    if (onboardingState === "ready") {
      setPreferencesNotice("Your meal plan is ready!");
      setShowCustomizePrompt(false);
      window.localStorage.removeItem(skipKey);
    } else if (onboardingState === "skipped") {
      setPreferencesNotice("Using starter defaults. Customise your plan anytime.");
      setShowCustomizePrompt(true);
      window.localStorage.setItem(skipKey, "1");
    } else {
      setShowCustomizePrompt(window.localStorage.getItem(skipKey) === "1");
    }

    if (onboardingState) {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("onboarding");
      const nextUrl = nextParams.toString()
        ? `/meals?${nextParams.toString()}`
        : "/meals";
      router.replace(nextUrl);
    }
  }, [router, searchParams, user]);

  useEffect(() => {
    if (authLoading || prefLoading) return;
    if (user && !preferences) {
      router.replace("/onboarding");
    }
  }, [authLoading, prefLoading, preferences, router, user]);

  const fetchPlanFromAi = async (
    rotationHistory: RotationHistoryEntry[],
    preferencesOverride?: PreferencesInput
  ): Promise<{ plan: WeeklyMealPlan; enforcement: EnforcementInfo | null }> => {
    const effectivePreferences = preferencesOverride ?? preferences;
    if (!effectivePreferences) {
      throw new Error("Missing preferences for AI request");
    }
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), AI_CLIENT_TIMEOUT_MS);
    try {
      const response = await fetch("/api/meal-plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: effectivePreferences,
          rotationHistory,
          mealHistory: mealHistorySummary,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error("meal plan generation failed");
      }
      const data = (await response.json()) as {
        plan: WeeklyMealPlan;
        enforcement?: EnforcementInfo | null;
      };
      if (!data?.plan) {
        throw new Error("meal plan payload missing plan");
      }
      return { plan: data.plan, enforcement: data.enforcement ?? null };
    } catch {
      throw new Error("We couldn't generate your meal plan right now.");
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  useEffect(() => {
    if (!user) {
      runAsync(() => {
        setPreferences(null);
        setPreferenceTastes([]);
        setPrefLoading(false);
        setLoadingStepIndex(0);
      });
      return;
    }

    runAsync(() => {
      setPrefLoading(true);
      setError(null);
    });

    (async () => {
      try {
        const [
          { data: prefData, error: prefError },
          { data: profileData, error: profileError },
          { data: userAllergiesData, error: userAllergiesError },
        ] = await Promise.all([
            supabase
              .from("user_preferences")
              .select(
                "taste_preferences, goal, meal_complexity, lifestyle, cuisines, allergies, target_calories, target_protein, target_carbs, target_fat"
              )
              .eq("user_id", user.id)
              .maybeSingle<RawPreferences>(),
            supabase
              .from("profiles")
              .select(
                "locale, timezone, body_weight_kg, body_fat_percent, height_cm, activity_level, training_schedule, allergies, dislikes, cuisines, pantry_staples, household, delivery_preferences, sleep_hours, stress_level, notes"
              )
              .eq("id", user.id)
              .maybeSingle<ProfileRow>(),
            supabase
              .from("user_allergies")
              .select("*")
              .eq("user_id", user.id),
          ]);

        if (prefError) {
          console.error(prefError);
          showToast("Using starter defaults while we load your preferences.", "info");
        }
        if (profileError) {
          console.error(profileError);
        }
        if (userAllergiesError) {
          console.error(userAllergiesError);
        }

        const tastes = parseTasteArray(prefData?.taste_preferences);
        setPreferenceTastes(tastes);
        const allergyFromProfile = ensureStringArray(profileData?.allergies);
        const allergyFromUserPrefs = parseDelimitedList(prefData?.allergies);
        const allergyFromUserAllergies = normalizeUserAllergyRows(
          (userAllergiesData as UserAllergyRow[] | null) ?? null
        );
        const mergedAllergies = uniqueStrings([
          ...allergyFromProfile,
          ...allergyFromUserPrefs,
          ...allergyFromUserAllergies,
        ]);

        const macroTargets = prefData
          ? {
              calories: parseNumberField(prefData.target_calories),
              protein: parseNumberField(prefData.target_protein),
              carbs: parseNumberField(prefData.target_carbs),
              fat: parseNumberField(prefData.target_fat),
            }
          : null;
        const hasMacroTargets = macroTargets && hasAnyTarget(macroTargets);
        const onboardingMeta = readOnboardingMeta(profileData?.notes ?? null);
        const localOnboardingMeta = readOnboardingMetaFromStorage(user.id);

        const profileInfo = {
          locale: profileData?.locale ?? "UK",
          timezone: profileData?.timezone ?? null,
          bodyWeightKg: parseNumberField(profileData?.body_weight_kg),
          bodyFatPercent: parseNumberField(profileData?.body_fat_percent),
          heightCm: parseNumberField(profileData?.height_cm),
          activityLevel: profileData?.activity_level ?? null,
          dietaryMode: normalizeDietaryModeValue(prefData?.lifestyle ?? null),
          trainingSchedule: ensureStringArray(profileData?.training_schedule),
          allergies: mergedAllergies,
          dislikes: ensureStringArray(profileData?.dislikes),
          cuisines: uniqueStrings([
            ...ensureStringArray(profileData?.cuisines),
            ...parseDelimitedList(prefData?.cuisines),
          ]),
          pantryStaples: ensureStringArray(profileData?.pantry_staples),
          household: ensureStringArray(profileData?.household),
          deliveryPreferences: ensureStringArray(profileData?.delivery_preferences),
          sleepHours: parseNumberField(profileData?.sleep_hours),
          stressLevel: profileData?.stress_level ?? null,
          notes: profileData?.notes ?? null,
          mealsPerDay:
            onboardingMeta?.mealsPerDay ??
            localOnboardingMeta?.mealsPerDay ??
            5,
        };

        setPreferences({
          userId: user.id,
          tastes,
          goal: prefData?.goal ?? null,
          mealComplexity:
            typeof prefData?.meal_complexity === "number"
              ? complexityFromInt(prefData.meal_complexity)
              : null,
          macroTargets: hasMacroTargets ? macroTargets : null,
          profile: profileInfo,
        });
      } catch (loadError) {
        console.error("Failed loading preferences", loadError);
        setError(null);
        showToast("Couldn't load saved preferences. Using defaults for now.", "info");
        setPreferences({
          userId: user.id,
          tastes: [],
          goal: "maintain",
          mealComplexity: "normal",
          macroTargets: null,
          profile: {
            locale: "UK",
            timezone: null,
            bodyWeightKg: null,
            bodyFatPercent: null,
            heightCm: null,
            activityLevel: null,
            dietaryMode: "mixed",
            trainingSchedule: [],
            allergies: [],
            dislikes: [],
            cuisines: [],
            pantryStaples: [],
            household: [],
            deliveryPreferences: [],
            sleepHours: null,
            stressLevel: null,
            notes: null,
            mealsPerDay: readOnboardingMetaFromStorage(user.id)?.mealsPerDay ?? 5,
          },
        });
      } finally {
        setPrefLoading(false);
      }
    })();
  }, [router, user]);

  useEffect(() => {
    setClientReady(true);
  }, []);

  useEffect(() => {
    planLoadingRef.current = planLoading;
    if (planLoading) {
      planLoadingStartedAtRef.current = Date.now();
      setPlanLoadingElapsedMs(0);
    } else {
      setPlanLoadingElapsedMs(0);
    }
  }, [planLoading]);

  useEffect(() => {
    if (!planLoading) return;
    const startedAt = planLoadingStartedAtRef.current || Date.now();
    const interval = setInterval(() => {
      setPlanLoadingElapsedMs(Date.now() - startedAt);
    }, 500);
    return () => clearInterval(interval);
  }, [planLoading]);

  useEffect(() => {
    if (!user || !preferences || !preferenceSignature) {
      runAsync(() => {
        setPlan(null);
        setEnforcement(null);
        setPlanLoading(false);
        planSignatureRef.current = null;
      });
      return;
    }
    if (typeof window === "undefined") return;

    const signature = preferenceSignature;
    const key = storageKeyFor(user.id);
    const cachedRaw = window.localStorage.getItem(key);
    let cachedPlan: WeeklyMealPlan | null = null;
    if (cachedRaw) {
      try {
        cachedPlan = JSON.parse(cachedRaw) as WeeklyMealPlan;
      } catch {
        cachedPlan = null;
      }
    }

    if (cachedPlan && cachedPlan.preferenceSignature === signature && planSignatureRef.current === signature) {
      setPlan(cachedPlan);
      setPlanLoading(false);
      setLoadingStepIndex(LOADING_STEPS.length);
      return;
    }

    let canceled = false;

    const loadPlan = async () => {
      const loadStart = performance.now();

      // Try stored plan on server first to keep state across devices
      try {
        const storedPayload = await fetchStoredPlan(weekStartISO(new Date().toISOString()));
        if (
          storedPayload?.plan &&
          (!signature || storedPayload.plan.preferenceSignature === signature)
        ) {
          const storedEnforced = storedPayload.enforcement
            ? {
                plan: storedPayload.plan,
                enforcement: storedPayload.enforcement,
              }
            : enforcePlanMacros(storedPayload.plan, preferences);
          setPlan(storedEnforced.plan);
          setEnforcement(storedEnforced.enforcement);
          await persistPlan(
            storedEnforced.plan,
            storedEnforced.plan.preferenceSignature ?? signature,
            storedEnforced.enforcement
          );
          setPlanLoading(false);
          setLoadingStepIndex(LOADING_STEPS.length);
          console.log("Meal plan load", {
            source: "server",
            duration: Math.round(performance.now() - loadStart),
          });
          return;
        }
      } catch (error) {
        console.error("Failed to load plan from server", error);
        showToast("Couldn't load your saved plan. Trying a fresh generation...", "error", {
          actionLabel: "Retry",
          onAction: () => {
            router.refresh();
          },
        });
      }

      if (cachedPlan && cachedPlan.preferenceSignature === signature) {
        const cachedEnforced = enforcePlanMacros(cachedPlan, preferences);
        setPlan(cachedEnforced.plan);
        setEnforcement(cachedEnforced.enforcement);
        planSignatureRef.current = signature;
        void persistPlan(cachedEnforced.plan, signature, cachedEnforced.enforcement);
        setPlanLoading(false);
        setLoadingStepIndex(LOADING_STEPS.length);
        console.log("Meal plan load", {
          source: "cache",
          duration: Math.round(performance.now() - loadStart),
        });
        return;
      }

      setPlanLoading(true);
      setLoadingStepIndex(0);
      const rotationHistory = cachedPlan ? rotationHistoryFromPlan(cachedPlan) : [];

      try {
        setLoadingStepIndex(1);
        const aiResponse = await fetchPlanFromAi(rotationHistory);
        const aiPlan = aiResponse.plan;
        if (canceled) return;
        setPlan(aiPlan);
        setEnforcement(aiResponse.enforcement);
        await persistPlan(aiPlan, signature, aiResponse.enforcement ?? null);
        setPlanLoading(false);
        setLoadingStepIndex(LOADING_STEPS.length);
        console.log("Meal plan load", {
          source: "openai",
          duration: Math.round(performance.now() - loadStart),
        });
        return;
      } catch (error) {
        console.error("AI meal plan request failed", error);
        showToast("Couldn't generate from server. Using local fallback meals.", "error", {
          actionLabel: "Retry",
          onAction: () => {
            void handleRegenerate();
          },
        });
      }

      if (canceled) return;
      const fallbackPlan = generateFallbackMealPlan(preferences);
      const fallbackEnforced = enforcePlanMacros(fallbackPlan, preferences);
      setPlan(fallbackEnforced.plan);
      setEnforcement(fallbackEnforced.enforcement);
      await persistPlan(fallbackEnforced.plan, signature, fallbackEnforced.enforcement);
      setPlanLoading(false);
      setLoadingStepIndex(LOADING_STEPS.length);
      console.log("Meal plan load", {
        source: "fallback",
        duration: Math.round(performance.now() - loadStart),
      });
    };

    loadPlan();

    return () => {
      canceled = true;
    };
  }, [preferences, preferenceSignature, user]);

  const persistPlan = async (
    nextPlan: WeeklyMealPlan,
    signature = preferenceSignature,
    enforcementState: EnforcementInfo | null = enforcement
  ) => {
    if (!user || typeof window === "undefined") return;
    window.localStorage.setItem(storageKeyFor(user.id), JSON.stringify(nextPlan));
    if (signature) {
      planSignatureRef.current = signature;
    }
    try {
      await fetch("/api/meal-plan/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: toDateOnly(nextPlan.weekStart ?? new Date().toISOString()),
          plan: nextPlan,
          enforcement: enforcementState,
        }),
      });
    } catch (error) {
      console.error("Failed to persist plan state", error);
      showToast("Couldn't save your latest plan changes. Try again.", "error", {
        actionLabel: "Retry",
        onAction: () => {
          void persistPlan(nextPlan, signature, enforcementState);
        },
      });
    }
  };

  const fetchStoredPlan = async (weekStart: string) => {
    try {
      const response = await fetch(
        `/api/meal-plan/state?weekStart=${weekStart}`
      );
      if (!response.ok) return null;
      const data = (await response.json()) as {
        plan?: WeeklyMealPlan | null;
        enforcement?: EnforcementInfo | null;
      };
      if (!data.plan) return null;
      return {
        plan: data.plan,
        enforcement: data.enforcement ?? null,
      };
    } catch (error) {
      console.error("Failed to load stored plan", error);
      return null;
    }
  };

  useEffect(() => {
    if (!user) {
      setMealHistorySummary(null);
      return;
    }
    let active = true;
    (async () => {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 30);
      const fromISO = fromDate.toISOString().split("T")[0];
      const [{ data: historyRows, error: historyError }, { data: logRows, error: logsError }] =
        await Promise.all([
          supabase
            .from("plan_history")
            .select("plan_id, week_start, date, meals")
            .eq("user_id", user.id)
            .gte("week_start", fromISO),
          supabase
            .from("meal_logs")
            .select("date, status")
            .eq("user_id", user.id)
            .gte("date", fromISO),
        ]);
      if (!active) return;
      if (historyError) {
        console.error("Failed to load plan history", historyError);
        return;
      }
      if (logsError) {
        console.error("Failed to load meal logs", logsError);
      }
      const weekMap = new Map<
        string,
        {
          weekStart: string;
          proteinCounts: Record<string, number>;
          mealCount: number;
          totalCalories: number;
          eatenMeals: number;
          skippedMeals: number;
        }
      >();
      historyRows?.forEach((row) => {
        const weekKey = weekStartISO(row.week_start ?? row.date);
        const entry =
          weekMap.get(weekKey) ??
          {
            weekStart: weekKey,
            proteinCounts: {},
            mealCount: 0,
            totalCalories: 0,
            eatenMeals: 0,
            skippedMeals: 0,
          };
        const meals: StoredMealInstance[] = row.meals ?? [];
        meals.forEach((meal) => {
          const protein = meal.proteinType ?? "mixed";
          entry.proteinCounts[protein] = (entry.proteinCounts[protein] ?? 0) + 1;
          entry.mealCount += 1;
          entry.totalCalories += meal.macros?.calories ?? 0;
        });
        weekMap.set(weekKey, entry);
      });
      logRows?.forEach((log) => {
        const weekKey = weekStartISO(log.date);
        const entry = weekMap.get(weekKey);
        if (!entry) return;
        if (log.status === "eaten") entry.eatenMeals += 1;
        if (log.status === "skipped") entry.skippedMeals += 1;
      });
      const summary: MealHistorySummary = {
        lastGeneratedPlanId: historyRows?.[historyRows.length - 1]?.plan_id,
        weeks: Array.from(weekMap.values())
          .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))
          .map((entry) => ({
            weekStart: entry.weekStart,
            proteinCounts: entry.proteinCounts,
            skippedMeals: entry.skippedMeals,
            eatenMeals: entry.eatenMeals,
            averageCalories:
              entry.mealCount > 0 ? Math.round(entry.totalCalories / entry.mealCount) : 0,
          })),
      };
      setMealHistorySummary(summary);
    })();
    return () => {
      active = false;
    };
  }, [supabase, user, plan?.id]);

  const handleRegenerate = async () => {
    if (!preferences || !preferenceSignature) return;
    setRegeneratingWeek(true);
    setPlanLoading(true);
    setLoadingStepIndex(0);
    const rotationHistory = rotationHistoryFromPlan(plan);
    try {
      setLoadingStepIndex(1);
      const aiResponse = await fetchPlanFromAi(rotationHistory);
      const aiPlan = aiResponse.plan;
      setPlan(aiPlan);
      setEnforcement(aiResponse.enforcement);
      await persistPlan(aiPlan, preferenceSignature, aiResponse.enforcement ?? null);
      setLoadingStepIndex(LOADING_STEPS.length);
      showToast("Week regenerated.", "success");
    } catch (error) {
      console.error("Unable to regenerate via AI, using fallback", error);
      const fallbackPlan = plan
        ? regenerateWeekInPlan(plan, preferences)
        : generateFallbackMealPlan(preferences);
      const fallbackEnforced = enforcePlanMacros(fallbackPlan, preferences);
      setPlan(fallbackEnforced.plan);
      setEnforcement(fallbackEnforced.enforcement);
      await persistPlan(
        fallbackEnforced.plan,
        preferenceSignature,
        fallbackEnforced.enforcement
      );
      setLoadingStepIndex(LOADING_STEPS.length);
      showToast("Couldn't regenerate from server. Showing fallback meals.", "error", {
        actionLabel: "Retry",
        onAction: () => {
          void handleRegenerate();
        },
      });
    } finally {
      setPlanLoading(false);
      setRegeneratingWeek(false);
    }
  };

  const handleRegenerateDay = async (dayIndex: number) => {
    if (!plan || !preferences) return;
    setRegeneratingDayIndex(dayIndex);
    setError(null);
    try {
      const response = await fetch("/api/meal-plan/generate/day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences,
          plan,
          dayIndex,
          dayDate: plan.days[dayIndex]?.date,
        }),
      });
      if (!response.ok) {
        throw new Error("regenerate day request failed");
      }
      const data = (await response.json()) as {
        plan?: WeeklyMealPlan;
        enforcement?: EnforcementInfo | null;
      };
      const nextPlan = data.plan ?? regenerateDayInPlan(plan, dayIndex, preferences);
      const nextEnforcement = data.enforcement ?? null;
      setPlan(nextPlan);
      setEnforcement(nextEnforcement);
      await persistPlan(nextPlan, preferenceSignature, nextEnforcement);
      showToast("Day regenerated.", "success");
    } catch (error) {
      console.error("Unable to regenerate day via API, using fallback", error);
      try {
        const fallbackPlan = regenerateDayInPlan(plan, dayIndex, preferences);
        const fallbackEnforced = enforcePlanMacros(fallbackPlan, preferences);
        setPlan(fallbackEnforced.plan);
        setEnforcement(fallbackEnforced.enforcement);
        await persistPlan(
          fallbackEnforced.plan,
          preferenceSignature,
          fallbackEnforced.enforcement
        );
        showToast("Couldn't regenerate from server. Applied local fallback.", "error", {
          actionLabel: "Retry",
          onAction: () => {
            void handleRegenerateDay(dayIndex);
          },
        });
      } catch {
        setError("We couldn't regenerate that day. Please try again.");
        showToast("Couldn't regenerate day. Try again.", "error", {
          actionLabel: "Retry",
          onAction: () => {
            void handleRegenerateDay(dayIndex);
          },
        });
      }
    } finally {
      setRegeneratingDayIndex(null);
    }
  };

  const handleSwapMeal = async (dayIndex: number, mealIndex: number) => {
    if (!plan || !preferences) return;
    const mealId = plan.days[dayIndex]?.meals[mealIndex]?.instanceId ?? null;
    setSwappingMealId(mealId);
    try {
      const response = await fetch("/api/meal-plan/generate/meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences,
          plan,
          dayIndex,
          mealIndex,
        }),
      });
      if (!response.ok) {
        throw new Error("swap meal request failed");
      }
      const data = (await response.json()) as {
        plan?: WeeklyMealPlan;
        enforcement?: EnforcementInfo | null;
      };
      const nextPlan = data.plan ?? swapMealInPlan(plan, dayIndex, mealIndex, preferences);
      const nextEnforcement = data.enforcement ?? null;
      setPlan(nextPlan);
      setEnforcement(nextEnforcement);
      await persistPlan(nextPlan, preferenceSignature, nextEnforcement);
      showToast("Meal swapped.", "success");
    } catch (error) {
      console.error("Unable to swap meal", error);
      showToast("Couldn't swap meal. Try again.", "error", {
        actionLabel: "Retry",
        onAction: () => {
          void handleSwapMeal(dayIndex, mealIndex);
        },
      });
    } finally {
      setSwappingMealId(null);
    }
  };

  const togglePanelArrayValue = (
    key: "allergies" | "cuisines",
    value: string
  ) => {
    setPreferencesPanelState((prev) => {
      const exists = prev[key].includes(value);
      return {
        ...prev,
        [key]: exists ? prev[key].filter((item) => item !== value) : [...prev[key], value],
      };
    });
  };

  const addDislikeTag = (rawValue: string) => {
    const normalized = rawValue.trim();
    if (!normalized) return;
    setPreferencesPanelState((prev) => ({
      ...prev,
      dislikes: uniqueStrings([...prev.dislikes, normalized]),
    }));
    setDislikeInput("");
  };

  const removeDislikeTag = (tag: string) => {
    setPreferencesPanelState((prev) => ({
      ...prev,
      dislikes: prev.dislikes.filter((item) => item !== tag),
    }));
  };

  const saveAllergiesToTable = async (userId: string, allergies: string[]) => {
    const { error: deleteError } = await supabase
      .from("user_allergies")
      .delete()
      .eq("user_id", userId);
    if (deleteError) {
      throw deleteError;
    }
    if (!allergies.length) {
      return;
    }
    const allergyRows = allergies.map((allergy) => ({
      user_id: userId,
      allergy: allergy.toLowerCase(),
    }));
    const { error: allergyError } = await supabase
      .from("user_allergies")
      .insert(allergyRows);
    if (!allergyError) {
      return;
    }
    const allergenRows = allergies.map((allergy) => ({
      user_id: userId,
      allergen: allergy.toLowerCase(),
    }));
    const { error: allergenError } = await supabase
      .from("user_allergies")
      .insert(allergenRows);
    if (!allergenError) {
      return;
    }
    const nameRows = allergies.map((allergy) => ({
      user_id: userId,
      name: allergy.toLowerCase(),
    }));
    const { error: nameError } = await supabase
      .from("user_allergies")
      .insert(nameRows);
    if (nameError) {
      throw nameError;
    }
  };

  const handleSavePreferencePanel = async () => {
    if (!user || !preferences) return;
    setPreferencesSaving(true);
    setError(null);
    setPreferencesNotice(null);
    const sanitizedAllergies = uniqueStrings(preferencesPanelState.allergies);
    const sanitizedDislikes = uniqueStrings(preferencesPanelState.dislikes);
    const sanitizedCuisines = uniqueStrings(preferencesPanelState.cuisines);
    const dietaryMode =
      preferencesPanelState.dietaryMode === "mixed"
        ? null
        : preferencesPanelState.dietaryMode;

    const nextPreferences: PreferencesInput = {
      ...preferences,
      profile: {
        ...(preferences.profile ?? {}),
        dietaryMode,
        allergies: sanitizedAllergies,
        dislikes: sanitizedDislikes,
        cuisines: sanitizedCuisines,
      },
    };
    const nextSignature = preferenceSignatureFor(nextPreferences);

    try {
      const { error: prefSaveError } = await supabase.from("user_preferences").upsert({
        user_id: user.id,
        lifestyle: dietaryMode,
        allergies: sanitizedAllergies.length ? sanitizedAllergies.join(", ") : null,
        cuisines: sanitizedCuisines.length ? sanitizedCuisines.join(", ") : null,
      });
      if (prefSaveError) {
        throw prefSaveError;
      }

      const { error: profileSaveError } = await supabase.from("profiles").upsert({
        id: user.id,
        allergies: sanitizedAllergies.length ? sanitizedAllergies : null,
        dislikes: sanitizedDislikes.length ? sanitizedDislikes : null,
        cuisines: sanitizedCuisines.length ? sanitizedCuisines : null,
      });
      if (profileSaveError) {
        throw profileSaveError;
      }

      await saveAllergiesToTable(user.id, sanitizedAllergies);

      setPreferencesPanelOpen(false);
      setPreferencesNotice("Preferences saved. Regenerating your meals...");
      showToast("Preferences saved. Regenerating your meals...", "info");
      setRegeneratingWeek(true);
      setPlanLoading(true);
      setLoadingStepIndex(0);
      const rotationHistory = rotationHistoryFromPlan(plan);

      try {
        setLoadingStepIndex(1);
        const aiResponse = await fetchPlanFromAi(rotationHistory, nextPreferences);
        setPlan(aiResponse.plan);
        setEnforcement(aiResponse.enforcement);
        await persistPlan(aiResponse.plan, nextSignature, aiResponse.enforcement ?? null);
        showToast("Preferences applied.", "success");
      } catch (generationError) {
        console.error("Unable to regenerate via AI after saving preferences", generationError);
        const fallbackPlan = plan
          ? regenerateWeekInPlan(plan, nextPreferences)
          : generateFallbackMealPlan(nextPreferences);
        const fallbackEnforced = enforcePlanMacros(fallbackPlan, nextPreferences);
        setPlan(fallbackEnforced.plan);
        setEnforcement(fallbackEnforced.enforcement);
        await persistPlan(
          fallbackEnforced.plan,
          nextSignature,
          fallbackEnforced.enforcement
        );
        showToast("Applied preferences with local fallback generation.", "error", {
          actionLabel: "Retry",
          onAction: () => void handleSavePreferencePanel(),
        });
      } finally {
        setPlanLoading(false);
        setRegeneratingWeek(false);
        setLoadingStepIndex(LOADING_STEPS.length);
      }

      setPreferences(nextPreferences);
      setShowCustomizePrompt(false);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(onboardingSkipKeyFor(user.id));
      }
    } catch (saveError) {
      console.error("Failed to save preference panel", saveError);
      setError("We couldn't save your preferences. Please try again.");
      showToast("Couldn't save preferences. Try again.", "error", {
        actionLabel: "Retry",
        onAction: () => void handleSavePreferencePanel(),
      });
    } finally {
      setPreferencesSaving(false);
    }
  };

  const weeklyMacroTargets = useMemo(() => {
    if (!macroTargets) return null;
    return {
      calories:
        typeof macroTargets.calories === "number"
          ? macroTargets.calories * WORKDAY_COUNT
          : null,
      protein:
        typeof macroTargets.protein === "number"
          ? macroTargets.protein * WORKDAY_COUNT
          : null,
      carbs:
        typeof macroTargets.carbs === "number"
          ? macroTargets.carbs * WORKDAY_COUNT
          : null,
      fat:
        typeof macroTargets.fat === "number" ? macroTargets.fat * WORKDAY_COUNT : null,
    };
  }, [macroTargets]);

  const displayDays = useMemo(() => {
    if (!plan) return [];
    return plan.days.slice(0, WORKDAY_COUNT);
  }, [plan]);

  const workweekTotals = useMemo<MacroBreakdown>(
    () => sumMacroBreakdowns(displayDays.map((day) => day.totals)),
    [displayDays]
  );

  const workweekAverages = useMemo(() => {
    const divisor = displayDays.length || WORKDAY_COUNT;
    return {
      calories: Math.round(workweekTotals.calories / divisor),
      protein: Math.round(workweekTotals.protein / divisor),
      carbs: Math.round(workweekTotals.carbs / divisor),
      fat: Math.round(workweekTotals.fat / divisor),
    };
  }, [displayDays.length, workweekTotals]);

  useEffect(() => {
    if (!displayDays.length) {
      setExpandedDayId(null);
      return;
    }
    const hasExpanded = expandedDayId && displayDays.some((day) => day.id === expandedDayId);
    if (hasExpanded) return;
    const today = toDateOnly(new Date().toISOString());
    const todayDay = displayDays.find((day) => toDateOnly(day.date) === today);
    setExpandedDayId(todayDay?.id ?? displayDays[0].id);
  }, [displayDays, expandedDayId]);

  const chartData = useMemo(() => {
    return displayDays.map((day) => ({
      label: day.label.slice(0, 3),
      calories: day.totals.calories,
      protein: day.totals.protein,
      carbs: day.totals.carbs,
      fat: day.totals.fat,
    }));
  }, [displayDays]);

  const weekRange = useMemo(() => {
    if (!plan) return "";
    const start = new Date(plan.weekStart);
    const end = addDays(start, WORKDAY_COUNT - 1);
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }, [plan]);

  const shoppingList = useMemo<ShoppingListItem[]>(() => {
    if (!plan) return [];
    return buildShoppingList({
      ...plan,
      days: displayDays,
      weeklyTotals: workweekTotals,
    });
  }, [displayDays, plan, workweekTotals]);

  useEffect(() => {
    if (!plan || !shoppingList.length) {
      setNormalizedList([]);
      setBasketPricing(null);
      setNormalizingList(false);
      setShoppingListError(null);
      return;
    }
    if (authLoading || !user) {
      setNormalizedList(shoppingList);
      setBasketPricing(buildLocalBasketPricing(shoppingList));
      setNormalizingList(false);
      setShoppingListError(null);
      return;
    }
    let active = true;
    const weekStart = toDateOnly(plan.weekStart ?? new Date().toISOString());
    const loadList = async () => {
      setNormalizingList(true);
      setShoppingListError(null);
      let hadFailure = false;
      // Try cached server list first
      try {
        const cached = await fetch(`/api/shopping-list?weekStart=${weekStart}`, {
          method: "GET",
          cache: "no-store",
        });
        if (cached.ok) {
          const data = (await cached.json()) as {
            items?: ShoppingListItem[];
            pricing?: BasketPricing;
          };
          if (active && data.items?.length) {
            setNormalizedList(data.items);
            setBasketPricing(data.pricing ?? buildLocalBasketPricing(data.items));
            setNormalizingList(false);
            return;
          }
        } else {
          hadFailure = true;
        }
      } catch (error) {
        console.error("Failed to load cached shopping list", error);
        hadFailure = true;
      }

      // Regenerate and persist
      try {
        const response = await fetch("/api/shopping-list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weekStart,
            plan,
            locale: profileLocale,
          }),
        });
        if (response.ok) {
          const data = (await response.json()) as {
            items?: ShoppingListItem[];
            pricing?: BasketPricing;
          };
          if (active) {
            const resolvedItems = data.items ?? shoppingList;
            setNormalizedList(resolvedItems);
            setBasketPricing(data.pricing ?? buildLocalBasketPricing(resolvedItems));
            setNormalizingList(false);
            return;
          }
        } else {
          hadFailure = true;
        }
      } catch (error) {
        console.error("Failed to regenerate shopping list", error);
        hadFailure = true;
      }

      if (active) {
        setNormalizedList(shoppingList);
        const localPricing = buildLocalBasketPricing(shoppingList);
        setBasketPricing(localPricing);
        setNormalizingList(false);
        if (hadFailure) {
          if (localPricing) {
            setShoppingListError(null);
            showToast("Using local shopping list estimates.", "info");
          } else {
            setShoppingListError("Couldn't load shopping list. Try again.");
            showToast("Couldn't load shopping list. Try again.", "error", {
              actionLabel: "Retry",
              onAction: () => {
                setShoppingReloadToken((prev) => prev + 1);
              },
            });
          }
        }
      }
    };

    loadList();

    return () => {
      active = false;
    };
  }, [authLoading, plan, profileLocale, shoppingList, shoppingReloadToken, user]);

  const displayShoppingList = normalizedList?.length ? normalizedList : shoppingList;

  const shoppingItemPrices = useMemo(() => {
    const keyToPrice = new Map<string, number | null>();
    if (!basketPricing?.itemPrices?.length || !displayShoppingList.length) {
      return keyToPrice;
    }

    if (basketPricing.itemPrices.length === displayShoppingList.length) {
      displayShoppingList.forEach((item, index) => {
        const quote = basketPricing.itemPrices[index];
        keyToPrice.set(
          shoppingItemKey(item),
          quote && quote.matched ? quote.totalCost : null
        );
      });
      return keyToPrice;
    }

    const fallbackByIngredient = new Map<string, BasketPricingLine>();
    basketPricing.itemPrices.forEach((quote) => {
      const ingredientKey = quote.ingredient.trim().toLowerCase();
      if (!fallbackByIngredient.has(ingredientKey)) {
        fallbackByIngredient.set(ingredientKey, quote);
      }
    });

    displayShoppingList.forEach((item) => {
      const ingredientKey = (item.displayName ?? item.name).trim().toLowerCase();
      const quote = fallbackByIngredient.get(ingredientKey);
      keyToPrice.set(
        shoppingItemKey(item),
        quote && quote.matched ? quote.totalCost : null
      );
    });

    return keyToPrice;
  }, [basketPricing, displayShoppingList]);

  const groupedShoppingList = useMemo(
    () =>
      displayShoppingList.length
        ? Array.from(
            displayShoppingList.reduce((map, item) => {
              const key = item.category ?? "Pantry";
              if (!map.has(key)) {
                map.set(key, []);
              }
              map.get(key)!.push(item);
              return map;
            }, new Map<string, ShoppingListItem[]>())
          ).map(([category, items]) => ({
            category,
            items: items.sort((a, b) => a.name.localeCompare(b.name)),
          }))
            .map(({ category, items }) => {
              const subtotal = items.reduce((total, item) => {
                const price = shoppingItemPrices.get(shoppingItemKey(item));
                return typeof price === "number" ? total + price : total;
              }, 0);
              const pricedItems = items.filter((item) => {
                const price = shoppingItemPrices.get(shoppingItemKey(item));
                return typeof price === "number";
              }).length;

              return {
                category,
                items,
                subtotal: Number(subtotal.toFixed(2)),
                hasPricedItems: pricedItems > 0,
              };
            })
            .sort((a, b) => {
              const rankDiff =
                shoppingCategoryRank(a.category) - shoppingCategoryRank(b.category);
              return rankDiff !== 0 ? rankDiff : a.category.localeCompare(b.category);
            })
        : [],
    [displayShoppingList, shoppingItemPrices]
  );

  if (authLoading || prefLoading) {
    return (
      <Stack minHeight="60vh" alignItems="center" justifyContent="center" spacing={2}>
        <CircularProgress color="secondary" />
        <Typography color="text.secondary">Personalizing your meals...</Typography>
      </Stack>
    );
  }

  if (!user) {
    return (
      <Card variant="outlined" sx={{ maxWidth: 520, mx: "auto", mt: 8 }}>
        <CardContent>
          <Stack spacing={2} alignItems="flex-start">
            <Typography variant="h5">Sign in to see meals</Typography>
            <Typography color="text.secondary">
              We need your profile to pull preferences and generate meal plans.
            </Typography>
            <Button component={NextLink} href="/login" variant="contained">
              Go to login
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (!preferences) {
    return (
      <Card variant="outlined" sx={{ maxWidth: 620, mx: "auto", mt: 8 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5">
              Set your preferences to get personalised meals {"->"}
            </Typography>
            <Typography color="text.secondary">
              We need your onboarding settings before generating your first plan.
            </Typography>
            <Button component={NextLink} href="/onboarding" variant="contained" color="secondary">
              Start onboarding
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={4}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
      >
        <Box>
          <Typography variant="overline" color="secondary">
            Meal studio
          </Typography>
          <Typography variant="h3" component="h1" fontWeight={700} gutterBottom>
            Your weekly meals
          </Typography>
          <Typography color="text.secondary">
            Fresh plan generated from your tastes, goals, and cooking bandwidth.
          </Typography>
          {preferenceTastes.length > 0 && (
            <Stack direction="row" spacing={1} mt={2} flexWrap="wrap" useFlexGap>
              {preferenceTastes.slice(0, 4).map((taste) => (
                <Chip
                  key={taste}
                  label={taste.replace("-", " ")}
                  size="small"
                  sx={{ textTransform: "capitalize" }}
                />
              ))}
            </Stack>
          )}
          {(enforcement || basketPricing) && (
            <Stack direction="row" spacing={1} mt={1.5} flexWrap="wrap" useFlexGap>
              {enforcement && (
                <Tooltip title={enforcement.summary} arrow>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={macroStatusMeta(enforcement).color}
                    icon={macroStatusMeta(enforcement).icon}
                    label={macroStatusMeta(enforcement).label}
                  />
                </Tooltip>
              )}
              {basketPricing && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Estimated weekly cost: ~${formatGbp(basketPricing.subtotal)}`}
                />
              )}
            </Stack>
          )}
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            variant="text"
            color="secondary"
            onClick={() => {
              setPreferencesPanelState(panelStateFromPreferences(preferences));
              setDislikeInput("");
              setPreferencesPanelOpen(true);
            }}
          >
            Refine tastes
          </Button>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => setShoppingExpanded((prev) => !prev)}
            disabled={!displayShoppingList.length}
          >
            {shoppingExpanded ? "Hide shopping list" : "Shopping list"}
          </Button>
          <Button
            startIcon={
              regeneratingWeek ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <RefreshRoundedIcon />
              )
            }
            variant="contained"
            color="secondary"
            onClick={handleRegenerate}
            disabled={regeneratingWeek || planLoading}
          >
            {regeneratingWeek ? "Regenerating week..." : "Regenerate week"}
          </Button>
        </Stack>
      </Stack>

      {historyInsights && (
        <Card
          variant="outlined"
          sx={{
            borderColor: "rgba(255,255,255,0.08)",
            bgcolor: "rgba(10,14,26,0.7)",
          }}
        >
          <CardContent>
            <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
              <Box flex={1}>
                <Typography variant="overline" color="secondary">
                  Last {historyInsights.trackedWeeks} weeks
                </Typography>
                <Typography variant="h5" fontWeight={600}>
                  Ovona is personalizing from your history
                </Typography>
                <Typography color="text.secondary">
                  {historyInsights.totalMeals} meals logged - this week looks to balance
                  your proteins and recover skipped meals.
                </Typography>
              </Box>
              <Stack
                direction="row"
                spacing={2}
                flexWrap="wrap"
                useFlexGap
                alignItems="center"
              >
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Top proteins last week
                  </Typography>
                  <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap>
                    {historyInsights.topProteins.map(([protein, count]) => (
                      <Chip key={protein} label={`${protein} (${count})`} size="small" />
                    ))}
                  </Stack>
                </Box>
                {historyInsights.leastServed && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Needs love
                    </Typography>
                    <Chip
                      label={`${historyInsights.leastServed[0]} (${historyInsights.leastServed[1]})`}
                      size="small"
                      color="warning"
                      sx={{ mt: 1 }}
                    />
                  </Box>
                )}
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Meals skipped last week
                  </Typography>
                  <Typography variant="h5" fontWeight={600}>
                    {historyInsights.recentWeek.skippedMeals}
                  </Typography>
                </Box>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {error && <Alert severity="error">{error}</Alert>}
      {preferencesNotice && <Alert severity="success">{preferencesNotice}</Alert>}
      {showCustomizePrompt && preferences && (
        <Alert
          severity="info"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setPreferencesPanelState(panelStateFromPreferences(preferences));
                setDislikeInput("");
                setPreferencesPanelOpen(true);
              }}
            >
              Customise your plan {"->"}
            </Button>
          }
        >
          Starter defaults are active for now.
        </Alert>
      )}

      {planLoading && (
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Card
            variant="outlined"
            sx={{
              bgcolor: "rgba(12,16,32,0.88)",
              borderColor: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(18px)",
            }}
          >
            <CardContent>
              <Stack spacing={1.25}>
                <Typography
                  variant="h5"
                  fontWeight={700}
                  sx={{
                    animation: "ovonaPulse 1.8s ease-in-out infinite",
                    "@keyframes ovonaPulse": {
                      "0%": { opacity: 0.7 },
                      "50%": { opacity: 1 },
                      "100%": { opacity: 0.7 },
                    },
                  }}
                >
                  {loadingMessage}
                </Typography>
                <Typography color="text.secondary">
                  Generating your meal plan...
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {LOADING_STEPS[Math.min(loadingStepIndex, LOADING_STEPS.length - 1)]?.label ??
                    "Preparing meals"}
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(5, minmax(0, 1fr))",
              },
            }}
          >
            {Array.from({ length: 5 }).map((_, index) => (
              <Card
                key={`loading-card-${index}`}
                variant="outlined"
                sx={{
                  borderColor: "rgba(255,255,255,0.08)",
                  bgcolor: "rgba(10,14,26,0.84)",
                  minHeight: 220,
                }}
              >
                <CardContent>
                  <Stack spacing={1.5}>
                    <Skeleton variant="text" width="35%" height={18} />
                    <Skeleton variant="text" width="80%" height={30} />
                    <Skeleton
                      variant="rounded"
                      width="42%"
                      height={24}
                      sx={{ borderRadius: 999 }}
                    />
                    <Skeleton variant="text" width="100%" height={22} />
                    <Skeleton
                      variant="rounded"
                      width="100%"
                      height={36}
                      sx={{ borderRadius: 1.5, mt: 3 }}
                    />
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Stack>
      )}

      {!planLoading && clientReady && preferences && !plan && (
        <Card variant="outlined" sx={{ maxWidth: 620, mx: "auto", mt: 2 }}>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5">Generate your first meal plan</Typography>
              <Typography color="text.secondary">
                Create a full week in one click, then swap or regenerate anything you want.
              </Typography>
              <Button
                variant="contained"
                color="secondary"
                onClick={handleRegenerate}
                disabled={regeneratingWeek}
              >
                {regeneratingWeek ? "Generating..." : "Generate plan"}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {plan && !planLoading && clientReady && (
        <>
          <Stack
            spacing={3}
            direction={{ xs: "column", md: "row" }}
            alignItems="stretch"
          >
            <Card
              variant="outlined"
              sx={{
                width: { xs: "100%", md: 320 },
                flexShrink: 0,
                bgcolor: "rgba(12,16,32,0.85)",
                backdropFilter: "blur(18px)",
              }}
            >
              <CardHeader
                avatar={<RestaurantMenuRoundedIcon color="secondary" />}
                title="Weekly totals"
                subheader={weekRange}
              />
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1}>
                    <Chip
                      label={goalLabels[preferences.goal ?? "maintain"] ?? "Balanced"}
                      size="small"
                    />
                    {preferences.mealComplexity && (
                      <Chip
                        label={complexityLabels[preferences.mealComplexity]}
                        size="small"
                      />
                    )}
                  </Stack>
                  {enforcement && (
                    <Tooltip title={enforcement.summary} arrow>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={macroStatusMeta(enforcement).color}
                        icon={macroStatusMeta(enforcement).icon}
                        label={macroStatusMeta(enforcement).label}
                        sx={{ alignSelf: "flex-start" }}
                      />
                    </Tooltip>
                  )}
                  <Grid container spacing={2}>
                    {macroDisplay.map((macro) => {
                      const macroKey = macro.key as keyof MacroTargets;
                      const weeklyTarget = weeklyMacroTargets?.[macroKey] ?? null;
                      const dailyTarget = macroTargets?.[macroKey] ?? null;
                      const total = workweekTotals[macro.key];
                      const average = workweekAverages[macro.key];
                      const unitLabel = macro.key === "calories" ? "kcal" : macro.unit;
                      return (
                        <Grid item xs={6} key={macro.key}>
                          <Box
                            sx={{
                              borderRadius: 2,
                              p: 2,
                              border: "1px solid rgba(255,255,255,0.08)",
                            }}
                          >
                            <Typography variant="subtitle2" color="text.secondary">
                              {macro.label}
                            </Typography>
                            <Typography variant="h5" sx={{ mb: 0.25 }}>
                              {total.toLocaleString()} {unitLabel}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {`Weekly: ${total.toLocaleString()} ${unitLabel} (avg ${average.toLocaleString()}/day)`}
                            </Typography>
                            {typeof dailyTarget === "number" && (
                              <Typography variant="body2" color="text.secondary">
                                {`Target ${
                                  typeof weeklyTarget === "number"
                                    ? formatNumber(weeklyTarget)
                                    : "-"
                                } ${unitLabel}/wk (${formatNumber(dailyTarget)} ${
                                  unitLabel
                                }/day)`}
                              </Typography>
                            )}
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Stack>
              </CardContent>
            </Card>

            <Card
              variant="outlined"
              sx={{
                flex: 1,
                bgcolor: "rgba(15,19,40,0.9)",
                backdropFilter: "blur(18px)",
                minHeight: { xs: 360, md: 520 },
              }}
            >
              <CardHeader
                avatar={<TimelineRoundedIcon color="primary" />}
                title="Macro overview"
                subheader="Per day totals"
              />
              <CardContent
                sx={{
                  height: { xs: 320, sm: 360, md: 520 },
                  pt: 3,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                {hasMacroTargets && (
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {macroDisplay.map((macro) => {
                      const value = macroTargets?.[macro.key as keyof MacroTargets];
                      if (typeof value !== "number") return null;
                      return (
                        <Chip
                          key={macro.key}
                          label={`${macro.label}: ${value.toLocaleString()} ${
                            macro.unit
                          }/day`}
                          variant="outlined"
                          size="small"
                          sx={{ borderColor: "rgba(255,255,255,0.2)" }}
                        />
                      );
                    })}
                  </Stack>
                )}
                <Box sx={{ flex: 1 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="label" stroke="#94a3b8" />
                      <YAxis yAxisId="macros" stroke="#94a3b8" />
                      <YAxis yAxisId="calories" orientation="right" stroke="#94a3b8" />
                      <RechartsTooltip content={<MacroTooltip />} />
                      <Legend />
                      {typeof macroTargets?.calories === "number" && (
                        <ReferenceLine
                          yAxisId="calories"
                          y={macroTargets.calories}
                          stroke={chartColors.calories}
                          strokeDasharray="4 4"
                          label={{ value: "Cal target", position: "insideTopRight", fill: chartColors.calories }}
                        />
                      )}
                      {typeof macroTargets?.protein === "number" && (
                        <ReferenceLine
                          yAxisId="macros"
                          y={macroTargets.protein}
                          stroke={chartColors.protein}
                          strokeDasharray="4 4"
                        />
                      )}
                      {typeof macroTargets?.carbs === "number" && (
                        <ReferenceLine
                          yAxisId="macros"
                          y={macroTargets.carbs}
                          stroke={chartColors.carbs}
                          strokeDasharray="4 4"
                        />
                      )}
                      {typeof macroTargets?.fat === "number" && (
                        <ReferenceLine
                          yAxisId="macros"
                          y={macroTargets.fat}
                          stroke={chartColors.fat}
                          strokeDasharray="4 4"
                        />
                      )}
                      <Bar yAxisId="calories" dataKey="calories" fill={chartColors.calories} />
                      <Bar yAxisId="macros" dataKey="protein" fill={chartColors.protein} />
                      <Bar yAxisId="macros" dataKey="carbs" fill={chartColors.carbs} />
                      <Bar yAxisId="macros" dataKey="fat" fill={chartColors.fat} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Stack>

          {displayShoppingList.length > 0 ? (
            <Accordion
              expanded={shoppingExpanded}
              onChange={(_, expanded) => setShoppingExpanded(expanded)}
              disableGutters
              sx={{
                borderRadius: 3,
                border: "1px solid rgba(255,255,255,0.08)",
                bgcolor: "rgba(10,14,26,0.85)",
                "&:before": { display: "none" },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreRoundedIcon />}
                sx={{
                  px: { xs: 2, md: 3 },
                  py: 1.5,
                  "& .MuiAccordionSummary-content": { margin: 0 },
                }}
              >
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", md: "center" }}
                  width="100%"
                >
                  <Stack spacing={0.5}>
                    <Typography variant="h6">Weekly shopping list</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {displayShoppingList.length} unique items
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Estimated weekly cost:{" "}
                      {basketPricing ? `~${formatGbp(basketPricing.subtotal)}` : "—"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Prices approximate, based on Tesco online
                    </Typography>
                    {basketPricing?.unmatchedItems?.length ? (
                      <Typography variant="caption" color="warning.main">
                        {basketPricing.unmatchedItems.length} item(s) missing price match
                      </Typography>
                    ) : null}
                    {normalizingList && (
                      <Typography variant="caption" color="text.secondary">
                        Loading shopping list...
                      </Typography>
                    )}
                  </Stack>
                  <Chip
                    label={shoppingExpanded ? "Hide items" : "View items"}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </Stack>
              </AccordionSummary>
              <AccordionDetails
                sx={{
                  px: { xs: 2, md: 3 },
                  pb: 3,
                }}
              >
                <Stack spacing={2}>
                  {shoppingListError && (
                    <Alert
                      severity="error"
                      action={
                        <Button color="inherit" size="small" onClick={retryShoppingList}>
                          Retry
                        </Button>
                      }
                    >
                      Couldn&apos;t load shopping list. Try again.
                    </Alert>
                  )}

                  {normalizingList && (
                    <Stack spacing={1.25}>
                      {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton
                          key={`shopping-skeleton-${index}`}
                          variant="rounded"
                          height={34}
                          sx={{ borderRadius: 1.5 }}
                        />
                      ))}
                    </Stack>
                  )}

                  {groupedShoppingList.map(({ category, items, subtotal, hasPricedItems }) => (
                    <Box
                      key={category}
                      sx={{
                        borderRadius: 2,
                        border: "1px solid rgba(255,255,255,0.08)",
                        p: 2,
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{ mb: 1, textTransform: "uppercase", letterSpacing: 0.5 }}
                      >
                        {category}
                      </Typography>
                      <Stack spacing={1}>
                        {items.map((item) => {
                          const itemPrice = shoppingItemPrices.get(shoppingItemKey(item));
                          const displayLine = shoppingDisplayLine(item);
                          return (
                            <Stack
                              key={shoppingItemKey(item)}
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              spacing={1}
                            >
                              <Typography fontWeight={600} sx={{ minWidth: 84 }}>
                                {displayLine.amount}
                              </Typography>
                              <Typography color="text.secondary" sx={{ flexGrow: 1 }}>
                                {displayLine.name}
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ minWidth: 64, textAlign: "right", fontWeight: 600 }}
                              >
                                {typeof itemPrice === "number" ? formatGbp(itemPrice) : "—"}
                              </Typography>
                            </Stack>
                          );
                        })}
                        <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", my: 0.25 }} />
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Typography variant="caption" color="text.secondary">
                            Category subtotal
                          </Typography>
                          <Typography variant="subtitle2">
                            {hasPricedItems ? formatGbp(subtotal) : "—"}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ) : (
            <Card
              variant="outlined"
              sx={{
                borderColor: "rgba(255,255,255,0.08)",
                bgcolor: "rgba(10,14,26,0.72)",
              }}
            >
              <CardContent>
                <Typography color="text.secondary">
                  Generate a meal plan to see your shopping list.
                </Typography>
              </CardContent>
            </Card>
          )}

          <Stack spacing={2}>
            {displayDays.map((day, dayIndex) => {
              const calorieStatus = calorieStatusMeta(
                day.totals.calories,
                macroTargets?.calories
              );
              const dayEnforcement = enforcement?.days?.[dayIndex] ?? null;
              const enforcedStatus = dayEnforcementMeta(dayEnforcement);
              const dayEnforcementStatus = dayEnforcement
                ? dayEnforcement.status ??
                  (!dayEnforcement.passed
                    ? "partial"
                    : dayEnforcement.corrected
                    ? "adjusted"
                    : "verified")
                : null;
              const statusColor = enforcedStatus?.color ?? calorieStatus.color;
              const statusLabel = enforcedStatus?.label ?? calorieStatus.label;
              const expandedMealForDay =
                day.meals.find((meal) => meal.instanceId === expandedMealId) ?? null;
              const expandedRecipeSteps = expandedMealForDay
                ? resolveRecipeSteps(expandedMealForDay)
                : [];
              const expandedProteinMeta = expandedMealForDay
                ? proteinTypeMeta(expandedMealForDay.proteinType)
                : null;
              return (
              <Accordion
                key={day.id}
                disableGutters
                expanded={expandedDayId === day.id}
                onChange={(_, expanded) => setExpandedDayId(expanded ? day.id : null)}
                sx={{
                  borderRadius: 3,
                  border: "1px solid rgba(255,255,255,0.08)",
                  bgcolor: "rgba(10,14,26,0.85)",
                  "&:before": { display: "none" },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreRoundedIcon />}
                  sx={{
                    px: { xs: 2, md: 3 },
                    py: 1.5,
                    "& .MuiAccordionSummary-content": {
                      margin: 0,
                    },
                  }}
                >
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1}
                    alignItems={{ xs: "flex-start", md: "center" }}
                    justifyContent="space-between"
                    width="100%"
                  >
                    <Stack spacing={0.75}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {day.label} | {formatDate(day.date)}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            bgcolor: statusColor,
                            boxShadow: `0 0 0 3px ${statusColor}22`,
                          }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          {`${day.totals.calories.toLocaleString()} kcal • ${day.totals.protein.toLocaleString()}g protein`}
                        </Typography>
                        {statusLabel !== "No target" && (
                          <Typography variant="caption" color="text.secondary">
                            {statusLabel}
                          </Typography>
                        )}
                        {dayEnforcementStatus === "adjusted" && (
                          <Tooltip
                            title="Portions adjusted to meet macro targets."
                            arrow
                          >
                            <Chip
                              size="small"
                              variant="outlined"
                              color="warning"
                              label="Adjusted"
                            />
                          </Tooltip>
                        )}
                        {dayEnforcementStatus === "partial" && (
                          <Tooltip
                            title="Current meal mix cannot meet targets within safe portion limits."
                            arrow
                          >
                            <Chip
                              size="small"
                              variant="outlined"
                              color="error"
                              label="Needs different meals"
                            />
                          </Tooltip>
                        )}
                      </Stack>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Button
                        size="small"
                        variant="outlined"
                        color="secondary"
                        startIcon={
                          regeneratingDayIndex === dayIndex ? (
                            <CircularProgress size={14} color="inherit" />
                          ) : (
                            <AutorenewRoundedIcon fontSize="small" />
                          )
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleRegenerateDay(dayIndex);
                        }}
                        disabled={regeneratingDayIndex !== null || planLoading}
                      >
                        {regeneratingDayIndex === dayIndex ? "Regenerating..." : "Regenerate day"}
                      </Button>
                    </Stack>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails
                  sx={{
                    px: { xs: 2, md: 3 },
                    pb: 3,
                  }}
                >
                  <Box
                    sx={{
                      display: "grid",
                      gap: 2,
                      alignItems: "stretch",
                      gridTemplateColumns: {
                        xs: "1fr",
                        md: `repeat(${Math.max(day.meals.length, 1)}, minmax(0, 1fr))`,
                      },
                    }}
                  >
                    {day.meals.map((meal, mealIndex) => {
                      const expanded = expandedMealId === meal.instanceId;
                      const swapping = swappingMealId === meal.instanceId;
                      return (
                        <Card
                          key={meal.instanceId}
                          variant="outlined"
                          sx={{
                            height: "100%",
                            position: "relative",
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column",
                            minWidth: 0,
                            transition:
                              "opacity 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease",
                            opacity: swapping ? 0.9 : 1,
                            borderColor: expanded
                              ? "rgba(125, 211, 252, 0.45)"
                              : "rgba(255,255,255,0.08)",
                            bgcolor: "rgba(5,7,15,0.88)",
                            backgroundImage:
                              "linear-gradient(180deg, rgba(125,211,252,0.08), rgba(5,7,15,0.88) 22%)",
                            boxShadow: expanded
                              ? "0 0 0 1px rgba(125,211,252,0.22)"
                              : "none",
                          }}
                        >
                          {swapping && (
                            <Box
                              sx={{
                                position: "absolute",
                                inset: 0,
                                zIndex: 2,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexDirection: "column",
                                gap: 1,
                                bgcolor: "rgba(5,7,15,0.62)",
                                backdropFilter: "blur(2px)",
                              }}
                            >
                              <CircularProgress size={20} color="secondary" />
                              <Typography variant="body2" color="text.secondary">
                                Swapping...
                              </Typography>
                            </Box>
                          )}
                          <CardContent
                            sx={{ display: "flex", flexDirection: "column", gap: 1.5, flexGrow: 1 }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                letterSpacing: 0.8,
                                textTransform: "uppercase",
                                fontWeight: 700,
                                color: mealSlotColor(meal.mealSlot),
                              }}
                            >
                              {mealSlotDisplayLabel(meal.mealSlot, mealIndex, day.meals)}
                            </Typography>
                            <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                              {meal.title}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center" useFlexGap>
                              <Chip label={`${meal.readyInMinutes} min`} size="small" variant="outlined" />
                              {meal.portionMultiplier !== 1 && (
                                <Chip label={`Portion x${meal.portionMultiplier}`} size="small" />
                              )}
                            </Stack>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                            >
                              {mealMacroLine(meal)}
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: "auto" }}>
                              <Button
                                size="small"
                                color="secondary"
                                variant="outlined"
                                startIcon={
                                  swapping ? (
                                    <CircularProgress size={14} color="inherit" />
                                  ) : (
                                    <SwapHorizRoundedIcon fontSize="small" />
                                  )
                                }
                                onClick={() => void handleSwapMeal(dayIndex, mealIndex)}
                                disabled={Boolean(swappingMealId)}
                              >
                                {swapping ? "Swapping..." : "Swap meal"}
                              </Button>
                              <Button
                                size="small"
                                color="secondary"
                                startIcon={<MenuBookRoundedIcon fontSize="small" />}
                                endIcon={
                                  <ExpandMoreRoundedIcon
                                    sx={{
                                      transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                                      transition: "transform 0.2s ease",
                                    }}
                                  />
                                }
                                onClick={() => setExpandedMealId(expanded ? null : meal.instanceId)}
                              >
                                {expanded ? "Hide recipe" : "View recipe"}
                              </Button>
                            </Stack>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Box>
                  <Collapse in={Boolean(expandedMealForDay)} timeout="auto" unmountOnExit>
                    {expandedMealForDay && expandedProteinMeta && (
                      <Box
                        sx={{
                          mt: 2,
                          borderTop: "1px solid rgba(255,255,255,0.08)",
                          pt: 2,
                          borderRadius: 2,
                          border: "1px solid rgba(255,255,255,0.08)",
                          bgcolor: "rgba(5,7,15,0.7)",
                          p: { xs: 2, md: 2.5 },
                        }}
                      >
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={1.25}
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", md: "center" }}
                          sx={{ mb: 2 }}
                        >
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip
                              size="small"
                              variant="outlined"
                              icon={<ScheduleRoundedIcon fontSize="small" />}
                              label={`Prep ${expandedMealForDay.readyInMinutes} min`}
                            />
                            <Chip
                              size="small"
                              variant="outlined"
                              icon={<PersonRoundedIcon fontSize="small" />}
                              label="Serves 1"
                            />
                            <Chip
                              size="small"
                              variant="outlined"
                              icon={expandedProteinMeta.icon}
                              label={expandedProteinMeta.label}
                            />
                            <Chip
                              size="small"
                              variant="outlined"
                              label={`${expandedMealForDay.macros.calories} kcal • ${expandedMealForDay.macros.protein}g protein • ${expandedMealForDay.macros.carbs}g carbs • ${expandedMealForDay.macros.fat}g fat`}
                            />
                          </Stack>
                          <Button
                            size="small"
                            color="secondary"
                            onClick={() => setExpandedMealId(null)}
                          >
                            Close recipe
                          </Button>
                        </Stack>
                        {expandedMealForDay.description ? (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {expandedMealForDay.description}
                          </Typography>
                        ) : null}
                        <Box
                          sx={{
                            display: "grid",
                            gap: 2.5,
                            gridTemplateColumns: {
                              xs: "1fr",
                              md: "minmax(0, 0.4fr) minmax(0, 0.6fr)",
                            },
                          }}
                        >
                          <Stack spacing={1}>
                            <Typography variant="subtitle2" color="text.secondary">
                              Ingredients
                            </Typography>
                            {(expandedMealForDay.ingredients ?? []).length ? (
                              <Stack spacing={0.75}>
                                {(expandedMealForDay.ingredients ?? []).map((ingredient) => (
                                  <Typography
                                    key={`${expandedMealForDay.instanceId}-${ingredient.name}-${ingredient.unit}-${ingredient.amount}`}
                                    variant="body2"
                                  >
                                    {formatIngredientLine(ingredient)}
                                  </Typography>
                                ))}
                              </Stack>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                Ingredients will appear here for this meal.
                              </Typography>
                            )}
                          </Stack>
                          <Stack spacing={1}>
                            <Typography variant="subtitle2" color="text.secondary">
                              Method
                            </Typography>
                            {expandedRecipeSteps.length > 0 ? (
                              <Stack spacing={1.25}>
                                {expandedRecipeSteps.map((step, index) => (
                                  <Stack
                                    key={`${expandedMealForDay.instanceId}-step-${index}`}
                                    direction="row"
                                    spacing={1}
                                    alignItems="flex-start"
                                  >
                                    <Typography
                                      variant="subtitle2"
                                      fontWeight={700}
                                      sx={{ minWidth: 22, color: "secondary.main" }}
                                    >
                                      {index + 1}.
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      {step}
                                    </Typography>
                                  </Stack>
                                ))}
                              </Stack>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                Cooking steps not available for this meal.
                              </Typography>
                            )}
                          </Stack>
                        </Box>
                      </Box>
                    )}
                  </Collapse>
                </AccordionDetails>
              </Accordion>
              );
            })}
          </Stack>
        </>
      )}
      <Drawer
        anchor="right"
        open={preferencesPanelOpen}
        onClose={() => {
          if (!preferencesSaving) {
            setPreferencesPanelOpen(false);
          }
        }}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 460 },
            bgcolor: "rgba(10,14,26,0.98)",
            backgroundImage: "linear-gradient(180deg, rgba(125,211,252,0.06), rgba(10,14,26,0.98))",
            borderLeft: "1px solid rgba(255,255,255,0.08)",
            p: 3,
          },
        }}
      >
        <Stack spacing={2.5} height="100%">
          <Box>
            <Typography variant="overline" color="secondary">
              Preference engine
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              Refine meal filters
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Update dietary mode, allergies, dislikes, and cuisine preferences.
            </Typography>
          </Box>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

          <Stack spacing={1.25}>
            <Typography variant="subtitle2" color="text.secondary">
              1. Dietary Mode
            </Typography>
            <FormControl>
              <RadioGroup
                value={preferencesPanelState.dietaryMode}
                onChange={(event) =>
                  setPreferencesPanelState((prev) => ({
                    ...prev,
                    dietaryMode: event.target.value as DietaryModeOption,
                  }))
                }
              >
                {DIETARY_MODE_OPTIONS.map((option) => (
                  <FormControlLabel
                    key={option.value}
                    value={option.value}
                    control={<Radio size="small" />}
                    label={option.label}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          </Stack>

          <Stack spacing={1.25}>
            <Typography variant="subtitle2" color="text.secondary">
              2. Allergies
            </Typography>
            <FormGroup>
              <Grid container spacing={0.5}>
                {ALLERGY_OPTIONS.map((allergy) => (
                  <Grid item xs={6} key={allergy}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={preferencesPanelState.allergies.includes(allergy)}
                          onChange={() => togglePanelArrayValue("allergies", allergy)}
                        />
                      }
                      label={allergy}
                    />
                  </Grid>
                ))}
              </Grid>
            </FormGroup>
          </Stack>

          <Stack spacing={1.25}>
            <Typography variant="subtitle2" color="text.secondary">
              3. Dislikes
            </Typography>
            <TextField
              placeholder="Type an ingredient and press Enter"
              value={dislikeInput}
              onChange={(event) => setDislikeInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addDislikeTag(dislikeInput);
                }
              }}
              fullWidth
              size="small"
            />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {preferencesPanelState.dislikes.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  onDelete={() => removeDislikeTag(tag)}
                />
              ))}
            </Stack>
          </Stack>

          <Stack spacing={1.25}>
            <Typography variant="subtitle2" color="text.secondary">
              4. Cuisine Preferences (optional)
            </Typography>
            <FormGroup>
              <Grid container spacing={0.5}>
                {CUISINE_OPTIONS.map((cuisine) => (
                  <Grid item xs={6} key={cuisine}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={preferencesPanelState.cuisines.includes(cuisine)}
                          onChange={() => togglePanelArrayValue("cuisines", cuisine)}
                        />
                      }
                      label={cuisine}
                    />
                  </Grid>
                ))}
              </Grid>
            </FormGroup>
          </Stack>

          <Box sx={{ mt: "auto" }}>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                variant="text"
                color="inherit"
                onClick={() => setPreferencesPanelOpen(false)}
                disabled={preferencesSaving}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="secondary"
                onClick={() => void handleSavePreferencePanel()}
                disabled={preferencesSaving}
                startIcon={
                  preferencesSaving ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : undefined
                }
              >
                {preferencesSaving ? "Saving..." : "Save preferences"}
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Drawer>
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={closeToast}
        anchorOrigin={
          isMobile
            ? { vertical: "bottom", horizontal: "center" }
            : { vertical: "bottom", horizontal: "right" }
        }
      >
        <Alert
          onClose={closeToast}
          severity={toast.severity}
          variant="filled"
          action={
            toast.actionLabel && toastActionRef.current ? (
              <Button color="inherit" size="small" onClick={runToastAction}>
                {toast.actionLabel}
              </Button>
            ) : undefined
          }
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}

/* eslint-enable react-hooks/set-state-in-effect */





