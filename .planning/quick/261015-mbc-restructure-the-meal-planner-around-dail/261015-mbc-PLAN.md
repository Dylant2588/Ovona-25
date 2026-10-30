---
phase: quick
plan: 261015-mbc
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend-new/app/meals/page.tsx
  - frontend-new/lib/orchestration/schedule.ts
  - frontend-new/tests/orchestration/schedule.test.ts
autonomous: false
requirements: [QUICK-DAILY-FIRST-PLANNER, QUICK-SAME-DAY-VARIETY]
must_haves:
  truths:
    - "A user selects a day and immediately sees that day's meals before weekly nutrition or shopping information."
    - "Day-specific actions sit with the selected day's meals and remain usable on a narrow phone screen."
    - "Weekly nutrition and the weekly shopping list remain available below the daily meal workflow as optional disclosures."
    - "A generated day cannot contain the same protein source three times, while the scheduler still honours reviewed-recipe, allergy, preference, practical-basket, macro, and repetition constraints."
  artifacts:
    - path: "frontend-new/app/meals/page.tsx"
      provides: "Daily-first mobile-responsive planner hierarchy"
    - path: "frontend-new/lib/orchestration/schedule.ts"
      provides: "Same-day protein variety constraint during candidate scheduling"
    - path: "frontend-new/tests/orchestration/schedule.test.ts"
      provides: "Regression coverage for daily protein variety"
  key_links:
    - from: "frontend-new/app/meals/page.tsx day-selector buttons"
      to: "expandedDayId and selected-day meal rendering"
      via: "setExpandedDayId(day.id)"
      pattern: "setExpandedDayId\\(day\\.id\\)"
    - from: "frontend-new/app/meals/page.tsx selected-day meal section"
      to: "handleRegenerateDay, handleSwapMeal, saveMealLog and recipe expansion"
      via: "existing authenticated event handlers"
      pattern: "handle(RegenerateDay|SwapMeal)|saveMealLog"
    - from: "frontend-new/lib/orchestration/schedule.ts selection traversal"
      to: "VerifiedCandidateMeal.proteinType"
      via: "same-day count before candidate selection"
      pattern: "MAX_SAME_PROTEIN_PER_DAY|proteinType"
---

<objective>
Put the selected day at the centre of Ovona's meal-planning experience and prevent impractical same-day protein repetition.

Purpose: People open Ovona to know what to make today; weekly diagnostics and shopping data support that decision after the daily meals, rather than interrupting it.
Output: A daily-first planner layout and tested scheduling rule that rejects three occurrences of one protein source in a day.
</objective>

<context>
@AGENTS.md
@.planning/STATE.md
@frontend-new/app/meals/page.tsx
@frontend-new/lib/orchestration/schedule.ts
@frontend-new/tests/orchestration/schedule.test.ts

<interfaces>
From frontend-new/app/meals/page.tsx:
```typescript
const [expandedDayId, setExpandedDayId] = useState<string>(...);
// displayDays is the rendered weekly plan; selected day is displayDays filtered by expandedDayId.
handleRegenerateDay(dayIndex: number): Promise<void>;
handleSwapMeal(dayIndex: number, mealIndex: number): Promise<void>;
saveMealLog(mealInstanceId: string, date: string): Promise<void>;
```

From frontend-new/lib/orchestration/types.ts:
```typescript
export type VerifiedCandidateMeal = { id: string; slot: PlannerMealSlot; proteinType?: string; /* reviewed recipe data */ };
export type SelectedMeal = { candidateId: string; proteinType?: string; /* final scheduled meal */ };
```
</interfaces>

User decisions:
- The mobile-first order is fixed: plan header and day selector, selected-day meals, optional selected-day actions, then weekly nutrition and shopping list.
- Weekly nutrition and shopping must remain available below the daily workflow, not removed or moved into unrelated product flows.
- The scheduler must prefer variety and must never schedule the same protein source three times in one day, while retaining all existing trusted recipe and practical constraints.

Discovery level 0: this uses the existing MUI page, existing plan state/handlers, and existing scheduler/test infrastructure. No dependency or external integration is needed.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Lock the same-day protein variety rule with scheduler regressions</name>
  <files>frontend-new/tests/orchestration/schedule.test.ts, frontend-new/lib/orchestration/schedule.ts</files>
  <behavior>
    - A five-meal day with candidates containing several protein types never schedules any normalised proteinType more than twice.
    - A catalogue that only permits a macro-feasible day by using one protein type three times returns the existing structured insufficiency result; it must not silently relax the daily rule.
    - Missing proteinType is treated consistently as the existing fallback category, so it cannot be used to bypass the rule.
    - Existing bounded weekly recipe-repeat and explicitly linked leftover behaviour stays intact.
  </behavior>
  <action>First add deterministic cases to the existing node:test schedule suite. Then make the scheduler's complete-day traversal enforce a maximum of two normalised protein types within its in-progress daily choices, before it commits the day. Preserve all existing eligibility filtering, allergy and never-food boundaries, reviewed-candidate boundary, macro feasibility calculation, practical ingredient basket caps, linked-leftover exception, and bounded weekly recipe repetition. Continue to rank lower-used protein sources first where choices otherwise remain feasible, but never fabricate a new recipe, substitute unreviewed data, or weaken any hard constraint to make a schedule pass. Keep the failure an explicit existing insufficiency response when catalogue coverage makes a varied day impossible.</action>
  <verify>
    <automated>cd frontend-new; node --test tests/orchestration/schedule.test.ts</automated>
  </verify>
  <done>The scheduler demonstrably rejects three same-protein meals on a day, permits at most two when the catalogue supports it, and all existing schedule regressions pass.</done>
</task>

<task type="auto">
  <name>Task 2: Restructure the planner into a daily-first mobile flow</name>
  <files>frontend-new/app/meals/page.tsx</files>
  <action>Reorder the authenticated plan presentation per the user decision: (1) retain the compact plan header and persistent preference/new-plan controls, (2) show the selected-day heading, target summary, horizontally scrollable day selector, and selected-day meals immediately after it, (3) keep only actions that apply to that selected day beside or directly beneath its meals (change day, recipe, swap, ate-this, meal-out/logging and target recovery), and (4) render the weekly nutrition/trends disclosure and weekly shopping-list disclosure only after all selected-day content. Do not place the weekly graph, weekly totals, or shopping list between the day selector and the selected meal rows. Keep the current `expandedDayId` state, all data fetches/persistence, recipe expansion, meal logging, swapping, social-meal warnings, target-state messaging, shopping-list calculations and retailer evidence behaviour intact. On phones, day tabs must remain horizontally scrollable, meal actions must stack without clipping, and the selected-day meals must not be hidden inside a desktop-only layout. On desktop, keep the daily flow as one readable vertical task sequence rather than restoring the current weekly panels above it. Do not change unrelated onboarding, auth, review, budget or pricing flows.</action>
  <verify>
    <automated>cd frontend-new; npx eslint app/meals/page.tsx; npx tsc --noEmit --pretty false</automated>
  </verify>
  <done>A signed-in user sees their selected day's meals directly after choosing a day at mobile and desktop widths; weekly nutrition and shopping are below those meals and retain their existing disclosures and data.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify the daily-first planner and variety protection</name>
  <action>Exercise the completed authenticated planner flow in a real signed-in browser session and confirm the protected scheduling outcome is understandable to a user.</action>
  <what-built>A daily-first planner hierarchy and protected same-day protein variety rule.</what-built>
  <how-to-verify>
    1. Open `/meals` on a phone-width viewport and choose a non-today day: its meal list must appear directly below the day selector, with controls readable and tappable.
    2. Open a recipe, swap a meal, mark a meal eaten and use Change day: these existing actions must still work for the selected day.
    3. Expand weekly nutrition and weekly shopping: both must appear below the selected-day workflow and show their usual data.
    4. Generate a new plan and inspect any day: no protein source (for example turkey or chicken) should appear in three meals on that day. If the trusted catalogue cannot make a compliant day, Ovona should keep the existing plan and report that safely instead of producing a three-turkey day.
  </how-to-verify>
  <verify><automated>cd frontend-new; node --test tests/orchestration/schedule.test.ts; npx tsc --noEmit --pretty false</automated></verify>
  <done>A human has confirmed the displayed order and existing daily actions; generated plans either honour the two-meal same-protein cap or fail safely with a clear catalogue limitation.</done>
  <resume-signal>Type "approved" or describe the issue.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| reviewed recipe catalogue to scheduler | Candidate recipe fields drive user meal choices and shopping quantities. |
| client planner state to authenticated mutations | UI controls invoke existing regenerate, swap and meal-log APIs. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-01 | Tampering | `schedule.ts` | mitigate | Enforce protein variety inside the same complete-day candidate selection that already runs eligibility, macro, and practical-basket checks; cover it with deterministic tests. |
| T-quick-02 | Spoofing/Elevation | `meals/page.tsx` action controls | mitigate | Reuse the existing authenticated mutation handlers; do not add client-side write paths or bypass server validation. |
| T-quick-03 | Information | weekly panels | accept | Existing plan data remains visible only through the authenticated page's existing fetches; this task only changes visual order. |
| T-quick-04 | Denial of service | day selector and disclosures | mitigate | Preserve bounded in-memory rendering and existing accordion/disclosure mechanics; introduce no new network calls on selection. |
</threat_model>

<verification>
Run the focused scheduler suite, lint the planner file and type-check the application. Then carry out the checkpoint at phone and desktop widths against a signed-in plan. A plan that cannot meet the trusted catalogue, macro, practical ingredient and variety requirements must fail safely rather than relax any of those boundaries.
</verification>

<success_criteria>
- Day selection flows straight into the selected daily meal list and day actions.
- Weekly nutrition and weekly shopping appear after daily meal execution content.
- Existing daily planner actions and shopping derivation remain functional.
- No generated day contains more than two meals with the same protein source.
</success_criteria>

<output>
After completion, create `.planning/quick/261015-mbc-restructure-the-meal-planner-around-dail/261015-mbc-SUMMARY.md` with the changed files, automated results, and human verification outcome.
</output>
