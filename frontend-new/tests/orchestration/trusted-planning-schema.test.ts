import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(import.meta.dirname, "../../supabase/migrations/20261013_trusted_planning_evidence.sql"),
  "utf8",
);

test("trusted planning migration preserves evidence, rotation identity, and service-only operational writes", () => {
  for (const fragment of [
    "create table if not exists public.recipe_imports",
    "source_reference text not null",
    "rights_declaration text not null",
    "payload_hash text not null",
    "imported_by uuid not null",
    "reviewed_by uuid",
    "create table if not exists public.retailer_price_observations",
    "retailer_id text not null",
    "retailer_name text not null",
    "source_reference text not null",
    "provenance_status text not null",
    "adapter_version text not null",
    "import_batch_id text not null",
    "observed_at timestamptz not null",
    "imported_at timestamptz not null",
    "add column if not exists recipe_id text",
    "add column if not exists recipe_version integer",
    "add column if not exists similarity_key text",
    "add column if not exists cuisine text",
    "add column if not exists format text",
    "add column if not exists planning_state text",
    "planning_state in ('accepted', 'eaten')",
    "idx_user_meal_history_rotation",
    "recipe_imports_review_status_idx",
    "retailer_price_observations_freshness_idx",
    "enable row level security",
    "revoke all on public.recipe_imports from anon, authenticated",
    "revoke all on public.retailer_price_observations from anon, authenticated",
    "user_meal_history_owner_access",
  ]) assert.match(migration, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
});

test("migration keeps the existing immutable approved recipe-version trigger", () => {
  assert.match(migration, /protect_approved_recipe_version/i);
  assert.match(migration, /Approved recipe versions are immutable/i);
});
