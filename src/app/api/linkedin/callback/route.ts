import { NextRequest, NextResponse } from 'next/server';

import { buildAppUrl } from '@/lib/app-url';
import { connectLinkedInWorkspace } from '@/lib/linkedin/service';
import { parseLinkedInState } from '@/lib/linkedin/oauth';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(new URL(buildAppUrl('/app/channels?error=linkedin-missing-oauth#linkedin-onboarding', request.url)));
  }

  try {
    const payload = parseLinkedInState(state);
    const result = await connectLinkedInWorkspace(payload.workspaceId, code, payload.configKey);
    const redirectUrl = new URL(buildAppUrl('/app/channels?linkedin=connected&setup=review-target#linkedin-onboarding', request.url));

    if (result.organizationSyncWarning) {
      redirectUrl.searchParams.set('warning', result.organizationSyncWarning);
    }

    return NextResponse.redirect(redirectUrl);
  } catch {
    return NextResponse.redirect(new URL(buildAppUrl('/app/channels?error=linkedin-connect-failed#linkedin-onboarding', request.url)));
  }
}
