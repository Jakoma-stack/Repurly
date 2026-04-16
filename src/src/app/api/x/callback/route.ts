import { NextRequest, NextResponse } from 'next/server';

import { buildAppUrl } from '@/lib/app-url';
import { connectXWorkspace } from '@/lib/x/service';
import { parseXState } from '@/lib/x/oauth';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  if (!code || !state) return NextResponse.json({ error: 'Missing OAuth parameters' }, { status: 400 });

  const payload = parseXState(state);
  await connectXWorkspace(payload.workspaceId, code, payload.verifier);
  return NextResponse.redirect(new URL(buildAppUrl('/app/channels?x=connected', request.url)));
}
