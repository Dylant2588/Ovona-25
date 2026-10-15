import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

for (const line of fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*?)\s*$/);
  if (match) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
}

test("prints live approved candidate eligibility", async () => {
  const { approveRecipe } = await import("../lib/recipes/approval.ts");
  const { normalizePlannerProfile } = await import("../lib/orchestration/normalize-profile.ts");
  const { orchestrateWeek } = await import("../lib/orchestration/schedule.ts");
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const preferences = await client.from("user_preferences").select("user_id, allergies, max_prep_minutes, never_foods, dietary_mode, lifestyle").limit(1);
  assert.equal(preferences.error, null, preferences.error?.message);
  assert.ok(Array.isArray(preferences.data) && preferences.data.length, "expected saved preferences");
  const userId = (preferences.data as Array<{ user_id: string }>)[0]!.user_id;
  const [profile, allergies, recipes] = await Promise.all([
    client.from("profiles").select("allergies").eq("id", userId).limit(1),
    client.from("user_allergies").select("allergy_name").eq("user_id", userId),
    client.from("recipe_library").select("id, record").eq("review_status", "approved"),
  ]);
  const asStrings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : typeof value === "string" ? value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean) : [];
  const pref = (preferences.data as Array<Record<string, unknown>>)[0] ?? {};
  assert.equal(profile.error, null, profile.error?.message);
  const prof = (profile.data as Array<Record<string, unknown>> | null)?.[0] ?? {};
  const constraints = {
    allergies: [...asStrings(pref.allergies), ...asStrings(prof.allergies), ...((allergies.data ?? []) as Array<{ allergy_name: string }>).map((row) => row.allergy_name)],
    neverFoods: [...asStrings(pref.never_foods), ...asStrings(prof.never_foods)],
    dietaryModes: [...asStrings(pref.dietary_mode), ...asStrings(pref.lifestyle), ...asStrings(prof.dietary_mode), ...asStrings(prof.lifestyle)],
    maxPrepMinutes: 30,
  };
  const outcome = (recipes.data ?? []).map((row) => {
    const result = approveRecipe(row.record as never, constraints);
    return { id: row.id, slots: (row.record as { slots?: string[] }).slots ?? [], ingredients: (row.record as { ingredients?: Array<{ name: string; canonicalId: string }> }).ingredients?.map((ingredient) => `${ingredient.name} (${ingredient.canonicalId})`) ?? [], approved: result.approved, reasons: result.reasons.map((reason) => reason.code) };
  });
  const snacks = outcome.filter((item) => item.slots.includes("snack"));
  const candidates = (recipes.data ?? []).flatMap((row) => {
    const record = row.record as { id: string; slots: Array<"breakfast" | "snack" | "lunch" | "dinner">; ingredients: Array<{ name: string; canonicalId: string; amount: number; unit: string }>; macros: { calories: number; protein: number; carbs: number; fat: number }; readyInMinutes: number; proteinType: string };
    if (!approveRecipe(record as never, constraints).approved) return [];
    return record.slots.map((slot) => ({ id: `${record.id}:${slot}`, slot, title: record.id, verified: true as const,
      ingredients: record.ingredients.map((ingredient) => ({ name: ingredient.name, normalizedName: ingredient.canonicalId, quantity: ingredient.amount, unit: ingredient.unit, pantry: false })),
      allergens: [], dietaryTags: [], nutrition: record.macros, cost: 0, prepMinutes: record.readyInMinutes, servings: 1, similarityKey: record.id, proteinType: record.proteinType, format: slot }));
  });
  const profileForSchedule = normalizePlannerProfile({ calorieTarget: 1830, proteinTarget: 216, allergies: constraints.allergies,
    dietaryRules: [], maxPrepMinutes: 30, householdSize: 1, requiredSlots: ["breakfast", "snack", "lunch", "snack", "dinner"] });
  const schedule = orchestrateWeek(profileForSchedule, candidates, {});
  console.log(JSON.stringify({ constraints, snackEligible: snacks.filter((item) => item.approved), snackExcluded: snacks.filter((item) => !item.approved), eligibleRecipes: (recipes.data ?? []).filter((row) => approveRecipe(row.record as never, constraints).approved).map((row) => { const record = row.record as { id: string; slots: string[]; proteinType: string; macros: object }; return { id: record.id, slots: record.slots, proteinType: record.proteinType, macros: record.macros }; }), allEligible: outcome.filter((item) => item.approved).length, schedule }, null, 2));
});
