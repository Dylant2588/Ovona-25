import assert from "node:assert/strict";
import test from "node:test";
import { matchesPlanPeriod } from "../../lib/plan-view.ts";
import { planAnchor, planCacheKey } from "../../lib/plan-scope.ts";
import { reviewedPlan } from "./reviewed-recipe-fixture.ts";

test("daily caches and saved revisions cannot be mistaken for weekly or another owner's plan", () => {
  const week = reviewedPlan(); week.userId = "owner";
  const anchor = planAnchor("week", week.weekStart);
  const day = { ...week, scope: "day" as const, days: [week.days[0]] };
  assert.equal(matchesPlanPeriod(day, "owner", "day", anchor), true);
  assert.equal(matchesPlanPeriod(week, "owner", "week", anchor), true);
  assert.equal(matchesPlanPeriod(day, "owner", "week", anchor), false);
  assert.equal(matchesPlanPeriod(week, "owner", "day", anchor), false);
  assert.equal(matchesPlanPeriod({ ...day, scope: undefined }, "owner", "day", anchor), false);
  assert.equal(matchesPlanPeriod(day, "another-owner", "day", anchor), false);
  assert.equal(matchesPlanPeriod({ ...day, days: [] }, "owner", "day", anchor), false);
  assert.equal(matchesPlanPeriod({ ...day, days: [{ ...day.days[0], date: "2026-10-13" }] }, "owner", "day", anchor), false);
  assert.equal(matchesPlanPeriod({ ...day, id: "saved-revision" }, "owner", "day", anchor), true);
  assert.notEqual(planCacheKey("owner", "day", anchor), planCacheKey("owner", "week", anchor));
  assert.notEqual(planCacheKey("owner", "day", anchor), planCacheKey("another-owner", "day", anchor));
});
