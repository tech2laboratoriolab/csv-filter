import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("patologistas")
    .select("nome")
    .order("nome");

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!Array.isArray(body))
    return NextResponse.json({ error: "Array esperado" }, { status: 400 });

  // Apaga tudo e reinsere (mesmo comportamento da versão anterior com writeFileSync)
  const { error: delError } = await supabase
    .from("patologistas")
    .delete()
    .neq("id", 0);
  if (delError)
    return NextResponse.json({ error: delError.message }, { status: 500 });

  if (body.length > 0) {
    const rows = body.map((p: { nome: string }) => ({ nome: p.nome }));
    const { error: insError } = await supabase
      .from("patologistas")
      .insert(rows);
    if (insError)
      return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
