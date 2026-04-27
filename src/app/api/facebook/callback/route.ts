import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { buildAppUrl } from '@/lib/app-url';
import { getAuthenticatedWorkspaceRole } from '@/lib/auth/workspace';
import { connectFacebookWorkspace } from '@/lib/facebook/service';
import { parseFacebookState } from '@/lib/facebook/oauth';

const CONNECT_ROLES = new Set(['owner', 'admin']);

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  if (!code || !state) return NextResponse.redirect(new URL(buildAppUrl('/app/channels?error=facebook-missing-oauth', request.url)));

  try {
    const { userId } = await auth();
    const payload = parseFacebookState(state);
    if (!userId || payload.userId !== userId) {
      return NextResponse.redirect(new URL(buildAppUrl('/app/channels?error=facebook-state-mismatch', request.url)));
    }

    const access = await getAuthenticatedWorkspaceRole(payload.workspaceId);
    if (!access || !CONNECT_ROLES.has(access.role)) {
      return NextResponse.redirect(new URL(buildAppUrl('/app/channels?error=forbidden-workspace', request.url)));
    }

    await connectFacebookWorkspace(payload.workspaceId, code);
    return NextResponse.redirect(new URL(buildAppUrl('/app/channels?facebook=connected', request.url)));
  } catch (error) {
    console.error('Facebook OAuth callback failed', error);
    return NextResponse.redirect(new URL(buildAppUrl('/app/channels?error=facebook-connect-failed', request.url)));
  }
}
