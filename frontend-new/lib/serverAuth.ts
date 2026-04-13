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

type AuthContext = {
  supabase: SupabaseClient;
  session: SessionData | null;
  user: User | null;
  accessToken: string | null;
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

export const resolveRequestAuth = async (
  request: NextRequest
): Promise<AuthContext> => {
  let supabase: SupabaseClient;
  try {
    supabase = await supabaseServer();
  } catch (error) {
    console.error("[auth] supabaseServer init failed", error);
    supabase = createAnonClient();
  }

  let session: SessionData | null = null;
  try {
    const {
      data: { session: sessionData },
      error: sessionError,
    } = await supabase.auth.getSession();
    session = sessionData ?? null;
    if (sessionError) {
      console.error("[auth] getSession failed", sessionError.message);
    }
  } catch (error) {
    console.error("[auth] getSession threw", error);
  }

  if (session?.user) {
    const sessionToken = session.access_token ?? null;
    return {
      supabase,
      session,
      user: session.user,
      accessToken: sessionToken,
    };
  }

  const accessToken = bearerFromRequest(request);
  if (!accessToken) {
    return {
      supabase,
      session: null,
      user: null,
      accessToken: null,
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
    };
  }

  const {
    data: { user },
    error: userError,
  } = await bearerClient.auth.getUser();

  if (userError) {
    console.error("[auth] getUser(accessToken) failed", userError.message);
  }

  return {
    supabase: bearerClient,
    session: null,
    user: user ?? null,
    accessToken,
  };
};
