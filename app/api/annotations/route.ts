import { NextRequest, NextResponse } from 'next/server';
import { getAnnotations, setAnnotation } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rowIdsParam = searchParams.get('rowIds') ?? '';
    const colIdsParam = searchParams.get('colIds') ?? '';
    const rowIds = rowIdsParam ? rowIdsParam.split(',').map(Number).filter(n => !isNaN(n)) : [];
    const colIds = colIdsParam ? colIdsParam.split(',').filter(Boolean) : [];
    const annotations = getAnnotations(rowIds, colIds);
    return NextResponse.json({ annotations });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rowId, colId, value } = body;
    if (typeof rowId !== 'number' || !colId) {
      return NextResponse.json({ error: 'rowId and colId are required' }, { status: 400 });
    }
    setAnnotation(rowId, colId, value ?? '');
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
