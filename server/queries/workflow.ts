import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { approvalRequests, brands, engagementComments, leadPipeline, platformAccounts, postTargets, posts, publishJobs } from '../../../drizzle/schema';

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
    .where(and(eq(platformAccounts.workspaceId, workspaceId), eq(platformAccounts.provider, 'linkedin'), eq(platformAccounts.publishEnabled, true)))
    .orderBy(desc(platformAccounts.isDefault), desc(platformAccounts.updatedAt));
}

export async function getWorkspaceBrandOptions(workspaceId: string) {
  return db
    .select({
      id: brands.id,
      name: brands.name,
      slug: brands.slug,
      defaultTone: brands.defaultTone,
      audience: brands.audience,
      primaryCta: brands.primaryCta,
      hashtags: brands.hashtags,
      status: brands.status,
    })
    .from(brands)
    .where(eq(brands.workspaceId, workspaceId))
    .orderBy(brands.name);
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
      brandId: posts.brandId,
      postType: posts.postType,
      metadata: posts.metadata,
    })
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.workspaceId, workspaceId)))
    .limit(1);

  const post = postRows[0];
  if (!post) return null;

  const targetRows = await db.select({ targetId: postTargets.platformAccountId }).from(postTargets).where(eq(postTargets.postId, post.id)).limit(1);

  const approvalRows = await db
    .select({ approvalOwner: approvalRequests.note })
    .from(approvalRequests)
    .where(and(eq(approvalRequests.postId, post.id), eq(approvalRequests.workspaceId, workspaceId)))
    .orderBy(desc(approvalRequests.createdAt))
    .limit(1);

  return {
    id: post.id,
    title: post.title ?? '',
    body: post.body ?? '',
    scheduledForIso: post.scheduledFor ? new Date(post.scheduledFor).toISOString() : '',
    targetId: targetRows[0]?.targetId ?? null,
    approvalOwner: approvalRows[0]?.approvalOwner ?? '',
    status: post.status,
    brandId: post.brandId,
    postType: post.postType,
    brief: String(post.metadata?.brief ?? ''),
  };
}

export async function getRecentDrafts(workspaceId: string, brandId?: string | null) {
  const filters = [eq(posts.workspaceId, workspaceId), eq(posts.status, 'draft')];

  if (brandId) {
    filters.push(eq(posts.brandId, brandId));
  }

  return db
    .select({
      id: posts.id,
      title: posts.title,
      status: posts.status,
      brandName: brands.name,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .innerJoin(brands, eq(brands.id, posts.brandId))
    .where(and(...filters))
    .orderBy(desc(posts.updatedAt))
    .limit(8);
}

export async function getPostsByIds(workspaceId: string, postIds: string[]) {
  if (!postIds.length) return [];

  const rows = await db
    .select({
      id: posts.id,
      title: posts.title,
      body: posts.body,
      status: posts.status,
      postType: posts.postType,
      brandName: brands.name,
      metadata: posts.metadata,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .innerJoin(brands, eq(brands.id, posts.brandId))
    .where(and(eq(posts.workspaceId, workspaceId), inArray(posts.id, postIds)))
    .orderBy(desc(posts.updatedAt));

  const order = new Map(postIds.map((id, index) => [id, index]));
  return rows
    .map((row) => ({
      ...row,
      titleHint: String(row.metadata?.titleHint ?? ''),
      callToAction: String(row.metadata?.callToAction ?? ''),
      draftNumber: Number(row.metadata?.draftNumber ?? 0),
      excerpt: row.body.length > 220 ? `${row.body.slice(0, 217).trim()}...` : row.body,
    }))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
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
      brandName: brands.name,
    })
    .from(publishJobs)
    .innerJoin(posts, eq(posts.id, publishJobs.postId))
    .innerJoin(brands, eq(brands.id, posts.brandId))
    .innerJoin(postTargets, eq(postTargets.id, publishJobs.postTargetId))
    .innerJoin(platformAccounts, eq(platformAccounts.id, postTargets.platformAccountId))
    .where(eq(posts.workspaceId, workspaceId))
    .orderBy(desc(publishJobs.scheduledFor));

  return rows.map((row) => ({
    id: row.id,
    postId: row.postId,
    scheduledForIso: row.scheduledFor ? new Date(row.scheduledFor).toISOString() : null,
    title: row.title,
    brandName: row.brandName,
    targetLabel: row.targetDisplayName || row.targetHandle || 'LinkedIn target',
    provider: row.provider,
    status: row.status,
  }));
}

export async function getWorkflowMetrics(workspaceId: string) {
  const [postCounts, pendingReplies, hotLeads, brandCount] = await Promise.all([
    db
      .select({
        drafts: sql<number>`count(*) filter (where ${posts.status} = 'draft')`,
        approvalsPending: sql<number>`count(*) filter (where ${posts.status} = 'in_review')`,
        scheduled: sql<number>`count(*) filter (where ${posts.status} = 'scheduled')`,
        published: sql<number>`count(*) filter (where ${posts.status} = 'published')`,
        failed: sql<number>`count(*) filter (where ${posts.status} = 'failed')`,
      })
      .from(posts)
      .where(eq(posts.workspaceId, workspaceId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(engagementComments)
      .where(and(eq(engagementComments.workspaceId, workspaceId), eq(engagementComments.replyStatus, 'not_started'))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(leadPipeline)
      .where(and(eq(leadPipeline.workspaceId, workspaceId), sql`${leadPipeline.intentScore} >= 70`)),
    db.select({ count: sql<number>`count(*)` }).from(brands).where(eq(brands.workspaceId, workspaceId)),
  ]);

  return {
    drafts: Number(postCounts[0]?.drafts ?? 0),
    approvalsPending: Number(postCounts[0]?.approvalsPending ?? 0),
    scheduled: Number(postCounts[0]?.scheduled ?? 0),
    published: Number(postCounts[0]?.published ?? 0),
    failed: Number(postCounts[0]?.failed ?? 0),
    pendingReplies: Number(pendingReplies[0]?.count ?? 0),
    hotLeads: Number(hotLeads[0]?.count ?? 0),
    brandCount: Number(brandCount[0]?.count ?? 0),
  };
}
