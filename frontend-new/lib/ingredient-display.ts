const COUNTABLE_UNITS = new Set(["large", "each", "piece", "slice", "unit"]);
const NATURAL_COUNTABLE_UNITS = new Set(["large", "each", "piece", "unit"]);

const normalizeUnit = (unit: string) => unit.trim().toLowerCase();

// Practical kitchen presentation only: source quantities and macro arithmetic
// keep their full precision. Never turn a small positive quantity into zero.
const displayNumber = (value: number, decimals = 1) => {
  const rounded = Number(value.toFixed(decimals));
  return String(rounded === 0 && value > 0 ? Number(value.toPrecision(1)) : rounded);
};
const measuredNumber = (value: number) => displayNumber(value, value >= 1 ? 0 : 1);

const singularize = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/ies$/i.test(trimmed)) return trimmed.replace(/ies$/i, "y");
  if (/ses$/i.test(trimmed)) return trimmed.replace(/es$/i, "");
  if (/s$/i.test(trimmed) && !/ss$/i.test(trimmed)) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
};

const pluralize = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/[^aeiou]y$/i.test(trimmed)) return `${trimmed.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(trimmed)) return `${trimmed}es`;
  if (/s$/i.test(trimmed)) return trimmed;
  return `${trimmed}s`;
};

type HumaniseOptions = {
  countableRounding?: "practical" | "exact" | "nearest" | "up";
};

export const humaniseAmount = (
  amount: number,
  unit: string,
  ingredientName: string,
  options: HumaniseOptions = {}
): string => {
  if (!Number.isFinite(amount) || amount < 0) return "Quantity unavailable";
  const safeAmount = amount;
  const normalizedUnit = normalizeUnit(unit);
  const normalizedName = ingredientName.trim().toLowerCase();
  const countableRounding = options.countableRounding ?? "practical";

  if (COUNTABLE_UNITS.has(normalizedUnit)) {
    const finalCount =
      countableRounding === "up"
        ? Math.ceil(safeAmount)
        : countableRounding === "nearest" ? Math.round(safeAmount) : safeAmount;
    const text = displayNumber(finalCount, countableRounding === "exact" ? 4 : 1);
    if (normalizedUnit === "slice") {
      return `${text} ${finalCount > 0 && finalCount <= 1 ? "slice" : "slices"}`;
    }
    if (
      NATURAL_COUNTABLE_UNITS.has(normalizedUnit) ||
      (normalizedUnit === "large" && normalizedName.includes("egg"))
    ) {
      return text;
    }
    return `${text} ${normalizedUnit}`;
  }

  if (normalizedUnit === "g") {
    return `${measuredNumber(safeAmount)}g`;
  }

  if (normalizedUnit === "ml") {
    return `${measuredNumber(safeAmount)}ml`;
  }

  if (normalizedUnit === "kg" || normalizedUnit === "l") {
    if (safeAmount > 0 && safeAmount < 1) {
      return `${measuredNumber(safeAmount * 1000)}${normalizedUnit === "kg" ? "g" : "ml"}`;
    }
    return `${displayNumber(safeAmount, 2)}${normalizedUnit}`;
  }

  return `${displayNumber(safeAmount)} ${normalizedUnit || unit}`.trim();
};

type DisplayLineInput = {
  amount: number;
  unit: string;
  ingredientName: string;
  countableRounding?: "practical" | "exact" | "nearest" | "up";
};

export const formatIngredientLineForDisplay = ({
  amount,
  unit,
  ingredientName,
  countableRounding = "practical",
}: DisplayLineInput): string => {
  const normalizedUnit = normalizeUnit(unit);
  const cleanName = ingredientName.trim() || "Ingredient";
  const amountText = humaniseAmount(amount, unit, cleanName, {
    countableRounding,
  });

  if (!COUNTABLE_UNITS.has(normalizedUnit) || !Number.isFinite(amount) || amount < 0) {
    return `${amountText} ${cleanName}`.trim();
  }

  if (normalizedUnit === "slice") {
    return `${amountText} ${cleanName}`.trim();
  }
  const count = Number(amountText);

  const singularName = singularize(cleanName);
  const displayName = count > 0 && count <= 1 ? singularName : pluralize(singularName);
  return `${amountText} ${displayName}`.trim();
};

export const formatShoppingLineForDisplay = (input: {
  quantity: number;
  unit: string;
  ingredientName: string;
}) => {
  const normalizedUnit = normalizeUnit(input.unit);
  const cleanName = input.ingredientName.trim() || "Ingredient";
  const amountText = humaniseAmount(input.quantity, input.unit, cleanName, {
    countableRounding: "practical",
  });

  if (!COUNTABLE_UNITS.has(normalizedUnit) || !Number.isFinite(input.quantity) || input.quantity < 0) {
    return { amount: amountText, name: cleanName };
  }

  if (normalizedUnit === "slice") {
    return {
      amount: amountText,
      name: cleanName,
    };
  }
  const count = Number(amountText);

  const singularName = singularize(cleanName);
  const displayName = count > 0 && count <= 1 ? singularName : pluralize(singularName);
  return {
    amount: amountText,
    name: displayName,
  };
};
