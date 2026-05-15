export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getPromptsConfig } from "@/lib/promptsConfig";

export async function GET() {
  try {
    const data = await getPromptsConfig();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[api/prompts] Erro ao carregar prompts:", err);
    return NextResponse.json({ error: "Falha ao carregar prompts." }, { status: 500 });
  }
}
