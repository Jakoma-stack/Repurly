import { NextRequest, NextResponse } from 'next/server';
import { verifyYoutubeSignature } from '@/lib/webhooks/signatures';
import { mapProviderWebhookToPublishState } from '@/lib/webhooks/provider-events';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-repurly-token') ?? request.headers.get('x-goog-channel-token');

  if (!verifyYoutubeSignature(rawBody, signature, process.env.YOUTUBE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Invalid YouTube signature' }, { status: 401 });
  }

  const body = JSON.parse(rawBody || '{}');
  const result = await mapProviderWebhookToPublishState('youtube', body as Record<string, unknown>);
  return NextResponse.json({ received: true, result });
}
