"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Divider, FormControlLabel, Paper, Stack, Typography } from "@mui/material";
import { useAuth } from "@/lib/auth-context";
import { reviewQueueEntries, reviewQueueKey, type ReviewQueueEntry as Recipe } from "@/lib/recipes/review-queue";

type Attestations = { source: boolean; rights: boolean; ingredients: boolean; nutrition: boolean; cooked: boolean };
const emptyAttestations: Attestations = { source: false, rights: false, ingredients: false, nutrition: false, cooked: false };

export default function RecipeReviewPage() {
  const { session, loading: authLoading } = useAuth();
  const accessToken = session?.access_token;
  // A different session gets a fresh workspace immediately, before effects run.
  // Old queue entries, attestations and messages cannot cross this boundary.
  return <RecipeReviewWorkspace key={accessToken ?? "signed-out"} accessToken={accessToken} authLoading={authLoading} />;
}

function RecipeReviewWorkspace({ accessToken, authLoading }: { accessToken?: string; authLoading: boolean }) {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [attestations, setAttestations] = useState<Attestations>(emptyAttestations);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ severity: "error" | "success" | "info"; text: string } | null>(null);

  const reviewFetch = useCallback((input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers ?? {});
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(input, { ...init, headers, credentials: "same-origin" });
  }, [accessToken]);

  const fetchRecipes = useCallback(async (signal?: AbortSignal) => {
    const response = await reviewFetch("/api/recipe-review", { cache: "no-store", signal });
    const body = await response.json() as { recipes?: Recipe[]; error?: string; message?: string };
    if (!response.ok) {
      throw new Error(body.error === "reviewer_role_required" ? "Your account does not have a recipe-review role." : body.message ?? "Could not load recipe drafts.");
    }
    return reviewQueueEntries(body.recipes);
  }, [reviewFetch]);
  const applyRecipes = useCallback((next: Recipe[]) => {
    setRecipes(next);
    setSelectedId(current => current && next.some(recipe => reviewQueueKey(recipe) === current) ? current : next[0] ? reviewQueueKey(next[0]) : null);
  }, []);
  const load = useCallback(async () => {
    if (!active.current) return;
    setLoading(true);
    try {
      const next = await fetchRecipes();
      if (active.current) applyRecipes(next);
    }
    catch (error) {
      if (active.current) {
        setMessage({ severity: "error", text: error instanceof Error ? error.message : "Could not load recipe drafts." });
        setRecipes([]);
      }
    } finally { if (active.current) setLoading(false); }
  }, [applyRecipes, fetchRecipes]);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    const controller = new AbortController();
    void fetchRecipes(controller.signal).then(next => {
      if (!controller.signal.aborted) applyRecipes(next);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setMessage({ severity: "error", text: error instanceof Error ? error.message : "Could not load recipe drafts." });
        setRecipes([]);
      }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [accessToken, applyRecipes, authLoading, fetchRecipes]);
  const selected = useMemo(() => recipes.find((recipe) => reviewQueueKey(recipe) === selectedId) ?? null, [recipes, selectedId]);
  const selectedRecord = selected?.record ?? null;

  const review = async (action: "approve" | "reject") => {
    if (!selected || !selectedRecord || !active.current) return;
    setSaving(true); setMessage(null);
    try {
      const response = await reviewFetch("/api/recipe-review", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, version: selected.version, action, attestations }) });
      const body = await response.json() as { error?: string; message?: string };
      if (!active.current) return;
      if (!response.ok) setMessage({ severity: "error", text: body.message ?? "Could not save review." });
      else {
        setMessage({ severity: "success", text: `${selectedRecord.title} was ${action === "approve" ? "approved" : "rejected"}.` });
        setAttestations(emptyAttestations); await load();
      }
    } catch {
      if (active.current) setMessage({ severity: "error", text: "Could not save review. Please try again." });
    }
    finally { if (active.current) setSaving(false); }
  };

  return <Box sx={{ maxWidth: 1180, mx: "auto", px: { xs: 2, md: 4 }, py: 5 }}>
    <Typography variant="overline" color="primary.main">PRIVATE LIBRARY</Typography>
    <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>Review recipe drafts</Typography>
    <Typography color="text.secondary" sx={{ maxWidth: 760, mb: 3 }}>Only approve an Ovona recipe after checking its source and rights, exact ingredients and allergens, nutrition method, and a real cook-through. Approval creates an immutable reviewed version that the planner may use.</Typography>
    {!authLoading && !accessToken ? <Alert severity="error">Sign in to review recipes.</Alert> : message && <Alert severity={message.severity} sx={{ mb: 3 }}>{message.text}</Alert>}
    {authLoading || (accessToken && loading) ? <Stack alignItems="center" sx={{ py: 10 }}><CircularProgress /></Stack> : !accessToken ? null : <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} alignItems="stretch">
      <Paper variant="outlined" sx={{ width: { xs: "100%", md: 300 }, p: 1, alignSelf: "flex-start" }}>
        <Typography variant="subtitle2" sx={{ p: 1.25 }}>{recipes.length} pending drafts</Typography>
        <Stack spacing={0.5}>{recipes.map((recipe) => <Button key={reviewQueueKey(recipe)} onClick={() => { setSelectedId(reviewQueueKey(recipe)); setAttestations(emptyAttestations); }}
          variant={reviewQueueKey(recipe) === selectedId ? "contained" : "text"} color={reviewQueueKey(recipe) === selectedId ? "primary" : "inherit"} sx={{ textAlign: "left", justifyContent: "flex-start", p: 1.25 }}>
          <Box><Typography fontWeight={700}>{recipe.title}</Typography><Typography variant="caption">v{recipe.version} · {recipe.record ? `${recipe.record.slots.join(" · ")} · ${recipe.record.readyInMinutes} min` : "Malformed saved evidence · repair required"}</Typography></Box>
        </Button>)}</Stack>
      </Paper>
      {selected && selectedRecord ? <Paper variant="outlined" sx={{ flex: 1, p: { xs: 2, md: 3 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
          <Box><Typography variant="h4" fontWeight={800}>{selectedRecord.title}</Typography><Typography color="text.secondary">{selectedRecord.description}</Typography></Box>
          <Stack direction="row" spacing={1} alignItems="flex-start"><Chip label={`${selectedRecord.readyInMinutes} min`} /><Chip label={`${selectedRecord.macros.calories} kcal`} color="primary" variant="outlined" /></Stack>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>{selectedRecord.slots.map((slot) => <Chip key={slot} label={slot} size="small" />)}</Stack>
        <Divider sx={{ my: 2 }} />
        <Stack direction={{ xs: "column", md: "row" }} spacing={4}>
          <Box flex={1}><Typography variant="h6">Measured ingredients</Typography>{selectedRecord.ingredients.map((ingredient) => <Box key={`${ingredient.name}-${ingredient.amount}`} sx={{ py: 0.75 }}><Typography>{ingredient.amount}{ingredient.unit} {ingredient.name}</Typography><Typography variant="caption" color="text.secondary">Allergens: {ingredient.allergens.join(", ") || "none declared"}{ingredient.mayContain?.length ? ` · May contain: ${ingredient.mayContain.join(", ")}` : ""}</Typography></Box>)}</Box>
          <Box flex={1}><Typography variant="h6">Method</Typography>{selectedRecord.steps.map((step, index) => <Typography key={step} sx={{ py: 0.55 }}>{index + 1}. {step}</Typography>)}<Divider sx={{ my: 2 }} /><Typography variant="subtitle2">Evidence</Typography><Typography variant="body2">Source: {selectedRecord.source.kind} · {selectedRecord.source.reference}</Typography><Typography variant="body2">Rights: {selectedRecord.source.rights}</Typography><Typography variant="body2">Nutrition: {selectedRecord.nutrition.method} · {selectedRecord.nutrition.reference}</Typography></Box>
        </Stack>
        <Box sx={{ mt: 2 }}>
          <Chip size="small" label={selectedRecord.nutrition.method === "ingredient_calculated_v1" ? "Ingredient-calculated nutrition" : "Legacy nutrition · preparation required"} />
          <Typography variant="body2" sx={{ mt: 1 }}>Per serving ({selectedRecord.servings} servings per batch): {selectedRecord.macros.calories} kcal · {selectedRecord.macros.protein}g protein · {selectedRecord.macros.carbs}g carbohydrate · {selectedRecord.macros.fat}g fat</Typography>
          {selectedRecord.nutrition.method === "ingredient_calculated_v1" && selectedRecord.nutrition.calculation?.batchMacros ? <Typography variant="body2">Batch: {selectedRecord.nutrition.calculation.batchMacros.calories} kcal · {selectedRecord.nutrition.calculation.batchMacros.protein}g protein · {selectedRecord.nutrition.calculation.batchMacros.carbs}g carbohydrate · {selectedRecord.nutrition.calculation.batchMacros.fat}g fat</Typography> : null}
          {selectedRecord.nutrition.method === "ingredient_calculated_v1" ? selectedRecord.ingredients.map((ingredient, index) => ingredient.nutrition?.food?.source ? <Typography key={index} variant="caption" display="block">{ingredient.name}: {ingredient.nutrition.food.name} · {ingredient.nutrition.food.state} · {ingredient.nutrition.food.source.dataset} {ingredient.nutrition.food.source.version} · food {ingredient.nutrition.food.source.foodCode} · revision {ingredient.nutrition.food.revision}</Typography> : null) : null}
        </Box>
        <Divider sx={{ my: 3 }} />
        {selected.validationErrors?.length ? <Alert severity="warning" sx={{ mb: 2 }}>This draft needs repair before it can be approved: {selected.validationErrors.join("; ")}</Alert> : null}
        <Typography variant="h6">Reviewer attestations</Typography>
        <Stack>{([
          ["source", "I checked the source record."], ["rights", "I confirmed Ovona may use this recipe."], ["ingredients", "I verified measured ingredients and allergy information."], ["nutrition", "I checked the nutrition method and per-serving values."], ["cooked", "I cooked or otherwise tested the method and timing."],
        ] as Array<[keyof Attestations, string]>).map(([key, label]) => <FormControlLabel key={key} control={<Checkbox checked={attestations[key]} onChange={(event) => setAttestations((current) => ({ ...current, [key]: event.target.checked }))} />} label={label} />)}</Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }}><Button disabled={saving || Boolean(selected.validationErrors?.length) || !Object.values(attestations).every(Boolean)} onClick={() => void review("approve")} variant="contained">Approve reviewed version</Button><Button disabled={saving} onClick={() => void review("reject")} color="error">Reject draft</Button></Stack>
      </Paper> : <Paper variant="outlined" sx={{ flex: 1, p: 4 }}>{selected ? <><Typography variant="h6">{selected.title}</Typography><Alert severity="warning" sx={{ mt: 2 }}>This saved draft cannot be displayed or approved safely: {selected.validationErrors.join("; ")}</Alert></> : <Typography>No pending drafts.</Typography>}</Paper>}
    </Stack>}
  </Box>;
}
