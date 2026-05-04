import { NextRequest, NextResponse } from 'next/server';

const UMAMI_ORIGIN = 'https://umamilab.ngrok.dev';

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body?.payload?.url) {
    body.payload.url = body.payload.url.replace(/\/filters\/[^?#]+/, '/filters');
  }

  const response = await fetch(`${UMAMI_ORIGIN}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.text();
  return new NextResponse(data, { status: response.status });
}
