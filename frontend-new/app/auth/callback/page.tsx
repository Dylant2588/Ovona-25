"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function handleAuthRedirect() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: preferences } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (preferences) {
        router.replace("/meals");
        return;
      }

      router.replace("/onboarding");
    }

    handleAuthRedirect();

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
        <Typography variant="h6">Signing you in…</Typography>
        <Typography color="text.secondary">
          Gathering your kitchen preferences and nutrition plan.
        </Typography>
      </Stack>
    </Box>
  );
}
