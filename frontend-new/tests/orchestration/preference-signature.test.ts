import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { PreferencesInput } from "../../lib/meal-generator.ts";
import { foodPreferencesWithDrafts } from "../../lib/preference-drafts.ts";
import { parsePreferencePatch } from "../../lib/preferences-persistence.ts";

const require = createRequire(import.meta.url);
const { load } = require("../../scripts/export-recipe-library.cjs") as {
  load: (path: string) => { preferenceSignatureFor: (preferences: PreferencesInput) => string };
};
const { preferenceSignatureFor } = load(fileURLToPath(new URL("../../lib/meal-generator.ts", import.meta.url)));
const base = (): PreferencesInput => ({ tastes: ["quick-minimal"], profile: { allergies: ["Dairy"], dislikes: [], neverFoods: [], foodLikes: [], maxPrepMinutes: 30, bodyWeightKg: 80, timezone: "Europe/London" } });

test("real preference signature changes for never-include, liked foods and strict prep limits", () => {
  const original = base(); const signature = preferenceSignatureFor(original);
  for (const patch of [{ neverFoods: ["garlic"] }, { foodLikes: ["rice"] }, { maxPrepMinutes: 15 }]) {
    assert.notEqual(preferenceSignatureFor({ ...original, profile: { ...original.profile, ...patch } }), signature);
  }
});

test("draft Save and persisted reload have identical food signatures despite normalization", () => {
  const original = base();
  const foods = foodPreferencesWithDrafts({ dislikes: ["Eggs"], neverFoods: [], foodLikes: ["Rice"] }, {
    dislikeInput: " EGGS ", neverFoodInput: " Red   onion ", foodLikeInput: "rice",
  });
  const beforeSave: PreferencesInput = { ...original, profile: { ...original.profile, ...foods, allergies: [" Dairy ", "dairy"], cuisines: [" Mediterranean ", "mediterranean"] } };
  const patch = parsePreferencePatch({ ...foods, allergies: beforeSave.profile!.allergies, cuisines: beforeSave.profile!.cuisines });
  const afterReload: PreferencesInput = { ...original, profile: { ...original.profile, dislikes: patch.dislikes as string[], neverFoods: patch.never_foods as string[], foodLikes: patch.food_likes as string[], allergies: patch.allergies as string[], cuisines: patch.cuisines as string[] } };
  assert.equal(preferenceSignatureFor(beforeSave), preferenceSignatureFor(afterReload));
});

test("signature normalization is nonmutating and standard null prep equals displayed 30 minutes", () => {
  const original = base(); original.profile!.dislikes = ["  Red  onion", "EGGS", "eggs"];
  const snapshot = structuredClone(original);
  const normalized: PreferencesInput = { ...base(), profile: { ...base().profile, dislikes: ["eggs", "red onion"], maxPrepMinutes: null } };
  assert.equal(preferenceSignatureFor(original), preferenceSignatureFor(normalized));
  assert.deepEqual(original, snapshot);
  assert.equal(preferenceSignatureFor(base()), preferenceSignatureFor({ ...base(), profile: { ...base().profile, maxPrepMinutes: undefined } }));
});

test("legacy delimited food columns retain every allergy and match equivalent array signatures", () => {
  const legacy = { ...base(), profile: { ...base().profile,
    allergies: " Eggs; Dairy / Sesame\nSoy ", dislikes: " Red onion, Garlic ", neverFoods: "Mushroom; Celery", foodLikes: "Rice / Oats", cuisines: "British; Asian",
  } } as unknown as PreferencesInput;
  const arrays = { ...base(), profile: { ...base().profile,
    allergies: ["eggs", "dairy", "sesame", "soy"], dislikes: ["red onion", "garlic"], neverFoods: ["mushroom", "celery"], foodLikes: ["rice", "oats"], cuisines: ["british", "asian"],
  } };
  assert.equal(preferenceSignatureFor(legacy), preferenceSignatureFor(arrays));
  assert.notEqual(preferenceSignatureFor(legacy), preferenceSignatureFor({ ...arrays, profile: { ...arrays.profile, allergies: ["dairy", "sesame", "soy"] } }));
  const malformed = { ...base(), profile: { ...base().profile, allergies: ["Eggs", null] } } as unknown as PreferencesInput;
  assert.throws(() => preferenceSignatureFor(malformed), /Preference food lists/);
});
