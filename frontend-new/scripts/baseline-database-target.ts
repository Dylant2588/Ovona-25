import path from "node:path";

export type BaselineDatabaseTarget = Readonly<{
  apiUrl: string; anonKey: string; serviceKey: string;
  expectedRef: string; database: URL; psqlPath: string;
}>;
const blocked = (): never => { throw new Error("BLOCKED: disposable database unavailable or target confirmation does not match. Supply explicit OVONA_BASELINE_TEST_* settings; never use the live project."); };

/** Pure validation: no file reads, network connections or default app credentials. */
export function baselineDatabaseTarget(env: Readonly<Record<string, string | undefined>>): BaselineDatabaseTarget {
  const get = (name: string) => env[`OVONA_BASELINE_TEST_${name}`]?.trim() || blocked();
  if (get("DISPOSABLE") !== "true" || get("CONFIRM") !== "isolated-fixtures-only") blocked();
  let api: URL, database: URL;
  try { api = new URL(get("URL")); database = new URL(get("DATABASE_URL")); }
  catch { return blocked(); }
  const expectedRef = get("EXPECTED_REF");
  const expectedHost = get("EXPECTED_HOST");
  if (api.hostname !== expectedHost || api.username || api.password || api.search || api.hash ||
      api.pathname !== "/" || !["postgres:", "postgresql:"].includes(database.protocol) ||
      !database.username || !database.password || database.hash || database.search ||
      decodeURIComponent(database.pathname.slice(1)) !== get("EXPECTED_DATABASE")) blocked();
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(api.hostname);
  if (loopback) {
    if (expectedRef !== "local" || !["http:", "https:"].includes(api.protocol) || database.hostname !== api.hostname) blocked();
  } else {
    if (!/^[a-z0-9-]+$/.test(expectedRef) || api.hostname !== `${expectedRef}.supabase.co` ||
        api.protocol !== "https:" || database.hostname !== `db.${expectedRef}.supabase.co` ||
        get("REMOTE_APPROVED_REF") !== expectedRef) blocked();
    const production = get("PRODUCTION_REFS").split(",").map((value) => value.trim().toLowerCase());
    if (production.includes(expectedRef.toLowerCase()) || production.includes(api.hostname.toLowerCase())) blocked();
  }
  const psqlPath = get("PSQL");
  if (!path.isAbsolute(psqlPath) && !path.win32.isAbsolute(psqlPath)) blocked();
  return Object.freeze({ apiUrl: api.origin, anonKey: get("ANON_KEY"), serviceKey: get("SERVICE_ROLE_KEY"), expectedRef, database, psqlPath });
}
