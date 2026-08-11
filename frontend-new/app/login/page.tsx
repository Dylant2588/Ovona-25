"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
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
import { getSiteUrl } from "@/lib/site-url";

export default function LoginPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

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
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${getSiteUrl()}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to start Google sign-in.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailAuth = async (mode: "signIn" | "signUp") => {
    const normalizedEmail = email.trim();
    setAuthError(null);
    setAuthMessage(null);

    if (!normalizedEmail || !password) {
      setAuthError("Enter your email address and password.");
      return;
    }

    setAuthLoading(true);
    try {
      if (mode === "signIn") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;

        if (data.session) {
          router.replace("/meals");
        }
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${getSiteUrl()}/auth/callback`,
        },
      });
      if (error) throw error;

      if (data.session) {
        router.replace("/meals");
      } else {
        setAuthMessage("Check your email to confirm your account, then return here to sign in.");
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to continue. Please try again.");
    } finally {
      setAuthLoading(false);
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
          Sign in to view your meal plan, or create an account to start building one.
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
          <Stack
            component="form"
            spacing={3}
            onSubmit={(event) => {
              event.preventDefault();
              void handleEmailAuth("signIn");
            }}
          >
            <Stack spacing={1}>
              <Typography variant="subtitle2" color="text.secondary">
                Email
              </Typography>
              <TextField
                placeholder="chef@ovona.com"
                type="email"
                fullWidth
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={authLoading || googleLoading}
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
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={authLoading || googleLoading}
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button
                type="submit"
                fullWidth
                size="large"
                variant="contained"
                disabled={authLoading || googleLoading}
              >
                {authLoading ? "Working..." : "Sign In"}
              </Button>
              <Button
                type="button"
                fullWidth
                size="large"
                color="secondary"
                onClick={() => void handleEmailAuth("signUp")}
                disabled={authLoading || googleLoading}
              >
                Create Account
              </Button>
            </Stack>
            {authError && <Alert severity="error">{authError}</Alert>}
            {authMessage && <Alert severity="success">{authMessage}</Alert>}
            <Button
              onClick={handleGoogleLogin}
              size="large"
              variant="contained"
              color="secondary"
              fullWidth
              disabled={googleLoading || authLoading}
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
