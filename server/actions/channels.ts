'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { platformAccounts } from '../../../drizzle/schema';

function requiredString(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

async function refreshChannelPages() {
  revalidatePath('/app');
  revalidatePath('/app/channels');
  revalidatePath('/app/settings');
  revalidatePath('/app/content');
}

export async function setDefaultLinkedInTarget(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const platformAccountId = requiredString(formData, 'platformAccountId');
  const continueTo = requiredString(formData, 'continueTo');

  if (!workspaceId || !platformAccountId || !process.env.DATABASE_URL) {
    redirect('/app/channels?error=invalid-target#linkedin-onboarding' as Route);
  }

  const targetRows = await db
    .select({ id: platformAccounts.id })
    .from(platformAccounts)
    .where(
      and(
        eq(platformAccounts.id, platformAccountId),
        eq(platformAccounts.workspaceId, workspaceId),
        eq(platformAccounts.provider, 'linkedin'),
        eq(platformAccounts.publishEnabled, true),
      ),
    )
    .limit(1);

  const target = targetRows[0];
  if (!target) {
    redirect('/app/channels?error=invalid-target#linkedin-onboarding' as Route);
  }

  await db
    .update(platformAccounts)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(and(eq(platformAccounts.workspaceId, workspaceId), eq(platformAccounts.provider, 'linkedin')));

  await db
    .update(platformAccounts)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(platformAccounts.id, target.id));

  await refreshChannelPages();

  if (continueTo === 'composer') {
    redirect('/app/content#target-selection' as Route);
  }

  redirect('/app/channels?linkedin=connected&setup=target-confirmed#linkedin-onboarding' as Route);
}
