"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardActions,
  CardContent,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        if (data.user) {
          router.replace("/meals");
        } else {
          setCheckingSession(false);
        }
      })
      .catch(() => setCheckingSession(false));

    return () => {
      active = false;
    };
  }, [router]);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "http://localhost:3000/auth/callback",
        },
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  if (checkingSession) {
    return null;
  }

  return (
    <Stack spacing={4} alignItems="center">
      <Stack spacing={1} textAlign="center">
        <Typography variant="overline" color="secondary">
          Access Ovona
        </Typography>
        <Typography variant="h3" component="h1" fontWeight={700}>
          Sign in to your kitchen HQ
        </Typography>
        <Typography color="text.secondary" maxWidth={640}>
          Placeholder experience for the upcoming authentication flow. Use the
          form below to get a feel for the tone and spacing we will iterate on
          later.
        </Typography>
      </Stack>

      <Card
        variant="outlined"
        sx={{
          width: "100%",
          maxWidth: 480,
          bgcolor: "rgba(12,16,32,0.85)",
          backdropFilter: "blur(18px)",
        }}
      >
        <CardContent>
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography variant="subtitle2" color="text.secondary">
                Email
              </Typography>
              <TextField
                placeholder="chef@ovona.com"
                type="email"
                fullWidth
                disabled
                helperText="Interactive logic coming soon"
              />
            </Stack>
            <Stack spacing={1}>
              <Typography variant="subtitle2" color="text.secondary">
                Password
              </Typography>
              <TextField
                placeholder="********"
                type="password"
                fullWidth
                disabled
                helperText="We will wire this up to Supabase next"
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button fullWidth size="large" variant="contained" disabled>
                Sign In
              </Button>
              <Button fullWidth size="large" color="secondary" disabled>
                Create Account
              </Button>
            </Stack>
            <Button
              onClick={handleGoogleLogin}
              size="large"
              variant="contained"
              color="secondary"
              fullWidth
              disabled={googleLoading}
            >
              {googleLoading ? "Redirecting..." : "Continue with Google"}
            </Button>
          </Stack>
        </CardContent>
        <Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />
        <CardActions
          sx={{
            px: 3,
            py: 2,
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1.5,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Need access?
          </Typography>
          <Button
            component={NextLink}
            href="/onboarding"
            variant="text"
            color="secondary"
          >
            Continue onboarding
          </Button>
        </CardActions>
      </Card>
    </Stack>
  );
}
