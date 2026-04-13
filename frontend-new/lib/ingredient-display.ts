const COUNTABLE_UNITS = new Set(["large", "each", "piece", "slice", "unit"]);
const NATURAL_COUNTABLE_UNITS = new Set(["large", "each", "piece", "unit"]);

const normalizeUnit = (unit: string) => unit.trim().toLowerCase();

const roundToStep = (value: number, step: number) =>
  Math.round(value / step) * step;

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

const countFromDisplay = (value: string) => {
  const match = value.match(/\d+/);
  if (!match) return 1;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
};

type HumaniseOptions = {
  countableRounding?: "nearest" | "up";
};

export const humaniseAmount = (
  amount: number,
  unit: string,
  ingredientName: string,
  options: HumaniseOptions = {}
): string => {
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const normalizedUnit = normalizeUnit(unit);
  const normalizedName = ingredientName.trim().toLowerCase();
  const countableRounding = options.countableRounding ?? "nearest";

  if (COUNTABLE_UNITS.has(normalizedUnit)) {
    const rounded =
      countableRounding === "up"
        ? Math.ceil(safeAmount)
        : Math.round(safeAmount);
    const finalCount = Math.max(1, rounded);
    if (normalizedUnit === "slice") {
      return `${finalCount} ${finalCount === 1 ? "slice" : "slices"}`;
    }
    if (
      NATURAL_COUNTABLE_UNITS.has(normalizedUnit) ||
      (normalizedUnit === "large" && normalizedName.includes("egg"))
    ) {
      return `${finalCount}`;
    }
    return `${finalCount} ${normalizedUnit}`;
  }

  if (normalizedUnit === "g") {
    if (safeAmount <= 10) return `${Math.round(safeAmount)}g`;
    if (safeAmount <= 100) return `${roundToStep(safeAmount, 10)}g`;
    if (safeAmount <= 500) return `${roundToStep(safeAmount, 25)}g`;
    return `${roundToStep(safeAmount, 50)}g`;
  }

  if (normalizedUnit === "ml") {
    if (safeAmount <= 100) return `${roundToStep(safeAmount, 10)}ml`;
    if (safeAmount <= 500) return `${roundToStep(safeAmount, 25)}ml`;
    return `${roundToStep(safeAmount, 50)}ml`;
  }

  if (normalizedUnit === "kg" || normalizedUnit === "l") {
    const rounded = Math.round(safeAmount * 10) / 10;
    return `${rounded}${normalizedUnit}`;
  }

  const roundedFallback = Math.round(safeAmount * 10) / 10;
  return `${roundedFallback} ${normalizedUnit || unit}`.trim();
};

type DisplayLineInput = {
  amount: number;
  unit: string;
  ingredientName: string;
  countableRounding?: "nearest" | "up";
};

export const formatIngredientLineForDisplay = ({
  amount,
  unit,
  ingredientName,
  countableRounding = "nearest",
}: DisplayLineInput): string => {
  const normalizedUnit = normalizeUnit(unit);
  const cleanName = ingredientName.trim() || "Ingredient";
  const amountText = humaniseAmount(amount, unit, cleanName, {
    countableRounding,
  });

  if (!COUNTABLE_UNITS.has(normalizedUnit)) {
    return `${amountText} ${cleanName}`.trim();
  }

  const count = countFromDisplay(amountText);
  if (normalizedUnit === "slice") {
    return `${amountText} ${cleanName}`.trim();
  }

  const singularName = singularize(cleanName);
  const displayName = count === 1 ? singularName : pluralize(singularName);
  return `${count} ${displayName}`.trim();
};

export const formatShoppingLineForDisplay = (input: {
  quantity: number;
  unit: string;
  ingredientName: string;
}) => {
  const normalizedUnit = normalizeUnit(input.unit);
  const cleanName = input.ingredientName.trim() || "Ingredient";
  const amountText = humaniseAmount(input.quantity, input.unit, cleanName, {
    countableRounding: "nearest",
  });

  if (!COUNTABLE_UNITS.has(normalizedUnit)) {
    return { amount: amountText, name: cleanName };
  }

  const count = countFromDisplay(amountText);
  if (normalizedUnit === "slice") {
    return {
      amount: amountText,
      name: cleanName,
    };
  }

  const singularName = singularize(cleanName);
  const displayName = count === 1 ? singularName : pluralize(singularName);
  return {
    amount: `${count}`,
    name: displayName,
  };
};
