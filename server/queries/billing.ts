import { getLiveUsageSnapshot } from '@/lib/usage/metering';

export async function getBillingSnapshot(workspaceId?: string) {
  return getLiveUsageSnapshot(workspaceId);
}
