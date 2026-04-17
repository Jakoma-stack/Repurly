import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { notificationDeliveries, notificationPreferences, workspaces } from '../../../drizzle/schema';
import { getResendClient } from '@/lib/email/client';
import { ProviderOutcomeEmail } from '@/emails/provider-outcome-email';

export async function createNotificationDeliveries(input: {
  workspaceId: string;
  publishJobId?: string | null;
  deliveryLogId?: string | null;
  eventGroup: string;
  title: string;
  message: string;
  actionHref: string;
}) {
  if (!process.env.DATABASE_URL) return [] as string[];

  const preferences = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.workspaceId, input.workspaceId))
    .catch(() => []);

  const effective = preferences.length
    ? preferences.filter((item) => item.enabled && (item.eventGroup === input.eventGroup || item.eventGroup === 'all'))
    : [
        { channel: 'in_app', eventGroup: input.eventGroup, enabled: true, digest: 'instant', target: null },
        { channel: 'email', eventGroup: input.eventGroup, enabled: true, digest: 'instant', target: process.env.ALERT_EMAIL_TO ?? null },
      ];

  const workspaceRows = await db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.id, input.workspaceId)).limit(1).catch(() => []);
  const workspaceName = workspaceRows[0]?.name ?? 'Repurly';

  const insertedIds: string[] = [];

  for (const pref of effective) {
    const shouldSendNow = pref.digest === 'instant' || pref.channel === 'in_app';
    const row = await db.insert(notificationDeliveries).values({
      workspaceId: input.workspaceId,
      publishJobId: input.publishJobId ?? null,
      deliveryLogId: input.deliveryLogId ?? null,
      channel: pref.channel,
      eventGroup: input.eventGroup,
      destination: pref.target ?? null,
      status: shouldSendNow ? 'sent' : 'queued_digest',
      subject: input.title,
      message: input.message,
      metadata: { actionHref: input.actionHref, digest: pref.digest },
      sentAt: shouldSendNow ? new Date() : null,
    }).returning({ id: notificationDeliveries.id }).catch(() => []);

    if (row[0]?.id) insertedIds.push(row[0].id);

    if (shouldSendNow && pref.channel === 'email' && pref.target && process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
      await getResendClient().emails.send({
        from: process.env.EMAIL_FROM,
        to: pref.target,
        subject: input.title,
        react: ProviderOutcomeEmail({ workspaceName, title: input.title, message: input.message, actionHref: input.actionHref }),
      }).catch(() => undefined);
    }
  }

  return insertedIds;
}
