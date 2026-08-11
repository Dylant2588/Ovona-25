## 1. Validated meal variety

- [ ] 1.1 Audit the static catalogue by slot, ingredient coverage, and primary protein source; add compatible verified concepts where rotation is too small.
- [ ] 1.2 Make AI concept generation request a bounded set of novel, rotation-aware candidates using the resolved user constraints.
- [ ] 1.3 Validate and rank AI and catalogue candidates using ingredient resolution, safety, preparation, and recent-history rules before weekly selection.
- [ ] 1.4 Apply safe variety rules across initial generation, day regeneration, and meal swaps.

## 2. Daily target adherence

- [ ] 2.1 Define calorie and protein acceptance tolerances and a structured per-day adherence result.
- [ ] 2.2 Add deterministic compatible correction passes for portions and meal substitutions after nutrition calculation.
- [x] 2.3 Prevent materially off-target days from being returned as accepted plans; return an actionable incomplete-plan result when recovery is exhausted.
- [ ] 2.4 Persist and expose daily adherence outcomes through the meal-plan API and planner state.

## 3. Macro adherence visualization

- [x] 3.1 Replace the mixed-unit grouped chart with a calorie-versus-target view and separate gram-based macro progress.
- [ ] 3.2 Add clear per-day accepted/off-target states to the weekly totals and day summaries.
- [ ] 3.3 Verify responsive desktop and mobile rendering with realistic accepted and incomplete plan data.

## 4. Verification and dogfood

- [ ] 4.1 Add coverage for rotation, safe fallback, daily target correction, and incomplete-plan responses.
- [ ] 4.2 Run the production dogfood path with Dairy allergy and custom macro targets; verify a varied plan, target adherence, graph readability, and no automatic regeneration.
