import { and, count, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { getWorkspaceOperatorFlags } from '@/lib/ops/feature-flags';
import { approvalRequests, featureFlags, integrations, platformAccounts, posts, publishJobs, workspaceInvites, workspaceMemberships } from '../../../drizzle/schema';

export async function getSettingsSnapshot(workspaceId: string) {
  const [flags, supportRows, members, invites] = await Promise.all([
    getWorkspaceOperatorFlags(workspaceId),
    Promise.all([
      db.select({ count: count() }).from(posts).where(and(eq(posts.workspaceId, workspaceId), eq(posts.status, 'draft'))),
      db.select({ count: count() }).from(approvalRequests).where(and(eq(approvalRequests.workspaceId, workspaceId), eq(approvalRequests.status, 'pending'))),
      db.select({ count: count() }).from(publishJobs).innerJoin(posts, eq(posts.id, publishJobs.postId)).where(and(eq(posts.workspaceId, workspaceId), eq(publishJobs.status, 'queued'))),
      db.select({ count: count() }).from(publishJobs).innerJoin(posts, eq(posts.id, publishJobs.postId)).where(and(eq(posts.workspaceId, workspaceId), eq(publishJobs.status, 'retry_scheduled'))),
      db.select({ count: count() }).from(integrations).where(eq(integrations.workspaceId, workspaceId)),
      db.select({ count: count() }).from(platformAccounts).where(and(eq(platformAccounts.workspaceId, workspaceId), eq(platformAccounts.publishEnabled, true))),
      db.select({ count: count() }).from(workspaceMemberships).where(eq(workspaceMemberships.workspaceId, workspaceId)),
    ]),
    db.select({ id: workspaceMemberships.id, clerkUserId: workspaceMemberships.clerkUserId, role: workspaceMemberships.role, createdAt: workspaceMemberships.createdAt }).from(workspaceMemberships).where(eq(workspaceMemberships.workspaceId, workspaceId)).orderBy(desc(workspaceMemberships.createdAt)),
    db.select({ id: workspaceInvites.id, email: workspaceInvites.email, role: workspaceInvites.role, status: workspaceInvites.status, token: workspaceInvites.token, createdAt: workspaceInvites.createdAt }).from(workspaceInvites).where(eq(workspaceInvites.workspaceId, workspaceId)).orderBy(desc(workspaceInvites.createdAt)),
  ]);

  return {
    flags,
    supportSnapshot: {
      drafts: Number(supportRows[0][0]?.count ?? 0),
      pendingApprovals: Number(supportRows[1][0]?.count ?? 0),
      queuedJobs: Number(supportRows[2][0]?.count ?? 0),
      retryingJobs: Number(supportRows[3][0]?.count ?? 0),
      connectedIntegrations: Number(supportRows[4][0]?.count ?? 0),
      livePublishTargets: Number(supportRows[5][0]?.count ?? 0),
      workspaceMembers: Number(supportRows[6][0]?.count ?? 0),
    },
    members,
    invites,
  };
}
