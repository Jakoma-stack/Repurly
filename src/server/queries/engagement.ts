import { and, desc, eq, gte } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { brands, engagementComments, leadPipeline } from '../../../drizzle/schema';

export async function getEngagementSnapshot(workspaceId: string, activeStage?: string | null) {
  const comments = await db
    .select({
      id: engagementComments.id,
      brandId: engagementComments.brandId,
      brandName: brands.name,
      commenterName: engagementComments.commenterName,
      commenterHandle: engagementComments.commenterHandle,
      sourcePostTitle: engagementComments.sourcePostTitle,
      commentText: engagementComments.commentText,
      intentLabel: engagementComments.intentLabel,
      intentScore: engagementComments.intentScore,
      sentiment: engagementComments.sentiment,
      replyOptions: engagementComments.replyOptions,
      selectedReplyText: engagementComments.selectedReplyText,
      suggestedDmText: engagementComments.suggestedDmText,
      replyStatus: engagementComments.replyStatus,
      dmStatus: engagementComments.dmStatus,
      createdAt: engagementComments.createdAt,
    })
    .from(engagementComments)
    .leftJoin(brands, eq(brands.id, engagementComments.brandId))
    .where(eq(engagementComments.workspaceId, workspaceId))
    .orderBy(desc(engagementComments.createdAt));

  const leads = await db
    .select({
      id: leadPipeline.id,
      brandName: brands.name,
      leadName: leadPipeline.leadName,
      leadHandle: leadPipeline.leadHandle,
      stage: leadPipeline.stage,
      intentScore: leadPipeline.intentScore,
      nextAction: leadPipeline.nextAction,
      notes: leadPipeline.notes,
      commentText: engagementComments.commentText,
      commentId: leadPipeline.commentId,
      updatedAt: leadPipeline.updatedAt,
    })
    .from(leadPipeline)
    .leftJoin(brands, eq(brands.id, leadPipeline.brandId))
    .leftJoin(engagementComments, eq(engagementComments.id, leadPipeline.commentId))
    .where(
      activeStage
        ? and(eq(leadPipeline.workspaceId, workspaceId), eq(leadPipeline.stage, activeStage))
        : eq(leadPipeline.workspaceId, workspaceId),
    )
    .orderBy(desc(leadPipeline.intentScore), desc(leadPipeline.updatedAt));

  const hotLeads = await db
    .select({ id: leadPipeline.id })
    .from(leadPipeline)
    .where(and(eq(leadPipeline.workspaceId, workspaceId), gte(leadPipeline.intentScore, 70)));

  const pendingReplies = await db
    .select({ id: engagementComments.id })
    .from(engagementComments)
    .where(and(eq(engagementComments.workspaceId, workspaceId), eq(engagementComments.replyStatus, 'not_started')));

  const qualifiedLeads = await db
    .select({ id: leadPipeline.id })
    .from(leadPipeline)
    .where(and(eq(leadPipeline.workspaceId, workspaceId), eq(leadPipeline.stage, 'qualified')));

  const brandOptions = await db
    .select({ id: brands.id, name: brands.name, primaryCta: brands.primaryCta, defaultTone: brands.defaultTone })
    .from(brands)
    .where(eq(brands.workspaceId, workspaceId));

  return {
    comments,
    leads,
    brands: brandOptions,
    metrics: {
      commentsTotal: comments.length,
      pendingReplies: pendingReplies.length,
      hotLeads: hotLeads.length,
      qualifiedLeads: qualifiedLeads.length,
    },
  };
}
