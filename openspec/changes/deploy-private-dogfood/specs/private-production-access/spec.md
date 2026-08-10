## Purpose

Provide the owner with a secure, phone-accessible production Ovona experience for daily meal-planning dogfooding.

## ADDED Requirements

### Requirement: Production authenticated access
The system SHALL provide an HTTPS production URL at which an authenticated user can sign in and access the Ovona meal planner without relying on a localhost URL.

#### Scenario: Owner signs in from a phone
- **WHEN** the owner opens the production URL on a phone and completes Google sign-in
- **THEN** the owner is returned to the production Ovona application with an authenticated session

### Requirement: Deployment-aware authentication callback
The system SHALL use the active production site URL for OAuth return navigation and SHALL retain localhost navigation only for local development.

#### Scenario: Production OAuth callback
- **WHEN** a user initiates Google sign-in from the production deployment
- **THEN** the OAuth flow returns to the production authentication callback rather than `http://localhost:3000`

### Requirement: User data isolation
The system SHALL restrict user-owned preferences, meal plans, meal logs, shopping lists, and generated meal history to the authenticated user.

#### Scenario: Authenticated plan retrieval
- **WHEN** an authenticated user retrieves a saved plan from the production application
- **THEN** the response contains only records owned by that user

### Requirement: Daily dogfood workflow
The system SHALL allow an authenticated production user to save onboarding preferences, generate a meal plan, persist it, swap a meal, and retrieve a shopping list.

#### Scenario: Persisted plan survives a return visit
- **WHEN** a user generates and saves a plan, then later reopens the production application
- **THEN** the saved plan and its shopping-list state remain available to that user
