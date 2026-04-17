import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { notificationPreferences } from '../../../drizzle/schema';

export type NotificationPreferenceRow = {
  channel: string;
  eventGroup: string;
  enabled: boolean;
  digest: string;
  target?: string | null;
};

const defaults: NotificationPreferenceRow[] = [
  { channel: 'in_app', eventGroup: 'publish_updates', enabled: true, digest: 'instant' },
  { channel: 'email', eventGroup: 'publish_updates', enabled: true, digest: 'instant', target: process.env.ALERT_EMAIL_TO ?? '' },
  { channel: 'email', eventGroup: 'daily_digest', enabled: true, digest: 'daily', target: process.env.ALERT_EMAIL_TO ?? '' },
];

export async function getNotificationPreferences(workspaceId?: string): Promise<NotificationPreferenceRow[]> {
  if (!workspaceId || !process.env.DATABASE_URL) return defaults;
  const rows = await db.select().from(notificationPreferences).where(eq(notificationPreferences.workspaceId, workspaceId)).catch(() => []);
  return rows.length
    ? rows.map((row) => ({
        channel: row.channel,
        eventGroup: row.eventGroup,
        enabled: row.enabled,
        digest: row.digest,
        target: row.target,
      }))
    : defaults;
}
