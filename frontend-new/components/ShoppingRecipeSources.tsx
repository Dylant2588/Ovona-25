"use client";

import { Box, Stack, Tooltip, Typography } from "@mui/material";
import RestaurantMenuRoundedIcon from "@mui/icons-material/RestaurantMenuRounded";
import { shoppingSourceKey, shoppingSourceLabel, type ShoppingMealSource } from "@/lib/shopping-provenance";

export type ShoppingSourceView = "reveal" | "inline";

function RecipeIcons({ sources, showNames = false }: { sources: readonly ShoppingMealSource[]; showNames?: boolean }) {
  return (
    <Stack component="ul" direction={showNames ? "column" : "row"} spacing={0.5} useFlexGap flexWrap="wrap" sx={{ m: 0, p: 0, listStyle: "none" }}>
      {sources.map(source => {
        const label = shoppingSourceLabel([source]);
        const icon = <><RestaurantMenuRoundedIcon fontSize="inherit" aria-hidden />{source.meals > 1 && <span aria-hidden>{source.meals}</span>}</>;
        return (
          <Box component="li" key={shoppingSourceKey(source)}>
            {showNames ? (
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Box sx={{ display: "inline-flex", gap: 0.4, color: "secondary.main" }}>{icon}</Box>
                <Typography variant="caption">{label}</Typography>
              </Stack>
            ) : (
              <Tooltip title={label} arrow enterTouchDelay={0}>
                <Box component="button" type="button" aria-label={label}
                  sx={{ display: "inline-flex", gap: 0.4, alignItems: "center", minHeight: 32, px: 0.75, border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: "transparent", color: "secondary.main", cursor: "help" }}>
                  {icon}
                </Box>
              </Tooltip>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}

export function ShoppingRecipeSources({ ingredient, sources, view }: { ingredient: string; sources: readonly ShoppingMealSource[]; view: ShoppingSourceView }) {
  if (!sources.length) return null;
  if (view === "inline") return <RecipeIcons sources={sources} />;

  const count = sources.reduce((total, source) => total + source.meals, 0);
  return (
    <Box component="details" sx={{ "& summary": { cursor: "pointer", width: "fit-content", minHeight: 32, color: "secondary.light" } }}>
      <Tooltip title={<RecipeIcons sources={sources} showNames />} arrow disableTouchListener>
        <Typography component="summary" variant="caption" aria-label={`Recipes using ${ingredient}, ${count} ${count === 1 ? "meal" : "meals"}`}>
          Used in {count} {count === 1 ? "meal" : "meals"}
        </Typography>
      </Tooltip>
      <Box sx={{ pl: 1.5, pb: 0.5 }}><RecipeIcons sources={sources} showNames /></Box>
    </Box>
  );
}
