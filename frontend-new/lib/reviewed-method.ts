/** Reviewed source instructions must not be filtered or replaced by generated steps. */
export function reviewedMethodForDisplay(meal: { recipeVersion?: number; steps?: unknown; recipeSteps?: unknown }): string[] | null {
  if (!Number.isInteger(meal.recipeVersion) || Number(meal.recipeVersion) < 1) return null;
  const steps = meal.steps ?? meal.recipeSteps;
  return Array.isArray(steps) ? steps.filter((s): s is string => typeof s === "string" && !!s.trim()).map(s => s.trim()) : [];
}
