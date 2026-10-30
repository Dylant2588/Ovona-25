import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { baselineDatabaseTarget } from "../../scripts/baseline-database-target.ts";
import { calculatedRecipe } from "../orchestration/calculated-recipe-fixtures.ts";
import { proposeReviewedVersion } from "../../lib/recipes/review-lifecycle.ts";

// Explicit opt-in only. This file never loads .env.local and cannot turn an
// unavailable database into a skip/PASS. It is separate from the unit-test glob.
test("isolated database proves migrations, permissions and atomic Phase 1 writes", { timeout: 180_000 }, async (t) => {
  const target = baselineDatabaseTarget(process.env); // Must precede clients, SQL and network.
  if (!fs.existsSync(target.psqlPath) || !fs.statSync(target.psqlPath).isFile()) {
    throw new Error("BLOCKED: disposable database unavailable: explicit existing psql executable is required.");
  }
  const db = target.database;
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(db.hostname);
  // libpq treats even empty service-file settings as explicit filenames.
  // Strip inherited PG variables rather than leaving empty override values;
  // PGHOSTADDR/service settings must not redirect the guarded SQL target.
  const sqlEnvironment: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith("PG"))),
    NODE_ENV: process.env.NODE_ENV ?? "test",
    PGHOST: db.hostname.replace(/^\[|\]$/g, ""), PGPORT: db.port || "5432",
    PGUSER: decodeURIComponent(db.username), PGPASSWORD: decodeURIComponent(db.password),
    PGDATABASE: decodeURIComponent(db.pathname.slice(1)), PGCONNECT_TIMEOUT: "10",
    PGSSLMODE: local ? "prefer" : "require", PGAPPNAME: "ovona-disposable-baseline-tests",
    PGOPTIONS: "-c client_min_messages=warning",
  };
  const sql = (source: string) => execFileSync(target.psqlPath,
    ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
    { env: sqlEnvironment, input: source, encoding: "utf8", timeout: 30_000, maxBuffer: 2_000_000, windowsHide: true }).trim();
  const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
  // Connection URL alone is not proof of identity: check the actual database,
  // and require a fresh public schema before any migration or fixture write.
  assert.equal(sql("select current_database();"), decodeURIComponent(db.pathname.slice(1)));
  assert.equal(sql("select count(*) from pg_catalog.pg_tables where schemaname='public';"), "0",
    "BLOCKED: target is not fresh; no migrations or cleanup will run against existing application tables.");
  assert.equal(sql("select to_regclass('auth.users') is not null;"), "t", "A Supabase-compatible Auth schema is required.");
  const migrationDir = path.resolve("supabase/migrations");
  const names = fs.readdirSync(migrationDir).filter((name) => name.endsWith(".sql")).sort();
  const sourceFor = (order: string[]) => order.map((name) => fs.readFileSync(path.join(migrationDir, name), "utf8")).join("\n");
  const swapped = [...names];
  const structured = swapped.indexOf("20261013_structured_planning_input.sql");
  const trusted = swapped.indexOf("20261013_trusted_planning_evidence.sql");
  assert.ok(structured >= 0 && trusted >= 0);
  [swapped[structured], swapped[trusted]] = [swapped[trusted], swapped[structured]];
  for (const [label, order] of [["chronological", names], ["trusted-before-structured", swapped]] as const) {
    let bootstrapPassed = false;
    await t.test(`fresh bootstrap validates ${label} order against real PostgreSQL`, () => {
      sql(`begin;\n${sourceFor([...order])}\nrollback;`);
      assert.equal(sql("select count(*) from pg_catalog.pg_tables where schemaname='public';"), "0");
      bootstrapPassed = true;
    });
    assert.equal(bootstrapPassed, true, "Failed bootstrap must prevent any committed migration or fixture writes.");
  }
  sql(sourceFor(names));
  sql(fs.readFileSync(path.resolve("tests/database/baseline-fixtures.sql"), "utf8"));
  // PostgREST reload is asynchronous. A bounded retry only polls schema visibility;
  // it never hides permission, transaction or assertion failures.
  sql("notify pgrst, 'reload schema';");
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const service = createClient(target.apiUrl, target.serviceKey, options);
  const anonymous = createClient(target.apiUrl, target.anonKey, options);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await service.from("recipe_review_events").select("id").limit(1);
    if (!response.error) break;
    if (response.error.code !== "PGRST205" || attempt === 19) throw response.error;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const makeUser = async (label: string) => {
    const email = `baseline-${label}-${randomUUID()}@example.invalid`;
    const password = `Baseline!${randomUUID()}`;
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
    assert.equal(created.error, null); assert.ok(created.data.user);
    const client = createClient(target.apiUrl, target.anonKey, options);
    const signed = await client.auth.signInWithPassword({ email, password });
    assert.equal(signed.error, null);
    return { id: created.data.user.id, client };
  };
  const [a, b, reviewer, firstSave] = await Promise.all([makeUser("a"), makeUser("b"), makeUser("reviewer"), makeUser("first")]);
  assert.equal((await service.from("recipe_reviewer_roles").insert({ user_id: reviewer.id, role: "reviewer" })).error, null);
  const attestations = { source: true, rights: true, ingredients: true, nutrition: true, cooked: true };
  const pending = (id: string) => {
    const record = calculatedRecipe(); record.id = id;
    record.review = { status: "pending_review", reviewedBy: null, reviewedAt: null };
    record.source.reviewed = false; record.nutrition.reviewed = false;
    record.ingredients.forEach((ingredient) => { ingredient.reviewed = false; });
    return record;
  };
  const seedDraft = async (id: string, imported = false) => {
    const record = pending(id);
    assert.equal((await service.from("recipe_library").insert({ id, version: 1, review_status: "pending_review", record })).error, null);
    if (imported) assert.equal((await service.from("recipe_imports").insert({ recipe_id: id, recipe_version: 1,
      source_reference: record.source.reference, rights_declaration: record.source.rights,
      payload_hash: "synthetic-original-hash", imported_by: a.id, review_status: "pending_review", record })).error, null);
    const proposed = proposeReviewedVersion(record, reviewer.id, new Date().toISOString());
    assert.equal(proposed.ok, true); if (!proposed.ok) throw new Error("Invalid synthetic review fixture");
    return { record, args: { p_recipe_id: id, p_expected_version: 1, p_expected_pending: record,
      p_proposed_record: proposed.record, p_action: "approve", p_actor: reviewer.id, p_attestations: attestations } };
  };
  const snapshot = async (id: string) => {
    const rows = await service.from("recipe_library").select("version,review_status,record").eq("id", id).order("version");
    assert.equal(rows.error, null); return rows.data;
  };

  await t.test("anonymous and ordinary users cannot review or access operational evidence", async () => {
    const draft = await seedDraft("baseline-auth");
    for (const client of [anonymous, a.client]) {
      assert.ok((await client.rpc("review_recipe_version", draft.args)).error);
      assert.ok((await client.from("recipe_review_events").select("id")).error);
    }
    assert.ok((await service.rpc("review_recipe_version", { ...draft.args, p_actor: a.id })).error);
    assert.equal((await snapshot("baseline-auth"))?.length, 1);
    assert.equal(sql("select has_function_privilege('authenticated','public.review_recipe_version(text,integer,jsonb,jsonb,text,uuid,jsonb)','EXECUTE');"), "f");
    assert.equal(sql("select has_function_privilege('anon','public.save_safety_preferences(jsonb)','EXECUTE');"), "f");
  });
  await t.test("concurrent reviews commit one immutable version and real imported provenance", async () => {
    const draft = await seedDraft("baseline-review-race", true);
    const results = await Promise.all([service.rpc("review_recipe_version", draft.args), service.rpc("review_recipe_version", draft.args)]);
    assert.equal(results.filter((result) => !result.error).length, 1);
    assert.equal(results.filter((result) => result.error?.code === "P0002").length, 1);
    const rows = await snapshot("baseline-review-race");
    assert.deepEqual(rows?.map((row) => [row.version, row.review_status]), [[1, "rejected"], [2, "approved"]]);
    const events = await service.from("recipe_review_events").select("*").eq("recipe_id", "baseline-review-race");
    assert.equal(events.error, null); assert.equal(events.data?.length, 1);
    assert.equal(events.data?.[0].original_importer_id, a.id);
    assert.equal(events.data?.[0].original_payload_hash, "synthetic-original-hash");
    assert.equal(events.data?.[0].provenance_kind, "imported");
    assert.ok((await service.from("recipe_library").update({ record: { ...draft.args.p_proposed_record, title: "forged" } }).eq("id", "baseline-review-race").eq("version", 2)).error);
    assert.ok((await service.from("recipe_review_events").delete().eq("recipe_id", "baseline-review-race")).error);
  });
  await t.test("legacy evidence is explicit and event failure rolls back approved version and draft closure", async () => {
    const legacy = await seedDraft("baseline-legacy");
    assert.equal((await service.rpc("review_recipe_version", legacy.args)).error, null);
    const event = await service.from("recipe_review_events").select("provenance_kind,original_importer_id,original_payload_hash").eq("recipe_id", "baseline-legacy").single();
    assert.equal(event.error, null);
    assert.deepEqual(event.data, { provenance_kind: "legacy_review_snapshot", original_importer_id: null, original_payload_hash: null });
    const failure = await seedDraft("baseline-event-failure");
    const before = await snapshot("baseline-event-failure");
    assert.ok((await service.rpc("review_recipe_version", failure.args)).error);
    assert.deepEqual(await snapshot("baseline-event-failure"), before);
    assert.equal((await service.from("recipe_review_events").select("id").eq("recipe_id", "baseline-event-failure")).data?.length, 0);
  });
  await t.test("owner-scoped preference saves preserve omissions and deny cross-owner access", async () => {
    assert.ok((await anonymous.rpc("save_safety_preferences", { p_patch: {} })).error);
    assert.equal((await b.client.rpc("save_safety_preferences", { p_patch: { never_foods: ["mushroom"], max_prep_minutes: 15, allergies: ["milk"] } })).error, null);
    assert.equal((await b.client.rpc("save_safety_preferences", { p_patch: { food_likes: ["rice"] } })).error, null);
    const saved = await service.from("user_preferences").select("never_foods,max_prep_minutes").eq("user_id", b.id).single();
    assert.equal(saved.error, null); assert.deepEqual(saved.data, { never_foods: ["mushroom"], max_prep_minutes: 15 });
    assert.equal((await a.client.from("user_preferences").select("user_id").eq("user_id", b.id)).data?.length, 0);
    assert.ok((await a.client.rpc("save_safety_preferences", { p_patch: { user_id: b.id } })).error);
  });
  await t.test("pending import is service-only, atomic, attributed and never overwrites existing versions", async () => {
    const records = [pending("baseline-import-good-a"), pending("baseline-import-good-b")];
    const args = { p_records: records, p_actor: reviewer.id };
    for (const client of [anonymous, a.client]) assert.ok((await client.rpc("import_pending_recipe_batch", args)).error);
    assert.equal((await service.rpc("import_pending_recipe_batch", { ...args, p_actor: a.id })).error?.code, "42501");
    const imported = await service.rpc("import_pending_recipe_batch", args);
    assert.equal(imported.error, null); assert.deepEqual(imported.data, { ok: true, imported: 2 });
    for (const record of records) {
      assert.deepEqual((await snapshot(record.id))?.map(row => row.record), [record]);
      const audit = await service.from("recipe_imports").select("*").eq("recipe_id", record.id).single();
      assert.equal(audit.error, null); assert.equal(audit.data?.imported_by, reviewer.id);
      assert.equal(audit.data?.source_reference, record.source.reference);
      assert.deepEqual(audit.data?.record, record);
      assert.equal(audit.data?.payload_hash, sql(`select encode(sha256(convert_to(record::text, 'UTF8')), 'hex') from public.recipe_library where id=${quote(record.id)} and version=1;`));
    }
    assert.equal((await service.rpc("import_pending_recipe_batch", args)).error?.code, "23505");
    assert.equal(sql("select count(*) from public.recipe_imports where recipe_id like 'baseline-import-good-%';"), "2");
    const earlier = pending("baseline-import-aaa-rollback");
    assert.equal((await service.rpc("import_pending_recipe_batch", { p_records: [earlier, records[0]], p_actor: reviewer.id })).error?.code, "23505");
    assert.equal((await snapshot(earlier.id))?.length, 0);
    assert.equal((await service.from("recipe_imports").select("id").eq("recipe_id", earlier.id)).data?.length, 0);
    const proposal = proposeReviewedVersion(records[0], reviewer.id, new Date().toISOString());
    assert.equal(proposal.ok, true); if (!proposal.ok) throw new Error("Invalid calculated import proposal");
    const approved = await service.rpc("review_recipe_version", { p_recipe_id: records[0].id, p_expected_version: 1,
      p_expected_pending: records[0], p_proposed_record: proposal.record, p_action: "approve", p_actor: reviewer.id, p_attestations: attestations });
    assert.equal(approved.error, null);
    const event = await service.from("recipe_review_events").select("provenance_kind,original_importer_id,original_payload_hash,draft_snapshot").eq("recipe_id", records[0].id).single();
    assert.equal(event.error, null); assert.equal(event.data?.provenance_kind, "imported");
    assert.equal(event.data?.original_importer_id, reviewer.id); assert.deepEqual(event.data?.draft_snapshot, records[0]);
    assert.match(event.data?.original_payload_hash ?? "", /^[a-f0-9]{64}$/);
  });
  await t.test("concurrent pending imports commit once and injected audit failure rolls back the whole batch", async () => {
    const record = pending("baseline-import-race"); const args = { p_records: [record], p_actor: reviewer.id };
    const races = await Promise.all([service.rpc("import_pending_recipe_batch", args), service.rpc("import_pending_recipe_batch", args)]);
    assert.equal(races.filter(result => !result.error).length, 1);
    assert.equal(races.filter(result => result.error?.code === "23505").length, 1);
    assert.equal((await snapshot(record.id))?.length, 1);
    sql(`create function public.baseline_test_reject_import_write() returns trigger language plpgsql set search_path=pg_catalog as $$ begin raise exception 'Synthetic import audit failure' using errcode='23514'; end; $$;
      create trigger baseline_test_import_audit_failure before insert on public.recipe_imports for each row when (new.recipe_id='baseline-import-rollback-z') execute function public.baseline_test_reject_import_write();`);
    const records = [pending("baseline-import-rollback-a"), pending("baseline-import-rollback-z")];
    assert.equal((await service.rpc("import_pending_recipe_batch", { p_records: records, p_actor: reviewer.id })).error?.code, "23514");
    for (const entry of records) {
      assert.equal((await snapshot(entry.id))?.length, 0);
      assert.equal((await service.from("recipe_imports").select("id").eq("recipe_id", entry.id)).data?.length, 0);
    }
  });
  await t.test("SQL new approval policy rejects legacy nutrition and malformed pending imports without writes", async () => {
    const draft = await seedDraft("baseline-legacy-method-denied");
    const legacy = { ...draft.record, nutrition: { method: "measured", reference: "synthetic legacy only", reviewed: false } };
    assert.equal((await service.from("recipe_library").update({ record: legacy }).eq("id", legacy.id).eq("version", 1)).error, null);
    const proposed = { ...draft.args.p_proposed_record, nutrition: { ...legacy.nutrition, reviewed: true } };
    const before = await snapshot(legacy.id);
    const denied = await service.rpc("review_recipe_version", { ...draft.args, p_expected_pending: legacy, p_proposed_record: proposed });
    assert.equal(denied.error?.code, "22023"); assert.deepEqual(await snapshot(legacy.id), before);
    const malformed = pending("baseline-import-invalid"); malformed.source.reviewed = true;
    for (const records of [[], Array(51).fill(malformed), [malformed], [pending("baseline-import-duplicate"), pending("baseline-import-duplicate")]]) {
      assert.equal((await service.rpc("import_pending_recipe_batch", { p_records: records, p_actor: reviewer.id })).error?.code, "22023");
    }
    assert.equal((await snapshot(malformed.id))?.length, 0);
  });
  await t.test("first-time concurrent saves retain the union and failed inserts roll back every old row", async () => {
    const first = await Promise.all([firstSave.client.rpc("save_safety_preferences", { p_patch: { allergies: ["milk"] } }), firstSave.client.rpc("save_safety_preferences", { p_patch: { allergies: ["soy"] } })]);
    assert.ok(first.every((result) => !result.error));
    const allergies = await service.from("user_allergies").select("allergy_name").eq("user_id", firstSave.id).order("allergy_name");
    assert.equal(allergies.error, null); assert.deepEqual(allergies.data?.map((row) => row.allergy_name), ["milk", "soy"]);
    // Seed each legacy store separately to prove all three are incorporated.
    assert.equal((await service.from("profiles").update({ allergies: ["eggs"] }).eq("id", firstSave.id)).error, null);
    assert.equal((await service.from("user_preferences").update({ allergies: "gluten" }).eq("user_id", firstSave.id)).error, null);
    assert.equal((await firstSave.client.rpc("save_safety_preferences", { p_patch: {} })).error, null);
    const union = await service.from("user_allergies").select("allergy_name").eq("user_id", firstSave.id).order("allergy_name");
    assert.deepEqual(union.data?.map((row) => row.allergy_name), ["eggs", "gluten", "milk", "soy"]);
    const before = sql(`select jsonb_build_object('profile',(select to_jsonb(p) from public.profiles p where id=${quote(firstSave.id)}::uuid),'prefs',(select to_jsonb(p) from public.user_preferences p where user_id=${quote(firstSave.id)}::uuid),'allergies',(select jsonb_agg(to_jsonb(a) order by allergy_name) from public.user_allergies a where user_id=${quote(firstSave.id)}::uuid));`);
    assert.ok((await firstSave.client.rpc("save_safety_preferences", { p_patch: { allergies: ["baseline-fail-allergy"], profile: { notes: "must rollback" } } })).error);
    const after = sql(`select jsonb_build_object('profile',(select to_jsonb(p) from public.profiles p where id=${quote(firstSave.id)}::uuid),'prefs',(select to_jsonb(p) from public.user_preferences p where user_id=${quote(firstSave.id)}::uuid),'allergies',(select jsonb_agg(to_jsonb(a) order by allergy_name) from public.user_allergies a where user_id=${quote(firstSave.id)}::uuid));`);
    assert.equal(after, before);
  });
  // The deliberately disposable target is preserved for diagnosis; this harness
  // never resets/drops an environment or performs automatic remote cleanup.
});
