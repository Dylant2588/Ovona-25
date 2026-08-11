## Purpose

Keep every meal-generation request aligned with the user's current preferences instead of silently using stale or default values.

## ADDED Requirements

### Requirement: Current preferences drive generation
The system SHALL use the preferences supplied with a generation request after reconciling them with the authenticated user's persisted preferences.

#### Scenario: Updated preference is used immediately
- **WHEN** a user saves a changed goal, macro target, cuisine, dislike, or allergy and requests a plan
- **THEN** the generated plan reflects the saved change without requiring a later refresh or a separate hidden default path

### Requirement: Preference-source failures are explicit
The system SHALL report when required preference data cannot be loaded or reconciled. It MUST NOT silently generate a plan using starter defaults when the user has stored preferences.

#### Scenario: Preference query fails
- **WHEN** the system cannot retrieve required saved preferences for an authenticated user
- **THEN** it returns a recoverable preference-loading error and does not claim that a default-generated plan is personalized

### Requirement: Generation diagnostics identify plan provenance
The system SHALL record whether a returned plan used an AI concept, a deterministic fallback, or a replacement, together with validation outcomes relevant to nutrition and allergies.

#### Scenario: Fallback is used
- **WHEN** the system uses a deterministic fallback for any part of a plan
- **THEN** the response identifies the fallback provenance and retains the same nutrition and allergy validation requirements

