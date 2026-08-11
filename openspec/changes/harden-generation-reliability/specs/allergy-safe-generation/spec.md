## Purpose

Prevent a user's recorded allergies from appearing in generated meals, substitutions, fallbacks, or alternatives.

## ADDED Requirements

### Requirement: Recorded allergies are generation constraints
The system SHALL collect allergies from every supported user preference source and apply them as hard exclusions when generating or selecting meals.

#### Scenario: Allergy stored in the user allergy table
- **WHEN** a user records Dairy as an allergy in the supported allergy table
- **THEN** Dairy is included in the generation constraints for that user

#### Scenario: Allergy stored with profile preferences
- **WHEN** a user records an allergy in their profile or preferences
- **THEN** the allergy is included in the generation constraints for that user

### Requirement: Allergy families are enforced
The system SHALL expand a recorded allergy into its common ingredient family when checking meal ingredients.

#### Scenario: Dairy exclusion
- **WHEN** Dairy is a recorded allergy
- **THEN** meals containing milk, cheese, cream, butter, whey, casein, yoghurt, or yogurt are rejected

### Requirement: Unsafe meals are never returned as fallbacks
The system SHALL reject an unsafe meal when no safe alternative can be validated. It MUST NOT retain the original unsafe meal merely because an alternative is unavailable.

#### Scenario: Unsafe generated meal without a replacement
- **WHEN** a meal conflicts with a recorded allergy and no validated alternative exists
- **THEN** the system marks the plan incomplete and requests or creates a safe replacement before returning the plan

#### Scenario: Meal swap
- **WHEN** a user swaps a meal
- **THEN** the replacement is checked against the user's allergy constraints before it is shown

