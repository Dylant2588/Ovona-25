import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabaseServer";
import { fallbackToStaticLibrary } from "@/lib/generation/fallback";
import type {
  GenerationContext,
  GenerationSupabase,
  MealConcept,
  NutritionistOutput,
} from "@/lib/generation/types";

const MODEL = process.env.OPENAI_MEAL_MODEL ?? "gpt-4o-mini";
const TIMEOUT_MS = 30_000;
const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

type MealConceptRow = Record<string, unknown>;

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeSlot = (value: string) => {
  const lower = value.trim().toLowerCase();
  if (lower.includes("break")) return "breakfast";
  if (lower.includes("lunch")) return "lunch";
  if (lower.includes("dinner")) return "dinner";
  return "snack";
};

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[,;\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

const uniqueBy = <T>(items: T[], key: (item: T) => string) => {
  const map = new Map<string, T>();
  items.forEach((item) => {
    const marker = key(item);
    if (!map.has(marker)) {
      map.set(marker, item);
    }
  });
  return Array.from(map.values());
};

const mealUsesForbiddenIngredients = (meal: MealConcept, context: GenerationContext) => {
  const normalizedIngredients = meal.ingredients.map((item) => normalize(item));
  const forbidden = new Set([
    ...context.allergies.map((entry) => normalize(entry)),
    ...context.dislikes.map((entry) => normalize(entry)),
  ]);
  return normalizedIngredients.some((ingredient) => {
    for (const blocked of forbidden) {
      if (!blocked) continue;
      if (ingredient.includes(blocked)) return true;
    }
    return false;
  });
};

const conceptFromDbRow = (row: MealConceptRow): MealConcept | null => {
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!name) return null;
  const ingredients = toStringArray(row.ingredients);
  const steps = toStringArray(row.steps);
  const mealSlots = toStringArray(row.meal_slots);
  const slot = mealSlots[0] ? normalizeSlot(mealSlots[0]) : normalizeSlot(String(row.slot ?? "lunch"));

  return {
    name,
    ingredients,
    steps,
    cuisine: typeof row.cuisine === "string" ? row.cuisine.toLowerCase() : "mixed",
    protein_type:
      typeof row.protein_type === "string" ? row.protein_type.toLowerCase() : "mixed",
    slot,
    prep_minutes:
      typeof row.prep_minutes === "number" && Number.isFinite(row.prep_minutes)
        ? Math.round(row.prep_minutes)
        : 15,
  };
};

const ingredientOverlapScore = (candidate: MealConcept, selected: MealConcept[]): number => {
  if (!candidate.ingredients.length || !selected.length) return 0;
  const existingIngredients = new Set(
    selected.flatMap((meal) => meal.ingredients.map((item) => normalize(item)))
  );
  const candidateIngredients = candidate.ingredients.map((item) => normalize(item));
  const overlap = candidateIngredients.filter((ingredient) => existingIngredients.has(ingredient));
  return overlap.length / candidateIngredients.length;
};

const scoreCandidate = (
  candidate: MealConcept,
  selected: MealConcept[],
  weeklyUses: Map<string, number>,
  context: GenerationContext
) => {
  const useCount = weeklyUses.get(normalize(candidate.name)) ?? 0;
  const overlap = ingredientOverlapScore(candidate, selected);
  const cuisineBoost =
    context.cuisinePreferences.length && context.cuisinePreferences.includes(candidate.cuisine)
      ? 1
      : 0;
  const prepPenalty = candidate.prep_minutes > context.maxPrepMinutes ? -1.5 : 0;
  const varietyPenalty = useCount >= 2 ? -100 : useCount > 0 ? -2.5 : 0;
  return overlap * 4 + cuisineBoost + prepPenalty + varietyPenalty + Math.random() * 0.1;
};

const pickWeekMeals = (
  pool: MealConcept[],
  context: GenerationContext,
  required: number
) => {
  const selected: MealConcept[] = [];
  const alternatives: MealConcept[] = [];
  const slotLabels = context.slotLabels.map((slot) => normalizeSlot(slot));
  const weeklyUses = new Map<string, number>();

  for (let day = 1; day <= 5; day += 1) {
    const usedToday = new Set<string>();
    slotLabels.forEach((slot) => {
      const candidates = pool
        .filter((meal) => normalizeSlot(meal.slot) === slot)
        .filter((meal) => !usedToday.has(normalize(meal.name)))
        .filter((meal) => !mealUsesForbiddenIngredients(meal, context));

      const ranked = [...candidates]
        .map((meal) => ({
          meal,
          score: scoreCandidate(meal, selected, weeklyUses, context),
        }))
        .sort((a, b) => b.score - a.score);

      const chosen = ranked[0]?.meal;
      if (!chosen) return;

      const chosenName = normalize(chosen.name);
      usedToday.add(chosenName);
      weeklyUses.set(chosenName, (weeklyUses.get(chosenName) ?? 0) + 1);
      selected.push({ ...chosen, slot, day });

      const alt = ranked.find(
        (entry) => normalize(entry.meal.name) !== chosenName
      )?.meal;
      if (alt) {
        alternatives.push({
          ...alt,
          slot,
          for_day: day,
          for_slot: slot,
        });
      }
    });
  }

  const normalizedSelected = uniqueBy(selected, (meal) => `${meal.day}-${meal.slot}-${normalize(meal.name)}`)
    .slice(0, required);
  const normalizedAlternatives = uniqueBy(
    alternatives,
    (meal) => `${meal.for_day}-${meal.for_slot}-${normalize(meal.name)}`
  ).slice(0, required);

  return { meals: normalizedSelected, alternatives: normalizedAlternatives };
};


const responseToText = (response: unknown) => {
  const candidate = response as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  if (Array.isArray(candidate.choices) && candidate.choices.length > 0) {
    const content = candidate.choices[0]?.message?.content;
    if (typeof content === "string" && content.trim()) {
      return content.trim();
    }
  }
  return "";
};

const mapRawConcept = (raw: unknown): MealConcept | null => {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  if (!name) return null;
  const slotSource =
    typeof obj.slot === "string"
      ? obj.slot
      : typeof obj.for_slot === "string"
      ? obj.for_slot
      : "lunch";
  const ingredients = toStringArray(obj.ingredients);
  const steps = toStringArray(obj.steps);
  const prep = typeof obj.prep_minutes === "number" ? obj.prep_minutes : Number(obj.prep_minutes);

  return {
    day: typeof obj.day === "number" ? obj.day : undefined,
    for_day: typeof obj.for_day === "number" ? obj.for_day : undefined,
    name,
    ingredients,
    steps,
    cuisine: typeof obj.cuisine === "string" ? obj.cuisine.toLowerCase() : "mixed",
    protein_type:
      typeof obj.protein_type === "string" ? obj.protein_type.toLowerCase() : "mixed",
    slot: normalizeSlot(slotSource),
    for_slot: typeof obj.for_slot === "string" ? normalizeSlot(obj.for_slot) : undefined,
    prep_minutes: Number.isFinite(prep) ? Math.max(1, Math.round(prep)) : 15,
  };
};

export function validateMealConcept(meal: MealConcept): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!meal.name || meal.name.length < 3) issues.push("Missing or short name");
  if (!meal.ingredients || meal.ingredients.length < 2) issues.push("Too few ingredients");
  if (!meal.steps || meal.steps.length < 2) issues.push("Too few steps");
  if (!meal.slot) issues.push("Missing slot");
  if (meal.prep_minutes > 45) issues.push("Prep time too long for weekday meal");

  const badStepPatterns = [
    "according to package",
    "serve and enjoy",
    "prep all ingredients",
    "goal vibe",
  ];
  for (const step of meal.steps || []) {
    for (const pattern of badStepPatterns) {
      if (step.toLowerCase().includes(pattern)) {
        issues.push(`Bad step pattern: "${pattern}"`);
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

export function buildNutritionistPrompt(context: GenerationContext): string {
  return `
You are a nutritionist creating a 5-day weekday meal plan.

USER PROFILE:
- Diet: ${context.dietaryMode}
- Allergies: ${context.allergies.join(", ") || "none"}
- Dislikes: ${context.dislikes.join(", ") || "none"}
- Preferred cuisines: ${context.cuisinePreferences.join(", ") || "any"}
- Max cooking time: ${context.maxPrepMinutes} minutes per meal
- Meals per day: ${context.mealsPerDay} (${context.slotLabels.join(", ")})
${context.healthConditions.length > 0 ? `- Health considerations: ${context.healthConditions.join(", ")}` : ""}

RECENT MEALS (avoid repeating these):
${context.recentMealNames.slice(0, 20).join(", ") || "none yet"}

GUIDELINES:
- Weekday meals only - quick, practical, minimal washing up
- Use common UK supermarket ingredients
- Breakfasts under 10 minutes, main meals under 15 minutes
- Reuse pantry and produce ingredients where practical, but do not repeat the same named meal in this week
- Each day should feel meaningfully different; rotate primary protein sources and do not use one source more than twice
- Snacks should be genuinely quick (under 5 minutes or no-cook)
- Include a mix of protein sources but maximum 3-4 different ones per week
${context.healthConditions.includes("anaemia") ? "- Include iron-rich foods (red meat, spinach, lentils) at least 3 times this week" : ""}
${context.healthConditions.includes("pcos") ? "- Favour lower-carb meals with anti-inflammatory ingredients" : ""}

RETURN FORMAT (JSON only, no other text):
{
  "meals": [
    {
      "day": 1,
      "slot": "Breakfast",
      "name": "Meal name here",
      "ingredients": ["ingredient 1", "ingredient 2"],
      "steps": ["Step 1 instruction", "Step 2 instruction"],
      "cuisine": "british",
      "protein_type": "poultry",
      "prep_minutes": 8
    }
  ],
  "alternatives": [
    {
      "for_day": 1,
      "for_slot": "Breakfast",
      "name": "Alternative meal name",
      "ingredients": ["ingredient 1", "ingredient 2"],
      "steps": ["Step 1 instruction", "Step 2 instruction"],
      "cuisine": "asian",
      "protein_type": "plant",
      "prep_minutes": 5
    }
  ]
}

RULES FOR INGREDIENTS:
- Use simple names
- Do NOT include amounts
- Do NOT include salt, pepper, or basic seasonings

RULES FOR STEPS:
- 3-6 steps per meal
- Each step is one action
- Never say "according to package directions"
- Never start with "Prep all ingredients"
- Never end with "Serve and enjoy"

Generate exactly ${context.mealsPerDay * 5} meals and ${context.mealsPerDay * 5} alternatives. Prefer ingredients that are common, specific supermarket foods rather than invented branded products.
  `.trim();
}

const fetchDbPool = async (context: GenerationContext, supabase: GenerationSupabase) => {
  const { data, error } = await supabase
    .from("meal_concepts")
    .select("*")
    .limit(600);

  if (error || !Array.isArray(data)) {
    if (error) {
      console.warn("[nutritionist] meal_concepts lookup failed:", error.message);
    }
    return [] as MealConcept[];
  }

  const recent = new Set(context.recentMealNames.map((meal) => normalize(meal)));
  const dietary = context.dietaryMode.toLowerCase();
  const allergies = new Set(context.allergies.map((item) => normalize(item)));

  return data
    .map((row) => conceptFromDbRow(row as MealConceptRow))
    .filter((row): row is MealConcept => Boolean(row))
    .filter((row) => !recent.has(normalize(row.name)))
    .filter((row) => {
      const allergens = toStringArray((row as unknown as Record<string, unknown>).allergens).map(
        (entry) => normalize(entry)
      );
      return !allergens.some((entry) => allergies.has(entry));
    })
    .filter((row) => {
      if (row.prep_minutes > Math.max(45, context.maxPrepMinutes + 15)) return false;
      if (dietary === "vegan") {
        return !["poultry", "red_meat", "fish", "seafood", "mixed"].includes(
          row.protein_type
        );
      }
      if (dietary === "vegetarian") {
        return !["poultry", "red_meat", "fish", "seafood"].includes(row.protein_type);
      }
      if (dietary === "pescatarian") {
        return !["poultry", "red_meat"].includes(row.protein_type);
      }
      return true;
    });
};

const fillMissing = (
  base: MealConcept[],
  source: MealConcept[],
  required: number,
  slotLabels: string[]
) => {
  const result = [...base];
  let cursor = 0;
  while (result.length < required && source.length) {
    const slot = normalizeSlot(slotLabels[result.length % slotLabels.length] ?? "lunch");
    const candidate = source[cursor % source.length];
    cursor += 1;
    result.push({
      ...candidate,
      slot,
      day: Math.floor((result.length - 1) / slotLabels.length) + 1,
    });
  }
  return result.slice(0, required);
};

export async function generateMeals(
  context: GenerationContext,
  options?: { supabase?: GenerationSupabase }
): Promise<NutritionistOutput> {
  const supabase = options?.supabase ?? (await supabaseServer());
  const required = context.mealsPerDay * 5;
  const requiredTotal = required * 2;

  const dbPool = await fetchDbPool(context, supabase);
  const dbPick = pickWeekMeals(dbPool, context, required);
  if (
    dbPool.length >= requiredTotal &&
    dbPick &&
    dbPick.meals.length >= required &&
    dbPick.alternatives.length >= required
  ) {
    return {
      meals: dbPick.meals.slice(0, required),
      alternatives: dbPick.alternatives.slice(0, required),
      source: "db",
    };
  }

  let llmMeals: MealConcept[] = [];
  let llmAlternatives: MealConcept[] = [];
  let llmSucceeded = false;

  if (openaiClient) {
    try {
      const prompt = buildNutritionistPrompt(context);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const response = await openaiClient.chat.completions.create(
        {
          model: MODEL,
          temperature: 0.8,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "You are a nutritionist. Always respond with valid JSON only.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 5000,
        },
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      const rawText = responseToText(response);
      const parsed = JSON.parse(rawText) as {
        meals?: unknown[];
        alternatives?: unknown[];
      };
      const parsedMeals = (parsed.meals ?? [])
        .map(mapRawConcept)
        .filter((row): row is MealConcept => Boolean(row));
      const parsedAlternatives = (parsed.alternatives ?? [])
        .map(mapRawConcept)
        .filter((row): row is MealConcept => Boolean(row));

      llmMeals = parsedMeals.filter((meal) => validateMealConcept(meal).valid);
      llmAlternatives = parsedAlternatives.filter((meal) => validateMealConcept(meal).valid);
      llmSucceeded = llmMeals.length > 0;
    } catch (error) {
      console.error("[nutritionist] LLM generation failed:", error);
    }
  }

  const mergedMeals = uniqueBy(
    [...(dbPick?.meals ?? []), ...llmMeals],
    (meal) => `${meal.day ?? ""}-${normalizeSlot(meal.slot)}-${normalize(meal.name)}`
  );
  const mergedAlternatives = uniqueBy(
    [...(dbPick?.alternatives ?? []), ...llmAlternatives],
    (meal) => `${meal.for_day ?? ""}-${normalizeSlot(meal.for_slot ?? meal.slot)}-${normalize(meal.name)}`
  );

  if (mergedMeals.length >= required && mergedAlternatives.length >= required) {
    return {
      meals: mergedMeals.slice(0, required),
      alternatives: mergedAlternatives.slice(0, required),
      source: llmSucceeded ? "llm" : "db",
    };
  }

  const fallback = fallbackToStaticLibrary(context);

  return {
    meals: fillMissing(mergedMeals, fallback.meals, required, context.slotLabels),
    alternatives: fillMissing(
      mergedAlternatives,
      fallback.alternatives,
      required,
      context.slotLabels
    ),
    source: llmSucceeded ? "llm" : fallback.source,
  };
}
