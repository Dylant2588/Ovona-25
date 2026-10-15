"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Divider, FormControlLabel, Paper, Stack, Typography } from "@mui/material";
import { useAuth } from "@/lib/auth-context";

type Recipe = {
  id: string; version: number; review_status: "pending_review";
  validationErrors?: string[];
  record: { title: string; description: string; slots: string[]; readyInMinutes: number; servings: number;
    ingredients: Array<{ name: string; amount: number; unit: string; allergens: string[]; mayContain?: string[] }>;
    steps: string[]; macros: { calories: number; protein: number; carbs: number; fat: number };
    source: { kind: string; reference: string; rights: string }; nutrition: { method: string; reference: string } };
};

type Attestations = { source: boolean; rights: boolean; ingredients: boolean; nutrition: boolean; cooked: boolean };
const emptyAttestations: Attestations = { source: false, rights: false, ingredients: false, nutrition: false, cooked: false };

export default function RecipeReviewPage() {
  const { session, loading: authLoading } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [attestations, setAttestations] = useState<Attestations>(emptyAttestations);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ severity: "error" | "success" | "info"; text: string } | null>(null);

  const reviewFetch = useCallback((input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers ?? {});
    if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
    return fetch(input, { ...init, headers, credentials: "same-origin" });
  }, [session?.access_token]);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!session?.access_token) {
      setMessage({ severity: "error", text: "Sign in to review recipes." });
      setLoading(false);
      return;
    }
    setLoading(true);
    const response = await reviewFetch("/api/recipe-review", { cache: "no-store" });
    const body = await response.json() as { recipes?: Recipe[]; error?: string };
    if (!response.ok) {
      setMessage({ severity: "error", text: body.error === "reviewer_role_required" ? "Your account does not have a recipe-review role." : body.error ?? "Could not load recipe drafts." });
      setRecipes([]);
    } else {
      const next = body.recipes ?? [];
      setRecipes(next);
      setSelectedId((current) => current && next.some((recipe) => recipe.id === current) ? current : next[0]?.id ?? null);
    }
    setLoading(false);
  }, [authLoading, reviewFetch, session?.access_token]);

  useEffect(() => { void load(); }, [load]);
  const selected = useMemo(() => recipes.find((recipe) => recipe.id === selectedId) ?? null, [recipes, selectedId]);

  const review = async (action: "approve" | "reject") => {
    if (!selected) return;
    setSaving(true); setMessage(null);
    const response = await reviewFetch("/api/recipe-review", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id, version: selected.version, action, attestations }) });
    const body = await response.json() as { error?: string };
    if (!response.ok) setMessage({ severity: "error", text: body.error ?? "Could not save review." });
    else {
      setMessage({ severity: "success", text: `${selected.record.title} was ${action === "approve" ? "approved" : "rejected"}.` });
      setAttestations(emptyAttestations); await load();
    }
    setSaving(false);
  };

  return <Box sx={{ maxWidth: 1180, mx: "auto", px: { xs: 2, md: 4 }, py: 5 }}>
    <Typography variant="overline" color="primary.main">PRIVATE LIBRARY</Typography>
    <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>Review recipe drafts</Typography>
    <Typography color="text.secondary" sx={{ maxWidth: 760, mb: 3 }}>Only approve an Ovona recipe after checking its source and rights, exact ingredients and allergens, nutrition method, and a real cook-through. Approval creates an immutable reviewed version that the planner may use.</Typography>
    {message && <Alert severity={message.severity} sx={{ mb: 3 }}>{message.text}</Alert>}
    {loading ? <Stack alignItems="center" sx={{ py: 10 }}><CircularProgress /></Stack> : <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} alignItems="stretch">
      <Paper variant="outlined" sx={{ width: { xs: "100%", md: 300 }, p: 1, alignSelf: "flex-start" }}>
        <Typography variant="subtitle2" sx={{ p: 1.25 }}>{recipes.length} pending drafts</Typography>
        <Stack spacing={0.5}>{recipes.map((recipe) => <Button key={recipe.id} onClick={() => { setSelectedId(recipe.id); setAttestations(emptyAttestations); }}
          variant={recipe.id === selectedId ? "contained" : "text"} color={recipe.id === selectedId ? "primary" : "inherit"} sx={{ textAlign: "left", justifyContent: "flex-start", p: 1.25 }}>
          <Box><Typography fontWeight={700}>{recipe.record.title}</Typography><Typography variant="caption">{recipe.record.slots.join(" · ")} · {recipe.record.readyInMinutes} min</Typography></Box>
        </Button>)}</Stack>
      </Paper>
      {selected ? <Paper variant="outlined" sx={{ flex: 1, p: { xs: 2, md: 3 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
          <Box><Typography variant="h4" fontWeight={800}>{selected.record.title}</Typography><Typography color="text.secondary">{selected.record.description}</Typography></Box>
          <Stack direction="row" spacing={1} alignItems="flex-start"><Chip label={`${selected.record.readyInMinutes} min`} /><Chip label={`${selected.record.macros.calories} kcal`} color="primary" variant="outlined" /></Stack>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>{selected.record.slots.map((slot) => <Chip key={slot} label={slot} size="small" />)}</Stack>
        <Divider sx={{ my: 2 }} />
        <Stack direction={{ xs: "column", md: "row" }} spacing={4}>
          <Box flex={1}><Typography variant="h6">Measured ingredients</Typography>{selected.record.ingredients.map((ingredient) => <Box key={`${ingredient.name}-${ingredient.amount}`} sx={{ py: 0.75 }}><Typography>{ingredient.amount}{ingredient.unit} {ingredient.name}</Typography><Typography variant="caption" color="text.secondary">Allergens: {ingredient.allergens.join(", ") || "none declared"}{ingredient.mayContain?.length ? ` · May contain: ${ingredient.mayContain.join(", ")}` : ""}</Typography></Box>)}</Box>
          <Box flex={1}><Typography variant="h6">Method</Typography>{selected.record.steps.map((step, index) => <Typography key={step} sx={{ py: 0.55 }}>{index + 1}. {step}</Typography>)}<Divider sx={{ my: 2 }} /><Typography variant="subtitle2">Evidence</Typography><Typography variant="body2">Source: {selected.record.source.kind} · {selected.record.source.reference}</Typography><Typography variant="body2">Rights: {selected.record.source.rights}</Typography><Typography variant="body2">Nutrition: {selected.record.nutrition.method} · {selected.record.nutrition.reference}</Typography></Box>
        </Stack>
        <Divider sx={{ my: 3 }} />
        {selected.validationErrors?.length ? <Alert severity="warning" sx={{ mb: 2 }}>This draft needs repair before it can be approved: {selected.validationErrors.join("; ")}</Alert> : null}
        <Typography variant="h6">Reviewer attestations</Typography>
        <Stack>{([
          ["source", "I checked the source record."], ["rights", "I confirmed Ovona may use this recipe."], ["ingredients", "I verified measured ingredients and allergy information."], ["nutrition", "I checked the nutrition method and per-serving values."], ["cooked", "I cooked or otherwise tested the method and timing."],
        ] as Array<[keyof Attestations, string]>).map(([key, label]) => <FormControlLabel key={key} control={<Checkbox checked={attestations[key]} onChange={(event) => setAttestations((current) => ({ ...current, [key]: event.target.checked }))} />} label={label} />)}</Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }}><Button disabled={saving || Boolean(selected.validationErrors?.length) || !Object.values(attestations).every(Boolean)} onClick={() => void review("approve")} variant="contained">Approve reviewed version</Button><Button disabled={saving} onClick={() => void review("reject")} color="error">Reject draft</Button></Stack>
      </Paper> : <Paper variant="outlined" sx={{ flex: 1, p: 4 }}><Typography>No pending drafts.</Typography></Paper>}
    </Stack>}
  </Box>;
}
