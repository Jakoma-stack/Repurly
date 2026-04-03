'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, desc, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { approvalRequests, brands, platformAccounts, postTargets, posts, publishJobs } from '../../../drizzle/schema';

async function getDefaultBrandId(workspaceId: string) {
  const row = await db
    .select({ id: brands.id })
    .from(brands)
    .where(eq(brands.workspaceId, workspaceId))
    .limit(1);

  return row[0]?.id;
}

async function getTargetForWorkspace(workspaceId: string, targetId: string) {
  if (!targetId) return null;

  const row = await db
    .select({
      id: platformAccounts.id,
      provider: platformAccounts.provider,
      targetType: platformAccounts.targetType,
    })
    .from(platformAccounts)
    .where(and(eq(platformAccounts.id, targetId), eq(platformAccounts.workspaceId, workspaceId)))
    .limit(1);

  return row[0] ?? null;
}

function requiredString(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

async function createOrUpdateBasePost(formData: FormData, status: 'draft' | 'in_review' | 'scheduled') {
  const workspaceId = requiredString(formData, 'workspaceId');
  const authorId = requiredString(formData, 'authorId');
  const postId = requiredString(formData, 'postId');
  const title = requiredString(formData, 'title');
  const body = requiredString(formData, 'body');
  const scheduledForRaw = requiredString(formData, 'scheduledFor');

  if (!process.env.DATABASE_URL || !workspaceId || !authorId || !title || !body) {
    return { error: 'invalid' as const, post: null };
  }

  const scheduledFor = scheduledForRaw ? new Date(scheduledForRaw) : null;

  if (postId) {
    const updated = await db
      .update(posts)
      .set({
        authorId,
        title,
        body,
        status,
        scheduledFor,
      })
      .where(and(eq(posts.id, postId), eq(posts.workspaceId, workspaceId)))
      .returning({
        id: posts.id,
        workspaceId: posts.workspaceId,
        scheduledFor: posts.scheduledFor,
      });

    if (updated[0]) {
      return { error: null, post: updated[0] };
    }
  }

  const brandId = await getDefaultBrandId(workspaceId);
  if (!brandId) {
    return { error: 'missing-brand' as const, post: null };
  }

  const inserted = await db
    .insert(posts)
    .values({
      workspaceId,
      brandId,
      authorId,
      title,
      body,
      status,
      scheduledFor,
    })
    .returning({
      id: posts.id,
      workspaceId: posts.workspaceId,
      scheduledFor: posts.scheduledFor,
    });

  return { error: null, post: inserted[0] ?? null };
}

async function attachTarget(postId: string, workspaceId: string, formData: FormData) {
  const targetId = requiredString(formData, 'targetId');
  const target = await getTargetForWorkspace(workspaceId, targetId);

  if (!target) return null;

  const existing = await db
    .select({ id: postTargets.id })
    .from(postTargets)
    .where(eq(postTargets.postId, postId))
    .limit(1);

  if (existing[0]?.id) {
    const updated = await db
      .update(postTargets)
      .set({
        platformAccountId: target.id,
        provider: target.provider,
        targetType: target.targetType,
        platformStatus: 'queued',
      })
      .where(eq(postTargets.id, existing[0].id))
      .returning({
        id: postTargets.id,
        provider: postTargets.provider,
        targetType: postTargets.targetType,
      });

    return updated[0] ?? null;
  }

  const inserted = await db
    .insert(postTargets)
    .values({
      postId,
      platformAccountId: target.id,
      provider: target.provider,
      targetType: target.targetType,
      platformStatus: 'queued',
    })
    .returning({
      id: postTargets.id,
      provider: postTargets.provider,
      targetType: postTargets.targetType,
    });

  return inserted[0] ?? null;
}

async function upsertQueuedPublishJob(postId: string, postTargetId: string, scheduledFor: Date) {
  const existingQueued = await db
    .select({
      id: publishJobs.id,
    })
    .from(publishJobs)
    .where(and(eq(publishJobs.postId, postId), eq(publishJobs.postTargetId, postTargetId), eq(publishJobs.status, 'queued')))
    .orderBy(desc(publishJobs.scheduledFor))
    .limit(1);

  if (existingQueued[0]?.id) {
    await db
      .update(publishJobs)
      .set({
        scheduledFor,
      })
      .where(eq(publishJobs.id, existingQueued[0].id));

    return existingQueued[0].id;
  }

  const inserted = await db
    .insert(publishJobs)
    .values({
      postId,
      postTargetId,
      status: 'queued',
      scheduledFor,
    })
    .returning({ id: publishJobs.id });

  return inserted[0]?.id ?? null;
}

async function refreshWorkflowPages() {
  revalidatePath('/app');
  revalidatePath('/app/content');
  revalidatePath('/app/calendar');
  revalidatePath('/app/activity');
}

export async function saveDraft(formData: FormData) {
  const { error, post } = await createOrUpdateBasePost(formData, 'draft');
  if (error || !post) {
    redirect(`/app/content?error=${error ?? 'invalid'}`);
  }

  await attachTarget(post.id, post.workspaceId, formData);
  await refreshWorkflowPages();
  redirect(`/app/content?ok=draft&postId=${post.id}`);
}

export async function requestApproval(formData: FormData) {
  const { error, post } = await createOrUpdateBasePost(formData, 'in_review');
  if (error || !post) {
    redirect(`/app/content?error=${error ?? 'invalid'}`);
  }

  const target = await attachTarget(post.id, post.workspaceId, formData);
  if (!target) {
    redirect(`/app/content?error=missing-target&postId=${post.id}`);
  }

  const existingApproval = await db
    .select({ id: approvalRequests.id })
    .from(approvalRequests)
    .where(and(eq(approvalRequests.postId, post.id), eq(approvalRequests.workspaceId, post.workspaceId)))
    .limit(1);

  if (existingApproval[0]?.id) {
    await db
      .update(approvalRequests)
      .set({
        requestedById: requiredString(formData, 'authorId'),
        status: 'pending',
        note: requiredString(formData, 'approvalOwner') || null,
      })
      .where(eq(approvalRequests.id, existingApproval[0].id));
  } else {
    await db.insert(approvalRequests).values({
      workspaceId: post.workspaceId,
      postId: post.id,
      requestedById: requiredString(formData, 'authorId'),
      status: 'pending',
      note: requiredString(formData, 'approvalOwner') || null,
    });
  }

  await refreshWorkflowPages();
  redirect(`/app/content?ok=approval&postId=${post.id}`);
}

export async function schedulePost(formData: FormData) {
  const scheduledFor = requiredString(formData, 'scheduledFor');
  if (!scheduledFor) {
    const postId = requiredString(formData, 'postId');
    redirect(`/app/content?error=missing-schedule${postId ? `&postId=${postId}` : ''}`);
  }

  const { error, post } = await createOrUpdateBasePost(formData, 'scheduled');
  if (error || !post) {
    redirect(`/app/content?error=${error ?? 'invalid'}`);
  }

  const target = await attachTarget(post.id, post.workspaceId, formData);
  if (!target) {
    redirect(`/app/content?error=missing-target&postId=${post.id}`);
  }

  await upsertQueuedPublishJob(post.id, target.id, post.scheduledFor ?? new Date());

  await refreshWorkflowPages();
  redirect(`/app/content?ok=scheduled&postId=${post.id}`);
}
