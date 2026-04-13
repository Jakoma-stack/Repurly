import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { featureFlags } from '../../../drizzle/schema';

export const OPERATOR_FLAG_KEYS = [
  'pause_publishing',
  'advanced_ai_planner',
  'social_listening_automation',
  'facebook_channel_visibility',
  'auto_calendar_placement',
] as const;

export type OperatorFlagKey = (typeof OPERATOR_FLAG_KEYS)[number];

export async function getWorkspaceOperatorFlags(workspaceId: string) {
  const rows = await db
    .select({ key: featureFlags.key, enabled: featureFlags.enabled })
    .from(featureFlags)
    .where(eq(featureFlags.workspaceId, workspaceId));

  const current = new Map(rows.map((row) => [row.key, row.enabled]));

  return Object.fromEntries(OPERATOR_FLAG_KEYS.map((key) => [key, Boolean(current.get(key))])) as Record<OperatorFlagKey, boolean>;
}

export async function isFlagEnabled(workspaceId: string, key: OperatorFlagKey) {
  const rows = await db
    .select({ enabled: featureFlags.enabled })
    .from(featureFlags)
    .where(and(eq(featureFlags.workspaceId, workspaceId), eq(featureFlags.key, key)))
    .limit(1);

  return Boolean(rows[0]?.enabled);
}

export async function setWorkspaceOperatorFlag(workspaceId: string, key: OperatorFlagKey, enabled: boolean) {
  const existing = await db
    .select({ id: featureFlags.id })
    .from(featureFlags)
    .where(and(eq(featureFlags.workspaceId, workspaceId), eq(featureFlags.key, key)))
    .limit(1);

  if (existing[0]?.id) {
    await db.update(featureFlags).set({ enabled }).where(eq(featureFlags.id, existing[0].id));
    return;
  }

  await db.insert(featureFlags).values({ workspaceId, key, enabled });
}
