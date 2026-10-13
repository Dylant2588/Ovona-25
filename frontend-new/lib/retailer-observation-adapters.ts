export type RetailerPriceObservation = {
  retailerId: string; retailerName: string; ingredientKey: string; packSize: number; packUnit: string;
  unitPrice: number; currency: string; estimated: boolean; sourceReference: string;
  provenanceStatus: "operator_imported" | "licensed_feed"; observedAt: string; importedAt: string;
};

export type OperatorObservationBatch = {
  adapterVersion: string; importedBy: string; importBatchId: string; observations: RetailerPriceObservation[];
};

export type OperatorObservationResult = { ok: true; value: OperatorObservationBatch } | { ok: false; errors: string[] };
const present = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const time = (value: string) => Number.isFinite(Date.parse(value));

/** Accepts batches already obtained by an operator; this module intentionally has no runtime fetch or scraping path. */
export function acceptOperatorObservationBatch(batch: OperatorObservationBatch): OperatorObservationResult {
  const errors: string[] = [];
  if (!present(batch.adapterVersion) || !present(batch.importedBy) || !present(batch.importBatchId)) errors.push("Operator batch identity is required");
  if (!Array.isArray(batch.observations) || batch.observations.length === 0) errors.push("At least one operator observation is required");
  for (const observation of batch.observations ?? []) {
    if (![observation.retailerId, observation.retailerName, observation.ingredientKey, observation.packUnit, observation.currency, observation.sourceReference, observation.provenanceStatus].every(present)) errors.push("Retailer provenance and source evidence are required");
    if (!Number.isFinite(observation.packSize) || observation.packSize <= 0 || !Number.isFinite(observation.unitPrice) || observation.unitPrice < 0) errors.push("Valid pack and price values are required");
    if (!/^[A-Z]{3}$/.test(observation.currency)) errors.push("Currency must be ISO-4217");
    if (!time(observation.observedAt) || !time(observation.importedAt) || Date.parse(observation.importedAt) < Date.parse(observation.observedAt)) errors.push("Observed and imported timestamps are required in order");
  }
  return errors.length ? { ok: false, errors: [...new Set(errors)] } : { ok: true, value: { ...batch, observations: batch.observations.map((observation) => ({ ...observation })) } };
}
