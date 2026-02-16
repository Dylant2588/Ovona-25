export type OnboardingMeta = {
  cookingTime?: "under_10" | "10_15" | "15_30";
  mealsPerDay?: 3 | 5;
};

const ONBOARDING_META_PREFIX = "[ovona-onboarding]";

const isValidMealsPerDay = (value: unknown): value is 3 | 5 =>
  value === 3 || value === 5;

const isValidCookingTime = (
  value: unknown
): value is "under_10" | "10_15" | "15_30" =>
  value === "under_10" || value === "10_15" || value === "15_30";

export const readOnboardingMeta = (notes?: string | null): OnboardingMeta | null => {
  if (!notes) return null;
  const line = notes
    .split("\n")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(ONBOARDING_META_PREFIX));
  if (!line) return null;
  const payload = line.slice(ONBOARDING_META_PREFIX.length).trim();
  if (!payload) return null;
  try {
    const raw = JSON.parse(payload) as {
      cookingTime?: unknown;
      mealsPerDay?: unknown;
    };
    const meta: OnboardingMeta = {};
    if (isValidCookingTime(raw.cookingTime)) {
      meta.cookingTime = raw.cookingTime;
    }
    if (isValidMealsPerDay(raw.mealsPerDay)) {
      meta.mealsPerDay = raw.mealsPerDay;
    }
    return Object.keys(meta).length ? meta : null;
  } catch {
    return null;
  }
};

export const writeOnboardingMeta = (
  notes: string | null | undefined,
  meta: OnboardingMeta
) => {
  const cleanedLines = (notes ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith(ONBOARDING_META_PREFIX));

  const serialized = JSON.stringify(meta);
  cleanedLines.push(`${ONBOARDING_META_PREFIX} ${serialized}`);
  return cleanedLines.join("\n");
};

