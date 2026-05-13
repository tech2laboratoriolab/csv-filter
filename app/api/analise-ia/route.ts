import { NextRequest, NextResponse } from "next/server";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const PROMPT_PREFIX = `Atue como um revisor técnico da área de citopatologia e histopatologia. Leia atentamente o laudo médico e identifique se existem contradições internas.

Sua resposta deve ser gerada estritamente em formato JSON, seguindo as regras abaixo:
1. Crie uma chave chamada "contradicao" com o valor "SIM" ou "NÃO".
2. Se a resposta for "SIM", adicione uma chave chamada "evidencias" contendo um array (lista) de strings com 1 ou 2 tópicos resumindo os trechos exatos que se contradizem.
3. Se a resposta for "NÃO", omita completamente a chave "evidencias".
4. Não inclua nenhum texto adicional, explicações ou formatações fora do bloco JSON.

"""
`;

const PROMPT_SUFFIX = `
"""`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY não configurada no servidor." },
      { status: 500 }
    );
  }

  let body: { laudoMicro?: string; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const laudoMicro = body.laudoMicro?.trim();
  if (!laudoMicro) {
    return NextResponse.json(
      { error: "laudoMicro é obrigatório." },
      { status: 400 }
    );
  }

  const customPrompt = body.prompt?.trim();
  const prompt = customPrompt
    ? customPrompt.replace(/\{laudo\}/g, laudoMicro)
    : PROMPT_PREFIX + laudoMicro + PROMPT_SUFFIX;

  let geminiRes: Response;
  try {
    geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0 },
      }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Falha ao contatar a API do Gemini." },
      { status: 502 }
    );
  }

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    return NextResponse.json(
      { error: `Gemini retornou status ${geminiRes.status}: ${errText}` },
      { status: 502 }
    );
  }

  const geminiData = await geminiRes.json();
  const rawText: string | undefined =
    geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    return NextResponse.json(
      { error: "Resposta inesperada da API do Gemini." },
      { status: 502 }
    );
  }

  // Strip markdown code fences if present
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: { contradicao: string; evidencias?: string[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      { error: "Gemini não retornou JSON válido.", raw: rawText },
      { status: 502 }
    );
  }

  return NextResponse.json(parsed);
}
