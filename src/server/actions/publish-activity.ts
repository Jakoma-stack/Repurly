'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { requireWorkspaceRole } from '@/lib/auth/workspace';
import { postTargets, posts, publishJobs } from '../../../drizzle/schema';

async function safeRevalidate(publishJobId?: string) {
  revalidatePath('/app/activity');
  revalidatePath('/app/calendar');
  revalidatePath('/app/content');
  revalidatePath('/app');
  if (publishJobId) revalidatePath(`/app/activity/${publishJobId}`);
}

async function getWorkspaceIdForPublishJob(publishJobId: string) {
  if (!publishJobId) return null;
  const rows = await db.select({ workspaceId: posts.workspaceId }).from(publishJobs).innerJoin(posts, eq(posts.id, publishJobs.postId)).where(eq(publishJobs.id, publishJobId)).limit(1);
  return rows[0]?.workspaceId ?? null;
}
async function getWorkspaceIdForPostTarget(postTargetId: string) {
  if (!postTargetId) return null;
  const rows = await db.select({ workspaceId: posts.workspaceId }).from(postTargets).innerJoin(posts, eq(posts.id, postTargets.postId)).where(eq(postTargets.id, postTargetId)).limit(1);
  return rows[0]?.workspaceId ?? null;
}
async function getWorkspaceIdForPost(postId: string) {
  if (!postId) return null;
  const rows = await db.select({ workspaceId: posts.workspaceId }).from(posts).where(eq(posts.id, postId)).limit(1);
  return rows[0]?.workspaceId ?? null;
}
async function requireActivityMutationAccess(args: { publishJobId?: string; postTargetId?: string; postId?: string }) {
  const workspaceIds = (await Promise.all([
    args.publishJobId ? getWorkspaceIdForPublishJob(args.publishJobId) : null,
    args.postTargetId ? getWorkspaceIdForPostTarget(args.postTargetId) : null,
    args.postId ? getWorkspaceIdForPost(args.postId) : null,
  ])).filter(Boolean) as string[];
  const workspaceId = workspaceIds[0];
  if (!workspaceId || workspaceIds.some((id) => id !== workspaceId)) return null;
  await requireWorkspaceRole(workspaceId, ['owner', 'admin', 'editor']);
  return workspaceId;
}

export async function retryPublishJob(formData: FormData) {
  const publishJobId = String(formData.get('publishJobId') || '');
  if (!publishJobId || !process.env.DATABASE_URL) { await safeRevalidate(); return; }
  const workspaceId = await requireActivityMutationAccess({ publishJobId });
  if (!workspaceId) { await safeRevalidate(publishJobId); return; }
  await db.update(publishJobs).set({ status: 'queued', lastError: null, scheduledFor: new Date(), completedAt: null }).where(eq(publishJobs.id, publishJobId));
  await safeRevalidate(publishJobId);
}

export async function requeuePostTarget(formData: FormData) {
  const postTargetId = String(formData.get('postTargetId') || '');
  const publishJobId = String(formData.get('publishJobId') || '');
  if ((!postTargetId && !publishJobId) || !process.env.DATABASE_URL) { await safeRevalidate(); return; }
  const workspaceId = await requireActivityMutationAccess({ publishJobId, postTargetId });
  if (!workspaceId) { await safeRevalidate(publishJobId || undefined); return; }
  if (postTargetId) await db.update(postTargets).set({ platformStatus: 'queued', result: { summary: 'Requeued from activity screen', userMessage: 'Repurly moved this target back into the publish queue.', retryable: true }, updatedAt: new Date() }).where(eq(postTargets.id, postTargetId));
  if (publishJobId) await db.update(publishJobs).set({ status: 'queued', lastError: null, scheduledFor: new Date(), completedAt: null }).where(eq(publishJobs.id, publishJobId));
  await safeRevalidate(publishJobId || undefined);
}

export async function deletePostFromActivity(formData: FormData) {
  const postId = String(formData.get('postId') || '');
  const publishJobId = String(formData.get('publishJobId') || '');
  if (!postId || !process.env.DATABASE_URL) { await safeRevalidate(publishJobId || undefined); return; }
  const workspaceId = await requireActivityMutationAccess({ publishJobId, postId });
  if (!workspaceId) { await safeRevalidate(publishJobId || undefined); return; }
  await db.delete(posts).where(and(eq(posts.id, postId), eq(posts.workspaceId, workspaceId)));
  await safeRevalidate(publishJobId || undefined);
}
