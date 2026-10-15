import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const recipeReviewService = (): SupabaseClient => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Recipe review service is not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

export const recipeReviewerRole = async (userId: string): Promise<"reviewer" | "admin" | null> => {
  const service = recipeReviewService();
  const { data, error } = await service
    .from("recipe_reviewer_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || (data?.role !== "reviewer" && data?.role !== "admin")) return null;
  return data.role;
};
