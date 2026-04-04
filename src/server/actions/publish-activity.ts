'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { postTargets, posts, publishJobs } from '../../../drizzle/schema';

async function safeRevalidate(publishJobId?: string) {
  revalidatePath('/app/activity');
  revalidatePath('/app/calendar');
  revalidatePath('/app/content');
  revalidatePath('/app');
  if (publishJobId) {
    revalidatePath(`/app/activity/${publishJobId}`);
  }
}

export async function retryPublishJob(formData: FormData) {
  const publishJobId = String(formData.get('publishJobId') || '');
  if (!publishJobId || !process.env.DATABASE_URL) {
    await safeRevalidate();
    return;
  }

  await db
    .update(publishJobs)
    .set({
      status: 'queued',
      lastError: null,
      scheduledFor: new Date(),
      completedAt: null,
    })
    .where(eq(publishJobs.id, publishJobId));

  await safeRevalidate(publishJobId);
}

export async function requeuePostTarget(formData: FormData) {
  const postTargetId = String(formData.get('postTargetId') || '');
  const publishJobId = String(formData.get('publishJobId') || '');
  if ((!postTargetId && !publishJobId) || !process.env.DATABASE_URL) {
    await safeRevalidate();
    return;
  }

  if (postTargetId) {
    await db
      .update(postTargets)
      .set({
        platformStatus: 'queued',
        result: {
          summary: 'Requeued from activity screen',
          userMessage: 'Repurly moved this target back into the publish queue.',
          retryable: true,
        },
        updatedAt: new Date(),
      })
      .where(eq(postTargets.id, postTargetId));
  }

  if (publishJobId) {
    await db
      .update(publishJobs)
      .set({
        status: 'queued',
        lastError: null,
        scheduledFor: new Date(),
        completedAt: null,
      })
      .where(eq(publishJobs.id, publishJobId));
  }

  await safeRevalidate(publishJobId || undefined);
}


export async function deletePostFromActivity(formData: FormData) {
  const postId = String(formData.get('postId') || '');
  const publishJobId = String(formData.get('publishJobId') || '');

  if (!postId || !process.env.DATABASE_URL) {
    await safeRevalidate(publishJobId || undefined);
    return;
  }

  await db.delete(posts).where(eq(posts.id, postId));
  await safeRevalidate(publishJobId || undefined);
}
