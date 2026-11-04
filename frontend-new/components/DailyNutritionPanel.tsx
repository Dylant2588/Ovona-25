"use client";

import { Alert, Box, Card, CardContent, Link, Stack, Typography } from "@mui/material";
import type { MacroTargets } from "@/lib/meal-generator";
import type { PlanNutritionSummary } from "@/lib/recipes/plan-nutrition";

type Props = { day: PlanNutritionSummary["days"][number] | null; targets: MacroTargets | null; loading: boolean; error: string | null };
const format = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
const macros = [["calories", "Calories", "kcal"], ["protein", "Protein", "g"], ["carbs", "Carbohydrate", "g"], ["fat", "Fat", "g"]] as const;
const nutrients = [["calcium_mg", "Calcium"], ["iron_mg", "Iron"], ["vitamin_c_mg", "Vitamin C"]] as const;

export function DailyNutritionPanel({ day, targets, loading, error }: Props) {
  return <Card variant="outlined" component="section" aria-label="Daily nutrition coverage">
    <CardContent>
      <Stack spacing={1.5}>
        <Typography variant="h6">Nutrition for this day</Typography>
        {loading && <Typography role="status" color="text.secondary">Checking this plan&apos;s nutrition sources…</Typography>}
        {error && <Alert severity="warning">{error}</Alert>}
        {day && <>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 1.5 }}>
            {macros.map(([key, label, unit]) => {
              const target = targets?.[key];
              return <Box key={key}>
                <Typography variant="body2" color="text.secondary">{label}</Typography>
                <Typography fontWeight={700}>{format(day.macros[key])} {unit}</Typography>
                <Typography variant="caption">{typeof target === "number" && target > 0 ? `Goal: ${format(target)} ${unit} · ${Math.round(day.macros[key] / target * 100)}%` : "Goal not available"}</Typography>
              </Box>;
            })}
          </Box>
          <Typography variant="caption" color="text.secondary">
            Goals use saved profile values where provided, otherwise goal-based app defaults. The planner enforces calorie and protein ranges; carbohydrate and fat goals are shown for comparison.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {day.macroEvidence === "ingredient_calculated" ? "Macros calculated from versioned ingredient sources and approved portions." : day.macroEvidence === "legacy_reviewed" ? "Macros use reviewed recipe totals scaled to your portions. These legacy values have not been independently recalculated from ingredient sources." : day.macroEvidence === "mixed" ? "Macro totals combine ingredient-calculated and legacy-reviewed recipes." : "Some meal nutrition is unknown; these totals do not establish a complete day's intake."}
          </Typography>
          <Typography variant="subtitle2">Vitamins and minerals</Typography>
          {nutrients.map(([key, label]) => {
            const row = day.micronutrients[key];
            const known = row.status !== "unknown" && typeof row.knownSubtotal === "number";
            return <Box key={key}>
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                <Typography variant="body2">{label}</Typography>
                <Typography variant="body2" fontWeight={600}>{row.status === "complete" && typeof row.amount === "number" ? `${row.estimated ? "Estimated " : ""}${format(row.amount)} ${row.unit}` : known ? `Mapped subtotal: ${format(row.knownSubtotal!)} ${row.unit}` : "Unknown"}</Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {row.knownIngredients} of {row.totalIngredients} ingredient contributions mapped{row.status === "partial" ? "; full-day total unknown." : row.status === "unknown" ? "; missing values are not zero." : "."}{" "}
                General adult reference: {format(row.reference.amount)} {row.reference.unit}{row.status === "complete" && typeof row.amount === "number" ? ` (${Math.round(row.amount / row.reference.amount * 100)}% of reference)` : ""}.
              </Typography>
            </Box>;
          })}
          <Typography variant="caption" color="text.secondary">
            These adult food-labelling references are not personalised nutrient goals. Partial data cannot show whether you get enough, and one day does not establish long-term adequacy. Generic food estimates can differ by variety and preparation.
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <Link href="https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid" target="_blank" rel="noreferrer" variant="caption">Food data: CoFID 2021</Link>
            <Link href={day.micronutrients.calcium_mg.reference.url} target="_blank" rel="noreferrer" variant="caption">Adult reference source</Link>
          </Stack>
        </>}
      </Stack>
    </CardContent>
  </Card>;
}
