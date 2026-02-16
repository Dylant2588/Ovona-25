"use client";

import { KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  FormGroup,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { supabase } from "@/lib/supabaseClient";
import {
  readOnboardingMeta,
  writeOnboardingMeta,
  type OnboardingMeta,
} from "@/lib/onboarding-meta";

type GoalKey = "lose_weight" | "maintain" | "gain" | "recomp";
type ActivityKey = "sedentary" | "light" | "moderate" | "intense";
type DietaryModeOption = "mixed" | "pescatarian" | "vegetarian" | "vegan";
type CookingTimeOption = "under_10" | "10_15" | "15_30";
type MealsPerDayOption = 3 | 5;

type MacroTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type PreferencesRow = {
  goal: string | null;
  lifestyle: string | null;
  allergies: string | null;
  target_calories: number | null;
  target_protein: number | null;
  target_carbs: number | null;
  target_fat: number | null;
};

type ProfileRow = {
  body_weight_kg: number | null;
  height_cm: number | null;
  activity_level: string | null;
  allergies: string[] | null;
  dislikes: string[] | null;
  notes: string | null;
};

const STEP_COUNT = 3;

const GOAL_OPTIONS: Array<{ value: GoalKey; label: string; helper: string }> = [
  { value: "lose_weight", label: "Lose weight", helper: "Calorie deficit with high protein." },
  { value: "maintain", label: "Maintain weight", helper: "Balanced calories and steady energy." },
  { value: "gain", label: "Build muscle / Gain weight", helper: "Slight surplus to support training." },
  { value: "recomp", label: "Body recomposition", helper: "Lean out while preserving muscle." },
];

const ACTIVITY_OPTIONS: Array<{ value: ActivityKey; label: string; multiplier: number }> = [
  { value: "sedentary", label: "Sedentary", multiplier: 1.2 },
  { value: "light", label: "Lightly active", multiplier: 1.375 },
  { value: "moderate", label: "Active", multiplier: 1.55 },
  { value: "intense", label: "Very active", multiplier: 1.725 },
];

const DIETARY_MODE_OPTIONS: Array<{ value: DietaryModeOption; label: string }> = [
  { value: "mixed", label: "Mixed" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
];

const ALLERGY_OPTIONS = [
  "Dairy",
  "Gluten",
  "Nuts",
  "Fish",
  "Shellfish",
  "Eggs",
  "Soy",
  "Sesame",
] as const;

const COOKING_OPTIONS: Array<{ value: CookingTimeOption; label: string; helper: string }> = [
  {
    value: "under_10",
    label: "Under 10 minutes",
    helper: "Assembly only",
  },
  {
    value: "10_15",
    label: "10-15 minutes",
    helper: "Quick cooking",
  },
  {
    value: "15_30",
    label: "15-30 minutes",
    helper: "Happy to cook",
  },
];

const MEALS_PER_DAY_OPTIONS: Array<{ value: MealsPerDayOption; label: string; helper: string }> = [
  {
    value: 3,
    label: "3 meals",
    helper: "Breakfast, lunch, dinner",
  },
  {
    value: 5,
    label: "5 meals",
    helper: "Breakfast, snack, lunch, snack, dinner",
  },
];

const DEFAULT_SKIP_TARGETS: MacroTargets = {
  calories: 2200,
  protein: 160,
  carbs: 220,
  fat: 75,
};

const DEFAULT_SKIP_META: OnboardingMeta = {
  cookingTime: "10_15",
  mealsPerDay: 5,
};

const parseNumber = (value: string): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const uniqueStrings = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const parseDelimitedList = (value: string) =>
  uniqueStrings(
    value
      .split(/[,;\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  );

const normalizeGoal = (value: string | null | undefined): GoalKey | null => {
  if (value === "lose_weight" || value === "maintain" || value === "gain" || value === "recomp") {
    return value;
  }
  if (value === "lose") return "lose_weight";
  return null;
};

const normalizeDietaryMode = (value?: string | null): DietaryModeOption => {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("vegan")) return "vegan";
  if (normalized.includes("vegetarian")) return "vegetarian";
  if (normalized.includes("pescatarian") || normalized.includes("pescetarian")) {
    return "pescatarian";
  }
  return "mixed";
};

const normalizeActivity = (value?: string | null): ActivityKey | null => {
  if (value === "sedentary" || value === "light" || value === "moderate" || value === "intense") {
    return value;
  }
  return null;
};

const caloriesForGoal = (tdee: number, goal: GoalKey) => {
  if (goal === "lose_weight") return tdee * 0.82;
  if (goal === "gain") return tdee * 1.12;
  if (goal === "recomp") return tdee * 0.95;
  return tdee;
};

const proteinPerKgForGoal = (goal: GoalKey) => {
  if (goal === "lose_weight") return 2.2;
  if (goal === "recomp") return 2.1;
  if (goal === "gain") return 2.0;
  return 1.8;
};

const calculateMacroTargets = (
  weightKg: number,
  heightCm: number,
  goal: GoalKey,
  activity: ActivityKey
): MacroTargets => {
  const activityMultiplier =
    ACTIVITY_OPTIONS.find((option) => option.value === activity)?.multiplier ?? 1.375;

  // Mifflin-St Jeor with neutral assumptions (age 30, midpoint sex constant).
  const assumedAge = 30;
  const assumedSexConstant = -78;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * assumedAge + assumedSexConstant;
  const tdee = bmr * activityMultiplier;

  const calories = Math.max(1400, Math.round(caloriesForGoal(tdee, goal) / 10) * 10);
  const protein = Math.round(weightKg * proteinPerKgForGoal(goal));
  const fat = Math.max(45, Math.round((calories * 0.27) / 9));
  const carbs = Math.max(70, Math.round((calories - protein * 4 - fat * 9) / 4));

  return {
    calories,
    protein,
    carbs,
    fat,
  };
};

const cookingToComplexity = (cookingTime: CookingTimeOption) => {
  if (cookingTime === "15_30") return 2;
  return 1;
};

const cookingToTastePreferences = (cookingTime: CookingTimeOption) => {
  if (cookingTime === "under_10" || cookingTime === "10_15") {
    return ["quick-minimal"];
  }
  return ["meal-prep"];
};

const onboardingSkipKeyFor = (userId: string) => `ovona-onboarding-skipped-${userId}`;
const onboardingMetaKeyFor = (userId: string) => `ovona-onboarding-meta-${userId}`;

export default function OnboardingPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [profileNotes, setProfileNotes] = useState<string | null>(null);

  const [goal, setGoal] = useState<GoalKey | null>(null);
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityKey | null>(null);

  const [dietaryMode, setDietaryMode] = useState<DietaryModeOption>("mixed");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [dislikeInput, setDislikeInput] = useState("");

  const [cookingTime, setCookingTime] = useState<CookingTimeOption>("10_15");
  const [mealsPerDay, setMealsPerDay] = useState<MealsPerDayOption>(5);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);

      const [{ data: prefData }, { data: profileData }] = await Promise.all([
        supabase
          .from("user_preferences")
          .select(
            "goal, lifestyle, allergies, target_calories, target_protein, target_carbs, target_fat"
          )
          .eq("user_id", user.id)
          .maybeSingle<PreferencesRow>(),
        supabase
          .from("profiles")
          .select("body_weight_kg, height_cm, activity_level, allergies, dislikes, notes")
          .eq("id", user.id)
          .maybeSingle<ProfileRow>(),
      ]);

      if (!active) return;

      if (prefData) {
        setGoal(normalizeGoal(prefData.goal));
        setDietaryMode(normalizeDietaryMode(prefData.lifestyle));
        if (prefData.allergies) {
          setAllergies(parseDelimitedList(prefData.allergies));
        }
      }

      if (profileData) {
        if (typeof profileData.body_weight_kg === "number") {
          setWeightKg(String(profileData.body_weight_kg));
        }
        if (typeof profileData.height_cm === "number") {
          setHeightCm(String(profileData.height_cm));
        }
        setActivityLevel(normalizeActivity(profileData.activity_level));
        if (profileData.allergies?.length) {
          setAllergies(uniqueStrings(profileData.allergies));
        }
        if (profileData.dislikes?.length) {
          setDislikes(uniqueStrings(profileData.dislikes));
        }
        setProfileNotes(profileData.notes ?? null);
        const onboardingMeta = readOnboardingMeta(profileData.notes);
        if (onboardingMeta?.cookingTime) {
          setCookingTime(onboardingMeta.cookingTime);
        }
        if (onboardingMeta?.mealsPerDay) {
          setMealsPerDay(onboardingMeta.mealsPerDay);
        }
      }

      setCheckingSession(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, [router]);

  const calculatedTargets = useMemo<MacroTargets | null>(() => {
    const weight = parseNumber(weightKg);
    const height = parseNumber(heightCm);
    if (!goal || !activityLevel || !weight || !height) {
      return null;
    }
    return calculateMacroTargets(weight, height, goal, activityLevel);
  }, [activityLevel, goal, heightCm, weightKg]);

  const canAdvanceStepOne =
    goal !== null &&
    activityLevel !== null &&
    parseNumber(weightKg) !== null &&
    parseNumber(heightCm) !== null;

  const toggleAllergy = (allergy: string) => {
    setAllergies((prev) =>
      prev.includes(allergy)
        ? prev.filter((item) => item !== allergy)
        : uniqueStrings([...prev, allergy])
    );
  };

  const addDislike = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    setDislikes((prev) => uniqueStrings([...prev, normalized]));
    setDislikeInput("");
  };

  const removeDislike = (tag: string) => {
    setDislikes((prev) => prev.filter((item) => item !== tag));
  };

  const saveAllergiesToTable = async (targetUserId: string, allergyValues: string[]) => {
    const { error: deleteError } = await supabase
      .from("user_allergies")
      .delete()
      .eq("user_id", targetUserId);
    if (deleteError) {
      throw deleteError;
    }
    if (!allergyValues.length) {
      return;
    }
    const rows = allergyValues.map((allergy) => ({
      user_id: targetUserId,
      allergy: allergy.toLowerCase(),
    }));
    const { error: allergyError } = await supabase.from("user_allergies").insert(rows);
    if (!allergyError) return;

    const fallbackRows = allergyValues.map((allergy) => ({
      user_id: targetUserId,
      allergen: allergy.toLowerCase(),
    }));
    const { error: fallbackError } = await supabase
      .from("user_allergies")
      .insert(fallbackRows);
    if (!fallbackError) return;

    const nameRows = allergyValues.map((allergy) => ({
      user_id: targetUserId,
      name: allergy.toLowerCase(),
    }));
    const { error: nameError } = await supabase.from("user_allergies").insert(nameRows);
    if (nameError) {
      throw nameError;
    }
  };

  const persistOnboarding = async (useDefaults: boolean) => {
    setError(null);
    setSaving(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setSaving(false);
      router.replace("/login");
      return;
    }

    if (!useDefaults && !canAdvanceStepOne) {
      setSaving(false);
      setError("Please complete your goal, weight, height, and activity level first.");
      setStepIndex(0);
      return;
    }

    const chosenGoal = (useDefaults ? "maintain" : goal) as GoalKey;
    const chosenDietaryMode = useDefaults ? "mixed" : dietaryMode;
    const chosenAllergies = useDefaults ? [] : uniqueStrings(allergies);
    const chosenDislikes = useDefaults ? [] : uniqueStrings(dislikes);
    const chosenCookingTime = useDefaults ? DEFAULT_SKIP_META.cookingTime! : cookingTime;
    const chosenMealsPerDay = useDefaults ? DEFAULT_SKIP_META.mealsPerDay! : mealsPerDay;

    const chosenTargets = useDefaults ? DEFAULT_SKIP_TARGETS : calculatedTargets ?? DEFAULT_SKIP_TARGETS;

    const profileWeight = useDefaults ? null : parseNumber(weightKg);
    const profileHeight = useDefaults ? null : parseNumber(heightCm);
    const profileActivity = useDefaults ? "light" : activityLevel;

    const profileMeta: OnboardingMeta = {
      cookingTime: chosenCookingTime,
      mealsPerDay: chosenMealsPerDay,
    };

    const preferencePayload = {
      user_id: user.id,
      goal: chosenGoal,
      meal_complexity: cookingToComplexity(chosenCookingTime),
      taste_preferences: cookingToTastePreferences(chosenCookingTime),
      lifestyle: chosenDietaryMode === "mixed" ? null : chosenDietaryMode,
      allergies: chosenAllergies.length ? chosenAllergies.join(", ") : null,
      target_calories: chosenTargets.calories,
      target_protein: chosenTargets.protein,
      target_carbs: chosenTargets.carbs,
      target_fat: chosenTargets.fat,
    };

    const { error: prefError } = await supabase
      .from("user_preferences")
      .upsert(preferencePayload);

    if (prefError) {
      setSaving(false);
      setError("Could not save your preferences. Please try again.");
      return;
    }

    const profilePayload = {
      id: user.id,
      email: user.email ?? null,
      body_weight_kg: profileWeight,
      height_cm: profileHeight,
      activity_level: profileActivity,
      allergies: chosenAllergies.length ? chosenAllergies : null,
      dislikes: chosenDislikes.length ? chosenDislikes : null,
      notes: writeOnboardingMeta(profileNotes, profileMeta),
    };

    const profileFallbackPayload = {
      id: user.id,
      allergies: chosenAllergies.length ? chosenAllergies : null,
      dislikes: chosenDislikes.length ? chosenDislikes : null,
      notes: writeOnboardingMeta(profileNotes, profileMeta),
    };

    let profileError: Error | null = null;
    const profilePayloadVariants = [
      profilePayload,
      {
        ...profilePayload,
        email: undefined,
      },
      profileFallbackPayload,
    ];

    for (const payloadVariant of profilePayloadVariants) {
      const { error } = await supabase.from("profiles").upsert(payloadVariant, {
        onConflict: "id",
      });
      if (!error) {
        profileError = null;
        break;
      }
      profileError = error;
      console.error("profiles upsert failed during onboarding", {
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
    }

    if (profileError) {
      console.warn("Proceeding without profile persistence during onboarding.");
    }

    try {
      await saveAllergiesToTable(user.id, chosenAllergies);
    } catch (allergyError) {
      console.error("Failed to sync user_allergies", allergyError);
    }

    if (typeof window !== "undefined") {
      const skipKey = onboardingSkipKeyFor(user.id);
      const metaKey = onboardingMetaKeyFor(user.id);
      if (useDefaults) {
        window.localStorage.setItem(skipKey, "1");
      } else {
        window.localStorage.removeItem(skipKey);
      }
      window.localStorage.setItem(metaKey, JSON.stringify(profileMeta));
    }

    setSaving(false);
    router.replace(useDefaults ? "/meals?onboarding=skipped" : "/meals?onboarding=ready");
  };

  const handleNext = () => {
    setError(null);
    if (stepIndex === 0 && !canAdvanceStepOne) {
      setError("Please complete your goal, weight, height, and activity level.");
      return;
    }
    setStepIndex((prev) => Math.min(STEP_COUNT - 1, prev + 1));
  };

  const handleBack = () => {
    setError(null);
    setStepIndex((prev) => Math.max(0, prev - 1));
  };

  const progress = ((stepIndex + 1) / STEP_COUNT) * 100;

  if (checkingSession) {
    return (
      <Stack minHeight="60vh" alignItems="center" justifyContent="center" spacing={2}>
        <CircularProgress color="secondary" />
        <Typography color="text.secondary">Preparing onboarding...</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 860, mx: "auto", width: "100%" }}>
      <Stack spacing={1}>
        <Typography variant="overline" color="secondary">
          First-time setup
        </Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1.5}
        >
          <Typography variant="h4" fontWeight={700}>
            Step {stepIndex + 1} of {STEP_COUNT}
          </Typography>
          <Button
            variant="text"
            color="inherit"
            onClick={() => void persistOnboarding(true)}
            disabled={saving || !userId}
          >
            Skip for now
          </Button>
        </Stack>
        <LinearProgress
          value={progress}
          variant="determinate"
          color="secondary"
          sx={{ height: 8, borderRadius: 999 }}
        />
      </Stack>

      <Card
        variant="outlined"
        sx={{
          bgcolor: "rgba(11,15,30,0.9)",
          borderColor: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(16px)",
        }}
      >
        <CardContent>
          <Stack spacing={3}>
            {stepIndex === 0 && (
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="h5" fontWeight={700}>
                    What is your goal?
                  </Typography>
                  <Typography color="text.secondary">
                    We use this to set your daily calories and macros.
                  </Typography>
                </Box>

                <Stack spacing={1.25}>
                  {GOAL_OPTIONS.map((option) => {
                    const selected = goal === option.value;
                    return (
                      <Button
                        key={option.value}
                        variant={selected ? "contained" : "outlined"}
                        color={selected ? "secondary" : "inherit"}
                        onClick={() => setGoal(option.value)}
                        sx={{
                          justifyContent: "flex-start",
                          textAlign: "left",
                          py: 1.4,
                          borderColor: "rgba(255,255,255,0.18)",
                        }}
                      >
                        <Stack alignItems="flex-start" spacing={0.25}>
                          <Typography fontWeight={700}>{option.label}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.helper}
                          </Typography>
                        </Stack>
                      </Button>
                    );
                  })}
                </Stack>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Current weight (kg)"
                    value={weightKg}
                    onChange={(event) => setWeightKg(event.target.value)}
                    inputProps={{ min: 30, max: 300, step: 0.1 }}
                  />
                  <TextField
                    fullWidth
                    type="number"
                    label="Height (cm)"
                    value={heightCm}
                    onChange={(event) => setHeightCm(event.target.value)}
                    inputProps={{ min: 120, max: 230, step: 1 }}
                  />
                </Stack>

                <TextField
                  select
                  fullWidth
                  label="Activity level"
                  value={activityLevel ?? ""}
                  onChange={(event) => setActivityLevel(normalizeActivity(event.target.value))}
                >
                  <MenuItem value="">
                    Select activity level
                  </MenuItem>
                  {ACTIVITY_OPTIONS.map((option) => (
                    <MenuItem value={option.value} key={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>

                <Box
                  sx={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 2,
                    p: 1.5,
                    bgcolor: "rgba(255,255,255,0.02)",
                  }}
                >
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Estimated daily targets
                  </Typography>
                  {calculatedTargets ? (
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip label={`${calculatedTargets.calories} kcal`} size="small" />
                      <Chip label={`${calculatedTargets.protein}g protein`} size="small" />
                      <Chip label={`${calculatedTargets.carbs}g carbs`} size="small" />
                      <Chip label={`${calculatedTargets.fat}g fat`} size="small" />
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Enter your goal, weight, height, and activity level to calculate targets.
                    </Typography>
                  )}
                </Box>
              </Stack>
            )}

            {stepIndex === 1 && (
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="h5" fontWeight={700}>
                    Dietary preferences
                  </Typography>
                  <Typography color="text.secondary">
                    Allergies are treated as strict exclusions.
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {DIETARY_MODE_OPTIONS.map((option) => (
                    <Chip
                      key={option.value}
                      label={option.label}
                      color={dietaryMode === option.value ? "secondary" : "default"}
                      variant={dietaryMode === option.value ? "filled" : "outlined"}
                      onClick={() => setDietaryMode(option.value)}
                    />
                  ))}
                </Stack>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Allergies
                  </Typography>
                  <FormGroup>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: {
                          xs: "repeat(2, minmax(0, 1fr))",
                          sm: "repeat(4, minmax(0, 1fr))",
                        },
                        gap: 0.5,
                      }}
                    >
                      {ALLERGY_OPTIONS.map((allergy) => (
                        <FormControlLabel
                          key={allergy}
                          control={
                            <Checkbox
                              size="small"
                              checked={allergies.includes(allergy)}
                              onChange={() => toggleAllergy(allergy)}
                            />
                          }
                          label={allergy}
                        />
                      ))}
                    </Box>
                  </FormGroup>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Dislikes
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField
                      fullWidth
                      placeholder="Type an ingredient and press Enter"
                      value={dislikeInput}
                      onChange={(event) => setDislikeInput(event.target.value)}
                      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                        if (event.key === "Enter" || event.key === ",") {
                          event.preventDefault();
                          addDislike(dislikeInput);
                        }
                      }}
                    />
                    <Button variant="outlined" onClick={() => addDislike(dislikeInput)}>
                      Add
                    </Button>
                  </Stack>
                  {dislikes.length > 0 && (
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                      {dislikes.map((tag) => (
                        <Chip key={tag} label={tag} onDelete={() => removeDislike(tag)} />
                      ))}
                    </Stack>
                  )}
                </Box>
              </Stack>
            )}

            {stepIndex === 2 && (
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="h5" fontWeight={700}>
                    Cooking style
                  </Typography>
                  <Typography color="text.secondary">
                    Set your weekday effort level and meal cadence.
                  </Typography>
                </Box>

                <Stack spacing={1.25}>
                  <Typography variant="subtitle2" color="text.secondary">
                    How much time do you want to spend cooking on weekdays?
                  </Typography>
                  {COOKING_OPTIONS.map((option) => {
                    const selected = cookingTime === option.value;
                    return (
                      <Button
                        key={option.value}
                        variant={selected ? "contained" : "outlined"}
                        color={selected ? "secondary" : "inherit"}
                        onClick={() => setCookingTime(option.value)}
                        sx={{
                          justifyContent: "flex-start",
                          textAlign: "left",
                          py: 1.4,
                          borderColor: "rgba(255,255,255,0.18)",
                        }}
                      >
                        <Stack alignItems="flex-start" spacing={0.25}>
                          <Typography fontWeight={700}>{option.label}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.helper}
                          </Typography>
                        </Stack>
                      </Button>
                    );
                  })}
                </Stack>

                <Stack spacing={1.25}>
                  <Typography variant="subtitle2" color="text.secondary">
                    How many meals per day?
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {MEALS_PER_DAY_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        variant={mealsPerDay === option.value ? "contained" : "outlined"}
                        color={mealsPerDay === option.value ? "secondary" : "inherit"}
                        onClick={() => setMealsPerDay(option.value)}
                        sx={{ minWidth: 220 }}
                      >
                        <Stack alignItems="flex-start" spacing={0.25}>
                          <Typography fontWeight={700}>{option.label}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.helper}
                          </Typography>
                        </Stack>
                      </Button>
                    ))}
                  </Stack>
                </Stack>
              </Stack>
            )}

            {error && <Alert severity="error">{error}</Alert>}

            <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Button onClick={handleBack} disabled={saving || stepIndex === 0}>
                Back
              </Button>
              <Button
                variant="contained"
                color="secondary"
                onClick={
                  stepIndex === STEP_COUNT - 1
                    ? () => void persistOnboarding(false)
                    : handleNext
                }
                disabled={saving}
              >
                {saving ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={14} color="inherit" />
                    <span>Saving...</span>
                  </Stack>
                ) : stepIndex === STEP_COUNT - 1 ? (
                  "Finish"
                ) : (
                  "Next"
                )}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
