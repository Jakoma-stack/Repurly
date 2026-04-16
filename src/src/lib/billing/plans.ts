export type PlanKey = 'core' | 'growth' | 'scale';

export type PlanLimits = {
  workspaceMembers: number;
  brands: number;
  monthlyPosts: number;
  storageGb: number;
  connectedChannels: number;
  approvalFlows: boolean;
  prioritySupport: boolean;
};

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  core: {
    workspaceMembers: 2,
    brands: 1,
    monthlyPosts: 120,
    storageGb: 10,
    connectedChannels: 3,
    approvalFlows: false,
    prioritySupport: false,
  },
  growth: {
    workspaceMembers: 5,
    brands: 3,
    monthlyPosts: 1000,
    storageGb: 100,
    connectedChannels: 10,
    approvalFlows: true,
    prioritySupport: false,
  },
  scale: {
    workspaceMembers: 15,
    brands: 10,
    monthlyPosts: 10000,
    storageGb: 500,
    connectedChannels: 30,
    approvalFlows: true,
    prioritySupport: true,
  },
};

export type UsageSnapshot = {
  plan: PlanKey;
  membersUsed: number;
  brandsUsed?: number;
  postsUsedThisMonth: number;
  storageUsedGb: number;
  channelsConnected: number;
};

export function getPlanLimits(plan: PlanKey): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function buildUsageRows(snapshot: UsageSnapshot) {
  const limits = getPlanLimits(snapshot.plan);

  return [
    { key: 'Workspace members', used: snapshot.membersUsed, limit: limits.workspaceMembers, unit: 'seats' },
    { key: 'Brands', used: snapshot.brandsUsed ?? 0, limit: limits.brands, unit: 'brands' },
    { key: 'Posts this month', used: snapshot.postsUsedThisMonth, limit: limits.monthlyPosts, unit: 'posts' },
    { key: 'Storage', used: snapshot.storageUsedGb, limit: limits.storageGb, unit: 'GB' },
    { key: 'Connected channels', used: snapshot.channelsConnected, limit: limits.connectedChannels, unit: 'channels' },
  ].map((row) => {
    const ratio = row.limit > 0 ? row.used / row.limit : 0;

    return {
      ...row,
      percent: Math.min(100, Math.round(ratio * 100)),
      state: ratio >= 1 ? 'limit_reached' : ratio >= 0.8 ? 'warning' : 'healthy',
    };
  });
}

export function canConsume(plan: PlanKey, feature: keyof PlanLimits, currentValue: number) {
  const limit = PLAN_LIMITS[plan][feature];

  if (typeof limit !== 'number') {
    return Boolean(limit);
  }

  return currentValue < limit;
}
