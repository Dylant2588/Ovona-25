import { createPendingRecipeImport } from "./imports.ts";
import { newApprovalNutritionErrors } from "./nutrition.ts";
import type { RecipeRecord } from "./types.ts";

export const MAX_PENDING_IMPORT_BYTES = 1_048_576;
export class PendingImportBodyError extends Error {
  status: 400 | 413;
  constructor(status: 400 | 413, message: string) { super(message); this.status = status; }
}
export async function readPendingImportBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new PendingImportBodyError(400, "Supply a JSON array of pending calculated recipes.");
  const decoder = new TextDecoder("utf-8", { fatal: true }); let text = ""; let bytes = 0;
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > MAX_PENDING_IMPORT_BYTES) { await reader.cancel(); throw new PendingImportBodyError(413, "Import exceeds 1 MiB."); }
      text += decoder.decode(next.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof PendingImportBodyError) throw error;
    await reader.cancel().catch(() => undefined);
    throw new PendingImportBodyError(400, "Supply valid UTF-8 JSON pending recipes.");
  } finally { reader.releaseLock(); }
}
export function parsePendingImportBatch(value: unknown, actor: string): { ok: true; records: RecipeRecord[] } | { ok: false; errors: string[] } {
  if (!Array.isArray(value) || !value.length || value.length > 50) return { ok: false, errors: ["Supply 1–50 pending calculated recipes."] };
  const errors: string[] = []; const identities = new Set<string>();
  value.forEach((record, index) => {
    if (record === null || typeof record !== "object" || Array.isArray(record)) { errors.push(`Recipe ${index + 1}: record must be an object.`); return; }
    const result = createPendingRecipeImport({ record, importedBy: actor, payloadHash: "validated-server-hash-required-at-persistence", sourceReference: record?.source?.reference ?? "" });
    if (!result.ok) { errors.push(...result.errors.map(error => `Recipe ${index + 1}: ${error}`)); return; }
    errors.push(...newApprovalNutritionErrors(record).map(error => `Recipe ${index + 1}: ${error}`));
    const identity = JSON.stringify([record.id, record.version]);
    if (identities.has(identity)) errors.push(`Recipe ${index + 1}: duplicate recipe identity/version.`);
    identities.add(identity);
  });
  return errors.length ? { ok: false, errors } : { ok: true, records: value as RecipeRecord[] };
}

/** Fixed endpoint only; never allow credentials, remote HTTP or redirect forwarding. */
export function pendingImportEndpoint(value: string): string {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/api/recipe-import" ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)))) {
    throw new Error("Use an HTTPS or loopback HTTP /api/recipe-import endpoint without credentials, query or fragment.");
  }
  return url.href;
}
