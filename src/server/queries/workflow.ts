import { and, desc, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { approvalRequests, platformAccounts, postTargets, posts, publishJobs } from '../../../drizzle/schema';

export async function getLinkedInTargets(workspaceId: string) {
  return db
    .select({
      id: platformAccounts.id,
      integrationId: platformAccounts.integrationId,
      provider: platformAccounts.provider,
      externalAccountId: platformAccounts.externalAccountId,
      displayName: platformAccounts.displayName,
      handle: platformAccounts.handle,
      targetType: platformAccounts.targetType,
      isDefault: platformAccounts.isDefault,
      publishEnabled: platformAccounts.publishEnabled,
      metadata: platformAccounts.metadata,
      updatedAt: platformAccounts.updatedAt,
    })
    .from(platformAccounts)
    .where(
      and(
        eq(platformAccounts.workspaceId, workspaceId),
        eq(platformAccounts.provider, 'linkedin'),
        eq(platformAccounts.publishEnabled, true),
      ),
    )
    .orderBy(desc(platformAccounts.isDefault), desc(platformAccounts.updatedAt));
}

export async function getPostForEditing(workspaceId: string, postId?: string | null) {
  if (!postId) return null;

  const postRows = await db
    .select({
      id: posts.id,
      title: posts.title,
      body: posts.body,
      scheduledFor: posts.scheduledFor,
      status: posts.status,
    })
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.workspaceId, workspaceId)))
    .limit(1);

  const post = postRows[0];
  if (!post) return null;

  const targetRows = await db
    .select({
      targetId: postTargets.platformAccountId,
    })
    .from(postTargets)
    .where(eq(postTargets.postId, post.id))
    .limit(1);

  const approvalRows = await db
    .select({
      approvalOwner: approvalRequests.note,
    })
    .from(approvalRequests)
    .where(and(eq(approvalRequests.postId, post.id), eq(approvalRequests.workspaceId, workspaceId)))
    .orderBy(desc(approvalRequests.createdAt))
    .limit(1);

  const scheduledForInput = post.scheduledFor
    ? new Date(post.scheduledFor.getTime() - post.scheduledFor.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : '';

  return {
    id: post.id,
    title: post.title ?? '',
    body: post.body ?? '',
    scheduledForInput,
    targetId: targetRows[0]?.targetId ?? null,
    approvalOwner: approvalRows[0]?.approvalOwner ?? '',
    status: post.status,
  };
}

export async function getPublishingQueue(workspaceId: string) {
  const rows = await db
    .select({
      id: publishJobs.id,
      postId: posts.id,
      scheduledFor: publishJobs.scheduledFor,
      status: publishJobs.status,
      title: posts.title,
      provider: postTargets.provider,
      targetDisplayName: platformAccounts.displayName,
      targetHandle: platformAccounts.handle,
    })
    .from(publishJobs)
    .innerJoin(posts, eq(posts.id, publishJobs.postId))
    .innerJoin(postTargets, eq(postTargets.id, publishJobs.postTargetId))
    .innerJoin(platformAccounts, eq(platformAccounts.id, postTargets.platformAccountId))
    .where(eq(posts.workspaceId, workspaceId))
    .orderBy(desc(publishJobs.scheduledFor));

  return rows.map((row) => ({
    id: row.id,
    postId: row.postId,
    scheduledFor: row.scheduledFor ? new Date(row.scheduledFor).toLocaleString() : 'Not scheduled',
    title: row.title,
    targetLabel: row.targetDisplayName || row.targetHandle || 'LinkedIn target',
    provider: row.provider,
    status: row.status,
  }));
}

export async function getWorkflowMetrics(_workspaceId: string) {
  return {
    drafts: 0,
    approvalsPending: 0,
    scheduled: 0,
    published: 0,
    failed: 0,
  };
}
