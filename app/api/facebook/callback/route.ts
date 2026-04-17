import { NextRequest, NextResponse } from 'next/server';

import { buildAppUrl } from '@/lib/app-url';
import { connectFacebookWorkspace } from '@/lib/facebook/service';
import { parseFacebookState } from '@/lib/facebook/oauth';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  if (!code || !state) return NextResponse.json({ error: 'Missing OAuth parameters' }, { status: 400 });

  const payload = parseFacebookState(state);
  await connectFacebookWorkspace(payload.workspaceId, code);
  return NextResponse.redirect(new URL(buildAppUrl('/app/channels?facebook=connected', request.url)));
}
