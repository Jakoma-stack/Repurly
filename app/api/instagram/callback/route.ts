import { NextRequest, NextResponse } from 'next/server';

import { buildAppUrl } from '@/lib/app-url';
import { connectInstagramWorkspace } from '@/lib/instagram/service';
import { parseInstagramState } from '@/lib/instagram/oauth';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  if (!code || !state) return NextResponse.json({ error: 'Missing OAuth parameters' }, { status: 400 });

  const payload = parseInstagramState(state);
  await connectInstagramWorkspace(payload.workspaceId, code);
  return NextResponse.redirect(new URL(buildAppUrl('/app/channels?instagram=connected', request.url)));
}
