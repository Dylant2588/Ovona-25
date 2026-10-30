import assert from "node:assert/strict";
import test from "node:test";
import { baselineDatabaseTarget } from "../../scripts/baseline-database-target.ts";

const local = () => ({
  OVONA_BASELINE_TEST_URL: "http://127.0.0.1:54321",
  OVONA_BASELINE_TEST_ANON_KEY: "synthetic-anon",
  OVONA_BASELINE_TEST_SERVICE_ROLE_KEY: "synthetic-service",
  OVONA_BASELINE_TEST_DATABASE_URL: "postgresql://postgres:test@127.0.0.1:54322/postgres",
  OVONA_BASELINE_TEST_EXPECTED_HOST: "127.0.0.1",
  OVONA_BASELINE_TEST_EXPECTED_REF: "local",
  OVONA_BASELINE_TEST_EXPECTED_DATABASE: "postgres",
  OVONA_BASELINE_TEST_DISPOSABLE: "true",
  OVONA_BASELINE_TEST_CONFIRM: "isolated-fixtures-only",
  OVONA_BASELINE_TEST_PSQL: "C:/test-tools/psql.exe",
});

test("missing or implicit default environment is blocked before clients exist", () => {
  for (const env of [{}, { NEXT_PUBLIC_SUPABASE_URL: "https://live.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "secret" }]) {
    assert.throws(() => baselineDatabaseTarget(env), /BLOCKED: disposable database unavailable/);
  }
  for (const key of Object.keys(local())) {
    const env: Record<string, string> = local(); delete env[key];
    assert.throws(() => baselineDatabaseTarget(env), /BLOCKED/);
  }
});

test("an explicit isolated loopback API and SQL pair is accepted without reading files", () => {
  const target = baselineDatabaseTarget(local());
  assert.equal(target.expectedRef, "local");
  assert.equal(target.apiUrl, "http://127.0.0.1:54321");
  assert.equal(target.database.hostname, "127.0.0.1");
});

test("unsafe URLs, SQL target mismatches and missing confirmation are rejected", () => {
  for (const patch of [
    { OVONA_BASELINE_TEST_DISPOSABLE: "false" },
    { OVONA_BASELINE_TEST_CONFIRM: "yes" },
    { OVONA_BASELINE_TEST_EXPECTED_HOST: "localhost" },
    { OVONA_BASELINE_TEST_DATABASE_URL: "postgresql://postgres:test@evil.example/postgres" },
    { OVONA_BASELINE_TEST_EXPECTED_DATABASE: "production" },
    { OVONA_BASELINE_TEST_URL: "http://user:password@127.0.0.1:54321" },
    { OVONA_BASELINE_TEST_URL: "http://127.0.0.1:54321/another-project" },
    { OVONA_BASELINE_TEST_PSQL: "psql" },
  ]) assert.throws(() => baselineDatabaseTarget({ ...local(), ...patch }), /BLOCKED/);
});

test("remote targets require exact project approval and production denylist agreement", () => {
  const remote = { ...local(),
    OVONA_BASELINE_TEST_URL: "https://disposable-ref.supabase.co",
    OVONA_BASELINE_TEST_DATABASE_URL: "postgresql://postgres:test@db.disposable-ref.supabase.co/postgres",
    OVONA_BASELINE_TEST_EXPECTED_HOST: "disposable-ref.supabase.co",
    OVONA_BASELINE_TEST_EXPECTED_REF: "disposable-ref",
    OVONA_BASELINE_TEST_REMOTE_APPROVED_REF: "disposable-ref",
    OVONA_BASELINE_TEST_PRODUCTION_REFS: "live-ref",
  };
  assert.equal(baselineDatabaseTarget(remote).expectedRef, "disposable-ref");
  for (const patch of [
    { OVONA_BASELINE_TEST_REMOTE_APPROVED_REF: "" },
    { OVONA_BASELINE_TEST_PRODUCTION_REFS: "" },
    { OVONA_BASELINE_TEST_PRODUCTION_REFS: "live-ref,disposable-ref" },
    { OVONA_BASELINE_TEST_EXPECTED_REF: "other" },
    { OVONA_BASELINE_TEST_URL: "http://disposable-ref.supabase.co" },
    { OVONA_BASELINE_TEST_DATABASE_URL: "postgresql://postgres:test@db.live-ref.supabase.co/postgres" },
  ]) assert.throws(() => baselineDatabaseTarget({ ...remote, ...patch }), /BLOCKED/);
});
