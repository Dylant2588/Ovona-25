import assert from "node:assert/strict";
import test from "node:test";

import { filterEligibleCandidates, isVerifiedCandidate } from "../../lib/orchestration/eligibility.ts";
import { normalizePlannerProfile } from "../../lib/orchestration/normalize-profile.ts";
import { PlannerInsufficiencyError } from "../../lib/orchestration/types.ts";
import {
  allergyProhibitedCandidate,
  dietProhibitedCandidate,
  incompleteUnverifiedCandidate,
  safeCandidates,
  validRawProfile,
} from "./fixtures.ts";

test("admits only complete, explicitly verified candidates", () => {
  assert.equal(isVerifiedCandidate(safeCandidates[0]), true);
  assert.equal(isVerifiedCandidate(incompleteUnverifiedCandidate), false);
});

test("filters allergy, dietary, unverified, and slow candidates before scheduling", () => {
  const profile = normalizePlannerProfile(validRawProfile);
  const tooSlow = { ...safeCandidates[0], id: "too-slow", prepMinutes: 31 };
  const result = filterEligibleCandidates(profile, [
    ...safeCandidates,
    allergyProhibitedCandidate,
    dietProhibitedCandidate,
    incompleteUnverifiedCandidate,
    tooSlow,
  ]);

  assert.deepEqual(result.eligible.map((candidate) => candidate.id), safeCandidates.map((candidate) => candidate.id));
  assert.deepEqual(result.exclusions.map((entry) => entry.reason).sort(), ["allergen_conflict", "dietary_conflict", "prep_time_exceeded", "unverified_or_incomplete"].sort());
});

test("returns a typed insufficiency result rather than relaxing safety constraints", () => {
  const profile = normalizePlannerProfile(validRawProfile);
  const result = filterEligibleCandidates(profile, [allergyProhibitedCandidate, dietProhibitedCandidate]);

  assert.equal(result.eligible.length, 0);
  assert.equal(result.error instanceof PlannerInsufficiencyError, true);
  assert.equal(result.error?.statusCode, 422);
});
