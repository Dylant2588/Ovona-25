import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { mealInstanceId, date, status, notes } = body as {
    mealInstanceId?: string;
    date?: string;
    status?: string;
    notes?: string | null;
  };

  if (!mealInstanceId || !date || !status) {
    return NextResponse.json(
      { error: "mealInstanceId, date, and status are required" },
      { status: 400 }
    );
  }

  const cookieSupabase = await supabaseServer();
  const {
    data: { user: cookieUser },
  } = await cookieSupabase.auth.getUser();
  if (cookieUser) {
    const { error } = await cookieSupabase
      .from("meal_logs")
      .upsert(
        {
          user_id: cookieUser.id,
          meal_instance_id: mealInstanceId,
          date,
          status,
          notes: notes ?? null,
        },
        { onConflict: "user_id,meal_instance_id,date" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7)
    : null;

  if (!accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );

  const {
    data: userData,
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  if (userError || !userData?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("meal_logs")
    .upsert(
      {
        user_id: userData.user.id,
        meal_instance_id: mealInstanceId,
        date,
        status,
        notes: notes ?? null,
      },
      { onConflict: "user_id,meal_instance_id,date" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
