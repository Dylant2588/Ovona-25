import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { reportCatalogueCoverage, DEFAULT_COVERAGE_COHORTS, validateCoverageCohorts } from "../lib/recipes/catalogue-coverage.ts";

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
function readJson(file: string): unknown {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > MAX_INPUT_BYTES) throw new Error("Input must be a JSON file of at most 8 MiB.");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Explicit file-only interface: never loads env files or database clients. */
export function catalogueCoverageCli(args: readonly string[]) {
  const options: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index], value = args[index + 1];
    if (!["--input", "--cohorts", "--output"].includes(key) || !value || value.startsWith("--") || options[key]) throw new Error("Usage: node scripts/catalogue-coverage.ts --input records.json [--cohorts cohorts.json] [--output report.json]");
    options[key] = value;
  }
  if (!options["--input"]) throw new Error("An explicit --input recipe snapshot is required.");
  if (options["--output"] && [options["--input"], options["--cohorts"]].filter(Boolean).some(input => path.resolve(input) === path.resolve(options["--output"]))) throw new Error("Output must not overwrite an input file.");
  const records = readJson(options["--input"]);
  if (!Array.isArray(records)) throw new Error("Recipe snapshot must contain an array of recipe records.");
  const cohorts = options["--cohorts"] ? readJson(options["--cohorts"]) : DEFAULT_COVERAGE_COHORTS;
  validateCoverageCohorts(cohorts);
  const report = reportCatalogueCoverage(records, cohorts);
  const json = JSON.stringify(report, null, 2) + "\n";
  if (options["--output"]) fs.writeFileSync(options["--output"], json, { flag: "wx" });
  else process.stdout.write(json);
  return report;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { catalogueCoverageCli(process.argv.slice(2)); }
  catch (error) { console.error(error instanceof Error ? error.message : "Coverage report failed."); process.exitCode = 1; }
}
