import { and, count, eq, gte } from 'drizzle-orm';

import { PLAN_LIMITS, normalizePlanKey, type PlanKey } from '@/lib/billing/plans';
import { db } from '@/lib/db/client';
import { brands, platformAccounts, posts, workspaceMemberships, workspaces } from '../../../drizzle/schema';

export type EnforcedLimit = 'workspaceMembers' | 'brands' | 'monthlyPosts' | 'connectedChannels';

export type PlanLimitCheck = {
  allowed: boolean;
  metric: EnforcedLimit;
  plan: PlanKey;
  used: number;
  requested: number;
  limit: number;
  remaining: number;
};

function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

async function getWorkspacePlan(workspaceId: string): Promise<PlanKey> {
  const rows = await db
    .select({ plan: workspaces.plan })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  return normalizePlanKey(rows[0]?.plan);
}

async function countRowsForMetric(workspaceId: string, metric: EnforcedLimit) {
  switch (metric) {
    case 'workspaceMembers': {
      const rows = await db
        .select({ value: count() })
        .from(workspaceMemberships)
        .where(eq(workspaceMemberships.workspaceId, workspaceId));
      return Number(rows[0]?.value ?? 0);
    }
    case 'brands': {
      const rows = await db
        .select({ value: count() })
        .from(brands)
        .where(and(eq(brands.workspaceId, workspaceId), eq(brands.status, 'active')));
      return Number(rows[0]?.value ?? 0);
    }
    case 'monthlyPosts': {
      const rows = await db
        .select({ value: count() })
        .from(posts)
        .where(and(eq(posts.workspaceId, workspaceId), gte(posts.createdAt, monthStart())));
      return Number(rows[0]?.value ?? 0);
    }
    case 'connectedChannels': {
      const rows = await db
        .select({ value: count() })
        .from(platformAccounts)
        .where(and(eq(platformAccounts.workspaceId, workspaceId), eq(platformAccounts.publishEnabled, true)));
      return Number(rows[0]?.value ?? 0);
    }
    default:
      return 0;
  }
}

export async function checkPlanLimit(
  workspaceId: string,
  metric: EnforcedLimit,
  requested = 1,
): Promise<PlanLimitCheck> {
  const plan = await getWorkspacePlan(workspaceId);
  const limit = PLAN_LIMITS[plan][metric];
  const numericLimit = typeof limit === 'number' ? limit : 0;
  const used = await countRowsForMetric(workspaceId, metric);
  const remaining = Math.max(0, numericLimit - used);

  return {
    allowed: used + requested <= numericLimit,
    metric,
    plan,
    used,
    requested,
    limit: numericLimit,
    remaining,
  };
}

export async function assertPlanLimit(workspaceId: string, metric: EnforcedLimit, requested = 1) {
  const result = await checkPlanLimit(workspaceId, metric, requested);

  if (!result.allowed) {
    throw new Error(`PLAN_LIMIT_EXCEEDED:${metric}:${result.plan}:${result.used}/${result.limit}`);
  }

  return result;
}
