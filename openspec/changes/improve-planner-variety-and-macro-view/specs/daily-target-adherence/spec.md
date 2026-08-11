## Purpose

Ensure every accepted daily plan is a practical match for the user's calorie and protein targets.

## ADDED Requirements

### Requirement: Daily calorie and protein acceptance
The system SHALL assess each generated day against the active calorie and protein targets before presenting the plan as accepted.

#### Scenario: Day meets adherence tolerance
- **WHEN** a day's calorie and protein totals fall within the configured acceptance tolerance
- **THEN** the day SHALL be returned as accepted with its adherence result

#### Scenario: Day misses adherence tolerance
- **WHEN** a day's calorie or protein total falls outside the configured acceptance tolerance
- **THEN** the system SHALL attempt a deterministic correction before returning the plan

### Requirement: Explicit incomplete-plan result
The system SHALL not present an uncorrected materially off-target day as an accepted plan.

#### Scenario: Correction cannot meet targets
- **WHEN** no compatible correction can bring a day within the acceptance tolerance
- **THEN** the system SHALL return an explicit incomplete-plan result that identifies the affected day and target
