import assert from "node:assert/strict";
import test from "node:test";
import { OnboardingSessionChangedError, saveOnboardingPreferences } from "../../lib/onboarding-preferences.ts";
import { parsePreferencePatch } from "../../lib/preferences-persistence.ts";
import { allergyOptionSelected, toggleAllergyOption } from "../../lib/allergy-options.ts";
import { PreferenceSaveFeedbackError, preferenceSaveFeedback } from "../../lib/preference-feedback.ts";

const session = { access_token: "synthetic-token", user: { id: "owner-a" } };
function harness(options: { missing?: boolean; wrongVerified?: boolean; switchAt?: number; networkFailure?: boolean } = {}) {
  let reads = 0;
  const sent: RequestInit[] = [];
  const verifiedTokens: string[] = [];
  const auth = {
    getSession: async () => ({ data: { session: options.missing ? null : ++reads === options.switchAt ? { access_token: "other-token", user: { id: "owner-b" } } : session }, error: null }),
    getUser: async (token: string) => { verifiedTokens.push(token); return { data: { user: { id: options.wrongVerified ? "owner-b" : "owner-a" } }, error: null }; },
  };
  const send: typeof fetch = async (_input, init) => {
    sent.push(init!);
    if (options.networkFailure) throw new Error("Synthetic network failure");
    return Response.json({ ok: true, profileSaved: true, allergiesSynced: true });
  };
  return { auth, send, sent, verifiedTokens };
}

test("onboarding sends the verified bearer identity and precise chosen preparation limit", async () => {
  for (const [selection, expected] of [["under_10", 10], ["10_15", 15], ["15_30", 30]] as const) {
    const h = harness();
    const response = await saveOnboardingPreferences(h.auth, "owner-a", selection, { allergies: ["Dairy"], maxPrepMinutes: 99 }, h.send);
    assert.equal(response.status, 200);
    assert.deepEqual(h.verifiedTokens, [session.access_token]);
    assert.equal(h.sent.length, 1);
    assert.equal(new Headers(h.sent[0].headers).get("Authorization"), "Bearer synthetic-token");
    assert.deepEqual(parsePreferencePatch(JSON.parse(h.sent[0].body as string)), { allergies: ["dairy"], max_prep_minutes: expected });
  }
});

test("onboarding does not write when session identity is missing, unverified or changes before sending", async () => {
  for (const options of [{ missing: true }, { wrongVerified: true }, { switchAt: 2 }]) {
    const h = harness(options);
    await assert.rejects(saveOnboardingPreferences(h.auth, "owner-a", "15_30", {}, h.send), OnboardingSessionChangedError);
    assert.equal(h.sent.length, 0);
  }
  const h = harness();
  await assert.rejects(saveOnboardingPreferences(h.auth, "other-owner", "15_30", {}, h.send), OnboardingSessionChangedError);
  assert.equal(h.sent.length, 0);
});

test("an in-flight account switch cannot report onboarding success for the new account", async () => {
  const h = harness({ switchAt: 3 });
  await assert.rejects(saveOnboardingPreferences(h.auth, "owner-a", "10_15", {}, h.send), OnboardingSessionChangedError);
  assert.equal(h.sent.length, 1);
});

test("onboarding preserves non-success responses for caller feedback and propagates network failure", async () => {
  const h = harness();
  const failure: typeof fetch = async () => Response.json({ error: "preferences_schema_unsupported", message: "Update service" }, { status: 503 });
  const response = await saveOnboardingPreferences(h.auth, "owner-a", "15_30", {}, failure);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "preferences_schema_unsupported");
  const network = harness({ networkFailure: true });
  await assert.rejects(saveOnboardingPreferences(network.auth, "owner-a", "15_30", {}, network.send), /Synthetic network failure/);
});

test("saved lowercase and canonical allergies stay selected without broadening precise restrictions", () => {
  const saved = parsePreferencePatch({ allergies: ["Dairy", "Gluten", "Nuts", "Fish", "Shellfish", "Eggs", "Soy", "Sesame"] }).allergies as string[];
  for (const option of ["Dairy", "Gluten", "Nuts", "Fish", "Shellfish", "Eggs", "Soy", "Sesame"]) assert.equal(allergyOptionSelected(saved, option), true);
  assert.equal(allergyOptionSelected(["milk"], "Dairy"), true);
  assert.equal(allergyOptionSelected(["peanuts"], "Nuts"), true);
  assert.equal(allergyOptionSelected(["molluscs"], "Shellfish"), true);
  assert.equal(allergyOptionSelected(["milk"], "Fish"), false);
  const precise = ["peanuts", "mustard"];
  assert.equal(allergyOptionSelected(precise, "Nuts"), true);
  assert.deepEqual(precise, ["peanuts", "mustard"]);
  assert.deepEqual(toggleAllergyOption(["dairy", "milk", "mustard"], "Dairy"), ["mustard"]);
  assert.deepEqual(toggleAllergyOption(["mustard"], "Dairy"), ["mustard", "Dairy"]);
});

test("preference form feedback retains actionable schema failures while hiding unexpected error details", () => {
  const safe = "Safety preferences need a service update.";
  assert.equal(preferenceSaveFeedback(new PreferenceSaveFeedbackError({ error: "preferences_schema_unsupported", message: safe })), safe);
  for (const message of [undefined, null, "", "  ", 123, {}]) {
    assert.equal(preferenceSaveFeedback(new PreferenceSaveFeedbackError({ error: "preferences_schema_unsupported", message })), "Your safety preferences could not be saved. Please try again after the service is updated.");
  }
  assert.equal(preferenceSaveFeedback(new Error("Unexpected sensitive detail")), "We couldn't save your preferences. Please try again.");
  assert.equal(preferenceSaveFeedback(new PreferenceSaveFeedbackError({ error: "other", message: "Untrusted detail" })), "We couldn't save your preferences. Please try again.");
});
