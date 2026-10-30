import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAuth } from "@/lib/serverAuth";
import { parsePreferencePatch, savePreferencePatch, preferenceSaveFailure } from "@/lib/preferences-persistence";

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_preferences", message: "Invalid JSON body." }, { status: 400 }); }
  try {
    const patch = parsePreferencePatch(body);
    const { supabase, user, status, accessToken } = await resolveRequestAuth(request);
    if (status === "transient") return NextResponse.json({ error: "auth_unavailable", message: "Sign-in is temporarily unavailable." }, { status: 503 });
    if (!user || status !== "authorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    // Cookie contents alone are not verified identity. The authenticated RPC
    // independently derives its owner from auth.uid(), never from the payload.
    const verified = await supabase.auth.getUser(accessToken ?? undefined);
    if (verified.error || !verified.data.user || verified.data.user.id !== user.id) {
      const authStatus = verified.error?.status;
      return NextResponse.json({ error: authStatus && authStatus >= 500 ? "auth_unavailable" : "unauthorized" }, { status: authStatus && authStatus >= 500 ? 503 : 401 });
    }
    return NextResponse.json(await savePreferencePatch(supabase, patch));
  } catch (error) {
    const failure = preferenceSaveFailure(error);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
