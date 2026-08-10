"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

const isExplicitUnauthorizedError = (error: unknown) => {
  const authError = error as {
    status?: number;
    code?: string;
    message?: string;
    name?: string;
  } | null;

  if (!authError) return false;
  if (authError.status === 401 || authError.status === 403) return true;

  const details = `${authError.message ?? ""} ${authError.code ?? ""} ${authError.name ?? ""}`
    .toLowerCase()
    .trim();

  if (!details) return false;

  return [
    "auth session missing",
    "unauthorized",
    "forbidden",
    "invalid",
    "expired",
    "token",
    "jwt",
  ].some((hint) => details.includes(hint));
};

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const MAX_LOOKUP_ATTEMPTS = 3;
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    async function handleAuthRedirect() {
      let user: User | null = null;
      let authLookupTransient = false;
      let authLookupUnauthorized = false;

      for (let attempt = 0; attempt < MAX_LOOKUP_ATTEMPTS; attempt += 1) {
        try {
          const {
            data: { user: nextUser },
            error,
          } = await supabase.auth.getUser();

          if (error) {
            if (isExplicitUnauthorizedError(error)) {
              authLookupUnauthorized = true;
              break;
            }
            authLookupTransient = true;
          } else if (nextUser) {
            user = nextUser;
            authLookupTransient = false;
            break;
          } else {
            authLookupUnauthorized = true;
            break;
          }
        } catch {
          authLookupTransient = true;
        }

        if (attempt < MAX_LOOKUP_ATTEMPTS - 1) {
          await wait(250 * 2 ** attempt);
        }
      }

      if (!active) {
        return;
      }

      if (!user) {
        if (authLookupUnauthorized && !authLookupTransient) {
          router.replace("/login");
          return;
        }

        console.warn("[auth/callback] auth state remained uncertain; routing to meals");
        router.replace("/meals");
        return;
      }

      const { data: preferenceRows, error: preferenceError } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .limit(1);

      if (!active) {
        return;
      }

      if (preferenceError) {
        console.warn("[auth/callback] could not read preferences; routing to meals", preferenceError);
        router.replace("/meals");
        return;
      }

      if (preferenceRows?.length) {
        router.replace("/meals");
        return;
      }

      router.replace("/onboarding");
    }

    void handleAuthRedirect();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <Box
      sx={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Stack spacing={2} alignItems="center">
        <CircularProgress color="secondary" />
        <Typography variant="h6">Signing you in...</Typography>
        <Typography color="text.secondary">
          Gathering your kitchen preferences and nutrition plan.
        </Typography>
      </Stack>
    </Box>
  );
}
