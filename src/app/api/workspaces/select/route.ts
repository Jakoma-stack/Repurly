import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { assertWorkspaceAccess } from '@/lib/auth/workspace';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : '';
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });

  const allowed = await assertWorkspaceAccess(userId, workspaceId);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const response = NextResponse.json({ ok: true, workspaceId });
  response.cookies.set('repurly_workspace', workspaceId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
