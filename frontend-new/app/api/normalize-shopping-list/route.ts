import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { type ShoppingListItem } from "@/lib/meal-generator";

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
const ENABLE_AI_NORMALIZATION = process.env.OPENAI_SHOPPING_NORMALIZE === "1";

const MODEL = process.env.OPENAI_MEAL_MODEL ?? "gpt-4o-mini";
const UK_PACK_GUIDE = `
Protein pack heuristics for UK supermarkets:
- Chicken breast fillets: 300g (2 small), 460-500g (2-3 standard), 600-650g (family 3-4), 1kg bulk trays.
- Mince (beef/turkey/chicken/pork): 250g, 300g, 500g standard, 750g, 1kg value packs.
- Steak / pork chops / lamb: 200-250g single, 400-500g pack of 2, 600-800g family trays, 1kg large.
- Fish fillets (salmon/cod etc): 240g (2 fillets), 300g, 500g, 1kg frozen bags.
- Whole chicken: 1.2kg, 1.4kg, 1.6kg, 1.8kg.
- Eggs: sold in 6 or 12 large-egg cartons.
Use similar rounding logic for related proteins (e.g., prawns, thighs).`;

type AiNormalizedItem = {
  name: string;
  quantity: number;
  unit: string;
  category?: string;
  displayName?: string;
};

export async function POST(request: NextRequest) {
  let body: { items?: ShoppingListItem[]; locale?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const items = Array.isArray(body.items) ? body.items : [];
  const locale = body.locale ?? "UK";

  if (!items.length) {
    return NextResponse.json({ items });
  }

  const deterministic = items
    .map((item) =>
      normalizeItem({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        displayName: item.displayName,
      })
    )
    .filter((item): item is ShoppingListItem => Boolean(item));

  if (!client || !ENABLE_AI_NORMALIZATION) {
    return NextResponse.json({ items: deterministic });
  }

  try {
    const response = await client.responses.create({
      model: MODEL,
      temperature: 0.1,
      max_output_tokens: 800,
      input: [
        {
          role: "system",
          content: `
You are a culinary operations expert normalizing shopping lists for grocery fulfillment in ${locale}.
Rules:
- Combine items that refer to the same ingredient (e.g., "red onion" + "onion").
- Convert totals into realistic purchase quantities for ${locale} supermarkets. Round to practical pack sizes (e.g., chicken breasts in 500g increments, eggs by the dozen, yogurt tubs 150g, etc.).
- When locale is UK, follow these pack heuristics:
${UK_PACK_GUIDE}
- Preserve or infer category (Pantry, Produce, Protein, Dairy, Frozen, Bakery, Other).
- Output JSON array only, each object:
  {
    "name": "Chicken breast",
    "quantity": 1000,
    "unit": "g",
    "category": "Protein",
    "displayName": "2 x 500g chicken breast pack"
  }
Use metric units (g or ml) where possible. For pieces/units, use "piece" or meaningful label ("large", "pack").`,
        },
        {
          role: "user",
          content: JSON.stringify(items, null, 2),
        },
      ],
    });

    const text = extractText(response);
    if (!text) {
      throw new Error("Empty AI response");
    }
    const cleaned = extractJson(text);
    const parsed = JSON.parse(cleaned) as AiNormalizedItem[];
    const normalized = parsed
      .map((item) => normalizeItem(item))
      .filter((item): item is ShoppingListItem => Boolean(item));

    if (!normalized.length) {
      throw new Error("AI normalization returned empty result");
    }

    return NextResponse.json({ items: normalized });
  } catch (error) {
    console.error("Shopping list normalization failed", error);
    return NextResponse.json({ items: deterministic });
  }
}

const normalizeItem = (item: AiNormalizedItem): ShoppingListItem | null => {
  const quantity = Number(item.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }
  const unit = normalizeUnit(item.unit || "g");
  const name = (item.name || item.displayName || "Ingredient").trim();
  return {
    name: name || "Ingredient",
    quantity: roundQuantity(quantity, unit),
    unit,
    category: item.category,
  };
};

const normalizeUnit = (value: string) => {
  const unit = value.trim().toLowerCase();
  if (unit === "each" || unit === "unit" || unit === "slice") return "piece";
  if (unit === "grams") return "g";
  if (unit === "milliliters") return "ml";
  return unit || "g";
};

const roundMetric = (value: number) => {
  if (value < 100) return Math.round(value / 5) * 5;
  if (value <= 1000) return Math.round(value / 10) * 10;
  return Math.round(value / 50) * 50;
};

const roundQuantity = (quantity: number, unit: string) => {
  if (unit === "piece" || unit === "large") {
    return Math.ceil(quantity);
  }
  if (unit === "g" || unit === "ml") {
    return Math.max(5, roundMetric(quantity));
  }
  return Math.round(quantity * 100) / 100;
};

const extractText = (res: OpenAI.Beta.Responses.Response) =>
  res.output
    ?.map((block) =>
      block.content?.map((entry) => ("text" in entry ? entry.text : "")).join("")
    )
    .join("\n")
    ?.trim() ?? "";

const extractJson = (text: string) => {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error("No JSON array found in AI response");
  }
  return text.slice(start, end + 1);
};
