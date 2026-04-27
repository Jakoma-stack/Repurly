import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { buildAppUrl } from '@/lib/app-url';
import { getAuthenticatedWorkspaceRole } from '@/lib/auth/workspace';
import { connectLinkedInWorkspace } from '@/lib/linkedin/service';
import { parseLinkedInState } from '@/lib/linkedin/oauth';

const CONNECT_ROLES = new Set(['owner', 'admin']);

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(new URL(buildAppUrl('/app/channels?error=linkedin-missing-oauth#linkedin-onboarding', request.url)));
  }

  try {
    const { userId } = await auth();
    const payload = parseLinkedInState(state);

    if (!userId || payload.userId !== userId) {
      return NextResponse.redirect(new URL(buildAppUrl('/app/channels?error=linkedin-state-mismatch#linkedin-onboarding', request.url)));
    }

    const access = await getAuthenticatedWorkspaceRole(payload.workspaceId);
    if (!access || !CONNECT_ROLES.has(access.role)) {
      return NextResponse.redirect(new URL(buildAppUrl('/app/channels?error=forbidden-workspace#linkedin-onboarding', request.url)));
    }

    const result = await connectLinkedInWorkspace(payload.workspaceId, code, payload.configKey);
    const redirectUrl = new URL(buildAppUrl('/app/channels?linkedin=connected&setup=review-target#linkedin-onboarding', request.url));
    if (result.organizationSyncWarning) redirectUrl.searchParams.set('warning', result.organizationSyncWarning);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('LinkedIn OAuth callback failed', error);
    return NextResponse.redirect(new URL(buildAppUrl('/app/channels?error=linkedin-connect-failed#linkedin-onboarding', request.url)));
  }
}
