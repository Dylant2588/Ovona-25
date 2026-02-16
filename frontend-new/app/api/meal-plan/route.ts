import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  buildRecipeSteps,
  generateFallbackMealPlan,
  preferenceSignatureFor,
  resolveMacroTargets,
  WORKDAY_COUNT,
  WORKDAY_MEAL_SLOTS,
  type MealHistorySummary,
  type IngredientLine,
  type MacroBreakdown,
  type MealSlot,
  type PreferencesInput,
  type ProteinType,
  type RotationHistoryEntry,
  type WeeklyMealPlan,
} from "@/lib/meal-generator";
import {
  enforceMacros,
  toEnforcementInfo,
  type EnforcementInfo,
} from "@/lib/macro-enforcement";

const MODEL = process.env.OPENAI_MEAL_MODEL ?? "gpt-4o-mini";
const AI_TIMEOUT_MS = Number(process.env.OPENAI_MEAL_TIMEOUT_MS ?? 12000);
const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

type AiIngredient = {
  name: string;
  amount: number;
  unit: string;
  category?: string;
};

type AiMeal = {
  mealSlot: MealSlot;
  title: string;
  description?: string;
  steps?: string[];
  recipeSteps?: string[];
  proteinType?: ProteinType | string;
  tags?: string[];
  readyInMinutes?: number;
  macros: MacroBreakdown;
  ingredients: AiIngredient[];
};

type AiDay = {
  label: string;
  date?: string;
  meals: AiMeal[];
};

type AiPlanPayload = {
  weekStart?: string;
  days: AiDay[];
};

const resolveRequestedSlots = (preferences: PreferencesInput): MealSlot[] =>
  preferences.profile?.mealsPerDay === 3
    ? ["breakfast", "lunch", "dinner"]
    : [...WORKDAY_MEAL_SLOTS];

export async function POST(request: NextRequest) {
  let payload: {
    preferences?: PreferencesInput;
    rotationHistory?: RotationHistoryEntry[];
    mealHistory?: MealHistorySummary;
  };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const preferences = payload.preferences;
  const rotationHistory = payload.rotationHistory ?? [];
  const mealHistory = payload.mealHistory;

  if (!preferences) {
    return NextResponse.json({ error: "Missing preferences" }, { status: 400 });
  }

  const allowedSlots = resolveRequestedSlots(preferences);
  const targets = resolveMacroTargets(preferences);
  let plan: WeeklyMealPlan;
  let source: "openai" | "fallback";

  if (!openaiClient) {
    plan = generateFallbackMealPlan(preferences);
    source = "fallback";
  } else {
    try {
      plan = await requestAiPlan(
        preferences,
        rotationHistory,
        mealHistory,
        allowedSlots
      );
      source = "openai";
    } catch (error) {
      console.error("AI meal plan error", error);
      plan = generateFallbackMealPlan(preferences);
      source = "fallback";
    }
  }

  let enforcement: EnforcementInfo | null = null;

  if (targets && (targets.calories || targets.protein)) {
    const result = enforceMacros(plan, targets);
    enforcement = toEnforcementInfo(result);

    if (!result.passed) {
      console.warn("Macro enforcement incomplete:", enforcement.summary);
    }
  }

  return NextResponse.json({ plan, source, enforcement });
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`AI request timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);

const buildSystemPrompt = (allowedSlots: MealSlot[]) => `
You are Ovona's culinary planning assistant. Create a 5-day meal schedule (Monday-Friday) with exactly ${allowedSlots.length} meals per day in this order: ${allowedSlots.join(", ")}. Each meal must include:
- title, enticing description
- proteinType (poultry | red_meat | fish | seafood | plant | mixed)
- prep time in minutes
- short tags describing cuisines or styles
- 4-6 concise steps a home cook can follow
- macro breakdown (calories, protein, carbs, fat)
- 3-6 ingredients with quantity and unit (grams, ml, pieces, etc.)

Guidelines:
1. Respect the user's macro targets and nutrition goal. Prioritize hitting protein first, then calories. Keep daily totals within ~8% of calorie target and ~8% of protein target where possible. Snacks are lighter, dinners highest.
2. Honor tastes/allergies/dietary constraints, household notes, and pantry staples. Use rotation history to avoid repeating the same proteinType two days in a row and to balance the week (if last week was heavy on fish, limit fish to 1-2 meals this week, etc.). Do not repeat the exact same meal title twice within the same day.
3. Use locale information to prefer ingredients sold in that region (e.g., UK packs) and lean on pantry staples before introducing new items.
4. Reflect training schedule, sleep/stress, and delivery preferences when spacing heavy/light meals (e.g., higher carbs before long training sessions).
5. Vary cuisines, cooking methods, and portion styles (bowls, wraps, skillets, salads, etc.).
6. Output valid JSON only, matching this schema:
{
  "weekStart": "YYYY-MM-DD",
  "days": [
    {
      "label": "Monday",
      "meals": [
        {
          "mealSlot": "breakfast",
          "title": "Protein Buckwheat Pancakes",
          "description": "Fluffy pancakes with Greek yogurt, berry compote, and hemp seeds.",
          "steps": [
            "Whisk dry ingredients in one bowl and wet ingredients in another.",
            "Combine both bowls and rest batter for 5 minutes.",
            "Cook pancakes on a lightly oiled pan until golden on both sides.",
            "Top with yogurt and berries before serving."
          ],
          "proteinType": "plant",
          "readyInMinutes": 20,
          "tags": ["high-protein","comfort","weekend"],
          "macros": { "calories": 410, "protein": 28, "carbs": 45, "fat": 12 },
          "ingredients": [
            { "name": "Buckwheat flour", "amount": 80, "unit": "g", "category": "Pantry" },
            { "name": "Greek yogurt", "amount": 120, "unit": "g", "category": "Dairy" }
          ]
        },
        ...
      ]
    }
  ]
}
Return JSON only - no commentary.
`;

async function requestAiPlan(
  preferences: PreferencesInput,
  rotationHistory: RotationHistoryEntry[],
  mealHistory: MealHistorySummary | undefined,
  allowedSlots: MealSlot[]
): Promise<WeeklyMealPlan> {
  if (!openaiClient) {
    throw new Error("OpenAI client unavailable");
  }

  const openAiPromise = openaiClient.responses.create({
    model: MODEL,
    temperature: 0.25,
    max_output_tokens: 2000,
    input: [
      {
        role: "system",
        content: buildSystemPrompt(allowedSlots),
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            userProfile: {
              goal: preferences.goal,
              tastes: preferences.tastes,
              mealComplexity: preferences.mealComplexity,
              macroTargets: preferences.macroTargets,
              profile: preferences.profile,
            },
            rotationHistory,
            mealHistory,
          },
          null,
          2
        ),
      },
    ],
  });

  const response = await withTimeout(openAiPromise, AI_TIMEOUT_MS);

  const textOutput = extractText(response);
  if (!textOutput) {
    throw new Error("Empty AI response");
  }

  let aiPayload: AiPlanPayload;
  try {
    const cleaned = extractJsonBlock(textOutput);
    aiPayload = JSON.parse(cleaned) as AiPlanPayload;
  } catch (error) {
    throw new Error(`Failed to parse AI payload: ${(error as Error).message}`);
  }

  return convertAiPlan(aiPayload, preferences, allowedSlots);
}

const extractText = (res: OpenAI.Beta.Responses.Response) =>
  res.output
    ?.map((block) =>
      block.content
        ?.map((entry) => ("text" in entry ? entry.text : ""))
        .join("")
    )
    .join("\n")
    ?.trim() ?? "";

const extractJsonBlock = (text: string): string => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON object found");
  }
  return text.slice(start, end + 1);
};

const getStartOfWeek = (seed = new Date()) => {
  const d = new Date(seed);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date: Date, amount: number) => {
  const cloned = new Date(date);
  cloned.setDate(cloned.getDate() + amount);
  return cloned;
};

const sumMacroList = (items: MacroBreakdown[]): MacroBreakdown =>
  items.reduce(
    (acc, macro) => ({
      calories: acc.calories + macro.calories,
      protein: acc.protein + macro.protein,
      carbs: acc.carbs + macro.carbs,
      fat: acc.fat + macro.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

const normalizeMacros = (macros?: Partial<MacroBreakdown>): MacroBreakdown => ({
  calories: Number.isFinite(Number(macros?.calories)) ? Number(macros?.calories) : 0,
  protein: Number.isFinite(Number(macros?.protein)) ? Number(macros?.protein) : 0,
  carbs: Number.isFinite(Number(macros?.carbs)) ? Number(macros?.carbs) : 0,
  fat: Number.isFinite(Number(macros?.fat)) ? Number(macros?.fat) : 0,
});

const normalizeIngredient = (ingredient: AiIngredient): IngredientLine => ({
  name: ingredient.name ?? "Ingredient",
  amount: Number.isFinite(Number(ingredient.amount)) ? Number(ingredient.amount) : 0,
  unit: ingredient.unit ?? "g",
  category: ingredient.category,
});

const convertAiMeal = (payload: AiMeal, slot: MealSlot) => {
  const macros = normalizeMacros(payload.macros);
  const ingredients = Array.isArray(payload.ingredients)
    ? payload.ingredients.map(normalizeIngredient)
    : [];
  const tags = Array.isArray(payload.tags)
    ? payload.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  const providedSteps = Array.isArray(payload.steps)
    ? payload.steps
    : Array.isArray(payload.recipeSteps)
    ? payload.recipeSteps
    : [];
  const recipeSteps = providedSteps.length
    ? providedSteps.filter(
        (step): step is string => typeof step === "string" && step.trim().length > 0
      )
    : buildRecipeSteps({
        mealSlot: slot,
        title: payload.title,
        description: payload.description,
        readyInMinutes:
          Number.isFinite(Number(payload.readyInMinutes)) && payload.readyInMinutes
            ? Number(payload.readyInMinutes)
            : undefined,
        ingredients,
      });

  return {
    instanceId: randomUUID(),
    baseId: `ai-${slot}-${randomUUID()}`,
    mealSlot: slot,
    title: payload.title ?? `${slot} inspiration`,
    description: payload.description ?? "",
    steps: recipeSteps,
    recipeSteps,
    tags,
    image: "",
    readyInMinutes:
      Number.isFinite(Number(payload.readyInMinutes)) && payload.readyInMinutes
        ? Number(payload.readyInMinutes)
        : 20,
    portionMultiplier: 1,
    baseMacros: macros,
    macros,
    baseIngredients: ingredients,
    ingredients: ingredients.map((ingredient) => ({ ...ingredient })),
    proteinType: (payload.proteinType as ProteinType | undefined) ?? undefined,
  };
};

const normalizeMealTitle = (meal?: AiMeal) => (meal?.title ?? "").trim().toLowerCase();

const convertAiPlan = (
  payload: AiPlanPayload,
  preferences: PreferencesInput,
  allowedSlots: MealSlot[]
): WeeklyMealPlan => {
  const start = payload.weekStart ? getStartOfWeek(new Date(payload.weekStart)) : getStartOfWeek();
  const days: WeeklyMealPlan["days"] = [];

  if (!payload.days?.length) {
    throw new Error("AI payload missing days");
  }

  for (let index = 0; index < WORKDAY_COUNT; index += 1) {
    const aiDay = payload.days[index] ?? payload.days[payload.days.length - 1];
    const dayDate = aiDay?.date ? new Date(aiDay.date) : addDays(start, index);
    const meals: WeeklyMealPlan["days"][number]["meals"] = [];
    const usedMealIndexes = new Set<number>();
    const usedMealTitles = new Set<string>();

    allowedSlots.forEach((slot) => {
      const findCandidateIndex = (preferSlot: boolean) =>
        aiDay?.meals?.findIndex((meal, mealIndex) => {
          if (usedMealIndexes.has(mealIndex)) return false;
          if (preferSlot && meal.mealSlot !== slot) return false;
          const normalizedTitle = normalizeMealTitle(meal);
          if (normalizedTitle && usedMealTitles.has(normalizedTitle)) return false;
          return true;
        }) ?? -1;
      const matchedIndex =
        findCandidateIndex(true);
      const fallbackIndex = findCandidateIndex(false);
      const pickIndex = matchedIndex >= 0 ? matchedIndex : fallbackIndex;
      const slotMeal = pickIndex >= 0 ? aiDay?.meals?.[pickIndex] : undefined;
      if (slotMeal) {
        if (pickIndex >= 0) {
          usedMealIndexes.add(pickIndex);
        }
        const normalizedTitle = normalizeMealTitle(slotMeal);
        if (normalizedTitle) {
          usedMealTitles.add(normalizedTitle);
        }
        meals.push(convertAiMeal(slotMeal, slot));
      }
    });

    if (meals.length !== allowedSlots.length) {
      throw new Error("AI payload missing meals or contains duplicates for a day");
    }

    const totals = sumMacroList(meals.map((meal) => meal.macros));

    days.push({
      id: randomUUID(),
      label: aiDay?.label ?? dayDate.toLocaleDateString("en-US", { weekday: "long" }),
      date: dayDate.toISOString(),
      meals,
      totals,
    });
  }

  return {
    id: randomUUID(),
    userId: preferences.userId,
    weekStart: start.toISOString(),
    generatedAt: new Date().toISOString(),
    preferenceSignature: preferenceSignatureFor(preferences),
    days,
    weeklyTotals: sumMacroList(days.map((day) => day.totals)),
  };
};

