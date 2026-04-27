import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("notas")
    .select("id, texto, created_at")
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const texto = typeof body.texto === "string" ? body.texto.trim() : "";
  if (!texto)
    return NextResponse.json({ error: "texto obrigatório" }, { status: 400 });

  const { data, error } = await supabase
    .from("notas")
    .insert({ texto })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const id = typeof body.id === "number" ? body.id : null;
  const texto = typeof body.texto === "string" ? body.texto.trim() : "";
  if (!id || !texto)
    return NextResponse.json({ error: "id e texto obrigatórios" }, { status: 400 });

  const { data, error } = await supabase
    .from("notas")
    .update({ texto })
    .eq("id", id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const { error } = await supabase
    .from("notas")
    .delete()
    .eq("id", Number(id));

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
