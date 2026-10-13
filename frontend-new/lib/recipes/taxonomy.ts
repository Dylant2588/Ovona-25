export const normalizeIngredient = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const ALLERGENS = ["celery", "gluten", "crustaceans", "eggs", "fish", "lupin", "milk", "molluscs", "mustard", "peanuts", "sesame", "soy", "sulphites", "tree_nuts"] as const;
const allergyAliases: Record<string, string[]> = {
  celery: ["celery", "celeriac"], gluten: ["gluten", "wheat", "barley", "rye", "oats", "cereals containing gluten"],
  crustaceans: ["crustaceans", "shellfish", "prawn", "prawns", "shrimp", "crab", "lobster"], eggs: ["egg", "eggs"],
  fish: ["fish", "salmon", "tuna", "cod"], lupin: ["lupin", "lupine"], milk: ["milk", "dairy", "lactose", "whey"],
  molluscs: ["molluscs", "mollusks", "mussels", "oysters", "squid", "shellfish"], mustard: ["mustard"],
  peanuts: ["peanut", "peanuts", "groundnut", "groundnuts", "nuts"], sesame: ["sesame", "sesame seeds", "tahini"],
  soy: ["soy", "soya", "soybeans", "soybean"], sulphites: ["sulphites", "sulfites", "sulphur dioxide", "sulfur dioxide"],
  tree_nuts: ["tree nuts", "tree nut", "nuts", "almond", "almonds", "walnut", "walnuts", "cashew", "cashews", "hazelnut", "pecan", "pistachio", "brazil nuts", "macadamia"],
};
export function canonicalAllergens(value: string): string[] {
  const normalized = normalizeIngredient(value);
  return Object.entries(allergyAliases).filter(([key, aliases]) => normalizeIngredient(key) === normalized || aliases.includes(normalized)).map(([key]) => key);
}
export type IngredientTaxon = { id: string; aliases: string[]; allergens: string[]; dietaryFlags: string[] };
const taxon = (id: string, aliases: string[], allergens: string[] = [], dietaryFlags: string[] = []): IngredientTaxon => ({ id, aliases, allergens, dietaryFlags });
// Exact reviewed taxonomy only. Composite/brand products need separately reviewed entries before admission.
export const INGREDIENT_TAXONOMY: IngredientTaxon[] = [
  taxon("chicken", ["chicken", "chicken breast"], [], ["meat"]), taxon("turkey", ["turkey", "ground turkey", "roast turkey slices", "turkey breast"], [], ["meat"]),
  taxon("egg", ["egg", "eggs", "egg whites", "liquid egg whites"], ["eggs"], ["animal_product"]),
  taxon("milk", ["milk", "greek yogurt", "cottage cheese", "whey protein"], ["milk"], ["animal_product"]),
  taxon("salmon", ["salmon", "salmon fillet"], ["fish"], ["fish", "animal_product"]),
  taxon("tofu", ["tofu", "extra firm tofu"], ["soy"]), taxon("soy_sauce", ["soy sauce"], ["soy", "gluten"]),
  taxon("oats", ["oats", "rolled oats"], ["gluten"]), taxon("wheat", ["whole grain wrap", "whole wheat wraps", "wholemeal wraps", "whole wheat pasta", "wholewheat pasta", "pasta", "noodles"], ["gluten"]),
  taxon("peanut", ["peanuts", "peanut butter"], ["peanuts"]), taxon("walnut", ["walnuts"], ["tree_nuts"]),
  ...["celery", "lupin", "mustard", "sesame"].map(id => taxon(id, [id, `${id} seeds`], [id])),
  taxon("prawn", ["prawn", "prawns", "shrimp"], ["crustaceans"], ["fish", "animal_product"]),
  taxon("mussel", ["mussel", "mussels", "squid"], ["molluscs"], ["fish", "animal_product"]),
  ...["water", "spinach", "cucumber", "avocado", "blueberries", "banana", "lime", "carrots", "cabbage", "dates", "scallions", "rice vinegar", "maple syrup", "chia seeds", "pumpkin seeds", "espresso powder", "sea salt", "olive oil", "coconut milk", "snap peas", "corn kernels", "chipotle peppers", "cinnamon", "paprika", "garlic", "onion", "broccoli", "courgette"].map(name => taxon(name.replaceAll(" ", "_"), [name])),
  taxon("rice", ["brown rice", "jasmine rice", "rice"]), taxon("chickpea", ["chickpea", "chickpeas"]), taxon("tomato", ["tomatoes", "cherry tomatoes", "diced tomatoes", "tomato", "passata"]),
  taxon("pepper", ["bell pepper", "red pepper", "bell peppers", "peppers"]), taxon("black_beans", ["black beans"]),
];
export const findIngredientTaxon = (name: string) => INGREDIENT_TAXONOMY.find(entry => entry.aliases.includes(normalizeIngredient(name)));
