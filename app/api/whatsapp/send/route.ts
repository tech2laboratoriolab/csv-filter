import { NextRequest, NextResponse } from 'next/server';
import { getFilterById, getPatologistaSummary, getPatologistaRows } from '@/lib/db';

interface PathologistToSend {
  nome: string;
  telefone: string;
}

interface SendRequest {
  filterId: string;
  messageTemplate: string;
  pathologists: PathologistToSend[];
  linhasColumns?: string[];
}

interface SendResult {
  nome: string;
  telefone: string;
  success: boolean;
  message?: string;
  error?: string;
}

function formatNome(nome: string): string {
  return nome.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function formatDateBR(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function buildResumo(eventos: { nome_evento: string; count: number }[]): string {
  if (!eventos.length) return '📋 Nenhum evento encontrado.';
  const lines = ['📋 Resumo dos seus exames:'];
  for (const ev of eventos) {
    lines.push(`• ${ev.nome_evento}: ${ev.count}`);
  }
  return lines.join('\n');
}

function formatDateValue(val: string): string {
  const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return val;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function buildLinhas(
  columns: { name: string; label: string; type: string }[],
  rows: Record<string, string>[]
): string {
  if (!rows.length) return '📋 Nenhum registro encontrado.';
  return rows.map(row => {
    const parts = columns.map(col => {
      const val = row[col.name] || '-';
      return col.type === 'date' && val !== '-' ? formatDateValue(val) : val;
    });
    return `• ${parts.join(', ')}`;
  }).join('\n');
}

export async function POST(req: NextRequest) {
  try {
    const body: SendRequest = await req.json();
    const { filterId, messageTemplate, pathologists, linhasColumns } = body;

    if (!filterId || !messageTemplate || !Array.isArray(pathologists)) {
      return NextResponse.json({ error: 'filterId, messageTemplate e pathologists são obrigatórios' }, { status: 400 });
    }

    const filter = getFilterById(filterId);
    if (!filter) {
      return NextResponse.json({ error: `Filtro ${filterId} não encontrado` }, { status: 404 });
    }

    const wahaUrl = process.env.WAHA_URL || 'http://localhost:4300';
    const wahaSession = process.env.WAHA_SESSION || 'controle-prazo';
    const wahaApiKey = process.env.WAHA_API_KEY || '';
    const dataHoje = formatDateBR(new Date());

    const results: SendResult[] = [];

    for (const pat of pathologists) {
      if (!pat.telefone) {
        results.push({ nome: pat.nome, telefone: '', success: false, error: 'Sem número de telefone' });
        continue;
      }

      try {
        const summary = getPatologistaSummary(filter.conditions, pat.nome);
        const resumo = buildResumo(summary.eventos);
        const { columns, rows } = getPatologistaRows(
          filter.conditions,
          linhasColumns?.length ? linhasColumns : filter.selectedColumns,
          pat.nome
        );
        const linhas = buildLinhas(columns, rows);

        const finalMessage = messageTemplate
          .replace(/\{nome\}/g, formatNome(pat.nome))
          .replace(/\{total\}/g, String(summary.total))
          .replace(/\{data_hoje\}/g, dataHoje)
          .replace(/\{resumo\}/g, resumo)
          .replace(/\{linhas\}/g, linhas);

        const chatId = `${pat.telefone.replace(/\D/g, '')}@c.us`;

        const response = await fetch(`${wahaUrl}/api/sendText`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': wahaApiKey,
          },
          body: JSON.stringify({
            chatId,
            text: finalMessage,
            session: wahaSession,
          }),
        });

        if (response.ok) {
          results.push({ nome: pat.nome, telefone: pat.telefone, success: true, message: finalMessage });
        } else {
          const errText = await response.text();
          results.push({ nome: pat.nome, telefone: pat.telefone, success: false, error: `WAHA ${response.status}: ${errText}` });
        }
      } catch (err: any) {
        results.push({ nome: pat.nome, telefone: pat.telefone, success: false, error: err.message });
      }
    }

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({ success: true, sent, failed, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filterId = searchParams.get('filterId');
  const patologistaNome = searchParams.get('patologista');

  if (!filterId || !patologistaNome) {
    return NextResponse.json({ error: 'filterId e patologista são obrigatórios' }, { status: 400 });
  }

  const filter = getFilterById(filterId);
  if (!filter) {
    return NextResponse.json({ error: `Filtro ${filterId} não encontrado` }, { status: 404 });
  }

  const linhasColumnsParam = searchParams.get('linhasColumns');
  const linhasColumns = linhasColumnsParam ? linhasColumnsParam.split(',').filter(Boolean) : [];

  const summary = getPatologistaSummary(filter.conditions, patologistaNome);
  const { columns, rows } = getPatologistaRows(
    filter.conditions,
    linhasColumns.length ? linhasColumns : filter.selectedColumns,
    patologistaNome
  );
  return NextResponse.json({ ...summary, columns, rows });
}
