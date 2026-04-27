import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  if (searchParams.get("list") === "true") {
    const { data, error } = await supabase
      .from("semanas")
      .select("week_key")
      .order("week_key", { ascending: false });

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json((data ?? []).map((r) => r.week_key));
  }

  const week = searchParams.get("week");
  if (!week)
    return NextResponse.json(
      { error: "Parâmetro week obrigatório" },
      { status: 400 },
    );

  const { data, error } = await supabase
    .from("semanas")
    .select("week_key, patologistas")
    .eq("week_key", week)
    .maybeSingle();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ weekKey: week, patologistas: [] });

  return NextResponse.json({
    weekKey: data.week_key,
    patologistas: data.patologistas,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.weekKey)
    return NextResponse.json({ error: "weekKey obrigatório" }, { status: 400 });

  const { error } = await supabase
    .from("semanas")
    .upsert(
      { week_key: body.weekKey, patologistas: body.patologistas ?? [] },
      { onConflict: "week_key" },
    );

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
