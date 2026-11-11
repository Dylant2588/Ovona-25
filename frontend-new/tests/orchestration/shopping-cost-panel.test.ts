import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const code = ts.transpileModule(fs.readFileSync("components/ShoppingCostEstimate.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const panelModule = { exports: {} as { ShoppingCostEstimatePanel: unknown } };
const mui = Object.fromEntries(["Alert", "Box", "Checkbox", "FormControlLabel", "Stack", "Typography"].map(name => [name,
  (props: { children?: unknown; label?: string; role?: string; "aria-label"?: string }) => React.createElement("div", { role: props.role, "aria-label": props["aria-label"] }, props.label, props.children)]));
new Function("require", "module", "exports", code)((id: string) => id === "@mui/material" ? mui : require(id), panelModule, panelModule.exports);
const fixture = {
  status: "partial", currency: "GBP", purchaseSubtotal: 4, consumedSubtotal: 2.2,
  missingItems: ["Pea protein powder"], ownedIngredientKeys: [],
  source: { name: "Ovona illustrative price catalogue", reference: "lib/tesco-prices.ts", region: "UK", retailer: null, observedAt: null, calculatedAt: "2026-11-11T12:00:00.000Z", priceStatus: "date_unknown" },
  dietaryStatus: "unverified", lines: [{ key: "chicken:g", name: "Chicken breast", requiredQuantity: 550, unit: "g", matched: true, assumedOwned: false, packsNeeded: 1, packSize: "600g", purchaseCost: 4, consumedCost: 2.2 }],
};
const render = (estimate: unknown) => renderToStaticMarkup(React.createElement(panelModule.exports.ShoppingCostEstimatePanel, { estimate, ownedIngredientKeys: [], onOwnershipChange: () => {} }));

test("cost panel labels partial purchase and consumption subtotals and undated assumptions", () => {
  const html = render(fixture);
  assert.match(html, /Illustrative UK cost estimate/);
  assert.match(html, /Buy required packs/);
  assert.match(html, /Food used/);
  assert.match(html, /Known subtotal/);
  assert.match(html, /Pea protein powder/);
  assert.match(html, /Price observation date unknown/);
  assert.match(html, /Product suitability is unverified/);
  assert.match(html, /1 × 600g/);
  assert.doesNotMatch(html, /Grand total|Live Tesco|guaranteed/i);
});

test("cost panel distinguishes unavailable evidence from explicitly owned zero purchase cost", () => {
  const unavailable = render({ ...fixture, status: "unavailable", purchaseSubtotal: null, consumedSubtotal: null });
  assert.match(unavailable, /Unavailable/);
  assert.doesNotMatch(unavailable, /£0\.00/);
  const owned = render({ ...fixture, purchaseSubtotal: 0, lines: [{ ...fixture.lines[0], assumedOwned: true, packsNeeded: 0, purchaseCost: 0 }] });
  assert.match(owned, /£0\.00/);
  assert.match(owned, /Already owned/);
  assert.match(owned, /Have enough for this plan/);
});
