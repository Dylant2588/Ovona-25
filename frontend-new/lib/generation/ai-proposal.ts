import type { RecipeRecord } from "../recipes/types.ts";

export type AiMealChoice = Readonly<{ slot: string; recipeId: string; recipeVersion: number }>;
export type AiMealProposal = Readonly<{ choices: readonly AiMealChoice[] }>;
export type ResolvedAiMealChoice = Readonly<{ slot: string; recipe: RecipeRecord }>;
export type AiProposalFailure = Readonly<{ code: "ai_proposal_malformed" | "ai_proposal_refused" | "ai_proposal_timeout" | "ai_proposal_unavailable" | "ai_proposal_unreviewed"; reason: string }>;
export type AiProposalResolution = { ok: true; value: readonly ResolvedAiMealChoice[] } | { ok: false; error: AiProposalFailure };

const failure = (code: AiProposalFailure["code"], reason: string): AiProposalResolution => ({ ok: false, error: { code, reason } });

/**
 * The model's response is never recipe evidence. This resolver accepts only a
 * complete mapping back to the server-loaded reviewed recipe/version records.
 */
export function resolveReviewedProposal(
  proposal: unknown,
  reviewedRecipes: readonly RecipeRecord[],
  expectedSlots: readonly string[],
): AiProposalResolution {
  if (!proposal || typeof proposal !== "object" || !Array.isArray((proposal as { choices?: unknown }).choices)) {
    return failure("ai_proposal_malformed", "The AI returned an incomplete meal selection. Your existing plan is unchanged.");
  }
  const choices = (proposal as { choices: unknown[] }).choices;
  if (choices.length !== expectedSlots.length) return failure("ai_proposal_malformed", "The AI did not choose every required reviewed meal slot. Your existing plan is unchanged.");
  const expected = new Set(expectedSlots);
  const seen = new Set<string>();
  const resolved: ResolvedAiMealChoice[] = [];
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") return failure("ai_proposal_malformed", "The AI returned an invalid meal selection. Your existing plan is unchanged.");
    const { slot, recipeId, recipeVersion } = choice as Partial<AiMealChoice>;
    if (typeof slot !== "string" || typeof recipeId !== "string" || !Number.isInteger(recipeVersion) || !expected.has(slot) || seen.has(slot)) {
      return failure("ai_proposal_malformed", "The AI returned duplicate or invalid meal slots. Your existing plan is unchanged.");
    }
    const recipe = reviewedRecipes.find((candidate) => candidate.id === recipeId && candidate.version === recipeVersion && candidate.review.status === "approved");
    if (!recipe) return failure("ai_proposal_unreviewed", "The AI chose a recipe version that is not approved. Your existing plan is unchanged.");
    seen.add(slot);
    resolved.push({ slot, recipe });
  }
  if (seen.size !== expected.size) return failure("ai_proposal_malformed", "The AI omitted a required meal slot. Your existing plan is unchanged.");
  return { ok: true, value: resolved };
}

type OpenAiCompletion = { choices?: Array<{ message?: { refusal?: string | null; content?: string | null } }> };

const proposalSchema = {
  type: "object",
  additionalProperties: false,
  required: ["choices"],
  properties: {
    choices: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["slot", "recipeId", "recipeVersion"],
        properties: {
          slot: { type: "string" },
          recipeId: { type: "string" },
          recipeVersion: { type: "integer" },
        },
      },
    },
  },
} as const;

/** Optional Structured Outputs ranking. Callers must resolve its result before use. */
export async function requestReviewedProposal(
  choices: readonly Readonly<{ slot: string; recipeId: string; recipeVersion: number; title: string }>[],
  apiKey = process.env.OPENAI_API_KEY,
): Promise<{ ok: true; value: unknown } | { ok: false; error: AiProposalFailure }> {
  if (!apiKey) return { ok: false, error: { code: "ai_proposal_unavailable", reason: "OpenAI is not configured; using the reviewed deterministic schedule." } };
  try {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey, timeout: 8_000, maxRetries: 0 });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MEAL_MODEL || "gpt-4o-mini",
      messages: [{ role: "system", content: "Rank only the provided reviewed recipe IDs. Return no recipe facts or prose." }, { role: "user", content: JSON.stringify({ candidates: choices, requiredOutput: { choices: [{ slot: "string", recipeId: "string", recipeVersion: 1 }] } }) }],
      response_format: { type: "json_schema", json_schema: { name: "reviewed_recipe_choices", strict: true, schema: proposalSchema } },
    }) as OpenAiCompletion;
    const message = completion.choices?.[0]?.message;
    if (message?.refusal) return { ok: false, error: { code: "ai_proposal_refused", reason: "The AI declined the reviewed recipe selection. Your existing plan is unchanged." } };
    if (!message?.content) return { ok: false, error: { code: "ai_proposal_malformed", reason: "The AI returned no structured meal selection. Your existing plan is unchanged." } };
    return { ok: true, value: JSON.parse(message.content) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI request failed";
    return { ok: false, error: { code: /abort|timeout/i.test(message) ? "ai_proposal_timeout" : "ai_proposal_unavailable", reason: `AI meal selection is unavailable: ${message}. Your existing plan is unchanged.` } };
  }
}
