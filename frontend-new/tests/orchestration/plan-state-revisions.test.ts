import assert from "node:assert/strict";
import test from "node:test";
import { revisionRows, selectPlanRevision } from "../../lib/plan-revisions.ts";
import { reviewedPlan } from "./reviewed-recipe-fixture.ts";

test("revision selection isolates scope, never mixes rows and falls back to last complete commit", () => {
  const week = reviewedPlan(); const day = { ...week, scope: "day" as const, days: week.days.slice(0, 1), id: "daily" };
  const old = revisionRows(week, "user-1", "weekly", "2026-10-12");
  const current = revisionRows(day, "user-1", "daily", "2026-10-12");
  const incomplete = revisionRows(week, "user-1", "broken", "2026-10-12").slice(0, 6);
  assert.equal(selectPlanRevision([...incomplete, ...current, ...old], "user-1", "week", "2026-10-12")?.id, "weekly");
  assert.equal(selectPlanRevision([...incomplete, ...current, ...old], "user-1", "day", "2026-10-12")?.id, "daily");
  assert.equal(selectPlanRevision(old.slice(0, 1), "user-1", "day", "2026-10-12"), null);
  assert.equal(selectPlanRevision(current, "another", "day", "2026-10-12"), null);
  assert.equal(selectPlanRevision([...old.slice(0, 6), old[0]], "user-1", "week", "2026-10-12"), null);
});
