export type MealImageInput = {
  title: string;
  mealSlot: string;
  ingredients?: readonly { name: string }[];
  image?: string;
};

const families = ["bowl", "oats", "eggs", "pasta", "salad", "wrap", "soup", "plate", "snack"] as const;
const illustrations = new Set(families.map(family => `/images/meals/${family}.svg`));

/** Semantic artwork also works for historical plans with no persisted image. */
export function fallbackImageForMeal(meal: MealImageInput): string {
  const title = meal.title.toLowerCase();
  const ingredients = meal.ingredients?.map(item => item.name.toLowerCase()).join(" ") ?? "";
  let family: typeof families[number] = "plate";
  if (/oat|porridge|muesli|granola/.test(title)) family = "oats";
  else if (/soup|broth|stew/.test(title)) family = "soup";
  else if (/wrap|burrito|taco|quesadilla/.test(title)) family = "wrap";
  else if (/pasta|spaghetti|penne|noodle|macaroni/.test(title)) family = "pasta";
  else if (/salad/.test(title)) family = "salad";
  else if (/egg|omelette|frittata|scramble|toast/.test(title)) family = "eggs";
  else if (/bowl|rice|curry|quinoa/.test(title)) family = "bowl";
  else if (/snack|pot|yogurt|yoghurt|fruit|hummus/.test(title) || /snack/.test(meal.mealSlot)) family = "snack";
  else if (/oats/.test(ingredients) && meal.mealSlot === "breakfast") family = "oats";
  return `/images/meals/${family}.svg`;
}

/** Accept asset paths and HTTPS images, never inline SVG, scripts or arbitrary local paths. */
export function imageForMeal(meal: MealImageInput): string {
  const source = meal.image?.trim();
  if (source && illustrations.has(source)) return source;
  if (source) {
    try {
      const url = new URL(source);
      const legacyPhoto = /(^|\.)unsplash\.com$/i.test(url.hostname);
      if (url.protocol === "https:" && !url.username && !url.password && !legacyPhoto) return url.href;
    } catch { /* Old image values use the semantic illustration. */ }
  }
  return fallbackImageForMeal(meal);
}

export function imageAfterFailure(source: string, fallback: string): string | null {
  return source === fallback ? null : fallback;
}
