---
phase: quick
plan: 261013-qxl
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [D-01, D-02, D-04, D-08, D-11]
files_modified:
  - frontend-new/supabase/migrations/20261013_structured_planning_input.sql
  - frontend-new/lib/planning-input.ts
  - frontend-new/lib/generation/types.ts
  - frontend-new/lib/generation/context-builder.ts
  - frontend-new/lib/recipes/server-constraints.ts
  - frontend-new/app/api/preferences/route.ts
  - frontend-new/lib/generation/ai-proposal.ts
  - frontend-new/lib/generation/generate-plan.ts
  - frontend-new/lib/orchestration/candidate-adapter.ts
  - frontend-new/lib/generation/rotation-history.ts
  - frontend-new/tests/orchestration/planning-input.test.ts
  - frontend-new/tests/orchestration/ai-proposal.test.ts
  - frontend-new/tests/orchestration/meal-approval-integration.test.ts
must_haves:
  truths:
    - "An allergy, dietary rule, or user-marked never food prevents a recipe from reaching an AI proposal, deterministic schedule, approval response, or saved plan."
    - "A user can dislike mushrooms or prefer cuisines without those soft preferences being treated as medical or dietary safety facts."
    - "Quick meals is represented as an explicit maximum preparation time and checked before a recipe is selectable."
    - "The planner receives a single structured snapshot containing server-owned constraints, taste preferences, practical limits, and a 14-day history of accepted, eaten, and rejected meal feedback."
    - "The AI can rank only the supplied reviewed recipes and receives the structured snapshot as guidance; it cannot invent ingredients, relax hard exclusions, or write preference data."
  artifacts:
    - path: frontend-new/lib/planning-input.ts
      provides: "Canonical PlanningInput contract, normalization, and hard-versus-soft classification"
    - path: frontend-new/supabase/migrations/20261013_structured_planning_input.sql
      provides: "Compatibility-safe persistence for never foods, food likes, and rejected meal feedback"
    - path: frontend-new/tests/orchestration/planning-input.test.ts
      provides: "Regression coverage for hard exclusions, soft tastes, practical constraints, and history"
  key_links:
    - from: frontend-new/app/api/preferences/route.ts
      to: frontend-new/lib/planning-input.ts
      via: "validated save payload mapped to explicit planning-input fields"
      pattern: "PlanningInput|neverFoods|foodLikes|maxPrepMinutes"
    - from: frontend-new/lib/generation/context-builder.ts
      to: frontend-new/lib/planning-input.ts
      via: "server-owned context assembly"
      pattern: "build.*PlanningInput|PlanningInput"
    - from: frontend-new/lib/generation/generate-plan.ts
      to: frontend-new/lib/generation/ai-proposal.ts
      via: "structured snapshot and reviewed-candidate selection request"
      pattern: "requestReviewedProposal"
    - from: frontend-new/lib/generation/rotation-history.ts
      to: frontend-new/lib/orchestration/candidate-adapter.ts
      via: "accepted/eaten/rejected memory influencing candidate eligibility and ranking"
      pattern: "rejected|rotationHistory"
---

<objective>
Create one canonical, server-owned planning input for reviewed/AI-assisted weekly generation. It must distinguish safety exclusions from food tastes, practicality from taste, and historical feedback from current preferences, then carry that exact snapshot through candidate admission, AI ranking, validation, and presentation.

Purpose: a user can say “no mushrooms,” “allergic to wheat,” and “quick meals” without those statements being conflated or silently relaxed.
Output: persisted structured fields, typed planning-input assembly, AI prompt wiring, rejection-memory flow, and focused regression coverage.
</objective>

<execution_context>
@C:/Users/u1434/.codex/get-shit-done/workflows/execute-plan.md
@C:/Users/u1434/.codex/get-shit-done/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@.planning/STATE.md
@frontend-new/lib/generation/context-builder.ts
@frontend-new/lib/generation/types.ts
@frontend-new/lib/recipes/server-constraints.ts
@frontend-new/lib/generation/ai-proposal.ts
@frontend-new/lib/generation/generate-plan.ts
@frontend-new/lib/orchestration/candidate-adapter.ts
@frontend-new/lib/generation/rotation-history.ts
@frontend-new/app/api/preferences/route.ts

<interfaces>
Current `GenerationContext` mixes `allergies`, `dislikes`, `cuisinePreferences`, `maxPrepMinutes`, targets, and rotation history. `loadServerConstraints()` separately loads allergies/dietary modes/dislikes and explicitly prevents a client from weakening saved restrictions. `requestReviewedProposal()` currently receives only candidate IDs and titles, then resolves its JSON response exclusively against server-loaded approved recipe records. Preserve that trust boundary.

Create an explicit internal contract, for example:
```ts
type PlanningInput = Readonly<{
  hardExclusions: {
    allergies: readonly string[];
    dietaryRules: readonly string[];
    neverFoods: readonly string[];
  };
  foodPreferences: {
    likes: readonly string[];
    dislikes: readonly string[];
    cuisines: readonly string[];
  };
  mealConstraints: {
    maxPrepMinutes: number;
    mealsPerDay: 3 | 5;
    weeklyBudget: number;
    macroTargets: { calories: number; protein: number; carbs: number; fat: number };
  };
  memory: {
    acceptedOrEaten: RotationHistory;
    rejectedRecipeIds: readonly string[];
    rejectedSimilarityKeys: readonly string[];
  };
}>;
```
The exact exported names may improve, but retain these four semantic groups. Allergies/dietary rules/never foods are absolute; dislikes/likes/cuisines are preference signals; prep time is a practical rule. Do not add an AI-generated recipe path or third-party recipe content.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Define and persist the canonical structured planning input</name>
  <files>frontend-new/supabase/migrations/20261013_structured_planning_input.sql, frontend-new/lib/planning-input.ts, frontend-new/lib/generation/types.ts, frontend-new/lib/generation/context-builder.ts, frontend-new/lib/recipes/server-constraints.ts, frontend-new/app/api/preferences/route.ts, frontend-new/tests/orchestration/planning-input.test.ts</files>
  <behavior>
    - “Wheat allergy” and a dietary rule always populate hard exclusions; a request payload cannot delete saved values.
    - “No mushrooms” is stored and exposed as a soft dislike by default; a separately chosen “never show this food” value is a hard exclusion.
    - Food likes and cuisine preferences remain soft ranking signals.
    - “Quick meals” resolves to an explicit positive `maxPrepMinutes`, persisted and enforced independently of food tastes.
    - Empty, malformed, duplicate, or non-string submitted terms are normalized/rejected deterministically without converting an arbitrary value into a safety claim.
  </behavior>
  <action>Create `lib/planning-input.ts` first as the single typed contract and normalization/merge helper. Give it four named groups: hard exclusions (allergies, dietary rules, never foods), food preferences (likes, dislikes, cuisines), meal constraints (macro targets, budget, meals per day, maximum prep minutes), and memory. Use conservative case/whitespace normalization, stable de-duplication, bounded list lengths, and explicit validation errors for invalid constraint values. Preserve the existing rule that client inputs may add, but never remove, saved hard exclusions.

Create an additive, idempotent Supabase migration for structured `never_foods`, `food_likes`, and any missing preference fields needed by this contract. Add rejected-feedback persistence to the existing user history model in a compatibility-safe form (state/reason/recipe identity or a dedicated additive table), without assuming a particular pre-existing check constraint or requiring destructive migration. Update `/api/preferences` to accept the new groups, validate them through the canonical helper, and write field-compatible payload variants so older Supabase environments fail safely and visibly rather than silently dropping hard exclusions. Keep user allergies synchronized through the existing `user_allergies` table. Update `buildContext` and `loadServerConstraints` to assemble their data from this contract rather than independently reinterpreting arrays; retain existing target and onboarding fallbacks only as defaults for missing practical constraints.

Write focused node tests before implementation: server saved wheat allergy remains present when the client posts an empty allergy list; mushrooms stays a soft dislike; mushrooms marked never-food becomes a hard exclusion; `under_10` resolves to 10 minutes; invalid max prep time and malformed term arrays fail predictably. Use repository/database doubles already used by orchestration tests; do not call a real Supabase instance.</action>
  <verify>
    <automated>cd frontend-new; node --test tests/orchestration/planning-input.test.ts tests/orchestration/meal-approval-integration.test.ts</automated>
  </verify>
  <done>A single typed planning-input snapshot can be built from saved data plus additive client input, with durable hard/soft/practical classification and regression tests proving no downgrade of a hard exclusion.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Carry the structured snapshot through reviewed candidate admission and AI selection</name>
  <files>frontend-new/lib/generation/ai-proposal.ts, frontend-new/lib/generation/generate-plan.ts, frontend-new/lib/orchestration/candidate-adapter.ts, frontend-new/lib/recipes/server-constraints.ts, frontend-new/tests/orchestration/ai-proposal.test.ts, frontend-new/tests/orchestration/generation-adapter.test.ts</files>
  <behavior>
    - Recipes with a wheat allergen, incompatible dietary tag, or never-food ingredient are excluded before the AI is asked to rank candidates.
    - A mushroom dislike is ranked away when alternatives exist but does not become an allergy failure; never-mushrooms does.
    - A recipe exceeding `maxPrepMinutes` cannot be offered or selected even if it matches the user’s cuisine preference.
    - The AI receives hard exclusions, soft preferences, constraints, and recent/rejected memory alongside only server-approved candidate IDs; its response still contains IDs/versions only and is resolved server-side.
    - A malformed, stale, unreviewed, duplicate, or out-of-catalogue AI selection is rejected before scheduling or persistence.
  </behavior>
  <action>Adapt `buildDeterministicPlanningInput` to receive the canonical snapshot and use its hard exclusions for `approveRecipe`/candidate eligibility, its practical limit for prep admission, and its food preferences only for scoring/ranking. Do not pass empty allergies/dietary rules into the normalized planner profile while separately enforcing them: keep the explicit hard constraints available at every later validator boundary. Ensure the candidate set carries enough reviewed ingredient/allergen/dietary evidence for deterministic validation.

Extend `requestReviewedProposal` with a typed, serializable planning brief derived from the snapshot. Send the brief and reviewed candidate metadata in the structured prompt; describe hard exclusions as non-negotiable, soft preferences as ranking guidance, and recent/rejected meals as avoid signals. Keep the strict JSON schema restricted to recipe choices. Never transmit user identity, raw profile notes, OAuth/session data, or secrets. Update `generateWeeklyPlanWithArtifacts` to pass the brief, resolve the output against server-owned approved records, run deterministic schedule/approval checks after AI ranking, and return the current explicit failure codes when any boundary fails. Preserve no-key deterministic reviewed scheduling as a valid fallback; do not reintroduce synthetic meal generation.

Add tests that inspect request construction through an injected OpenAI client or pure request-builder seam rather than making network calls. Cover hard wheat/never-food/prep exclusions, soft mushroom ranking behavior, brief redaction, and rejection of AI choices that attempt to escape the approved candidate set.</action>
  <verify>
    <automated>cd frontend-new; node --test tests/orchestration/ai-proposal.test.ts tests/orchestration/generation-adapter.test.ts tests/orchestration/meal-approval.test.ts</automated>
  </verify>
  <done>Reviewed candidate admission, AI ranking, deterministic scheduling, and final approval all use the same structured classification; the AI can influence selection but cannot weaken safety or invent meal facts.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Record rejection feedback and make recent-meal memory influence the next proposal</name>
  <files>frontend-new/lib/generation/rotation-history.ts, frontend-new/lib/generation/meal-storage.ts, frontend-new/app/api/meal-plan/state/route.ts, frontend-new/app/meals/page.tsx, frontend-new/tests/orchestration/planning-input.test.ts, frontend-new/tests/orchestration/meal-approval-integration.test.ts</files>
  <behavior>
    - Accepted/eaten history remains the 14-day rotation record.
    - A user rejection records the approved recipe ID/version and similarity key with a reason without falsely marking it eaten.
    - A future plan avoids rejected recipes/similar meals while a safe alternative exists; it returns an honest insufficiency result if the reviewed catalogue cannot satisfy hard rules.
    - The UI labels a food as either “avoid” or “never include” and makes the distinction understandable before a plan is generated.
  </behavior>
  <action>Extend rotation history parsing and the persistence path so accepted/eaten and rejected states are distinct evidence. Store only authenticated user-owned, server-resolved reviewed recipe identity/version plus an allowlisted rejection reason; do not accept arbitrary recipe IDs, free-form private text, or client-provided history state. Feed rejected recipe IDs/similarity keys into the orchestration history used by scheduling/replacement, with a candidate excluded only when an eligible alternative remains. Preserve the existing 14-day window and existing accepted/eaten semantics.

Expose the distinctions in the existing preferences/planner UI with low-cognitive-load copy: “Avoid foods” for soft dislikes and “Never include” for hard non-allergy exclusions, with allergies still clearly labelled as safety information. When a user rejects a generated recipe, use the protected route/state flow to persist feedback only after the server verifies the plan/recipe ownership and review version; show a calm success/failure state and leave the existing plan unchanged on failure. Do not add social/community features, third-party recipes, or a desktop redesign.

Add tests for a rejected reviewed recipe being avoided on the next schedule, a scarce catalogue falling back only when that is safe and not violating hard exclusions, spoofed rejection input producing no history write, and accepted/eaten records remaining distinct from rejections.</action>
  <verify>
    <automated>cd frontend-new; npm run test:orchestration; npx tsc --noEmit --pretty false</automated>
  </verify>
  <done>Each future generation consumes a server-owned 14-day memory that includes accepted/eaten rotation and protected rejection feedback, while the UI and API make hard exclusions, soft tastes, and practicality explicit.</done>
</task>

</tasks>

<threat_model>
| Boundary | Threat | Disposition | Mitigation |
|---|---|---|---|
| Client preferences to API | A client removes an allergy/dietary restriction or labels arbitrary data as safe | mitigate | Merge additively with server-owned hard exclusions; schema validation and server-side normalization |
| Saved preference rows to planner | Schema drift silently drops a hard exclusion | mitigate | Compatibility-safe writes, explicit read failures for unverifiable safety data, regression doubles for variants |
| Planning snapshot to AI | Prompt injection or profile data leaks change safety rules or reveal private notes | mitigate | Serialize allowlisted planning fields only; model sees hard rules as guidance but its IDs are revalidated server-side |
| AI response to scheduler | Model invents a recipe, ingredient, version, or relaxed restriction | mitigate | Strict JSON schema plus server resolution exclusively against approved recipe/version records |
| Client feedback to history | User forges another user's rejection/eaten state or poisons rotation memory | mitigate | Authenticated ownership/version lookup and allowlisted rejection reason before write |
| History to candidate ranking | Scarce catalogue causes a previous rejection to override allergy/diet/prep safety | mitigate | Hard eligibility first, rejected/recent avoidance only among already-safe alternatives |
</threat_model>

<verification>
Run the scoped planning-input, AI proposal, candidate-adapter, approval, and persistence tests, followed by `npm run test:orchestration` and `npx tsc --noEmit --pretty false`. Manually verify the existing planner preferences control shows the three categories in plain language and a generated/saved plan never includes wheat when wheat is an allergy, even with a client request attempting to clear the saved restriction. Treat existing unrelated worktree changes as read-only: stage only files this quick task changes, and do not revert, format, or fold in the current shopping, macro, UI, or debugging edits.
</verification>

<success_criteria>
Ovona has one server-owned JSON-ready planning input that accurately separates safety exclusions, food preferences, meal practicality, and recent feedback. That same input reaches deterministic eligibility and the AI selector, then final reviewed-recipe approval prevents either layer from violating it.
</success_criteria>

<output>
After completion, create `.planning/quick/261013-qxl-implement-structured-planning-input-that/261013-qxl-SUMMARY.md` with implementation files, test results, migration deployment status, and any catalogue gaps that prevent safe alternatives.
</output>
