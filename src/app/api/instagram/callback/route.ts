import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { buildAppUrl } from '@/lib/app-url';
import { getAuthenticatedWorkspaceRole } from '@/lib/auth/workspace';
import { connectInstagramWorkspace } from '@/lib/instagram/service';
import { parseInstagramState } from '@/lib/instagram/oauth';

const CONNECT_ROLES = new Set(['owner', 'admin']);

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  if (!code || !state) return NextResponse.redirect(new URL(buildAppUrl('/app/channels?error=instagram-missing-oauth', request.url)));

  try {
    const { userId } = await auth();
    const payload = parseInstagramState(state);
    if (!userId || payload.userId !== userId) {
      return NextResponse.redirect(new URL(buildAppUrl('/app/channels?error=instagram-state-mismatch', request.url)));
    }

    const access = await getAuthenticatedWorkspaceRole(payload.workspaceId);
    if (!access || !CONNECT_ROLES.has(access.role)) {
      return NextResponse.redirect(new URL(buildAppUrl('/app/channels?error=forbidden-workspace', request.url)));
    }

    await connectInstagramWorkspace(payload.workspaceId, code);
    return NextResponse.redirect(new URL(buildAppUrl('/app/channels?instagram=connected', request.url)));
  } catch (error) {
    console.error('Instagram OAuth callback failed', error);
    return NextResponse.redirect(new URL(buildAppUrl('/app/channels?error=instagram-connect-failed', request.url)));
  }
}
