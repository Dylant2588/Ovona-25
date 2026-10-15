import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const migration = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../supabase/migrations/20261013_structured_planning_input.sql"),
  "utf8"
);

test("structured planning migration is safe before trusted-evidence migration", () => {
  for (const column of ["recipe_id", "recipe_version", "similarity_key", "planning_state", "rejection_reason"]) {
    assert.match(migration, new RegExp(`add column if not exists ${column}`));
  }
  assert.match(migration, /planning_state is null or planning_state in \('accepted', 'eaten', 'rejected'\)/);
  assert.match(migration, /recipe_version is null or recipe_version > 0/);
});

test("trusted evidence migration preserves rejected feedback support", () => {
  const trusted = fs.readFileSync(
    path.resolve(import.meta.dirname, "../../supabase/migrations/20261013_trusted_planning_evidence.sql"),
    "utf8"
  );
  assert.match(trusted, /planning_state is null or planning_state in \('accepted', 'eaten', 'rejected'\)/);
});
