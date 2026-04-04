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
    await connectLinkedInWorkspace(payload.workspaceId, code);

    return NextResponse.redirect(
      new URL(buildAppUrl('/app/channels?linkedin=connected&setup=review-target#linkedin-onboarding', request.url)),
    );
  } catch {
    return NextResponse.redirect(new URL(buildAppUrl('/app/channels?error=linkedin-connect-failed#linkedin-onboarding', request.url)));
  }
}
