type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => value !== null && typeof value === "object" && !Array.isArray(value);
const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
type Result = { ok: true; sourceAmount: number; sourceUnit: "g" | "ml" | "each" } | { ok: false; errors: string[] };

/** Convert the measured batch amount to the precise food's basis dimension.
 * No implicit density, spoon size, egg size or count synonym is assumed.
 */
export function convertIngredientQuantity(value: unknown): Result {
  const fail = (message: string): Result => ({ ok: false, errors: [message] });
  if (!object(value) || !positive(value.amount)) return fail("Measured ingredient amount must be positive and finite.");
  const evidence = value.nutrition;
  if (!object(evidence) || !object(evidence.food) || !object(evidence.food.basis)) return fail("Missing exact food nutrition and quantity evidence.");
  if (typeof evidence.quantityState !== "string" || !["raw", "cooked", "drained", "cooked_drained", "as_sold"].includes(evidence.quantityState) || evidence.quantityState !== evidence.food.state) return fail("Ingredient quantity state must match the precise food preparation state.");
  const basis = evidence.food.basis;
  if (!positive(basis.amount) || typeof basis.unit !== "string" || !["g", "ml", "each"].includes(basis.unit)) return fail("Food basis must have a positive finite amount and g, ml or each unit.");
  const supplied = evidence.conversion;
  if (supplied !== undefined && (!object(supplied) || !text(supplied.reference))) return fail("Quantity conversion requires a nonempty evidence reference.");
  const conversion = object(supplied) ? supplied : {};
  if (Object.keys(conversion).some(key => !["reference", "densityGramsPerMl", "gramsPerUnit", "mlPerUnit"].includes(key))) return fail("Unsupported quantity conversion evidence field.");
  if ("densityGramsPerMl" in conversion && !positive(conversion.densityGramsPerMl)) return fail("Density must be positive finite grams per ml.");
  const weight = conversion.gramsPerUnit;
  if ("gramsPerUnit" in conversion && (!object(weight) || typeof weight.unit !== "string" || !["each", "large", "piece"].includes(weight.unit) || !positive(weight.grams))) return fail("Named count conversion requires a positive finite measured gram weight.");
  const spoon = conversion.mlPerUnit;
  if ("mlPerUnit" in conversion && (!object(spoon) || typeof spoon.unit !== "string" || !["tbsp", "tsp"].includes(spoon.unit) || !positive(spoon.ml))) return fail("Named spoon conversion requires positive finite measured ml.");
  let amount = value.amount;
  if (typeof value.unit !== "string") return fail("Unsupported or ambiguous ingredient unit.");
  let unit = value.unit;
  if (unit === "kg") { amount *= 1000; unit = "g"; }
  if (unit === "l") { amount *= 1000; unit = "ml"; }
  if (["tbsp", "tsp"].includes(unit)) {
    if (!object(spoon) || spoon.unit !== unit) return fail("This exact spoon unit requires measured ml-per-unit evidence.");
    amount *= spoon.ml as number; unit = "ml";
  }
  if (["large", "piece"].includes(unit) || (unit === "each" && basis.unit !== "each")) {
    if (!object(weight) || weight.unit !== unit) return fail("This exact count unit requires measured grams-per-unit evidence.");
    amount *= weight.grams as number; unit = "g";
  }
  if (!["g", "ml", "each"].includes(unit)) return fail("Unsupported or ambiguous ingredient unit.");
  if (unit !== basis.unit) {
    const density = conversion.densityGramsPerMl;
    if (unit === "ml" && (basis.unit === "g" || basis.unit === "each")) {
      if (!positive(density)) return fail("Volume to mass conversion requires explicit density evidence.");
      amount *= density; unit = "g";
    }
    if (unit === "g" && basis.unit === "ml") {
      if (!positive(density)) return fail("Mass to volume conversion requires explicit density evidence.");
      amount /= density; unit = "ml";
    }
    if (unit === "g" && basis.unit === "each") {
      if (!object(weight) || weight.unit !== "each") return fail("Mass to source count conversion requires the source each weight.");
      amount /= weight.grams as number; unit = "each";
    }
  }
  if (unit !== basis.unit || !positive(amount)) return fail("Incompatible dimensions or nonfinite converted ingredient amount.");
  return { ok: true, sourceAmount: amount, sourceUnit: basis.unit as "g" | "ml" | "each" };
}
