import { and, count, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { approvalRequests, engagementComments, integrations, leadPipeline, platformAccounts, posts, publishJobs } from '../../../drizzle/schema';

export async function getOperationalReport(workspaceId: string) {
  const [postSummary, publishSummary, approvalSummary, engagementSummary, integrationSummary, recentFailures] = await Promise.all([
    db.select({
      drafts: sql<number>`count(*) filter (where ${posts.status} = 'draft')`,
      inReview: sql<number>`count(*) filter (where ${posts.status} = 'in_review')`,
      scheduled: sql<number>`count(*) filter (where ${posts.status} = 'scheduled')`,
      published: sql<number>`count(*) filter (where ${posts.status} = 'published')`,
      failed: sql<number>`count(*) filter (where ${posts.status} = 'failed')`,
    }).from(posts).where(eq(posts.workspaceId, workspaceId)),
    db.select({
      queued: sql<number>`count(*) filter (where ${publishJobs.status} = 'queued')`,
      retrying: sql<number>`count(*) filter (where ${publishJobs.status} = 'retry_scheduled')`,
      completed: sql<number>`count(*) filter (where ${publishJobs.status} = 'completed')`,
      failed: sql<number>`count(*) filter (where ${publishJobs.status} = 'failed')`,
    }).from(publishJobs).innerJoin(posts, eq(posts.id, publishJobs.postId)).where(eq(posts.workspaceId, workspaceId)),
    db.select({ pending: count() }).from(approvalRequests).where(and(eq(approvalRequests.workspaceId, workspaceId), eq(approvalRequests.status, 'pending'))),
    Promise.all([
      db.select({ comments: count() }).from(engagementComments).where(eq(engagementComments.workspaceId, workspaceId)),
      db.select({ hotLeads: count() }).from(leadPipeline).where(and(eq(leadPipeline.workspaceId, workspaceId), sql`${leadPipeline.intentScore} >= 70`)),
      db.select({ qualified: count() }).from(leadPipeline).where(and(eq(leadPipeline.workspaceId, workspaceId), eq(leadPipeline.stage, 'qualified'))),
    ]),
    Promise.all([
      db.select({ connectedIntegrations: count() }).from(integrations).where(eq(integrations.workspaceId, workspaceId)),
      db.select({ liveTargets: count() }).from(platformAccounts).where(and(eq(platformAccounts.workspaceId, workspaceId), eq(platformAccounts.publishEnabled, true))),
      db.select({ companyPages: count() }).from(platformAccounts).where(and(eq(platformAccounts.workspaceId, workspaceId), eq(platformAccounts.provider, 'linkedin'), eq(platformAccounts.targetType, 'organization'))),
    ]),
    db.select({ id: publishJobs.id, status: publishJobs.status, lastError: publishJobs.lastError, title: posts.title, scheduledFor: publishJobs.scheduledFor })
      .from(publishJobs)
      .innerJoin(posts, eq(posts.id, publishJobs.postId))
      .where(and(eq(posts.workspaceId, workspaceId), eq(publishJobs.status, 'failed')))
      .orderBy(desc(publishJobs.scheduledFor))
      .limit(8),
  ]);

  return {
    posts: {
      drafts: Number(postSummary[0]?.drafts ?? 0),
      inReview: Number(postSummary[0]?.inReview ?? 0),
      scheduled: Number(postSummary[0]?.scheduled ?? 0),
      published: Number(postSummary[0]?.published ?? 0),
      failed: Number(postSummary[0]?.failed ?? 0),
    },
    publishing: {
      queued: Number(publishSummary[0]?.queued ?? 0),
      retrying: Number(publishSummary[0]?.retrying ?? 0),
      completed: Number(publishSummary[0]?.completed ?? 0),
      failed: Number(publishSummary[0]?.failed ?? 0),
    },
    approvals: { pending: Number(approvalSummary[0]?.pending ?? 0) },
    engagement: {
      comments: Number(engagementSummary[0][0]?.comments ?? 0),
      hotLeads: Number(engagementSummary[1][0]?.hotLeads ?? 0),
      qualified: Number(engagementSummary[2][0]?.qualified ?? 0),
    },
    estate: {
      connectedIntegrations: Number(integrationSummary[0][0]?.connectedIntegrations ?? 0),
      liveTargets: Number(integrationSummary[1][0]?.liveTargets ?? 0),
      companyPages: Number(integrationSummary[2][0]?.companyPages ?? 0),
    },
    recentFailures,
  };
}
