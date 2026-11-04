import assert from "node:assert/strict";
import test from "node:test";
import { parsePlanScope, planDayCount, planAnchor, planCacheKey } from "../../lib/plan-scope.ts";

test("scope is explicit, defaults legacy plans to a week and rejects invalid dates", () => {
  assert.equal(parsePlanScope(undefined), "week");
  assert.equal(planDayCount("day"), 1);
  assert.equal(planDayCount("week"), 7);
  assert.throws(() => parsePlanScope("daily"));
  assert.equal(planAnchor("day", "2026-11-04"), "2026-11-04");
  assert.equal(planAnchor("week", "2026-11-04"), "2026-11-02");
  assert.throws(() => planAnchor("day", "2026-02-30"));
  assert.notEqual(planCacheKey("owner", "day", "2026-11-02"), planCacheKey("owner", "week", "2026-11-02"));
  assert.notEqual(planCacheKey("owner", "day", "2026-11-02"), planCacheKey("other", "day", "2026-11-02"));
});
