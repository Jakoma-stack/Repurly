import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { buildAppUrl } from '@/lib/app-url';
import { getAuthenticatedWorkspaceRole } from '@/lib/auth/workspace';
import { buildXAuthUrl } from '@/lib/x/oauth';

const CONNECT_ROLES = new Set(['owner', 'admin']);

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspaceId');
  const { userId } = await auth();

  if (!userId) return NextResponse.redirect(new URL(buildAppUrl('/sign-in', request.url)));
  if (!workspaceId) return NextResponse.redirect(new URL(buildAppUrl('/app/channels?error=missing-workspace', request.url)));

  const access = await getAuthenticatedWorkspaceRole(workspaceId);
  if (!access || !CONNECT_ROLES.has(access.role)) {
    return NextResponse.redirect(new URL(buildAppUrl('/app/channels?error=forbidden-workspace', request.url)));
  }

  return NextResponse.redirect(buildXAuthUrl(workspaceId, userId));
}
