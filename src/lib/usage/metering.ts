import { and, count, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { integrations, platformAccounts, usageEvents, workspaces, workspaceMemberships } from '../../../drizzle/schema';
import type { PlatformKey } from '@/lib/platforms/types';
import { normalizePlanKey, type UsageSnapshot } from '@/lib/billing/plans';

export type UsageMetricKey = 'published_post' | 'storage_bytes' | 'channel_connected' | 'channel_reconnect_required';

export function getUsagePeriodKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export async function recordUsageEvent(input: {
  workspaceId: string;
  metricKey: UsageMetricKey;
  quantity?: number;
  metadata?: Record<string, unknown>;
  periodKey?: string;
  referenceId?: string;
}) {
  await db.insert(usageEvents).values({
    workspaceId: input.workspaceId,
    metricKey: input.metricKey,
    periodKey: input.periodKey ?? getUsagePeriodKey(),
    quantity: input.quantity ?? 1,
    referenceId: input.referenceId,
    metadata: input.metadata ?? {},
  });
}

export async function getLiveUsageSnapshot(workspaceId?: string): Promise<UsageSnapshot> {
  const periodKey = getUsagePeriodKey();
  const [{ plan } = { plan: 'growth' as const }] = workspaceId
    ? await db.select({ plan: workspaces.plan }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1)
    : [{ plan: 'growth' as const }];

  const [membersRow] = workspaceId
    ? await db.select({ total: count() }).from(workspaceMemberships).where(eq(workspaceMemberships.workspaceId, workspaceId))
    : [{ total: 7 } as { total: number }];

  const [postsRow] = workspaceId
    ? await db
        .select({ total: sql<number>`coalesce(sum(${usageEvents.quantity}), 0)` })
        .from(usageEvents)
        .where(and(eq(usageEvents.workspaceId, workspaceId), eq(usageEvents.metricKey, 'published_post'), eq(usageEvents.periodKey, periodKey)))
    : [{ total: 684 }];

  const [storageRow] = workspaceId
    ? await db
        .select({ totalBytes: sql<number>`coalesce(sum(${usageEvents.quantity}), 0)` })
        .from(usageEvents)
        .where(and(eq(usageEvents.workspaceId, workspaceId), eq(usageEvents.metricKey, 'storage_bytes'), eq(usageEvents.periodKey, periodKey)))
    : [{ totalBytes: 43 * 1024 * 1024 * 1024 }];

  const [channelsRow] = workspaceId
    ? await db.select({ total: count() }).from(platformAccounts).where(eq(platformAccounts.workspaceId, workspaceId))
    : [{ total: 6 }];

  return {
    plan: normalizePlanKey(plan),
    membersUsed: Number(membersRow?.total ?? 0),
    postsUsedThisMonth: Number(postsRow?.total ?? 0),
    storageUsedGb: Math.max(0, Math.round(Number(storageRow?.totalBytes ?? 0) / (1024 * 1024 * 1024))),
    channelsConnected: Number(channelsRow?.total ?? 0),
  };
}

export async function getReconnectNudges(workspaceId?: string) {
  if (!workspaceId) {
    return [
      {
        provider: 'linkedin' as PlatformKey,
        label: 'LinkedIn reconnect due soon',
        severity: 'warning' as const,
        description: 'Refresh token expires in 6 days. Ask the workspace owner to reconnect before scheduled posts are affected.',
        actionLabel: 'Reconnect LinkedIn',
        href: '/api/linkedin/connect',
      },
      {
        provider: 'instagram' as PlatformKey,
        label: 'Instagram page token needs attention',
        severity: 'critical' as const,
        description: 'A Business account lost publish rights after a page-role change. Publishing is paused until reconnection.',
        actionLabel: 'Reconnect Instagram',
        href: '/api/instagram/connect',
      },
    ];
  }

  const rows = await db
    .select({ provider: integrations.provider, expiresAt: integrations.refreshTokenExpiresAt, status: integrations.status })
    .from(integrations)
    .where(eq(integrations.workspaceId, workspaceId));

  const now = Date.now();
  return rows
    .filter((row) => row.status !== 'connected' || !row.expiresAt || row.expiresAt.getTime() - now < 1000 * 60 * 60 * 24 * 14)
    .map((row) => {
      const provider = row.provider as PlatformKey;
      const isExpired = !row.expiresAt || row.expiresAt.getTime() <= now;
      return {
        provider,
        label: `${provider[0].toUpperCase()}${provider.slice(1)} ${isExpired ? 'reconnect required' : 'reconnect due soon'}`,
        severity: isExpired || row.status !== 'connected' ? ('critical' as const) : ('warning' as const),
        description: isExpired
          ? `Repurly no longer has a valid ${provider} refresh window. Reconnect now to resume publishing.`
          : `${provider} authorization expires on ${row.expiresAt?.toLocaleDateString()}. Reconnect early to avoid missed scheduled posts.`,
        actionLabel: `Reconnect ${provider[0].toUpperCase()}${provider.slice(1)}`,
        href: `/api/${provider}/connect`,
      };
    });
}
