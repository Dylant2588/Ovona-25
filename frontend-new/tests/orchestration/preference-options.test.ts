import assert from "node:assert/strict";
import test from "node:test";
import { preferenceOptionSelected, togglePreferenceOption, savedDietaryMode } from "../../lib/preference-options.ts";
import { parsePreferencePatch } from "../../lib/preferences-persistence.ts";

test("saved cuisine values remain visibly selected and can be unchecked after normalization", () => {
  const saved = parsePreferencePatch({ cuisines: ["Mediterranean", "Middle Eastern"] }).cuisines as string[];
  assert.equal(preferenceOptionSelected(saved, "Mediterranean"), true);
  assert.equal(preferenceOptionSelected(saved, "Middle Eastern"), true);
  assert.deepEqual(togglePreferenceOption(saved, "Mediterranean"), ["middle eastern"]);
  assert.deepEqual(saved, ["mediterranean", "middle eastern"]);
});

test("toggling cuisines removes case duplicates while preserving unrelated and unknown values", () => {
  const saved = [" ASIAN ", "asian", "Unknown regional cuisine"];
  assert.deepEqual(togglePreferenceOption(saved, "Asian"), ["Unknown regional cuisine"]);
  assert.deepEqual(togglePreferenceOption(saved, "Mexican"), [...saved, "Mexican"]);
});

test("canonical dietary mode takes precedence over legacy values including explicit mixed", () => {
  assert.equal(savedDietaryMode({ dietary_mode: "vegan", lifestyle: "mixed" }), "vegan");
  assert.equal(savedDietaryMode({ dietary_mode: null, lifestyle: "vegan" }), null);
  assert.equal(savedDietaryMode({ lifestyle: "pescetarian" }), "pescetarian");
  assert.equal(savedDietaryMode(null), null);
});
