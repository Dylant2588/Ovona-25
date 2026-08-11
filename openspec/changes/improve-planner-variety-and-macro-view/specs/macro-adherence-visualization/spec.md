## Purpose

Present a clear, mobile-friendly view of daily calorie and macro adherence without mixing incompatible units.

## ADDED Requirements

### Requirement: Calories are visually distinct from gram-based macros
The planner SHALL display calories separately from protein, carbohydrate, and fat values so users can interpret daily adherence without comparing incompatible units on one axis.

#### Scenario: User views the weekly macro overview
- **WHEN** an accepted plan is displayed
- **THEN** calories and their target SHALL appear in a distinct visual series from gram-based macro values

### Requirement: Per-day target adherence is understandable
The planner SHALL expose each day's calorie and protein relationship to target in a scannable form.

#### Scenario: User identifies an off-target day
- **WHEN** a day is outside the accepted tolerance
- **THEN** the visual SHALL identify that day and the direction of the miss without requiring the user to calculate it manually
