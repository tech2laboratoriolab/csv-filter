import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const FILE_PATH = path.join(process.cwd(), 'data', 'pathologists.json');

function ensureDir() {
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export async function GET() {
  if (!fs.existsSync(FILE_PATH)) return NextResponse.json([]);
  const data = JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  ensureDir();
  const body = await req.json();
  if (!Array.isArray(body)) return NextResponse.json({ error: 'Array esperado' }, { status: 400 });
  fs.writeFileSync(FILE_PATH, JSON.stringify(body, null, 2), 'utf-8');
  return NextResponse.json({ ok: true });
}
