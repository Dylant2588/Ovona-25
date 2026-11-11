---
phase: quick-261104-nvf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend-new/lib/tesco-prices.ts
  - frontend-new/lib/shopping-cost.ts
  - frontend-new/app/api/shopping-list/route.ts
  - frontend-new/components/ShoppingCostEstimate.tsx
  - frontend-new/app/meals/page.tsx
  - frontend-new/tests/orchestration/shopping-cost.test.ts
  - frontend-new/tests/orchestration/shopping-route-consistency.test.ts
  - frontend-new/tests/orchestration/shopping-cost-panel.test.ts
autonomous: true
requirements: [SCRUM-29]
must_haves:
  truths:
    - The approved day shows a clearly illustrative UK purchase-pack cost separately from food-consumed cost.
    - Missing prices, unsupported units and unknown observation dates never become fabricated or verified retailer quotes.
    - Owned ingredients reduce purchase cost only after an explicit user choice, without changing recipes or ledger quantities.
    - Swaps, portions, preferences and saved revisions cannot retain an estimate from a different approved basket.
  artifacts:
    - path: frontend-new/lib/tesco-prices.ts
      provides: Opt-in exact-form and compatible-unit pricing using the existing catalogue and pack arithmetic
    - path: frontend-new/lib/shopping-cost.ts
      provides: Structured illustrative purchase and consumption projection with gaps and provenance
    - path: frontend-new/components/ShoppingCostEstimate.tsx
      provides: Honest cost, assumptions and missing-item display
  key_links:
    - from: frontend-new/app/api/shopping-list/route.ts
      to: frontend-new/lib/shopping-cost.ts
      via: Derive estimates only after current server approval and ledger construction
    - from: frontend-new/lib/shopping-cost.ts
      to: frontend-new/lib/tesco-prices.ts
      via: Reuse strict priceBasket results rather than a second price catalogue or matcher
    - from: frontend-new/app/meals/page.tsx
      to: frontend-new/components/ShoppingCostEstimate.tsx
      via: Current plan and explicit ownership snapshot guard
---

<objective>
Deliver SCRUM-29: a useful, explicitly illustrative purchase-pack estimate and separate consumed-food estimate for the current approved daily basket. Reuse existing pricing data and pack calculations; preserve recipe nutrition, exact ingredient ledger and verified-retailer comparison semantics. No new retailer feed, schema, dependency, checkout, deployment or merge.
</objective>

<context>
@AGENTS.md
@.planning/STATE.md
@frontend-new/lib/tesco-prices.ts
@frontend-new/lib/ingredient-ledger.ts
@frontend-new/lib/shopping-approval.ts
@frontend-new/app/api/shopping-list/route.ts
@frontend-new/app/meals/page.tsx

Verified discovery (internal reuse, Level 0): PRICE_DB contains assumed UK pack sizes/prices but no observed dates, retailer product IDs or verified suitability evidence. priceBasket already calculates ceil(required/packSize) and purchase totals. Its legacy matcher strips preparation descriptors, canonicalises substrings, accepts unknown units and guesses count aliases such as slices/jars/servings. Those permissive paths are unsuitable for this estimate. Pea protein, cocoa, cinnamon and water have no supported entries; apple/banana have only piece pricing while current recipes use grams; olive oil is priced in ml while the recipe uses grams. These remain gaps without source-backed conversion. Existing shopping approval constructs the authoritative ledger and returns planId; existing frontend approval snapshots already invalidate after plan/preference/auth changes. Keep the separate qualified retailer comparator unchanged.

User decisions: individual one-day usability; rough cost accepted; no fabricated prices or dietary substitutions; explicit pantry assumptions; weekly functionality retained; hybrid AI and retailer comparisons deferred. Baseline:230 tests pass, TypeScript passes, lint zero errors/nine existing warnings. Parent owns UI wiring; executor owns pricing/API contracts and tests. Do not overwrite others' edits or stage unrelated snapshots.

<interfaces>
Existing: priceBasket(items: ShoppingListItem[]): BasketPricing; each priced line has ingredient, packsNeeded, packSize:string, totalCost, matched, amountNeeded, amountToBuy and unit. Extend with an optional strict-mode/options parameter while preserving the existing default behaviour for legacy callers.

Create ShoppingCostEstimate with status:"estimated"|"partial"|"unavailable", currency:"GBP"|null, purchaseSubtotal:number|null, consumedSubtotal:number|null, missingItems:string[], ownedIngredientKeys:string[], lines:Array&lt;{key:string;name:string;requiredQuantity:number;unit:string;matched:boolean;assumedOwned:boolean;packsNeeded:number|null;packSize:string|null;purchaseCost:number|null;consumedCost:number|null;reason?:string}&gt;, source:{name:string;reference:string;region:"UK";retailer:null;observedAt:null;calculatedAt:string;priceStatus:"date_unknown"}, dietaryStatus:"unverified". Export estimateShoppingCost(items,{currency,ownedIngredientKeys?,now?}). The source name is "Ovona illustrative price catalogue", reference is "lib/tesco-prices.ts"; calculatedAt is calculation time, never a fabricated observation date.

Shopping POST accepts optional ownedIngredientKeys:string[] and currency:string (default GBP under an explicit UK-estimate assumption); unknown/unsupported currency produces unavailable with no FX guess. The route response adds costEstimate beside existing items/planId/priceComparison. Ownership keys use ingredientLedgerKey(name,unit), must belong to the approved current ledger and default to an empty array. GET returns the same estimate with no owned-item assumptions.
</interfaces>
</context>

<tasks>
<task type="auto" tdd="true">
  <name>Task 1: Extend existing pack pricing with strict matching and an honest estimate projection</name>
  <files>frontend-new/lib/tesco-prices.ts, frontend-new/lib/shopping-cost.ts, frontend-new/tests/orchestration/shopping-cost.test.ts</files>
  <behavior>550g with a600g pack requires one pack;900g with500g packs requires two. Purchase cost differs from the fraction consumed. kg/g and L/ml work without mass-volume or count guesses. Pea protein never matches whey; fresh/unspecified tuna never matches tinned tuna. Unsupported currency and absent prices remain unavailable/partial. Default ownership is empty; explicit ownership sets purchase cost zero but does not invent missing consumed cost.</behavior>
  <action>Write tests first. Add an opt-in strict path to priceBasket that reuses PRICE_DB and its existing pack-ceiling arithmetic but bypasses canonicalizeIngredient, stripIngredientDescriptors, fuzzy scores and permissive unknown/count conversions. Strict normalization may fold case, whitespace and hyphens; retain meaningful parenthetical, raw/cooked/frozen/tinned, fat/cut and other form qualifiers. Match only compatible exact catalogue names or explicitly audited aliases. Exclude ambiguous existing aliases such as unqualified tuna for tinned tuna, mixed berries for frozen berries and generic protein powder for whey; do not promote legacy broad aliases into strict evidence. Accept only finite positive quantities, exact SI mass/volume conversion and explicit compatible counts (piece/each/unit or large where valid); never slices/jars/servings or unknown units. Validate usable finite positive pack sizes and finite nonnegative pack prices. An optional typed catalogue injection for deterministic pack tests is acceptable inside this same implementation; never accept catalogue entries from an API client. Preserve existing legacy callers by default. Do not add new price numbers to fill gaps. Implement estimateShoppingCost by consuming strict priceBasket lines; derive unrounded consumed cost from amountNeeded/amountToBuy*totalCost and round currency only for final presentation/totals. Preserve ledger quantities and units. Include explicit UK/GBP illustrative metadata, unknown price date, independent calculation timestamp and unverified suitability. Track matched, missing, owned and unsupported lines; no known lines means null totals, not a complete zero basket. Owned-but-unpriced lines may have zero purchase cost by explicit assumption while consumption remains unknown. Determine completeness separately enough to avoid presenting a subtotal as a full price.</action>
  <verify><automated>cd frontend-new; node --test tests/orchestration/shopping-cost.test.ts tests/orchestration/retailer-comparison.test.ts tests/orchestration/ingredient-ledger-consistency.test.ts</automated></verify>
  <done>Pack math is reused with conservative identity/unit admission; purchase/consumed costs and missing evidence are distinct, deterministic and fully tested without fabricated current-price claims.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Derive the estimate at the existing approved shopping API boundary</name>
  <files>frontend-new/app/api/shopping-list/route.ts, frontend-new/tests/orchestration/shopping-route-consistency.test.ts</files>
  <behavior>Only a current approved owner plan produces an estimate. Explicit ownership keys affect purchase cost without changing ledger/nutrition. Invalid ownership input rejects; another plan/revision cannot supply stale cost assumptions. Generic costing stays available independently of unavailable verified retailer comparison.</behavior>
  <action>Reuse approvedShoppingResponse after loadServerConstraints/approvePlanForUser and buildShoppingList. Parse optional currency and ownedIngredientKeys with bounds and types, reject unknown/non-current ledger keys instead of silently treating them as owned, and forward only validated options to estimateShoppingCost. Default empty ownership preserves buy-all assumptions. GET uses empty ownership; no persistence or new pantry schema. Add costEstimate to the existing response beside planId; do not replace priceComparison or mark it qualified. Preserve hard restrictions: no retail product is selected or represented as safe by illustrative costing. Keep the exact approved item quantities/provenance unchanged. Extend the actual route harness to exercise approved data, zero-write rejection, unknown price/units, explicit pantry assumptions and fresh revision identity; no live database writes.</action>
  <verify><automated>cd frontend-new; node --test tests/orchestration/shopping-route-consistency.test.ts tests/orchestration/shopping-cost.test.ts tests/orchestration/shopping-approval.test.ts</automated></verify>
  <done>Both shopping projection paths include appropriately scoped estimates, input assumptions are explicit and validated, existing approval guards remain effective, and real route tests prove no writes or quantity mutation.</done>
</task>

<task type="auto">
  <name>Task 3: Show purchase and consumption costs, assumptions and gaps on the daily screen</name>
  <files>frontend-new/components/ShoppingCostEstimate.tsx, frontend-new/app/meals/page.tsx, frontend-new/tests/orchestration/shopping-cost-panel.test.ts</files>
  <action>Parent implements the UI against the exported contract. Display "Illustrative UK cost estimate" with separate "Buy required packs" and "Food used" known totals/subtotals. Keep incomplete status and missing item names prominent; do not imply a complete cost when pea protein or other requirements are unpriced. Show pack count/size per matched ingredient in an accessible collapsible detail view. Label observation date unknown, source assumptions, GBP region and calculation timestamp distinctly; never claim Tesco stock, a live retailer quote or verified dietary suitability. Start with no pantry ownership assumptions; provide explicit ingredient ownership selection without editing recipe requirements. Trigger a fresh projection with the ownership keys and show assumed-owned items clearly. Guard results by the exact current plan plus ownership/currency snapshot, discard stale requests, and hide failed/unapproved estimates; reset or validate ownership keys when the basket changes. Retain category grouping and Used in references. Tests cover unknown versus zero/partial presentation and ownership labels with existing lightweight component-test patterns. Verify the real current day in desktop/mobile browser, then run full regression, TypeScript and ESLint; document every failure/warning and the limited price coverage. No install, new external feed, schema, merge or deployment.</action>
  <verify><automated>cd frontend-new; npm run test:orchestration; npx tsc --noEmit --incremental false; npm run lint</automated></verify>
  <done>A user can see an honest approximate purchase requirement and consumed-food cost for the current approved day, understand missing prices and explicit owned-item assumptions, and cannot see stale costs as current after changes.</done>
</task>
</tasks>

<threat_model>
| ID | Boundary/threat | Disposition | Mitigation |
|---|---|---|---|
| T-29-01 | Client plan or ownership keys tamper with basket/identity | mitigate | Existing owner/recipe/restriction approval, keys validated against the resulting ledger, no writes |
| T-29-02 | Legacy fuzzy matching implies a different ingredient or allergen-safe product | mitigate | Opt-in strict form/unit matching; no product IDs/recommendation; suitability explicitly unverified |
| T-29-03 | Assumed historical prices represented as verified current data | mitigate | Illustrative source metadata, observedAt null/date_unknown, separate calculation timestamp and unchanged retailer comparator |
| T-29-04 | Late request displays costs for another plan or pantry selection | mitigate | Exact plan and ownership/currency snapshot guard with cancellation |
</threat_model>

<verification>
AC matrix: approximate supported-currency cost Tasks1/3; purchase versus consumption and explicit pantry Tasks1/2/3; compatible pack math Task1; source/date/status Tasks1/3; missing gaps Tasks1/3; revision invalidation Tasks2/3; restrictions/unverified product suitability all tasks; no new retailer integration all tasks. Every criterion remains in scope. Missing catalogue prices are explicitly incomplete evidence, not a reason to fabricate values or broaden matching. Baseline230test/tsc/lint results must be preserved. Existing source/medical/recipe records remain unchanged.
</verification>

<success_criteria>
All SCRUM-29 criteria have concrete tests and browser evidence. Cost calculations reuse the existing catalogue and pack arithmetic while strict matching prevents unsafe conversions/substitutions. Known subtotals, full totals, consumed amounts, purchase packs and explicit ownership remain distinct. No stale/unapproved estimate or verified-price/safety claim is introduced. Record gaps and price assumptions before Review.
</success_criteria>

<output>
Create .planning/quick/261104-nvf-scrum-29-transparent-daily-purchase-pack/261104-nvf-SUMMARY.md with commits, checks, AC evidence and limitations. Parent owns STATE, docs metadata and Jira. Commit only assigned application/test changes; no unrelated snapshot files.
</output>
