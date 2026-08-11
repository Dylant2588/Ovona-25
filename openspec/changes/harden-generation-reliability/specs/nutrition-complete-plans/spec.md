## Purpose

Ensure each generated Ovona meal plan contains usable nutrition data and communicates whether its daily totals meet the user's targets.

## ADDED Requirements

### Requirement: Generated meals have complete nutrition totals
The system SHALL return a generated meal only when it has positive calorie, protein, carbohydrate, and fat values derived from resolved nutrition data. It MUST NOT present a meal with all-zero or unresolved macros as a successful generated result.

#### Scenario: Nutrition-complete meal
- **WHEN** the system resolves all ingredients for a generated meal
- **THEN** the returned meal includes positive calories, protein, carbs, and fat and contributes those values to its day total

#### Scenario: Unresolvable ingredient nutrition
- **WHEN** a generated meal contains an ingredient without usable nutrition data
- **THEN** the system replaces it with a nutritionally resolved safe option or reports generation as incomplete without presenting zero totals as a plan

### Requirement: Daily plan totals are validated before display
The system SHALL calculate daily totals from the returned meals and assess each day against the user's calorie and protein targets before the plan is displayed.

#### Scenario: Targets can be assessed
- **WHEN** a generated day has complete meal macros and user targets
- **THEN** the plan reports the day's calculated totals and whether they meet the supported target tolerance

#### Scenario: Plan cannot meet targets
- **WHEN** a generated day remains outside the supported target tolerance after correction
- **THEN** the plan identifies that day as needing adjustment and does not misrepresent it as target-compliant

