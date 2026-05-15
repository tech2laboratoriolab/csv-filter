export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { getPromptsConfig } from "@/lib/promptsConfig";

const GEMINI_MODEL = "gemini-3.1-flash-lite";

interface BatchItem {
  codRequisicao: string;
  laudoMicro: string;
}

function buildBatchPrompt(
  items: BatchItem[],
  defaultTemplate: string,
  batchInstruction: string,
  customPrompt?: string,
): string {
  const laudosList = items
    .map(
      (item, idx) =>
        `${idx + 1}. [COD_REQUISICAO: ${item.codRequisicao}]\n${item.laudoMicro}`,
    )
    .join("\n\n");

  const basePrompt = (customPrompt ?? defaultTemplate).replace(
    /\{laudo\}/g,
    laudosList,
  );

  return basePrompt + batchInstruction.replace("{N}", String(items.length));
}

function cleanGeminiText(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

const SCHEMA_INDIVIDUAL = {
  type: Type.OBJECT,
  properties: {
    contradicao: { type: Type.STRING },
    evidencias: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["contradicao"],
};

const SCHEMA_BATCH = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      cod_requisicao: { type: Type.STRING },
      contradicao: { type: Type.STRING },
      evidencias: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["cod_requisicao", "contradicao"],
  },
};

async function callGemini(prompt: string, apiKey: string, isBatchMode = false) {
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      temperature: 0,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: isBatchMode ? SCHEMA_BATCH : SCHEMA_INDIVIDUAL,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Resposta vazia da API do Gemini.");
  }
  const usage = response.usageMetadata;
  return {
    text,
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
  };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY não configurada no servidor." },
      { status: 500 },
    );
  }

  const { defaultTemplate, batchInstruction } = await getPromptsConfig();

  let body: { laudoMicro?: string; prompt?: string; items?: BatchItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const isBatch = Array.isArray(body.items) && body.items.length > 0;

  // ── Modo Individual ───────────────────────────────────────────────────────
  if (!isBatch) {
    const laudoMicro = body.laudoMicro?.trim();
    if (!laudoMicro) {
      return NextResponse.json(
        { error: "laudoMicro é obrigatório." },
        { status: 400 },
      );
    }

    const customPrompt = body.prompt?.trim();
    const prompt = (customPrompt ?? defaultTemplate).replace(
      /\{laudo\}/g,
      laudoMicro,
    );

    let geminiResult: Awaited<ReturnType<typeof callGemini>>;
    try {
      geminiResult = await callGemini(prompt, apiKey, false);
    } catch (e: any) {
      console.error("[analise-ia] Falha Gemini (individual):", e.message);
      return NextResponse.json(
        { error: e.message || "Falha ao contatar a API do Gemini." },
        { status: 502 },
      );
    }

    const cleaned = cleanGeminiText(geminiResult.text);
    let parsed: Record<string, any>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error(
        "[analise-ia] JSON inválido (individual):",
        cleaned.slice(0, 200),
      );
      return NextResponse.json(
        { error: "Gemini não retornou JSON válido.", raw: geminiResult.text },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ...parsed,
      inputTokens: geminiResult.inputTokens,
      outputTokens: geminiResult.outputTokens,
    });
  }

  // ── Modo Batch ────────────────────────────────────────────────────────────
  const items = body.items!;
  const validItems = items.filter(
    (it) => it.codRequisicao?.trim() && it.laudoMicro?.trim(),
  );
  if (validItems.length === 0) {
    return NextResponse.json(
      { error: "Nenhum item válido no batch." },
      { status: 400 },
    );
  }
  const customPrompt = body.prompt?.trim();
  const prompt = buildBatchPrompt(validItems, defaultTemplate, batchInstruction, customPrompt);

  let geminiResult: Awaited<ReturnType<typeof callGemini>>;
  try {
    geminiResult = await callGemini(prompt, apiKey, true);
  } catch (e: any) {
    console.error(
      `[analise-ia] Falha Gemini (batch ${validItems.length}):`,
      e.message,
    );
    return NextResponse.json(
      {
        error: e.message || "Falha ao contatar a API do Gemini.",
        batchSize: validItems.length,
      },
      { status: 502 },
    );
  }

  const cleaned = cleanGeminiText(geminiResult.text);
  let parsedArray: any[];
  try {
    parsedArray = JSON.parse(cleaned);
    if (!Array.isArray(parsedArray)) throw new Error("Resposta não é um array");
  } catch {
    console.error(
      "[analise-ia] JSON array inválido (batch):",
      cleaned.slice(0, 200),
    );
    return NextResponse.json(
      {
        error: "Gemini não retornou JSON array válido.",
        raw: geminiResult.text,
        batchSize: validItems.length,
      },
      { status: 502 },
    );
  }

  const results: Record<string, any> = {};
  const unmatched: { index: number; item: any }[] = [];

  for (let i = 0; i < parsedArray.length; i++) {
    const item = parsedArray[i];
    if (item && typeof item.cod_requisicao === "string") {
      results[item.cod_requisicao] = item;
    } else {
      unmatched.push({ index: i, item });
    }
  }

  // Fallback por índice para itens sem cod_requisicao
  for (const { index, item } of unmatched) {
    if (index < validItems.length) {
      console.warn(
        `[analise-ia] Fallback por índice para item ${index} → ${validItems[index].codRequisicao}`,
      );
      results[validItems[index].codRequisicao] = item;
    }
  }

  const missingCodes = validItems
    .map((it) => it.codRequisicao)
    .filter((cod) => !results[cod]);

  return NextResponse.json({
    results,
    totalInputTokens: geminiResult.inputTokens,
    totalOutputTokens: geminiResult.outputTokens,
    ...(missingCodes.length > 0 && { missing: missingCodes }),
  });
}
