"use client";

import { useState } from "react";
import { Box } from "@mui/material";
import { fallbackImageForMeal, imageAfterFailure, imageForMeal, type MealImageInput } from "@/lib/meal-images";

export function MealThumbnail({ meal, size = 88 }: { meal: MealImageInput; size?: number }) {
  const source = imageForMeal(meal);
  // A new meal/source resets recovery without an effect or an unbounded retry.
  return <ThumbnailImage key={`${source}:${meal.title}`} source={source} fallback={fallbackImageForMeal(meal)} size={size} />;
}

function ThumbnailImage({ source, fallback, size }: { source: string; fallback: string; size: number }) {
  const [current, setCurrent] = useState<string | null>(source);
  return (
    <Box sx={{ width: size, height: size, flexShrink: 0, borderRadius: "14px", overflow: "hidden", bgcolor: "#eee9df" }}>
      {current && (
        /* Local SVG artwork and optional persisted URLs do not need Next image optimisation. */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current} alt="" width={size} height={size} loading="lazy" decoding="async" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} onError={() => setCurrent(imageAfterFailure(current, fallback))} />
      )}
    </Box>
  );
}
