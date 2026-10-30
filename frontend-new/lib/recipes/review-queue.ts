import type { RecipeRecord } from "./types.ts";
import { recipeRecordErrors } from "./repository.ts";
import { newApprovalNutritionErrors } from "./nutrition.ts";

export type ReviewQueueEntry = { id: string; version: number; title: string; record: RecipeRecord | null; validationErrors: string[] };
export const reviewQueueKey = (entry: Pick<ReviewQueueEntry, "id" | "version">): string => JSON.stringify([entry.id, entry.version]);
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

/** Saved pending rows are untrusted JSON, including when TypeScript callers cast them. */
export function reviewQueueEntries(value: unknown): ReviewQueueEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((row, index) => {
    const id = object(row) && typeof row.id === "string" && row.id.trim() ? row.id : `invalid-row-${index + 1}`;
    const version = object(row) && Number.isSafeInteger(row.version) && Number(row.version) > 0 ? Number(row.version) : 0;
    const record = object(row) ? row.record : null;
    let errors: string[];
    try { errors = recipeRecordErrors(record); } catch { errors = ["Malformed recipe evidence."]; }
    if (!object(record) || record.id !== id || record.version !== version || typeof record.description !== "string" || !object(record.review) || record.review.status !== "pending_review") errors.push("Saved draft identity or display evidence is incomplete.");
    if (errors.length) return { id, version, title: `Invalid draft: ${id} v${version}`, record: null, validationErrors: [...new Set(errors)] };
    const checked = record as RecipeRecord;
    const displayRecord = structuredClone(checked);
    if (displayRecord.nutrition.method !== "ingredient_calculated_v1") {
      delete displayRecord.nutrition.calculation;
      displayRecord.ingredients.forEach(ingredient => { delete ingredient.nutrition; });
    }
    return { id, version, title: checked.title, record: displayRecord,
      validationErrors: [...new Set([...newApprovalNutritionErrors(checked), ...(object(row) && Array.isArray(row.validationErrors) ? row.validationErrors.filter((error): error is string => typeof error === "string") : [])])] };
  });
}
