import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDistinctPatologists } from '@/lib/db';

const PATHOLOGISTS_FILE = path.join(process.cwd(), 'data', 'pathologists.json');

interface Pathologist {
  nome: string;
  telefone: string;
}

function readFile(): Pathologist[] {
  try {
    if (!fs.existsSync(PATHOLOGISTS_FILE)) return [];
    const content = fs.readFileSync(PATHOLOGISTS_FILE, 'utf-8').trim();
    if (!content || content === '[]') return [];
    return JSON.parse(content) as Pathologist[];
  } catch {
    return [];
  }
}

export async function GET() {
  let saved = readFile();

  // If no saved data, auto-populate from DB
  if (saved.length === 0) {
    const names = getDistinctPatologists();
    saved = names.map(nome => ({ nome, telefone: '' }));
    if (saved.length > 0) {
      fs.writeFileSync(PATHOLOGISTS_FILE, JSON.stringify(saved, null, 2));
    }
    return NextResponse.json(saved);
  }

  // Merge: add names from DB that are not yet in file, preserve existing phones
  const dbNames = getDistinctPatologists();
  const savedMap = new Map(saved.map(p => [p.nome, p.telefone]));
  for (const nome of dbNames) {
    if (!savedMap.has(nome)) {
      savedMap.set(nome, '');
    }
  }
  const merged: Pathologist[] = Array.from(savedMap.entries())
    .map(([nome, telefone]) => ({ nome, telefone }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  // Persist merged list
  fs.writeFileSync(PATHOLOGISTS_FILE, JSON.stringify(merged, null, 2));

  return NextResponse.json(merged);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Body must be an array' }, { status: 400 });
    }
    const list: Pathologist[] = body.map((item: any) => ({
      nome: String(item.nome || ''),
      telefone: String(item.telefone || ''),
    }));
    fs.writeFileSync(PATHOLOGISTS_FILE, JSON.stringify(list, null, 2));
    return NextResponse.json({ success: true, count: list.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
