import { NextRequest, NextResponse } from 'next/server';
import { connectLinkedInWorkspace } from '@/lib/linkedin/service';
import { parseLinkedInState } from '@/lib/linkedin/oauth';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  if (!code || !state) return NextResponse.json({ error: 'Missing OAuth parameters' }, { status: 400 });

  const payload = parseLinkedInState(state);
  await connectLinkedInWorkspace(payload.workspaceId, code);
  return NextResponse.redirect(new URL('/app?linkedin=connected', request.url));
}
