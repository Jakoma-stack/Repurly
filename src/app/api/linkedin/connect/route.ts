import { NextRequest, NextResponse } from 'next/server';

import { buildAppUrl } from '@/lib/app-url';
import { buildLinkedInAuthUrl } from '@/lib/linkedin/oauth';

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspaceId');

  if (!workspaceId) {
    return NextResponse.redirect(new URL(buildAppUrl('/app/channels?error=missing-workspace', request.url)));
  }

  return NextResponse.redirect(buildLinkedInAuthUrl(workspaceId, request.url));
}
