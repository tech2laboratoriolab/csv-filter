import { NextRequest, NextResponse } from "next/server";

interface MessagePayload {
  nome: string;
  telefone: string;
  message: string;
}

interface SendRequest {
  messages: MessagePayload[];
}

interface SendResult {
  nome: string;
  telefone: string;
  success: boolean;
  message?: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: SendRequest = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Lista de mensagens inválida" },
        { status: 400 },
      );
    }

    const wahaUrl = process.env.WAHA_URL || "http://localhost:4300";
    const wahaSession = process.env.WAHA_SESSION || "controle-prazo";
    const wahaApiKey = process.env.WAHA_API_KEY || "";

    const results: SendResult[] = [];

    for (const msg of messages) {
      if (!msg.telefone) {
        results.push({
          nome: msg.nome,
          telefone: "",
          success: false,
          error: "Sem número de telefone",
        });
        continue;
      }

      try {
        const chatId = `${msg.telefone.replace(/\D/g, "")}@c.us`;

        const response = await fetch(`${wahaUrl}/api/sendText`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": wahaApiKey,
          },
          body: JSON.stringify({
            chatId,
            text: msg.message,
            session: wahaSession,
          }),
        });

        if (response.ok) {
          results.push({
            nome: msg.nome,
            telefone: msg.telefone,
            success: true,
            message: msg.message,
          });
        } else {
          const errText = await response.text();
          results.push({
            nome: msg.nome,
            telefone: msg.telefone,
            success: false,
            error: `WAHA ${response.status}: ${errText}`,
          });
        }
      } catch (err: any) {
        results.push({
          nome: msg.nome,
          telefone: msg.telefone,
          success: false,
          error: err.message,
        });
      }
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({ success: true, sent, failed, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

