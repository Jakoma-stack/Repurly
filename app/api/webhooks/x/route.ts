import { NextRequest, NextResponse } from 'next/server';
import { verifyXSignature } from '@/lib/webhooks/signatures';
import { mapProviderWebhookToPublishState } from '@/lib/webhooks/provider-events';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-repurly-signature') ?? request.headers.get('x-signature');

  if (!verifyXSignature(rawBody, signature, process.env.X_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Invalid X signature' }, { status: 401 });
  }

  const body = JSON.parse(rawBody || '{}');
  const result = await mapProviderWebhookToPublishState('x', body as Record<string, unknown>);
  return NextResponse.json({ received: true, result });
}
