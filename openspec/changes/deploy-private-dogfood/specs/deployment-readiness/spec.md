## Purpose

Ensure Ovona's production deployment and Supabase environment can be recreated, secured, and verified before daily use.

## ADDED Requirements

### Requirement: Reproducible production schema
The system SHALL maintain a version-controlled database migration baseline sufficient to provision all schema objects required by the production application.

#### Scenario: Fresh Supabase provisioning
- **WHEN** a new production Supabase project is provisioned from the repository migration history
- **THEN** all tables, relationships, constraints, and required seed data used by the deployed application are present

### Requirement: Production secret separation
The production deployment SHALL supply database and AI credentials through server-side environment configuration, and SHALL NOT expose privileged or OpenAI credentials to browser code.

#### Scenario: Browser configuration inspection
- **WHEN** a user loads the production application
- **THEN** browser-delivered configuration contains no Supabase service-role key or OpenAI API key

### Requirement: Deployment verification
The system SHALL provide a documented smoke-test procedure that verifies authentication, preferences, meal generation, plan persistence, meal swapping, and shopping-list retrieval against the deployed environment.

#### Scenario: Successful production release verification
- **WHEN** a production deployment is released
- **THEN** the owner can execute the smoke-test procedure and record a pass or a specific failing step

### Requirement: Failure visibility
The production application SHALL return a user-visible, non-sensitive failure response when a required backend dependency is unavailable.

#### Scenario: AI generation dependency failure
- **WHEN** meal generation cannot use the AI provider
- **THEN** the application uses its supported deterministic fallback or explains that generation is temporarily unavailable without disclosing a secret or stack trace
