import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { buildAppUrl } from '@/lib/app-url';
import { getAuthenticatedWorkspaceRole } from '@/lib/auth/workspace';
import { connectXWorkspace } from '@/lib/x/service';
import { parseXState } from '@/lib/x/oauth';

const CONNECT_ROLES = new Set(['owner', 'admin']);

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  if (!code || !state) return NextResponse.redirect(new URL(buildAppUrl('/app/channels?error=x-missing-oauth', request.url)));

  try {
    const { userId } = await auth();
    const payload = parseXState(state);
    if (!userId || payload.userId !== userId) {
      return NextResponse.redirect(new URL(buildAppUrl('/app/channels?error=x-state-mismatch', request.url)));
    }

    const access = await getAuthenticatedWorkspaceRole(payload.workspaceId);
    if (!access || !CONNECT_ROLES.has(access.role)) {
      return NextResponse.redirect(new URL(buildAppUrl('/app/channels?error=forbidden-workspace', request.url)));
    }

    await connectXWorkspace(payload.workspaceId, code, payload.verifier);
    return NextResponse.redirect(new URL(buildAppUrl('/app/channels?x=connected', request.url)));
  } catch (error) {
    console.error('X OAuth callback failed', error);
    return NextResponse.redirect(new URL(buildAppUrl('/app/channels?error=x-connect-failed', request.url)));
  }
}
