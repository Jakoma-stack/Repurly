import { NextRequest, NextResponse } from 'next/server';
import { verifyMetaSignature } from '@/lib/webhooks/signatures';
import { mapProviderWebhookToPublishState } from '@/lib/webhooks/provider-events';

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? '', { status: 200 });
  }

  return NextResponse.json({ ok: false }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  if (!verifyMetaSignature(rawBody, signature, process.env.META_APP_SECRET)) {
    return NextResponse.json({ error: 'Invalid Meta signature' }, { status: 401 });
  }

  const body = JSON.parse(rawBody || '{}');
  const entries = Array.isArray(body.entry) ? body.entry : [body];
  const results = [];

  for (const entry of entries) {
    results.push(await mapProviderWebhookToPublishState('meta', entry as Record<string, unknown>));
  }

  return NextResponse.json({ received: true, results });
}
