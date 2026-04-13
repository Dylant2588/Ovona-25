import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAuth } from "@/lib/serverAuth";

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

  const { supabase, session, user } = await resolveRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!session) {
    console.warn("[meal-log] using bearer fallback auth");
  }

  const { error } = await supabase
    .from("meal_logs")
    .upsert(
      {
        user_id: user.id,
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
