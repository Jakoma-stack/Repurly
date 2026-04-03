'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db/client';
import { notificationPreferences } from '../../../drizzle/schema';

export async function saveNotificationPreference(formData: FormData) {
  const workspaceId = String(formData.get('workspaceId') ?? '');
  const channel = String(formData.get('channel') ?? '');
  const eventGroup = String(formData.get('eventGroup') ?? '');
  const enabled = String(formData.get('enabled') ?? 'true') === 'true';
  const digest = String(formData.get('digest') ?? 'instant');
  const target = String(formData.get('target') ?? '');

  if (!process.env.DATABASE_URL || !workspaceId || !channel || !eventGroup) {
    revalidatePath('/app/settings/notifications');
    return;
  }

  const existing = await db
    .select({ id: notificationPreferences.id })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.workspaceId, workspaceId),
        eq(notificationPreferences.channel, channel),
        eq(notificationPreferences.eventGroup, eventGroup),
      ),
    )
    .limit(1)
    .catch(() => []);

  if (existing[0]?.id) {
    await db
      .update(notificationPreferences)
      .set({ enabled, digest, target: target || null, updatedAt: new Date() })
      .where(eq(notificationPreferences.id, existing[0].id))
      .catch(() => undefined);
  } else {
    await db
      .insert(notificationPreferences)
      .values({ workspaceId, channel, eventGroup, enabled, digest, target: target || null })
      .catch(() => undefined);
  }

  revalidatePath('/app/settings/notifications');
  revalidatePath('/app/notifications');
}
