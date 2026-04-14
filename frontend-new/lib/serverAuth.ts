import type { NextRequest } from "next/server";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";

type SessionData = Awaited<
  ReturnType<SupabaseClient["auth"]["getSession"]>
>["data"]["session"];

type AuthStatus = "authorized" | "unauthorized" | "transient";
type AuthMethod = "cookie" | "bearer" | "none";

export type AuthContext = {
  supabase: SupabaseClient;
  session: SessionData | null;
  user: User | null;
  accessToken: string | null;
  status: AuthStatus;
  method: AuthMethod;
  reason: string | null;
};

const bearerFromRequest = (request: NextRequest) => {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  return token || null;
};

const createAnonClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  return createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};

const createBearerClient = (accessToken: string) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  return createClient(url, anon, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};

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

  const unauthorizedHints = [
    "jwt",
    "token",
    "unauthorized",
    "forbidden",
    "invalid",
    "expired",
    "auth session missing",
    "refresh token",
  ];

  return unauthorizedHints.some((hint) => details.includes(hint));
};

export const resolveRequestAuth = async (
  request: NextRequest
): Promise<AuthContext> => {
  let supabase: SupabaseClient;
  let serverInitFailed = false;
  try {
    supabase = await supabaseServer();
  } catch (error) {
    console.error("[auth] supabaseServer init failed", error);
    serverInitFailed = true;
    supabase = createAnonClient();
  }

  let session: SessionData | null = null;
  let sessionReadFailed = false;
  try {
    const {
      data: { session: sessionData },
      error: sessionError,
    } = await supabase.auth.getSession();
    session = sessionData ?? null;
    if (sessionError) {
      console.error("[auth] getSession failed", sessionError.message);
      if (!isExplicitUnauthorizedError(sessionError)) {
        sessionReadFailed = true;
      }
    }
  } catch (error) {
    console.error("[auth] getSession threw", error);
    sessionReadFailed = true;
  }

  if (session?.user) {
    const sessionToken = session.access_token ?? null;
    return {
      supabase,
      session,
      user: session.user,
      accessToken: sessionToken,
      status: "authorized",
      method: "cookie",
      reason: null,
    };
  }

  const accessToken = bearerFromRequest(request);
  if (!accessToken) {
    if (serverInitFailed || sessionReadFailed) {
      return {
        supabase,
        session: null,
        user: null,
        accessToken: null,
        status: "transient",
        method: "none",
        reason: "session_unavailable",
      };
    }
    return {
      supabase,
      session: null,
      user: null,
      accessToken: null,
      status: "unauthorized",
      method: "none",
      reason: "missing_credentials",
    };
  }

  let bearerClient: SupabaseClient;
  try {
    bearerClient = createBearerClient(accessToken);
  } catch (error) {
    console.error("[auth] could not create bearer client", error);
    return {
      supabase,
      session: null,
      user: null,
      accessToken: null,
      status: "transient",
      method: "none",
      reason: "bearer_client_unavailable",
    };
  }

  try {
    const {
      data: { user },
      error: userError,
    } = await bearerClient.auth.getUser();

    if (userError) {
      if (isExplicitUnauthorizedError(userError)) {
        return {
          supabase: bearerClient,
          session: null,
          user: null,
          accessToken,
          status: "unauthorized",
          method: "bearer",
          reason: "invalid_bearer",
        };
      }
      console.error("[auth] getUser(accessToken) failed", userError.message);
      return {
        supabase: bearerClient,
        session: null,
        user: null,
        accessToken,
        status: "transient",
        method: "bearer",
        reason: "bearer_lookup_failed",
      };
    }

    if (!user) {
      return {
        supabase: bearerClient,
        session: null,
        user: null,
        accessToken,
        status: "unauthorized",
        method: "bearer",
        reason: "missing_user",
      };
    }

    return {
      supabase: bearerClient,
      session: null,
      user,
      accessToken,
      status: "authorized",
      method: "bearer",
      reason: null,
    };
  } catch (error) {
    console.error("[auth] getUser(accessToken) threw", error);
    return {
      supabase: bearerClient,
      session: null,
      user: null,
      accessToken,
      status: "transient",
      method: "bearer",
      reason: "bearer_lookup_threw",
    };
  }
};
