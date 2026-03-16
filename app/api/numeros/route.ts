import { NextResponse } from "next/server";

export async function GET() {
  const raw = process.env.NUMEROS_JSON;
  if (!raw) return NextResponse.json({}, { status: 404 });
  try {
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({}, { status: 500 });
  }
}
