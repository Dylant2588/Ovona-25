import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveRequestAuth } from "@/lib/serverAuth";

type SavePreferencesPayload = {
  dietaryMode?: string | null;
  allergies?: string[];
  dislikes?: string[];
  cuisines?: string[];
  tastePreferences?: string[];
  goal?: string | null;
  mealComplexity?: string | number | null;
  macroTargets?: {
    calories?: number | null;
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
  } | null;
};

const uniqueStrings = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean)
    )
  );
};

const parseNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeMealComplexity = (
  value: SavePreferencesPayload["mealComplexity"]
): number | null => {
  if (typeof value === "number") {
    if ([1, 2, 3].includes(value)) return value;
    return null;
  }
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase().trim();
  if (normalized === "simple") return 1;
  if (normalized === "normal") return 2;
  if (normalized === "adventurous") return 3;
  return null;
};

const normalizeGoal = (value: SavePreferencesPayload["goal"]) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "lose" || normalized === "lose_weight") return "lose_weight";
  if (normalized === "gain" || normalized === "build_muscle") return "gain";
  if (normalized === "maintain") return "maintain";
  if (normalized === "recomp" || normalized === "body_recomposition") return "recomp";
  return null;
};

const complexityTextFromInt = (value: number | null) => {
  if (value === 1) return "simple";
  if (value === 2) return "normal";
  if (value === 3) return "adventurous";
  return null;
};

const createWriteClient = async (
  server: Awaited<ReturnType<typeof supabaseServer>>
) => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return { writeClient: server, usingServiceRole: false };
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { writeClient: admin, usingServiceRole: true };
};

const logDbError = (label: string, error: unknown) => {
  const dbError = error as { message?: string; details?: string; hint?: string };
  console.error(`[preferences] ${label}`, {
    message: dbError?.message,
    details: dbError?.details,
    hint: dbError?.hint,
  });
};

const syncUserAllergies = async (
  writeClient: Awaited<ReturnType<typeof createWriteClient>>["writeClient"],
  userId: string,
  allergies: string[]
) => {
  const normalizedAllergies = allergies.map((allergy) => allergy.toLowerCase());
  const { error: deleteError } = await writeClient
    .from("user_allergies")
    .delete()
    .eq("user_id", userId);
  if (deleteError) {
    logDbError("Failed deleting existing user_allergies rows", deleteError);
  }

  if (!normalizedAllergies.length) {
    return true;
  }

  const attempts = [
    normalizedAllergies.map((allergy) => ({ user_id: userId, allergy })),
    normalizedAllergies.map((allergy) => ({ user_id: userId, allergen: allergy })),
    normalizedAllergies.map((allergy) => ({ user_id: userId, name: allergy })),
  ];

  for (const rows of attempts) {
    const { error } = await writeClient.from("user_allergies").insert(rows);
    if (!error) return true;
    logDbError("user_allergies insert attempt failed", error);
  }

  return false;
};

const upsertProfilesWithFallback = async (
  writeClient: Awaited<ReturnType<typeof createWriteClient>>["writeClient"],
  userId: string,
  allergies: string[],
  dislikes: string[],
  cuisines: string[]
) => {
  const base = {
    id: userId,
    allergies: allergies.length ? allergies : null,
    dislikes: dislikes.length ? dislikes : null,
    cuisines: cuisines.length ? cuisines : null,
  };
  const payloads = [
    base,
    { id: userId, allergies: base.allergies, dislikes: base.dislikes },
    { id: userId, allergies: base.allergies, cuisines: base.cuisines },
    { id: userId, dislikes: base.dislikes, cuisines: base.cuisines },
    { id: userId, allergies: base.allergies },
    { id: userId, dislikes: base.dislikes },
    { id: userId, cuisines: base.cuisines },
    { id: userId },
  ];

  for (const payload of payloads) {
    const { error } = await writeClient.from("profiles").upsert(payload, {
      onConflict: "id",
    });
    if (!error) return true;
    logDbError("profiles upsert attempt failed", error);
  }
  return false;
};

export async function POST(request: NextRequest) {
  console.log("Preferences save hit", request.method);

  try {
    let body: SavePreferencesPayload;
    try {
      body = (await request.json()) as SavePreferencesPayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { supabase: authClient, session, user } = await resolveRequestAuth(request);
    if (!user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (!session) {
      console.warn("[preferences] using bearer fallback auth");
    }
    const { writeClient, usingServiceRole } = await createWriteClient(authClient);
    const userId = user.id;
    console.log("[preferences] authenticated save request", {
      userId,
      usingServiceRole,
    });

    const dietaryModeRaw = (body.dietaryMode ?? "").trim().toLowerCase();
    const dietaryMode = dietaryModeRaw && dietaryModeRaw !== "mixed" ? dietaryModeRaw : null;
    const allergies = uniqueStrings(body.allergies);
    const dislikes = uniqueStrings(body.dislikes);
    const cuisines = uniqueStrings(body.cuisines);
    const tastePreferences = uniqueStrings(body.tastePreferences);
    const mealComplexity = normalizeMealComplexity(body.mealComplexity);
    const normalizedGoal = normalizeGoal(body.goal);

    const userPreferencesPayload: Record<string, unknown> = {
      user_id: userId,
      lifestyle: dietaryMode,
      allergies: allergies.length ? allergies.join(", ") : null,
      cuisines: cuisines.length ? cuisines.join(", ") : null,
    };

    if (normalizedGoal) {
      userPreferencesPayload.goal = normalizedGoal;
    }
    if (tastePreferences.length) {
      userPreferencesPayload.taste_preferences = tastePreferences;
    }
    if (mealComplexity !== null) {
      userPreferencesPayload.meal_complexity = mealComplexity;
    }
    if (body.macroTargets) {
      userPreferencesPayload.target_calories = parseNumberOrNull(body.macroTargets.calories);
      userPreferencesPayload.target_protein = parseNumberOrNull(body.macroTargets.protein);
      userPreferencesPayload.target_carbs = parseNumberOrNull(body.macroTargets.carbs);
      userPreferencesPayload.target_fat = parseNumberOrNull(body.macroTargets.fat);
    }

    const preferencePayloadVariants: Array<Record<string, unknown>> = [userPreferencesPayload];

    if (userPreferencesPayload.goal === "lose_weight") {
      preferencePayloadVariants.push({ ...userPreferencesPayload, goal: "lose" });
    }

    if (userPreferencesPayload.lifestyle === "pescatarian") {
      preferencePayloadVariants.push({
        ...userPreferencesPayload,
        lifestyle: "pescetarian",
      });
    }

    const complexityText = complexityTextFromInt(mealComplexity);
    if (complexityText) {
      preferencePayloadVariants.push({
        ...userPreferencesPayload,
        meal_complexity: complexityText,
      });
    }

    if (
      userPreferencesPayload.goal === "lose_weight" &&
      userPreferencesPayload.lifestyle === "pescatarian"
    ) {
      const combined: Record<string, unknown> = {
        ...userPreferencesPayload,
        goal: "lose",
        lifestyle: "pescetarian",
      };
      if (complexityText) {
        combined.meal_complexity = complexityText;
      }
      preferencePayloadVariants.push(combined);
    }

    let preferenceSaved = false;
    for (const payload of preferencePayloadVariants) {
      const { error } = await writeClient
        .from("user_preferences")
        .upsert(payload, { onConflict: "user_id" });
      if (!error) {
        preferenceSaved = true;
        break;
      }
      logDbError("user_preferences upsert attempt failed", error);
    }

    if (!preferenceSaved) {
      return NextResponse.json(
        { error: "Failed to save user_preferences" },
        { status: 500 }
      );
    }

    const profileSaved = await upsertProfilesWithFallback(
      writeClient,
      userId,
      allergies,
      dislikes,
      cuisines
    );
    const allergiesSynced = await syncUserAllergies(writeClient, userId, allergies);

    if (!profileSaved) {
      console.warn("[preferences] profiles persistence failed after fallback attempts");
    }
    if (!allergiesSynced) {
      console.warn("[preferences] user_allergies sync failed after fallback attempts");
    }

    return NextResponse.json({
      ok: true,
      profileSaved,
      allergiesSynced,
    });
  } catch (error) {
    console.error("[preferences] unexpected handler error", error);
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  }
}
