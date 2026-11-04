import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";
import type { DailyNutrientCoverage, PlanNutritionSummary } from "../../lib/recipes/plan-nutrition.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const code = ts.transpileModule(fs.readFileSync("components/DailyNutritionPanel.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const panelModule = { exports: {} as { DailyNutritionPanel: unknown } };
// Test presentation semantics with lightweight layout wrappers; real MUI layout is checked in the browser.
const mui = Object.fromEntries(["Alert", "Box", "Card", "CardContent", "Link", "Stack", "Typography"].map(name => [name,
  (props: { children?: unknown; role?: string; href?: string; "aria-label"?: string }) => React.createElement(name === "Link" ? "a" : "div", { role: props.role, href: props.href, "aria-label": props["aria-label"] }, props.children)]));
new Function("require", "module", "exports", code)((id: string) => id === "@mui/material" ? mui : require(id), panelModule, panelModule.exports);
const row: DailyNutrientCoverage = { unit: "mg", status: "unknown", knownSubtotal: null, amount: null, knownIngredients: 0, totalIngredients: 4, estimated: false,
  sources: [], reference: { amount: 800, unit: "mg", label: "Adult reference", url: "https://www.legislation.gov.uk/eur/2011/1169/annex/XIII" } };
const base: PlanNutritionSummary["days"][number] = { dayId: "day", macros: { calories: 2000, protein: 150, carbs: 200, fat: 60 }, macroEvidence: "legacy_reviewed", micronutrients: { calcium_mg: row, iron_mg: row, vitamin_c_mg: row } };
const render = (day = base) => renderToStaticMarkup(React.createElement(panelModule.exports.DailyNutritionPanel, { day, targets: { calories: 2000, protein: 150 }, loading: false, error: null }));

test("nutrition UI distinguishes unavailable nutrient evidence from a measured zero", () => {
  const unknown = render();
  assert.equal((unknown.match(/>Unknown</g) ?? []).length, 3);
  assert.doesNotMatch(unknown, /Mapped subtotal:/);
  assert.match(unknown, /not been independently recalculated/);
  const partial = render({ ...base, micronutrients: { ...base.micronutrients, calcium_mg: { ...row, status: "partial", knownSubtotal: 0, knownIngredients: 1, estimated: true } } });
  assert.match(partial, /Mapped subtotal: 0 mg/);
  assert.match(partial, /full-day total unknown/);
  const complete = render({ ...base, micronutrients: { ...base.micronutrients, calcium_mg: { ...row, status: "complete", knownSubtotal: 0, amount: 0, knownIngredients: 4, estimated: true } } });
  assert.match(complete, /Estimated 0 mg/);
  assert.match(complete, /not personalised nutrient goals/);
});
