import type { ShoppingListItem } from "@/lib/meal-generator";

type PriceCategory = "fresh" | "staples";
type PriceUnit = "g" | "ml" | "piece" | "large";

type PriceEntry = {
  ingredient: string;
  aliases: string[];
  unit: PriceUnit;
  packSize: number;
  packPrice: number;
  category: PriceCategory;
};

type IndexedPriceEntry = PriceEntry & {
  normalizedAliases: string[];
};

export type PricedBasketLine = {
  ingredient: string;
  packsNeeded: number;
  packSize: string;
  totalCost: number;
  matched: boolean;
  amountNeeded: number;
  amountToBuy: number;
  unit: string;
};

export type BasketPricing = {
  subtotal: number;
  freshCost: number;
  staplesCost: number;
  itemCount: number;
  unmatchedItems: string[];
  items: PricedBasketLine[];
};

const PRICE_DB: PriceEntry[] = [
  { ingredient: "Chicken breast", aliases: ["chicken breast", "chicken breast skinless", "chicken fillet"], unit: "g", packSize: 1000, packPrice: 5.5, category: "fresh" },
  { ingredient: "Chicken thighs", aliases: ["chicken thighs", "skinless chicken thighs"], unit: "g", packSize: 1000, packPrice: 3.8, category: "fresh" },
  { ingredient: "Ground turkey", aliases: ["ground turkey", "turkey mince"], unit: "g", packSize: 500, packPrice: 3.5, category: "fresh" },
  { ingredient: "Roast turkey slices", aliases: ["roast turkey slices", "turkey breast slices", "turkey slices"], unit: "g", packSize: 200, packPrice: 2.5, category: "fresh" },
  { ingredient: "Shrimp", aliases: ["shrimp", "prawns", "prawns cooked"], unit: "g", packSize: 200, packPrice: 3.5, category: "fresh" },
  { ingredient: "Salmon fillet", aliases: ["salmon fillet", "fresh salmon"], unit: "g", packSize: 260, packPrice: 4.0, category: "fresh" },
  { ingredient: "Smoked salmon", aliases: ["smoked salmon"], unit: "g", packSize: 120, packPrice: 3.0, category: "fresh" },
  { ingredient: "Cod fillet", aliases: ["cod fillet", "cod"], unit: "g", packSize: 320, packPrice: 3.8, category: "fresh" },
  { ingredient: "Tinned tuna", aliases: ["tinned tuna", "tuna", "tuna canned"], unit: "g", packSize: 160, packPrice: 3.6, category: "staples" },
  { ingredient: "Beef mince 5%", aliases: ["beef mince 5%", "ground beef", "lean beef mince"], unit: "g", packSize: 500, packPrice: 3.5, category: "fresh" },
  { ingredient: "Sirloin steak", aliases: ["sirloin steak", "beef steak", "steak"], unit: "g", packSize: 225, packPrice: 5.0, category: "fresh" },
  { ingredient: "Pork loin", aliases: ["pork loin", "lean pork"], unit: "g", packSize: 500, packPrice: 3.5, category: "fresh" },
  { ingredient: "Bacon", aliases: ["bacon", "streaky bacon", "back bacon"], unit: "g", packSize: 300, packPrice: 2.5, category: "fresh" },
  { ingredient: "Lean ham", aliases: ["lean ham", "ham"], unit: "g", packSize: 200, packPrice: 2.0, category: "fresh" },
  { ingredient: "Tofu", aliases: ["tofu", "extra-firm tofu", "firm tofu"], unit: "g", packSize: 400, packPrice: 2.0, category: "fresh" },
  { ingredient: "Tempeh", aliases: ["tempeh"], unit: "g", packSize: 200, packPrice: 2.5, category: "fresh" },
  { ingredient: "Mackerel fillet", aliases: ["mackerel fillet", "mackerel"], unit: "g", packSize: 250, packPrice: 2.8, category: "fresh" },
  { ingredient: "Tinned sardines", aliases: ["sardines", "tinned sardines"], unit: "g", packSize: 120, packPrice: 1.0, category: "staples" },

  { ingredient: "Eggs", aliases: ["eggs", "egg"], unit: "large", packSize: 10, packPrice: 2.35, category: "fresh" },
  { ingredient: "Greek yogurt 0%", aliases: ["greek yogurt 0%", "greek yogurt, 0% fat", "fat free greek yogurt"], unit: "g", packSize: 500, packPrice: 1.5, category: "fresh" },
  { ingredient: "Greek yogurt full fat", aliases: ["greek yogurt full fat", "greek yogurt"], unit: "g", packSize: 500, packPrice: 1.5, category: "fresh" },
  { ingredient: "Cottage cheese", aliases: ["cottage cheese"], unit: "g", packSize: 300, packPrice: 1.5, category: "fresh" },
  { ingredient: "Cheddar cheese", aliases: ["cheddar", "cheddar cheese"], unit: "g", packSize: 250, packPrice: 2.1, category: "fresh" },
  { ingredient: "Feta cheese", aliases: ["feta", "feta cheese"], unit: "g", packSize: 200, packPrice: 1.6, category: "fresh" },
  { ingredient: "Cream cheese", aliases: ["cream cheese", "light cream cheese"], unit: "g", packSize: 200, packPrice: 1.2, category: "fresh" },
  { ingredient: "Mozzarella", aliases: ["mozzarella"], unit: "g", packSize: 125, packPrice: 0.75, category: "fresh" },
  { ingredient: "Almond milk", aliases: ["almond milk"], unit: "ml", packSize: 1000, packPrice: 1.3, category: "staples" },
  { ingredient: "Oat milk", aliases: ["oat milk"], unit: "ml", packSize: 1000, packPrice: 1.3, category: "staples" },
  { ingredient: "Whole milk", aliases: ["whole milk", "milk"], unit: "ml", packSize: 2000, packPrice: 1.45, category: "fresh" },
  { ingredient: "Whey protein powder", aliases: ["whey protein powder", "whey protein", "protein powder"], unit: "g", packSize: 1000, packPrice: 22.0, category: "staples" },

  { ingredient: "Spinach", aliases: ["spinach"], unit: "g", packSize: 240, packPrice: 1.0, category: "fresh" },
  { ingredient: "Baby greens", aliases: ["baby spinach", "baby greens", "mixed leaves", "mixed salad leaves"], unit: "g", packSize: 120, packPrice: 1.25, category: "fresh" },
  { ingredient: "Broccoli", aliases: ["broccoli"], unit: "g", packSize: 350, packPrice: 0.49, category: "fresh" },
  { ingredient: "Kale", aliases: ["kale"], unit: "g", packSize: 200, packPrice: 1.0, category: "fresh" },
  { ingredient: "Bell peppers", aliases: ["bell peppers", "bell pepper", "peppers"], unit: "piece", packSize: 3, packPrice: 1.2, category: "fresh" },
  { ingredient: "Bell peppers (weight)", aliases: ["bell peppers", "bell pepper", "peppers"], unit: "g", packSize: 450, packPrice: 1.2, category: "fresh" },
  { ingredient: "Cherry tomatoes", aliases: ["cherry tomatoes", "tomatoes"], unit: "g", packSize: 300, packPrice: 1.1, category: "fresh" },
  { ingredient: "Red onion", aliases: ["red onion", "onion"], unit: "piece", packSize: 3, packPrice: 0.75, category: "fresh" },
  { ingredient: "Red onion (weight)", aliases: ["red onion", "onion"], unit: "g", packSize: 450, packPrice: 0.75, category: "fresh" },
  { ingredient: "Cucumber", aliases: ["cucumber"], unit: "piece", packSize: 1, packPrice: 0.45, category: "fresh" },
  { ingredient: "Cucumber (weight)", aliases: ["cucumber"], unit: "g", packSize: 300, packPrice: 0.45, category: "fresh" },
  { ingredient: "Avocado", aliases: ["avocado"], unit: "piece", packSize: 2, packPrice: 1.8, category: "fresh" },
  { ingredient: "Avocado (weight)", aliases: ["avocado"], unit: "g", packSize: 300, packPrice: 1.8, category: "fresh" },
  { ingredient: "Courgette", aliases: ["courgette", "zucchini"], unit: "piece", packSize: 3, packPrice: 1.0, category: "fresh" },
  { ingredient: "Mushrooms", aliases: ["mushrooms", "mushroom"], unit: "g", packSize: 250, packPrice: 0.85, category: "fresh" },
  { ingredient: "Carrots", aliases: ["carrots", "carrot"], unit: "g", packSize: 1000, packPrice: 0.55, category: "fresh" },
  { ingredient: "Sweetcorn", aliases: ["sweetcorn", "sweetcorn tinned", "corn kernels", "corn"], unit: "g", packSize: 325, packPrice: 0.5, category: "staples" },
  { ingredient: "Cabbage", aliases: ["cabbage"], unit: "g", packSize: 500, packPrice: 0.55, category: "fresh" },
  { ingredient: "Cabbage (head)", aliases: ["cabbage"], unit: "piece", packSize: 1, packPrice: 0.55, category: "fresh" },
  { ingredient: "Snap peas", aliases: ["snap peas"], unit: "g", packSize: 200, packPrice: 1.5, category: "fresh" },
  { ingredient: "Cauliflower", aliases: ["cauliflower"], unit: "g", packSize: 500, packPrice: 0.79, category: "fresh" },
  { ingredient: "Cauliflower (head)", aliases: ["cauliflower"], unit: "piece", packSize: 1, packPrice: 0.79, category: "fresh" },
  { ingredient: "Cauliflower rice", aliases: ["cauliflower rice"], unit: "g", packSize: 500, packPrice: 1.5, category: "staples" },
  { ingredient: "Sweet potato", aliases: ["sweet potato"], unit: "g", packSize: 1000, packPrice: 1.3, category: "fresh" },
  { ingredient: "Potato", aliases: ["potato", "potatoes"], unit: "g", packSize: 2500, packPrice: 1.5, category: "fresh" },
  { ingredient: "Banana", aliases: ["banana", "bananas"], unit: "piece", packSize: 6, packPrice: 0.79, category: "fresh" },
  { ingredient: "Blueberries", aliases: ["blueberries", "blueberry"], unit: "g", packSize: 150, packPrice: 2.5, category: "fresh" },
  { ingredient: "Mixed berries (frozen)", aliases: ["mixed berries", "frozen mixed berries"], unit: "g", packSize: 400, packPrice: 2.5, category: "staples" },
  { ingredient: "Apple", aliases: ["apple", "apples"], unit: "piece", packSize: 6, packPrice: 1.4, category: "fresh" },
  { ingredient: "Frozen mango", aliases: ["frozen mango", "mango frozen"], unit: "g", packSize: 500, packPrice: 2.0, category: "staples" },
  { ingredient: "Dates", aliases: ["dates", "medjool dates", "date"], unit: "g", packSize: 250, packPrice: 3.0, category: "staples" },
  { ingredient: "Lemon", aliases: ["lemon", "lemons"], unit: "piece", packSize: 4, packPrice: 0.8, category: "fresh" },
  { ingredient: "Lime", aliases: ["lime", "limes"], unit: "piece", packSize: 4, packPrice: 0.8, category: "fresh" },
  { ingredient: "Spring onions", aliases: ["spring onion", "spring onions", "scallions"], unit: "piece", packSize: 1, packPrice: 0.55, category: "fresh" },
  { ingredient: "Spring onions (weight)", aliases: ["spring onion", "spring onions", "scallions"], unit: "g", packSize: 100, packPrice: 0.55, category: "fresh" },
  { ingredient: "Fresh herbs", aliases: ["fresh herbs", "herbs"], unit: "piece", packSize: 1, packPrice: 0.8, category: "fresh" },
  { ingredient: "Kimchi", aliases: ["kimchi"], unit: "g", packSize: 330, packPrice: 2.5, category: "fresh" },

  { ingredient: "Rolled oats", aliases: ["rolled oats", "oats"], unit: "g", packSize: 1000, packPrice: 1.15, category: "staples" },
  { ingredient: "Brown rice", aliases: ["brown rice"], unit: "g", packSize: 1000, packPrice: 1.4, category: "staples" },
  { ingredient: "White rice", aliases: ["white rice", "basmati rice", "rice"], unit: "g", packSize: 1000, packPrice: 1.1, category: "staples" },
  { ingredient: "Jasmine rice", aliases: ["jasmine rice"], unit: "g", packSize: 1000, packPrice: 1.8, category: "staples" },
  { ingredient: "Quinoa", aliases: ["quinoa"], unit: "g", packSize: 300, packPrice: 1.8, category: "staples" },
  { ingredient: "Couscous", aliases: ["couscous"], unit: "g", packSize: 500, packPrice: 0.8, category: "staples" },
  { ingredient: "Wholewheat pasta", aliases: ["wholewheat pasta", "whole wheat pasta"], unit: "g", packSize: 500, packPrice: 0.95, category: "staples" },
  { ingredient: "White pasta", aliases: ["pasta", "white pasta"], unit: "g", packSize: 500, packPrice: 0.7, category: "staples" },
  { ingredient: "Soba noodles", aliases: ["soba noodles"], unit: "g", packSize: 250, packPrice: 1.5, category: "staples" },
  { ingredient: "Rice cakes", aliases: ["rice cakes", "rice cake"], unit: "g", packSize: 130, packPrice: 0.85, category: "staples" },
  { ingredient: "Peanut butter", aliases: ["peanut butter"], unit: "g", packSize: 340, packPrice: 1.9, category: "staples" },
  { ingredient: "Almond butter", aliases: ["almond butter"], unit: "g", packSize: 170, packPrice: 3.0, category: "staples" },
  { ingredient: "Walnuts", aliases: ["walnuts", "walnut"], unit: "g", packSize: 200, packPrice: 2.5, category: "staples" },
  { ingredient: "Pumpkin seeds", aliases: ["pumpkin seeds"], unit: "g", packSize: 200, packPrice: 2.0, category: "staples" },
  { ingredient: "Chia seeds", aliases: ["chia seeds", "chia"], unit: "g", packSize: 200, packPrice: 2.0, category: "staples" },
  { ingredient: "Ground flaxseed", aliases: ["ground flaxseed", "flaxseed", "flaxseed ground"], unit: "g", packSize: 200, packPrice: 1.5, category: "staples" },
  { ingredient: "Olive oil", aliases: ["olive oil"], unit: "ml", packSize: 500, packPrice: 3.5, category: "staples" },
  { ingredient: "Coconut oil", aliases: ["coconut oil"], unit: "ml", packSize: 500, packPrice: 3.0, category: "staples" },
  { ingredient: "Soy sauce", aliases: ["soy sauce"], unit: "ml", packSize: 250, packPrice: 1.2, category: "staples" },
  { ingredient: "Harissa paste", aliases: ["harissa paste", "harissa"], unit: "g", packSize: 180, packPrice: 1.8, category: "staples" },
  { ingredient: "Miso paste", aliases: ["miso paste", "miso"], unit: "g", packSize: 300, packPrice: 2.5, category: "staples" },
  { ingredient: "Tinned tomatoes", aliases: ["tinned tomatoes", "chopped tomatoes", "diced tomatoes", "tomatoes tinned"], unit: "g", packSize: 400, packPrice: 0.45, category: "staples" },
  { ingredient: "Passata", aliases: ["passata"], unit: "g", packSize: 500, packPrice: 0.55, category: "staples" },
  { ingredient: "Chickpeas", aliases: ["chickpeas", "chickpeas tinned"], unit: "g", packSize: 400, packPrice: 0.5, category: "staples" },
  { ingredient: "Black beans", aliases: ["black beans", "black beans tinned"], unit: "g", packSize: 400, packPrice: 0.6, category: "staples" },
  { ingredient: "Red lentils", aliases: ["red lentils"], unit: "g", packSize: 500, packPrice: 1.1, category: "staples" },
  { ingredient: "Kidney beans", aliases: ["kidney beans", "kidney beans tinned"], unit: "g", packSize: 400, packPrice: 0.5, category: "staples" },
  { ingredient: "Hummus", aliases: ["hummus"], unit: "g", packSize: 200, packPrice: 1.0, category: "fresh" },
  { ingredient: "Olives", aliases: ["olives", "olive"], unit: "g", packSize: 340, packPrice: 1.6, category: "staples" },
  { ingredient: "Coconut milk", aliases: ["coconut milk", "coconut milk tinned"], unit: "ml", packSize: 400, packPrice: 1.0, category: "staples" },
  { ingredient: "Light coconut milk", aliases: ["light coconut milk"], unit: "ml", packSize: 400, packPrice: 1.0, category: "staples" },
  { ingredient: "Hot sauce", aliases: ["hot sauce", "sriracha"], unit: "ml", packSize: 256, packPrice: 2.3, category: "staples" },
  { ingredient: "Honey", aliases: ["honey"], unit: "g", packSize: 340, packPrice: 2.5, category: "staples" },
  { ingredient: "Maple syrup", aliases: ["maple syrup"], unit: "ml", packSize: 250, packPrice: 3.5, category: "staples" },
  { ingredient: "Rice vinegar", aliases: ["rice vinegar"], unit: "ml", packSize: 250, packPrice: 1.5, category: "staples" },
  { ingredient: "Pesto basil", aliases: ["pesto basil", "basil pesto", "pesto"], unit: "g", packSize: 190, packPrice: 1.5, category: "staples" },
  { ingredient: "Granola", aliases: ["granola"], unit: "g", packSize: 500, packPrice: 2.5, category: "staples" },
  { ingredient: "Dark chocolate 70%", aliases: ["dark chocolate 70%", "dark chocolate"], unit: "g", packSize: 100, packPrice: 1.2, category: "staples" },
  { ingredient: "Corn kernels", aliases: ["corn kernels", "sweetcorn tinned", "sweet corn"], unit: "g", packSize: 325, packPrice: 0.5, category: "staples" },
  { ingredient: "Edamame (frozen)", aliases: ["edamame", "frozen edamame"], unit: "g", packSize: 500, packPrice: 2.0, category: "staples" },
  { ingredient: "Espresso powder", aliases: ["espresso powder"], unit: "g", packSize: 100, packPrice: 2.5, category: "staples" },
  { ingredient: "Sea salt", aliases: ["sea salt", "salt"], unit: "g", packSize: 750, packPrice: 0.55, category: "staples" },

  { ingredient: "Sourdough bread", aliases: ["sourdough bread", "sourdough"], unit: "g", packSize: 400, packPrice: 1.2, category: "fresh" },
  { ingredient: "Wholemeal bread", aliases: ["wholemeal bread", "brown bread"], unit: "g", packSize: 800, packPrice: 1.1, category: "fresh" },
  { ingredient: "Whole-grain wraps", aliases: ["whole-grain wraps", "whole grain wraps", "whole-grain wrap", "whole grain wrap"], unit: "piece", packSize: 8, packPrice: 1.5, category: "fresh" },
  { ingredient: "Tortilla wraps", aliases: ["tortilla wraps", "tortillas", "tortilla"], unit: "piece", packSize: 8, packPrice: 1.1, category: "fresh" },
  { ingredient: "Bagels", aliases: ["bagels", "bagel"], unit: "piece", packSize: 5, packPrice: 1.0, category: "fresh" },
];

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const ALIAS_CANONICAL: Record<string, string> = {
  "chicken breast skinless": "chicken breast",
  "chicken breast boneless": "chicken breast",
  "chicken breast skinless boneless": "chicken breast",
  "prawns cooked": "shrimp",
  shrimp: "shrimp",
  "extra firm tofu": "tofu",
  "firm tofu": "tofu",
  "greek yogurt 0 fat": "greek yogurt 0%",
  "greek yogurt 0": "greek yogurt 0%",
  "greek yogurt full fat": "greek yogurt full fat",
  "baby spinach mixed leaves": "baby greens",
  "mixed salad leaves": "baby greens",
  "tinned tomatoes chopped": "tinned tomatoes",
  "chopped tomatoes": "tinned tomatoes",
  "diced tomatoes": "tinned tomatoes",
  "corn kernels": "sweetcorn",
  "sweet corn": "sweetcorn",
  "spring onions": "spring onion",
  scallions: "spring onion",
  zucchini: "courgette",
  "whole grain wrap": "whole-grain wrap",
  "whole grain wraps": "whole-grain wraps",
  tortilla: "tortilla wraps",
  tortillas: "tortilla wraps",
  "roast turkey slices": "turkey breast slices",
  "turkey slices": "turkey breast slices",
  "coconut milk tinned": "coconut milk",
  "light coconut milk tinned": "light coconut milk",
};

const aliasPairs = Object.entries(ALIAS_CANONICAL)
  .map(([alias, canonical]) => [normalize(alias), normalize(canonical)] as const)
  .sort((a, b) => b[0].length - a[0].length);

const stripIngredientDescriptors = (value: string) =>
  value
    .replace(/\bskinless\b/g, " ")
    .replace(/\bboneless\b/g, " ")
    .replace(/\bcooked\b/g, " ")
    .replace(/\braw\b/g, " ")
    .replace(/\btrimmed\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const canonicalizeIngredient = (value: string) => {
  const normalized = stripIngredientDescriptors(normalize(value));
  for (const [alias, canonical] of aliasPairs) {
    if (normalized === alias || normalized.includes(alias)) {
      return canonical;
    }
  }
  return normalized;
};

const indexedPriceDb: IndexedPriceEntry[] = PRICE_DB.map((entry) => ({
  ...entry,
  normalizedAliases: Array.from(
    new Set(
      [entry.ingredient, ...entry.aliases]
        .map(canonicalizeIngredient)
        .filter(Boolean)
    )
  ),
}));

const formatPack = (entry: PriceEntry) => `${entry.packSize}${entry.unit}`;

const normalizeUnitAndQuantity = (quantity: number, unit: string) => {
  const normalized = normalize(unit);
  const safeQuantity = Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
  if (["kg", "kilogram", "kilograms"].includes(normalized)) {
    return { unit: "g" as const, quantity: safeQuantity * 1000 };
  }
  if (["g", "gram", "grams"].includes(normalized)) {
    return { unit: "g" as const, quantity: safeQuantity };
  }
  if (["l", "liter", "litre", "liters", "litres"].includes(normalized)) {
    return { unit: "ml" as const, quantity: safeQuantity * 1000 };
  }
  if (["ml", "milliliter", "millilitre", "milliliters", "millilitres"].includes(normalized)) {
    return { unit: "ml" as const, quantity: safeQuantity };
  }
  if (["large", "egg", "eggs"].includes(normalized)) {
    return { unit: "large" as const, quantity: safeQuantity };
  }
  if (
    [
      "piece",
      "pieces",
      "each",
      "unit",
      "slice",
      "slices",
      "bunch",
      "bunches",
      "pack",
      "packs",
      "jar",
      "jars",
      "tin",
      "tins",
      "can",
      "cans",
      "head",
      "heads",
      "loaf",
      "loaves",
      "bottle",
      "bottles",
      "bag",
      "bags",
      "fillet",
      "fillets",
      "serving",
      "servings",
    ].includes(normalized)
  ) {
    return { unit: "piece" as const, quantity: safeQuantity };
  }
  return { unit: "unknown" as const, quantity: safeQuantity };
};

const unitsCompatible = (
  inputUnit: ReturnType<typeof normalizeUnitAndQuantity>["unit"],
  targetUnit: PriceEntry["unit"]
) => {
  if (inputUnit === "unknown") return true;
  if (inputUnit === targetUnit) return true;
  if (
    (inputUnit === "piece" && targetUnit === "large") ||
    (inputUnit === "large" && targetUnit === "piece")
  ) {
    return true;
  }
  return false;
};

const aliasMatchScore = (candidate: string, alias: string) => {
  if (!candidate || !alias) return 0;
  if (candidate === alias) return 12;
  if (candidate.startsWith(alias) || alias.startsWith(candidate)) return 8;
  if (candidate.includes(alias) || alias.includes(candidate)) return 5;
  const candidateTokens = candidate.split(" ");
  const aliasTokens = alias.split(" ");
  const overlap = aliasTokens.filter((token) => candidateTokens.includes(token)).length;
  return overlap >= 2 ? 3 + overlap : 0;
};

const findEntry = (
  name: string,
  unit: ReturnType<typeof normalizeUnitAndQuantity>["unit"]
) => {
  const candidate = canonicalizeIngredient(name);
  const scored = indexedPriceDb
    .map((entry) => {
      const match = Math.max(...entry.normalizedAliases.map((alias) => aliasMatchScore(candidate, alias)));
      if (match <= 0) return null;
      const unitBonus = unitsCompatible(unit, entry.unit) ? 4 : 0;
      return {
        entry,
        score: match + unitBonus,
      };
    })
    .filter((row): row is { entry: IndexedPriceEntry; score: number } => row !== null)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return null;
  const compatible = scored.find((row) => unitsCompatible(unit, row.entry.unit));
  return (compatible ?? scored[0]).entry;
};

export const priceBasket = (items: ShoppingListItem[]): BasketPricing => {
  const lines: PricedBasketLine[] = [];
  const unmatched = new Set<string>();
  let subtotal = 0;
  let freshCost = 0;
  let staplesCost = 0;

  items.forEach((item) => {
    const normalized = normalizeUnitAndQuantity(item.quantity, item.unit);
    const amountNeeded = Number(normalized.quantity.toFixed(4));
    const entry = findEntry(item.displayName ?? item.name, normalized.unit);
    if (!entry || !unitsCompatible(normalized.unit, entry.unit)) {
      lines.push({
        ingredient: item.displayName ?? item.name,
        packsNeeded: 0,
        packSize: "-",
        totalCost: 0,
        matched: false,
        amountNeeded,
        amountToBuy: amountNeeded,
        unit: item.unit,
      });
      unmatched.add(item.displayName ?? item.name);
      return;
    }

    const qty = normalized.quantity;
    const packsNeeded = Math.max(1, Math.ceil(qty / entry.packSize));
    const amountToBuy = Number((packsNeeded * entry.packSize).toFixed(4));
    const totalCost = Number((packsNeeded * entry.packPrice).toFixed(2));
    subtotal += totalCost;
    if (entry.category === "fresh") {
      freshCost += totalCost;
    } else {
      staplesCost += totalCost;
    }
    lines.push({
      ingredient: item.displayName ?? item.name,
      packsNeeded,
      packSize: formatPack(entry),
      totalCost,
      matched: true,
      amountNeeded,
      amountToBuy,
      unit: entry.unit,
    });
  });

  return {
    subtotal: Number(subtotal.toFixed(2)),
    freshCost: Number(freshCost.toFixed(2)),
    staplesCost: Number(staplesCost.toFixed(2)),
    itemCount: items.length,
    unmatchedItems: Array.from(unmatched),
    items: lines,
  };
};
