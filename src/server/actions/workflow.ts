'use server';

import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { and, desc, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { generateContentDrafts } from '@/lib/ai/content';
import { approvalRequests, brands, platformAccounts, postTargets, posts, publishJobs } from '../../../drizzle/schema';

async function getDefaultBrandId(workspaceId: string) {
  const row = await db
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.workspaceId, workspaceId), eq(brands.status, 'active')))
    .limit(1);

  return row[0]?.id;
}

async function getBrand(workspaceId: string, brandId: string) {
  const row = await db
    .select({
      id: brands.id,
      name: brands.name,
      defaultTone: brands.defaultTone,
      audience: brands.audience,
      primaryCta: brands.primaryCta,
      secondaryCta: brands.secondaryCta,
      hashtags: brands.hashtags,
    })
    .from(brands)
    .where(and(eq(brands.workspaceId, workspaceId), eq(brands.id, brandId)))
    .limit(1);

  return row[0] ?? null;
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

async function resolveBrandId(formData: FormData, workspaceId: string) {
  const explicitBrandId = requiredString(formData, 'brandId');
  if (explicitBrandId) return explicitBrandId;
  return getDefaultBrandId(workspaceId);
}

async function createOrUpdateBasePost(formData: FormData, status: 'draft' | 'in_review' | 'scheduled') {
  const workspaceId = requiredString(formData, 'workspaceId');
  const authorId = requiredString(formData, 'authorId');
  const postId = requiredString(formData, 'postId');
  const title = requiredString(formData, 'title');
  const body = requiredString(formData, 'body');
  const scheduledForRaw = requiredString(formData, 'scheduledFor');
  const postType = requiredString(formData, 'postType') || 'text';
  const brief = requiredString(formData, 'brief');

  if (!process.env.DATABASE_URL || !workspaceId || !authorId || !title || !body) {
    return { error: 'invalid' as const, post: null };
  }

  const scheduledFor = scheduledForRaw ? new Date(scheduledForRaw) : null;
  const brandId = await resolveBrandId(formData, workspaceId);
  if (!brandId) {
    return { error: 'missing-brand' as const, post: null };
  }

  if (postId) {
    const updated = await db
      .update(posts)
      .set({
        authorId,
        brandId,
        title,
        body,
        status,
        scheduledFor,
        postType: postType as 'text' | 'image' | 'multi_image' | 'video' | 'link',
        metadata: { source: 'manual', brief },
        updatedAt: new Date(),
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
      postType: postType as 'text' | 'image' | 'multi_image' | 'video' | 'link',
      metadata: { source: 'manual', brief },
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
      .returning({ id: postTargets.id, provider: postTargets.provider, targetType: postTargets.targetType });

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
    .returning({ id: postTargets.id, provider: postTargets.provider, targetType: postTargets.targetType });

  return inserted[0] ?? null;
}

async function upsertQueuedPublishJob(postId: string, postTargetId: string, scheduledFor: Date) {
  const existingQueued = await db
    .select({ id: publishJobs.id })
    .from(publishJobs)
    .where(and(eq(publishJobs.postId, postId), eq(publishJobs.postTargetId, postTargetId), eq(publishJobs.status, 'queued')))
    .orderBy(desc(publishJobs.scheduledFor))
    .limit(1);

  if (existingQueued[0]?.id) {
    await db.update(publishJobs).set({ scheduledFor }).where(eq(publishJobs.id, existingQueued[0].id));
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
  revalidatePath('/app/brands');
  revalidatePath('/app/engagement');
  revalidatePath('/app/leads');
}

export async function saveDraft(formData: FormData) {
  const { error, post } = await createOrUpdateBasePost(formData, 'draft');
  if (error || !post) {
    redirect(`/app/content?error=${error ?? 'invalid'}` as Route);
  }

  await attachTarget(post.id, post.workspaceId, formData);
  await refreshWorkflowPages();
  redirect(`/app/content?ok=draft&postId=${post.id}` as Route);
}

export async function requestApproval(formData: FormData) {
  const { error, post } = await createOrUpdateBasePost(formData, 'in_review');
  if (error || !post) {
    redirect(`/app/content?error=${error ?? 'invalid'}` as Route);
  }

  const target = await attachTarget(post.id, post.workspaceId, formData);
  if (!target) {
    redirect(`/app/content?error=missing-target&postId=${post.id}` as Route);
  }

  const existingApproval = await db
    .select({ id: approvalRequests.id })
    .from(approvalRequests)
    .where(and(eq(approvalRequests.postId, post.id), eq(approvalRequests.workspaceId, post.workspaceId)))
    .limit(1);

  if (existingApproval[0]?.id) {
    await db.update(approvalRequests).set({
      requestedById: requiredString(formData, 'authorId'),
      status: 'pending',
      note: requiredString(formData, 'approvalOwner') || null,
      updatedAt: new Date(),
    }).where(eq(approvalRequests.id, existingApproval[0].id));
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
  redirect(`/app/content?ok=approval&postId=${post.id}` as Route);
}

export async function schedulePost(formData: FormData) {
  const scheduledFor = requiredString(formData, 'scheduledFor');
  if (!scheduledFor) {
    const postId = requiredString(formData, 'postId');
    redirect(`/app/content?error=missing-schedule${postId ? `&postId=${postId}` : ''}` as Route);
  }

  const { error, post } = await createOrUpdateBasePost(formData, 'scheduled');
  if (error || !post) {
    redirect(`/app/content?error=${error ?? 'invalid'}` as Route);
  }

  const target = await attachTarget(post.id, post.workspaceId, formData);
  if (!target) {
    redirect(`/app/content?error=missing-target&postId=${post.id}` as Route);
  }

  await upsertQueuedPublishJob(post.id, target.id, post.scheduledFor ?? new Date());

  await refreshWorkflowPages();
  redirect(`/app/content?ok=scheduled&postId=${post.id}` as Route);
}

export async function generateAiDrafts(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const authorId = requiredString(formData, 'authorId');
  const brandId = requiredString(formData, 'brandId');
  const brief = requiredString(formData, 'brief');
  const count = Math.max(1, Math.min(Number(requiredString(formData, 'count') || '3'), 6));
  const commercialGoal = requiredString(formData, 'commercialGoal');
  const postFormat = requiredString(formData, 'postFormat');

  if (!workspaceId || !authorId || !brandId || !brief) {
    redirect('/app/content?error=invalid' as Route);
  }

  const brand = await getBrand(workspaceId, brandId);
  if (!brand) {
    redirect('/app/content?error=missing-brand' as Route);
  }

  const drafts = await generateContentDrafts({
    brandName: brand.name,
    brandTone: brand.defaultTone,
    audience: brand.audience,
    primaryCta: brand.primaryCta,
    secondaryCta: brand.secondaryCta,
    hashtags: brand.hashtags ?? [],
    brief,
    count,
    commercialGoal,
    postFormat,
  });

  const inserted = await db.insert(posts).values(
    drafts.map((draft, index) => ({
      workspaceId,
      brandId,
      authorId,
      title: draft.title,
      body: draft.body,
      status: 'draft' as const,
      postType: (postFormat || 'text') as 'text' | 'image' | 'multi_image' | 'video' | 'link',
      metadata: {
        source: 'ai-generated',
        brief,
        titleHint: draft.titleHint,
        callToAction: draft.callToAction,
        hashtags: draft.hashtags,
        draftNumber: index + 1,
      },
    })),
  ).returning({ id: posts.id });

  await refreshWorkflowPages();
  redirect(`/app/content?ok=generated&postId=${inserted[0]?.id ?? ''}` as Route);
}
