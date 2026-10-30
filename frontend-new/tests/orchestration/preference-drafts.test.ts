import assert from "node:assert/strict";
import test from "node:test";
import { foodPreferencesWithDrafts } from "../../lib/preference-drafts.ts";
import { parsePreferencePatch } from "../../lib/preferences-persistence.ts";

test("saving uncommitted visible text includes all three food fields in the real API patch", () => {
  const saved = foodPreferencesWithDrafts({ dislikes: [], neverFoods: [], foodLikes: [] }, {
    dislikeInput: " Eggs ", neverFoodInput: "  red   onion ", foodLikeInput: " Rice ",
  });
  assert.deepEqual(parsePreferencePatch(saved), {
    dislikes: ["eggs"], never_foods: ["red onion"], food_likes: ["rice"],
  });
});

test("chip and draft duplicates are saved once, without changing allergy or food categories", () => {
  const result = foodPreferencesWithDrafts({ dislikes: ["Eggs", "eggs"], neverFoods: ["Mushroom"], foodLikes: ["Brown rice"] }, {
    dislikeInput: " EGGS ", neverFoodInput: "mushroom", foodLikeInput: "brown   rice",
  });
  assert.deepEqual(result, { dislikes: ["Eggs"], neverFoods: ["Mushroom"], foodLikes: ["Brown rice"] });
  assert.equal("allergies" in result, false);
});

test("blank inputs do not create tags and failed save snapshots leave form values retryable", () => {
  const lists = { dislikes: ["Eggs"], neverFoods: [], foodLikes: [] };
  const drafts = { dislikeInput: " ", neverFoodInput: " garlic ", foodLikeInput: "\n\t" };
  const before = structuredClone({ lists, drafts });
  const first = foodPreferencesWithDrafts(lists, drafts);
  assert.deepEqual({ lists, drafts }, before);
  assert.deepEqual(first, { dislikes: ["Eggs"], neverFoods: ["garlic"], foodLikes: [] });
  assert.deepEqual(foodPreferencesWithDrafts(lists, drafts), first);
});
