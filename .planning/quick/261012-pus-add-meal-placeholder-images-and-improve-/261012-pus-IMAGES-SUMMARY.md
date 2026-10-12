# Illustrated meal presentation

Added nine consistent local SVG food illustrations: bowls, oats, eggs/toast, pasta, salad, wraps, soup, plated meals and snack boxes. The shared resolver matches title/slot/ingredient semantics for existing blank-image plans, accepts trusted artwork paths and HTTPS custom image URLs, and replaces legacy Unsplash photos with illustrations. Inline markup, scripts, protocol-relative and arbitrary local paths are rejected.

Compact meal rows have 88px decorative thumbnails alongside the title, with fixed dimensions and lazy loading. Expanded recipes reuse the artwork at 96px. A failed custom source recovers to semantic artwork once; failure of that artwork removes the image without an error loop.

## Verification

- RED commit: `0c241cf` (tests fail because resolver module does not exist).
- `node --test --test-isolation=none tests/orchestration/meal-images.test.ts`: 3/3 pass. Standard isolation failed under sandbox with spawn EPERM; same assertions run without child process isolation.
- Changed-file ESLint: zero errors; four existing meals-page hook/disable warnings.
- Desktop/mobile browser inspection is handled by parent executor.

No dependencies, runtime AI, database columns or migrations introduced. Stored plan JSON can persist the existing image string. No new network endpoint or auth path. Known stubs: none; category artwork is intentional illustration rather than a claim of exact dish photography.
