import { and, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { getReconnectNudges } from '@/lib/usage/metering';
import { alertEvents, deliveryLogs, integrations, notificationDeliveries } from '../../../drizzle/schema';

export type WorkspaceNotification = {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  source: string;
  createdAt: string;
  actionableLabel?: string;
  actionableHref?: string;
  correlationId?: string;
  deliveryState?: string;
  channel?: string;
  channelStatus?: string;
};

export async function getWorkspaceNotifications(workspaceId?: string): Promise<WorkspaceNotification[]> {
  if (!workspaceId || !process.env.DATABASE_URL) {
    return [];
  }

  const [alerts, nudges, unhealthyIntegrations, recentDeliveryLogs, notificationRows] = await Promise.all([
    db
      .select()
      .from(alertEvents)
      .where(and(eq(alertEvents.workspaceId, workspaceId), isNull(alertEvents.acknowledgedAt)))
      .orderBy(desc(alertEvents.createdAt))
      .limit(20)
      .catch(() => []),
    getReconnectNudges(workspaceId),
    db
      .select({ provider: integrations.provider, status: integrations.status, updatedAt: integrations.updatedAt })
      .from(integrations)
      .where(eq(integrations.workspaceId, workspaceId))
      .catch(() => []),
    db
      .select()
      .from(deliveryLogs)
      .where(eq(deliveryLogs.workspaceId, workspaceId))
      .orderBy(desc(deliveryLogs.createdAt))
      .limit(12)
      .catch(() => []),
    db
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.workspaceId, workspaceId))
      .orderBy(desc(notificationDeliveries.createdAt))
      .limit(20)
      .catch(() => []),
  ]);

  const deliveryByLog = new Map<string, { channel?: string | null; status?: string | null }>(
    notificationRows
      .filter((row) => row.deliveryLogId)
      .map((row) => [row.deliveryLogId as string, { channel: row.channel, status: row.status }]),
  );

  const fromAlerts = alerts.map((item) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    severity: item.severity as WorkspaceNotification['severity'],
    source: item.source,
    createdAt: item.createdAt.toISOString(),
    actionableLabel: typeof item.metadata?.actionLabel === 'string' ? item.metadata.actionLabel : undefined,
    actionableHref: typeof item.metadata?.actionHref === 'string' ? item.metadata.actionHref : undefined,
  }));

  const fromNudges = nudges.map((item, idx) => ({
    id: `nudge-${idx}-${item.provider}`,
    title: item.label,
    body: item.description,
    severity: item.severity,
    source: 'reconnect',
    createdAt: new Date().toISOString(),
    actionableLabel: item.actionLabel,
    actionableHref: item.href,
    channel: 'in_app',
    channelStatus: 'sent',
  }));

  const fromIntegrations = unhealthyIntegrations
    .filter((item) => item.status !== 'connected')
    .map((item, idx) => ({
      id: `integration-${idx}-${item.provider}`,
      title: `${item.provider[0].toUpperCase()}${item.provider.slice(1)} connection needs review`,
      body: `The ${item.provider} connection is currently marked ${item.status}. Open Channels to reconnect or verify permissions.`,
      severity: 'warning' as const,
      source: 'integrations',
      createdAt: item.updatedAt.toISOString(),
      actionableLabel: `Open ${item.provider}`,
      actionableHref: '/app/channels',
      channel: 'in_app',
      channelStatus: 'sent',
    }));

  const fromDeliveryLogs = recentDeliveryLogs.map((item) => {
    const linkedDelivery = deliveryByLog.get(item.id);
    return {
      id: `delivery-${item.id}`,
      title: `${item.provider[0].toUpperCase()}${item.provider.slice(1)} delivery signal`,
      body: item.message,
      severity: item.level === 'error' ? ('critical' as const) : item.level === 'warning' ? ('warning' as const) : ('info' as const),
      source: 'delivery_logs',
      createdAt: item.createdAt.toISOString(),
      actionableLabel: item.publishJobId ? 'Open job detail' : 'Open activity',
      actionableHref: item.publishJobId ? `/app/activity/${item.publishJobId}` : '/app/activity',
      correlationId: item.correlationId ?? undefined,
      deliveryState: item.providerStatus ?? undefined,
      channel: linkedDelivery?.channel,
      channelStatus: linkedDelivery?.status,
    };
  });

  return [...fromDeliveryLogs, ...fromNudges, ...fromAlerts, ...fromIntegrations]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 30);
}
