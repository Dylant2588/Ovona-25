"use client";

import { Alert, Box, Checkbox, FormControlLabel, Stack, Typography } from "@mui/material";
import type { ShoppingCostEstimate } from "@/lib/shopping-cost";

const money = (amount: number | null) => amount === null ? "Unavailable" : `£${amount.toFixed(2)}`;

export function ShoppingCostEstimatePanel({ estimate, ownedIngredientKeys, onOwnershipChange }: {
  estimate: ShoppingCostEstimate;
  ownedIngredientKeys: readonly string[];
  onOwnershipChange: (key: string, owned: boolean) => void;
}) {
  const incomplete = estimate.status !== "estimated";
  return (
    <Stack spacing={1.5} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
      <Typography variant="h6">Illustrative UK cost estimate</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Box><Typography variant="body2">Buy required packs</Typography><Typography fontWeight={700}>{incomplete ? "Known subtotal: " : "Estimate: "}{money(estimate.purchaseSubtotal)}</Typography></Box>
        <Box><Typography variant="body2">Food used</Typography><Typography fontWeight={700}>{incomplete ? "Known subtotal: " : "Estimate: "}{money(estimate.consumedSubtotal)}</Typography></Box>
      </Stack>
      {incomplete && <Alert severity="warning">Incomplete estimate. {estimate.missingItems.length ? `Missing prices or compatible pack data: ${estimate.missingItems.join(", ")}.` : "No supported complete price estimate is available."} These subtotals do not cover the whole list.</Alert>}
      <Typography variant="caption" color="text.secondary">GBP · UK assumptions from {estimate.source.name}. Price observation date unknown; prices may be out of date. Calculated {estimate.source.calculatedAt}. This is not a live retailer quote.</Typography>
      <Typography variant="caption" color="text.secondary">Product suitability is unverified. Check product labels for your dietary restrictions. Pack rounding affects buying only; recipe quantities stay unchanged.</Typography>
      <Box component="details" sx={{ "& summary": { cursor: "pointer", minHeight: 36 } }}>
        <Typography component="summary" variant="body2">Pack assumptions and ingredients already owned</Typography>
        <Typography variant="caption" color="text.secondary">Nothing is assumed owned by default. Select only ingredients you already have enough of for this plan. This changes purchase cost only.</Typography>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {estimate.lines.map(line => (
            <Box key={line.key}>
              <Typography variant="body2">{line.name}: {line.assumedOwned ? "Already owned" : line.matched ? `${line.packsNeeded} × ${line.packSize}` : "Pack data unavailable"} · Buy: {money(line.purchaseCost)} · Food used: {money(line.consumedCost)}</Typography>
              <FormControlLabel control={<Checkbox checked={ownedIngredientKeys.includes(line.key)} onChange={(_, checked) => onOwnershipChange(line.key, checked)} size="small" />} label={`Have enough for this plan: ${line.name}`} />
            </Box>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}
