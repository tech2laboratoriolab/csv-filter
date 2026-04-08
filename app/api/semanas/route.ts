import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SEMANAS_DIR = path.join(process.cwd(), 'data', 'semanas');

function ensureDir() {
  if (!fs.existsSync(SEMANAS_DIR)) fs.mkdirSync(SEMANAS_DIR, { recursive: true });
}

export async function GET(req: NextRequest) {
  ensureDir();
  const { searchParams } = new URL(req.url);

  if (searchParams.get('list') === 'true') {
    const files = fs.readdirSync(SEMANAS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
      .sort((a, b) => b.localeCompare(a)); // mais recente primeiro
    return NextResponse.json(files);
  }

  const week = searchParams.get('week');
  if (!week) return NextResponse.json({ error: 'Parâmetro week obrigatório' }, { status: 400 });

  const filePath = path.join(SEMANAS_DIR, `${week}.json`);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ weekKey: week, patologistas: [] });
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  ensureDir();
  const body = await req.json();
  if (!body.weekKey) return NextResponse.json({ error: 'weekKey obrigatório' }, { status: 400 });

  const filePath = path.join(SEMANAS_DIR, `${body.weekKey}.json`);
  fs.writeFileSync(filePath, JSON.stringify(body, null, 2), 'utf-8');
  return NextResponse.json({ ok: true });
}
