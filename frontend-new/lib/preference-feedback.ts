const unsupported = "Your safety preferences could not be saved. Please try again after the service is updated.";
const generic = "We couldn't save your preferences. Please try again.";

/** Only deliberately constructed safe response messages may reach the form. */
export class PreferenceSaveFeedbackError extends Error {
  constructor(payload: { error?: unknown; message?: unknown }) {
    super(payload.error === "preferences_schema_unsupported"
      ? typeof payload.message === "string" && payload.message.trim() ? payload.message : unsupported
      : generic);
  }
}

export const preferenceSaveFeedback = (error: unknown): string => error instanceof PreferenceSaveFeedbackError ? error.message : generic;
