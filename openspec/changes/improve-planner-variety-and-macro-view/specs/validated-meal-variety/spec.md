## Purpose

Provide a varied weekly meal rotation while retaining Ovona's nutrition and allergy safety guarantees.

## ADDED Requirements

### Requirement: Validated varied weekly meal rotation
The system SHALL generate a five-day meal plan with a varied rotation of meal concepts and primary protein sources while respecting all active dietary, allergy, dislike, cuisine, and preparation constraints.

#### Scenario: Repeated generation uses fresh safe concepts
- **WHEN** a user generates a plan after recently receiving a plan
- **THEN** the system SHALL prefer validated concepts not recently served when compatible alternatives exist

#### Scenario: AI concept fails validation
- **WHEN** an AI-proposed concept has unresolved ingredients or violates a hard user constraint
- **THEN** the system SHALL exclude it and use a validated alternative without returning the invalid concept

### Requirement: Catalogue fallback remains safe and varied
The system SHALL retain a validated catalogue fallback that can provide complete nutrition and hard-constraint compliance when AI concept generation is unavailable or insufficient.

#### Scenario: AI generation is unavailable
- **WHEN** AI concept generation fails or yields insufficient valid concepts
- **THEN** the system SHALL return a complete plan from compatible validated catalogue concepts or an explicit incomplete-plan response
