import { auth } from '@clerk/nextjs/server';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createPresignedUpload } from '@/lib/storage/presign';
import { isPrivatePilotMode } from '@/lib/billing/private-pilot';
import { getAuthenticatedWorkspaceRole } from '@/lib/auth/workspace';
import { getWorkspaceBillingAccessState } from '@/lib/billing/workspace-billing';

export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'application/pdf']);

const schema = z.object({
  fileName: z.string().min(1).max(180),
  contentType: z.string().min(1).max(120),
  workspaceId: z.string().uuid(),
  byteSize: z.number().int().positive().max(MAX_UPLOAD_BYTES).optional(),
});

function sanitizeFileName(fileName: string) {
  const sanitized = fileName.replace(/[\\/]+/g, '-').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
  return sanitized || 'upload';
}

export async function POST(request: NextRequest) {
  if (isPrivatePilotMode()) {
    return NextResponse.json({ error: 'Uploads disabled in private pilot' }, { status: 503 });
  }

  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });

    const { fileName, contentType, workspaceId } = parsed.data;
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 });

    const access = await getAuthenticatedWorkspaceRole(workspaceId);
    if (!access || !['owner', 'admin', 'editor'].includes(access.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const billing = await getWorkspaceBillingAccessState(workspaceId);
    if (!billing?.hasPaidAccess) return NextResponse.json({ error: 'Payment required' }, { status: 402 });
    const objectKey = `workspaces/${workspaceId}/uploads/${randomUUID()}-${sanitizeFileName(fileName)}`;
    const result = await createPresignedUpload(objectKey, contentType);
    return NextResponse.json({ ...result, maxBytes: MAX_UPLOAD_BYTES });
  } catch (error) {
    console.error('Failed to create presigned upload', error);
    return NextResponse.json({ error: 'Failed to create presigned upload' }, { status: 500 });
  }
}
