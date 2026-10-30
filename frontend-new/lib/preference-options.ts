const optionKey = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

/** Saved API values are lowercase; preserve unrecognised values while rendering known choices. */
export function preferenceOptionSelected(values: readonly string[], option: string): boolean {
  return values.some(value => optionKey(value) === optionKey(option));
}

export function togglePreferenceOption(values: readonly string[], option: string): string[] {
  return preferenceOptionSelected(values, option)
    ? values.filter(value => optionKey(value) !== optionKey(option))
    : [...values, option];
}

/** A canonical null explicitly means mixed and must not resurrect a legacy diet. */
export function savedDietaryMode(row: { dietary_mode?: string | null; lifestyle?: string | null } | null): string | null {
  return row?.dietary_mode !== undefined ? row.dietary_mode : row?.lifestyle ?? null;
}
