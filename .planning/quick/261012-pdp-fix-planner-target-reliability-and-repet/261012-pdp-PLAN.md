---
phase: quick
plan: 261012-pdp
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend-new/app/meals/page.tsx
autonomous: true
requirements: [QUICK-RELIABILITY, QUICK-PREMIUM-PRESENTATION]
must_haves:
  truths:
    - Meals are readable in compact rows with recipe access and quieter swap actions.
    - Selected-day meals follow a compact day selector and nutrition summary.
    - Target failures remain truthful and offer one clear recovery action.
    - Confirmed generation defects have regression evidence; target tolerances are not loosened to conceal failures.
  artifacts:
    - path: frontend-new/app/meals/page.tsx
      provides: Compact planner presentation preserving existing interactions
  key_links:
    - from: meal row recipe control
      to: expandedMealId and existing recipe Collapse
      via: existing recipe toggle
    - from: meal row swap control
      to: handleSwapMeal(dayIndex, mealIndex)
      via: existing authenticated swap flow
---

<objective>
Deliver the user-approved reliability investigation and calmer premium planner presentation, preserving current colours and complete planner functionality.
</objective>

<context>
@AGENTS.md
@.planning/STATE.md
@frontend-new/app/meals/page.tsx
Existing contracts: mealSlotDisplayLabel(meal.mealSlot, mealIndex, day.meals), mealMacroLine(meal), handleSwapMeal(dayIndex, mealIndex), handleRegenerateDay(dayIndex), handleRegenerate(), saveMealLog(meal.instanceId, day.date), expandedMealId/setExpandedMealId, expandedMealForDay and recipe-${day.id} Collapse. Reuse these; retain auth, persistence, ingredient scaling, shopping, logging, preferences, analytics disclosures and loading states.
Discovery level 0: existing MUI layout and handlers, no new dependency or external integration.
</context>

<tasks>
<task type="auto">
  <name>Task 1: Integrate confirmed reliability diagnosis and regression evidence</name>
  <files>.planning/quick/261012-pdp-fix-planner-target-reliability-and-repet/261012-pdp-SUMMARY.md</files>
  <action>Consume the separately assigned debugger's confirmed diagnosis and scoped domain fix for target failures and repeated protein-heavy meals. Record exact changed domain files and regression commands/results in the summary. Domain implementation belongs to that debugger; do not edit their files or unrelated in-flight generation/STATE changes. Do not prescribe speculative target-tolerance changes, fabricate passing target status, or claim existing saved plans are repaired automatically. Verify actual corrected generation behavior and explicitly report any constraints still preventing acceptable plans.</action>
  <verify><automated>cd frontend-new; npm run test:orchestration</automated></verify>
  <done>Confirmed defect, applied fix, focused regression evidence and any remaining limitations are documented from the debugger's results.</done>
</task>

<task type="auto">
  <name>Task 2: Replace narrow meal columns with responsive compact rows</name>
  <files>frontend-new/app/meals/page.tsx</files>
  <action>Replace the repeat(day.meals.length) desktop card grid with one full-width row per meal. Show meal slot, readable meal title, cooking time when available, calories and protein; allow natural title wrapping without breaking ordinary words. Give recipe access a quiet keyboard-accessible text/button control and retain aria-expanded/aria-controls and current recipe expansion. Position swap and eaten logging as secondary controls with existing disabled/loading states and 44px touch targets; stack controls and metadata cleanly on mobile. Preserve complete expanded recipe content. Remove Portion multiplier from row metadata and show it only within expanded recipe details when different from one. Preserve existing theme, data, shopping derivations and handlers. Add no fake images or dependencies.</action>
  <verify><automated>cd frontend-new; npx eslint app/meals/page.tsx</automated></verify>
  <done>Five meals display as readable rows at desktop and mobile widths; recipe, swap and eaten controls retain their existing functionality; multipliers appear only in recipe details.</done>
</task>

<task type="auto">
  <name>Task 3: Compress planner hierarchy and consolidate actionable warnings</name>
  <files>frontend-new/app/meals/page.tsx</files>
  <action>Reduce hero heading size/padding and collapse the oversized Today/Next up panel into a compact day heading, horizontally scrollable day selector and calories/protein summary immediately above meal rows. Keep preferences, shopping shortcut and new-plan access. Ensure Today label only applies to the actual local calendar date, not any selected day. Keep optional food logging available through its disclosure. Replace repeated Needs different meals text/chips and redundant top/day warnings with one selected-day explanation using actual target/validation state plus the existing regenerate-day recovery action; expose week-wide failure count in the same coherent warning if needed. Maintain accurate calorie/protein numbers and distinguish selected future days. Use calm factual heading copy when the plan is outside targets. Verify signed-in desktop/mobile recipe expansion, swap, day selection, logging and shopping; capture actual results and known unrelated type errors in the summary.</action>
  <verify><automated>cd frontend-new; npx eslint app/meals/page.tsx</automated></verify>
  <done>Meals occupy the primary content area; day controls remain usable at narrow widths; each target failure has one honest explanation and actionable recovery; no existing feature is removed.</done>
</task>
</tasks>

<threat_model>
Trust boundary: authenticated planner state and API responses enter client rendering.

| Threat | Category | Disposition | Mitigation |
|---|---|---|---|
| Misleading target success hides invalid plans | Tampering | mitigate | Preserve numeric targets and validation status; consolidate presentation only. |
| Layout changes bypass authenticated mutations | Elevation | mitigate | Reuse handleSwapMeal, handleRegenerateDay and saveMealLog without changing API/auth flows. |
| Recipe text becomes executable markup | Injection | mitigate | Preserve React text rendering; introduce no raw HTML. |
</threat_model>

<verification>
Run focused eslint and debugger regressions. Inspect populated signed-in planner at desktop/mobile widths, exercising existing controls. Do not add styling-mirroring tests or weaken validation to obtain green status.
</verification>

<success_criteria>
All four user-approved outcomes are delivered: evidence-based reliability correction, compact meal rows, compressed top hierarchy, and internal-looking metadata/duplicate warnings removed from the overview. Existing features and theme remain intact.
</success_criteria>

<output>
Create .planning/quick/261012-pdp-fix-planner-target-reliability-and-repet/261012-pdp-SUMMARY.md with changes, verification and limitations.
</output>
