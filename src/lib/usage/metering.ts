import { and, count, eq, gte, lt, sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { integrations, platformAccounts, usageEvents, workspaces, workspaceMemberships } from '../../../drizzle/schema';
import type { PlatformKey } from '@/lib/platforms/types';
import type { UsageSnapshot } from '@/lib/billing/plans';

export type UsageMetricKey = 'published_post' | 'storage_bytes' | 'channel_connected' | 'channel_reconnect_required';

export function getUsagePeriodKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function getPeriodBounds(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { start, end };
}

export async function recordUsageEvent(input: {
  workspaceId: string;
  metricKey: UsageMetricKey;
  quantity?: number;
  metadata?: Record<string, unknown>;
  periodKey?: string;
}) {
  await db.insert(usageEvents).values({
    workspaceId: input.workspaceId,
    metric: input.metricKey,
    quantity: input.quantity ?? 1,
    metadata: {
      ...(input.metadata ?? {}),
      periodKey: input.periodKey ?? getUsagePeriodKey(),
    },
  });
}

export async function getLiveUsageSnapshot(workspaceId?: string): Promise<UsageSnapshot> {
  if (!workspaceId || !process.env.DATABASE_URL) {
    return {
      plan: 'core',
      membersUsed: 0,
      postsUsedThisMonth: 0,
      storageUsedGb: 0,
      channelsConnected: 0,
    };
  }

  const { start, end } = getPeriodBounds();
  const [{ plan } = { plan: 'core' as const }] = await db.select({ plan: workspaces.plan }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);

  const [membersRow] = await db.select({ total: count() }).from(workspaceMemberships).where(eq(workspaceMemberships.workspaceId, workspaceId));

  const [postsRow] = await db
    .select({ total: sql<number>`coalesce(sum(${usageEvents.quantity}), 0)` })
    .from(usageEvents)
    .where(and(eq(usageEvents.workspaceId, workspaceId), eq(usageEvents.metric, 'published_post'), gte(usageEvents.createdAt, start), lt(usageEvents.createdAt, end)));

  const [storageRow] = await db
    .select({ totalBytes: sql<number>`coalesce(sum(${usageEvents.quantity}), 0)` })
    .from(usageEvents)
    .where(and(eq(usageEvents.workspaceId, workspaceId), eq(usageEvents.metric, 'storage_bytes'), gte(usageEvents.createdAt, start), lt(usageEvents.createdAt, end)));

  const [channelsRow] = await db.select({ total: count() }).from(platformAccounts).where(eq(platformAccounts.workspaceId, workspaceId));

  return {
    plan: (plan as UsageSnapshot['plan']) ?? 'core',
    membersUsed: Number(membersRow?.total ?? 0),
    postsUsedThisMonth: Number(postsRow?.total ?? 0),
    storageUsedGb: Math.max(0, Math.round(Number(storageRow?.totalBytes ?? 0) / (1024 * 1024 * 1024))),
    channelsConnected: Number(channelsRow?.total ?? 0),
  };
}

function buildReconnectHref(provider: PlatformKey, workspaceId?: string) {
  const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
  return `/api/${provider}/connect${query}`;
}

export async function getReconnectNudges(workspaceId?: string) {
  if (!workspaceId || !process.env.DATABASE_URL) {
    return [];
  }

  const rows = await db
    .select({ provider: integrations.provider, expiresAt: integrations.refreshTokenExpiresAt, status: integrations.status })
    .from(integrations)
    .where(eq(integrations.workspaceId, workspaceId));

  const now = Date.now();
  const warningWindowMs = 1000 * 60 * 60 * 24 * 14;

  return rows
    .filter((row) => {
      if (row.status !== 'connected') return true;
      if (!row.expiresAt) return false;
      return row.expiresAt.getTime() - now < warningWindowMs;
    })
    .map((row) => {
      const provider = row.provider as PlatformKey;
      const isStatusIssue = row.status !== 'connected';
      const isExpired = Boolean(row.expiresAt && row.expiresAt.getTime() <= now);
      const severity = isStatusIssue || isExpired ? ('critical' as const) : ('warning' as const);
      const label = `${provider[0].toUpperCase()}${provider.slice(1)} ${severity === 'critical' ? 'reconnect required' : 'reconnect due soon'}`;
      const description = isStatusIssue
        ? `Repurly marked ${provider} as disconnected for this workspace. Reconnect now before queued posts miss their publish window.`
        : isExpired
          ? `Repurly can see that ${provider} authorization expired. Reconnect now to resume publishing.`
          : `${provider} authorization expires on ${row.expiresAt?.toLocaleDateString()}. Reconnect early to avoid missed scheduled posts.`;

      return {
        provider,
        label,
        severity,
        description,
        actionLabel: `Reconnect ${provider[0].toUpperCase()}${provider.slice(1)}`,
        href: buildReconnectHref(provider, workspaceId),
      };
    });
}
