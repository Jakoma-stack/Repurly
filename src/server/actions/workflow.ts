'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, desc, eq, ne } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { requireWorkspaceRole } from '@/lib/auth/workspace';
import { inngest } from '@/lib/inngest/client';
import { buildBrandIntelligence } from '@/lib/ai/brand-context';
import { generateVisualAssets } from '@/lib/ai/visual-assets';
import {
  buildAiReview,
  buildFallbackContentDrafts,
  buildSuggestedSchedule,
  generateContentDrafts,
  type ContentDraft,
  type GenerateContentDraftsArgs,
} from '@/lib/ai/content';
import { approvalRequests, approvalResponses, brands, platformAccounts, postTargets, posts, publishJobs } from '../../../drizzle/schema';

const SAVED_CAMPAIGN_COOKIE = 'repurly_saved_campaign';

type SavedCampaign = {
  workspaceId: string;
  brandId: string;
  brief: string;
  commercialGoal: string;
  postFormat: string;
  count: number;
  cadence: string;
  preferredTimeOfDay: string;
  campaignWindowDays: number;
  sourceMaterial: string;
  voiceNotes: string;
  blockedTerms: string;
  targetPlatforms: string;
  savedAt: string;
};

const IMMEDIATE_PUBLISH_WINDOW_MS = 60 * 1000;

function parseScheduledFor(formData: FormData) {
  const rawValue = requiredString(formData, 'scheduledFor');
  if (!rawValue) return null;

  const timezoneOffsetMinutes = Number(requiredString(formData, 'timezoneOffsetMinutes') || '0');
  const match = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

  if (match) {
    const [, year, month, day, hour, minute] = match;
    const utcTimestamp = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    ) + timezoneOffsetMinutes * 60 * 1000;

    return new Date(utcTimestamp);
  }

  const fallback = new Date(rawValue);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function buildContentPath(
  params: Record<string, string | undefined>,
  hash?: 'campaign-planner' | 'generated-drafts' | 'composer' | 'target-selection' | 'recent-drafts',
) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }

  const query = search.toString();
  return `/app/content${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`;
}

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
      website: brands.website,
      contactEmail: brands.contactEmail,
      linkedinProfileUrl: brands.linkedinProfileUrl,
      linkedinCompanyUrl: brands.linkedinCompanyUrl,
      metadata: brands.metadata,
    })
    .from(brands)
    .where(and(eq(brands.workspaceId, workspaceId), eq(brands.id, brandId)))
    .limit(1);

  return row[0] ?? null;
}

async function getBrandPerformanceContext(workspaceId: string, brandId: string) {
  const rows = await db
    .select({ title: posts.title, body: posts.body, publishedAt: posts.publishedAt, updatedAt: posts.updatedAt })
    .from(posts)
    .where(and(eq(posts.workspaceId, workspaceId), eq(posts.brandId, brandId), eq(posts.status, 'published')))
    .orderBy(desc(posts.publishedAt), desc(posts.updatedAt))
    .limit(5);

  return rows.map((row) => {
    const excerpt = String(row.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 180);
    const publishedLabel = row.publishedAt ? new Date(row.publishedAt).toISOString().slice(0, 10) : 'recently';
    return `${row.title} (${publishedLabel})${excerpt ? ` — ${excerpt}` : ''}`;
  });
}

async function getTargetForWorkspace(workspaceId: string, targetId: string) {
  if (!targetId) return null;

  const row = await db
    .select({ id: platformAccounts.id, provider: platformAccounts.provider, targetType: platformAccounts.targetType })
    .from(platformAccounts)
    .where(and(eq(platformAccounts.id, targetId), eq(platformAccounts.workspaceId, workspaceId)))
    .limit(1);

  return row[0] ?? null;
}

function requiredString(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function parseCount(formData: FormData) {
  return Math.max(1, Math.min(Number(requiredString(formData, 'count') || '3'), 12));
}

function mergePostMetadata(existing: Record<string, unknown> | null, incoming: Record<string, unknown>) {
  const current = (existing ?? {}) as Record<string, unknown>;
  const next = { ...current, ...incoming } as Record<string, unknown>;
  if (current.aiAssets && !incoming.aiAssets) next.aiAssets = current.aiAssets;
  if (current.assetGeneration && !incoming.assetGeneration) next.assetGeneration = current.assetGeneration;
  return next;
}

async function getExistingPostMetadata(workspaceId: string, postId: string) {
  if (!postId) return null;
  const rows = await db
    .select({ metadata: posts.metadata })
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.workspaceId, workspaceId)))
    .limit(1);
  return (rows[0]?.metadata ?? null) as Record<string, unknown> | null;
}

function postNeedsVisualAssets(postType: string) {
  return postType === 'image' || postType === 'multi_image' || postType === 'video';
}

function postHasRenderableAssets(postType: string, metadata: Record<string, unknown> | null | undefined) {
  if (!postNeedsVisualAssets(postType)) return true;
  const aiAssets = metadata && typeof metadata === 'object' ? (metadata.aiAssets as Record<string, unknown> | undefined) : undefined;
  const image = aiAssets?.image as Record<string, unknown> | undefined;
  const carousel = aiAssets?.carousel as Record<string, unknown> | undefined;
  const slides = Array.isArray(carousel?.slides) ? carousel?.slides : [];
  if (postType === 'image') return Boolean(image?.dataUri);
  if (postType === 'multi_image') return slides.length >= 2;
  return false;
}

function parseCampaignWindowDays(formData: FormData) {
  return Math.max(7, Math.min(Number(requiredString(formData, 'campaignWindowDays') || '30'), 180));
}

function parseCsvField(raw: string) {
  return raw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join(', ');
}

async function persistSavedCampaign(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const brandId = requiredString(formData, 'brandId');
  const brief = requiredString(formData, 'brief');

  if (!workspaceId || !brandId || !brief) return false;
  await requireWorkspaceRole(workspaceId, ['owner', 'admin', 'editor']);
  const brand = await getBrand(workspaceId, brandId);
  if (!brand) return false;

  const payload: SavedCampaign = {
    workspaceId,
    brandId,
    brief,
    commercialGoal: requiredString(formData, 'commercialGoal'),
    postFormat: requiredString(formData, 'postFormat') || 'auto',
    count: parseCount(formData),
    cadence: requiredString(formData, 'cadence') || 'weekly',
    preferredTimeOfDay: requiredString(formData, 'preferredTimeOfDay') || 'morning',
    campaignWindowDays: parseCampaignWindowDays(formData),
    sourceMaterial: requiredString(formData, 'sourceMaterial'),
    voiceNotes: requiredString(formData, 'voiceNotes'),
    blockedTerms: parseCsvField(requiredString(formData, 'blockedTerms')),
    targetPlatforms: parseCsvField(requiredString(formData, 'targetPlatforms') || 'linkedin'),
    savedAt: new Date().toISOString(),
  };

  const cookieStore = await cookies();
  cookieStore.set(SAVED_CAMPAIGN_COOKIE, Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url'), {
    path: '/app/content',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
    httpOnly: true,
  });

  return true;
}

async function resolveBrandId(formData: FormData, workspaceId: string) {
  const explicitBrandId = requiredString(formData, 'brandId');
  if (explicitBrandId) return explicitBrandId;
  return getDefaultBrandId(workspaceId);
}

async function createOrUpdateBasePost(formData: FormData, status: 'draft' | 'in_review' | 'scheduled') {
  const workspaceId = requiredString(formData, 'workspaceId');
  const access = workspaceId ? await requireWorkspaceRole(workspaceId, ['owner', 'admin', 'editor']) : null;
  const authorId = access?.userId ?? '';
  const postId = requiredString(formData, 'postId');
  const title = requiredString(formData, 'title');
  const body = requiredString(formData, 'body');
  const postType = requiredString(formData, 'postType') || 'text';
  const brief = requiredString(formData, 'brief');

  if (!process.env.DATABASE_URL || !workspaceId || !authorId || !title || !body) {
    return { error: 'invalid' as const, post: null };
  }

  if ((postType === 'image' || postType === 'multi_image' || postType === 'video') && !brief) {
    return { error: 'media-brief-required' as const, post: null };
  }

  const scheduledFor = parseScheduledFor(formData);
  const brandId = await resolveBrandId(formData, workspaceId);
  if (!brandId) return { error: 'missing-brand' as const, post: null };
  const brand = await getBrand(workspaceId, brandId);
  if (!brand) return { error: 'missing-brand' as const, post: null };
  const existingMetadata = postId ? await getExistingPostMetadata(workspaceId, postId) : null;
  const mergedMetadata = mergePostMetadata(existingMetadata, { source: 'manual', brief });

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
        metadata: mergedMetadata,
        updatedAt: new Date(),
      })
      .where(and(eq(posts.id, postId), eq(posts.workspaceId, workspaceId)))
      .returning({ id: posts.id, workspaceId: posts.workspaceId, scheduledFor: posts.scheduledFor, authorId: posts.authorId });

    if (updated[0]) return { error: null, post: updated[0] };
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
      metadata: mergedMetadata,
    })
    .returning({ id: posts.id, workspaceId: posts.workspaceId, scheduledFor: posts.scheduledFor, authorId: posts.authorId });

  return { error: null, post: inserted[0] ?? null };
}

async function attachTarget(postId: string, workspaceId: string, formData: FormData) {
  const targetId = requiredString(formData, 'targetId');
  const target = await getTargetForWorkspace(workspaceId, targetId);
  if (!target) return null;

  const existing = await db.select({ id: postTargets.id }).from(postTargets).where(eq(postTargets.postId, postId)).limit(1);

  if (existing[0]?.id) {
    const updated = await db
      .update(postTargets)
      .set({ platformAccountId: target.id, provider: target.provider, targetType: target.targetType, platformStatus: 'queued' })
      .where(eq(postTargets.id, existing[0].id))
      .returning({ id: postTargets.id, provider: postTargets.provider, targetType: postTargets.targetType });

    return updated[0] ?? null;
  }

  const inserted = await db
    .insert(postTargets)
    .values({ postId, platformAccountId: target.id, provider: target.provider, targetType: target.targetType, platformStatus: 'queued' })
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

  const inserted = await db.insert(publishJobs).values({ postId, postTargetId, status: 'queued', scheduledFor }).returning({ id: publishJobs.id });
  return inserted[0]?.id ?? null;
}

async function maybeDispatchScheduledPost(args: {
  publishJobId: string | null;
  postId: string;
  postTargetId: string;
  scheduledFor: Date | null;
}) {
  if (!args.publishJobId || !args.scheduledFor) return;

  if (args.scheduledFor.getTime() > Date.now() + IMMEDIATE_PUBLISH_WINDOW_MS) {
    return;
  }

  try {
    await inngest.send({
      name: 'repurly/post.publish.requested',
      data: {
        jobId: args.publishJobId,
        postId: args.postId,
        postTargetId: args.postTargetId,
      },
    });
  } catch (error) {
    console.error('schedulePost: immediate publish enqueue failed', {
      postId: args.postId,
      postTargetId: args.postTargetId,
      publishJobId: args.publishJobId,
      error,
    });
  }
}

function buildGeneratedDraftRows(args: {
  workspaceId: string;
  brandId: string;
  authorId: string;
  brief: string;
  cadence: string;
  preferredTimeOfDay: string;
  generationArgs: GenerateContentDraftsArgs;
  drafts: ContentDraft[];
}) {
  const schedule = buildSuggestedSchedule(args.generationArgs);

  return args.drafts.map((draft, index) => ({
    workspaceId: args.workspaceId,
    brandId: args.brandId,
    authorId: args.authorId,
    title: draft.title,
    body: draft.body,
    status: 'draft' as const,
    postType: draft.postFormat,
    metadata: {
      source: 'ai-generated',
      brief: args.brief,
      cadence: args.cadence,
      preferredTimeOfDay: args.preferredTimeOfDay,
      titleHint: draft.titleHint,
      callToAction: draft.callToAction,
      hashtags: draft.hashtags,
      draftNumber: index + 1,
      postFormat: draft.postFormat,
      angle: draft.angle,
      funnelStage: draft.funnelStage,
      proofPoint: draft.proofPoint,
      reasoning: draft.reasoning,
      assetPlan: draft.assetPlan,
      suggestedSchedule: schedule[index] ?? null,
      aiReview: buildAiReview(args.generationArgs, draft, index + 1),
    },
  }));
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

export async function saveCampaign(formData: FormData) {
  const saved = await persistSavedCampaign(formData);
  if (!saved) redirect(buildContentPath({ error: 'invalid' }, 'campaign-planner') as Route);
  redirect(buildContentPath({ ok: 'campaign-saved' }, 'campaign-planner') as Route);
}

export async function clearSavedCampaign() {
  const cookieStore = await cookies();
  cookieStore.delete(SAVED_CAMPAIGN_COOKIE);
  redirect(buildContentPath({ ok: 'campaign-cleared' }, 'campaign-planner') as Route);
}

export async function clearRecentDrafts(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const brandId = requiredString(formData, 'brandId');
  const currentPostId = requiredString(formData, 'postId');

  if (!workspaceId) redirect(buildContentPath({ error: 'invalid' }, 'recent-drafts') as Route);
  await requireWorkspaceRole(workspaceId, ['owner', 'admin', 'editor']);

  const filters = [eq(posts.workspaceId, workspaceId), eq(posts.status, 'draft')];
  if (brandId) filters.push(eq(posts.brandId, brandId));
  if (currentPostId) filters.push(ne(posts.id, currentPostId));

  const deleted = await db.delete(posts).where(and(...filters)).returning({ id: posts.id });

  await refreshWorkflowPages();

  if (!deleted.length) {
    redirect(buildContentPath({ ok: 'no-drafts', postId: currentPostId || undefined }, 'recent-drafts') as Route);
  }

  redirect(buildContentPath({ ok: 'drafts-cleared', postId: currentPostId || undefined }, 'recent-drafts') as Route);
}

export async function saveDraft(formData: FormData) {
  const { error, post } = await createOrUpdateBasePost(formData, 'draft');
  if (error || !post) redirect(buildContentPath({ error: error ?? 'invalid' }, 'composer') as Route);

  await attachTarget(post.id, post.workspaceId, formData);
  await refreshWorkflowPages();
  redirect(buildContentPath({ ok: 'draft', postId: post.id }, 'target-selection') as Route);
}

export async function requestApproval(formData: FormData) {
  const { error, post } = await createOrUpdateBasePost(formData, 'in_review');
  if (error || !post) redirect(buildContentPath({ error: error ?? 'invalid' }, 'composer') as Route);

  const target = await attachTarget(post.id, post.workspaceId, formData);
  if (!target) redirect(buildContentPath({ error: 'missing-target', postId: post.id }, 'target-selection') as Route);
  const metadata = await getExistingPostMetadata(post.workspaceId, post.id);
  if (!postHasRenderableAssets(requiredString(formData, 'postType') || 'text', metadata)) redirect(buildContentPath({ error: 'missing-assets', postId: post.id }, 'composer') as Route);

  const existingApproval = await db
    .select({ id: approvalRequests.id })
    .from(approvalRequests)
    .where(and(eq(approvalRequests.postId, post.id), eq(approvalRequests.workspaceId, post.workspaceId)))
    .limit(1);

  const approvalNote = requiredString(formData, 'approvalOwner') || null;

  if (existingApproval[0]?.id) {
    await db
      .update(approvalRequests)
      .set({ requestedById: post.authorId, status: 'pending', note: approvalNote, updatedAt: new Date() })
      .where(eq(approvalRequests.id, existingApproval[0].id));
  } else {
    await db.insert(approvalRequests).values({ workspaceId: post.workspaceId, postId: post.id, requestedById: post.authorId, status: 'pending', note: approvalNote });
  }

  await refreshWorkflowPages();
  redirect(buildContentPath({ ok: 'approval', postId: post.id }, 'target-selection') as Route);
}


export async function respondToApproval(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const approvalRequestId = requiredString(formData, 'approvalRequestId');
  const postId = requiredString(formData, 'postId');
  const response = requiredString(formData, 'response');
  const note = requiredString(formData, 'approvalResponseNote') || null;

  if (!workspaceId || !approvalRequestId || !postId || !response) {
    redirect(buildContentPath({ error: 'invalid', postId: postId || undefined }, 'composer') as Route);
  }

  const access = await requireWorkspaceRole(workspaceId, ['owner', 'admin', 'approver']);
  const requestRows = await db
    .select({ approvalRequestId: approvalRequests.id, postId: posts.id })
    .from(approvalRequests)
    .innerJoin(posts, eq(posts.id, approvalRequests.postId))
    .where(and(eq(approvalRequests.id, approvalRequestId), eq(approvalRequests.postId, postId), eq(approvalRequests.workspaceId, workspaceId), eq(posts.workspaceId, workspaceId)))
    .limit(1);

  if (!requestRows[0]) redirect(buildContentPath({ error: 'invalid', postId }, 'composer') as Route);

  const status = response === 'approve' ? 'approved' : response === 'changes_requested' ? 'changes_requested' : 'rejected';
  const postStatus = status === 'approved' ? 'approved' : 'draft';

  await db.transaction(async (tx) => {
    await tx.update(approvalRequests).set({ status, updatedAt: new Date() }).where(and(eq(approvalRequests.id, approvalRequestId), eq(approvalRequests.workspaceId, workspaceId), eq(approvalRequests.postId, postId)));
    await tx.insert(approvalResponses).values({ approvalRequestId, responderId: access.userId, status, note });
    await tx.update(posts).set({ status: postStatus, updatedAt: new Date() }).where(and(eq(posts.id, postId), eq(posts.workspaceId, workspaceId)));
  });

  await refreshWorkflowPages();
  redirect(buildContentPath({ ok: status === 'approved' ? 'approved' : status === 'changes_requested' ? 'changes-requested' : 'rejected', postId }, 'composer') as Route);
}

export async function schedulePost(formData: FormData) {
  const scheduledFor = requiredString(formData, 'scheduledFor');
  const postId = requiredString(formData, 'postId');

  if (!scheduledFor) {
    redirect(buildContentPath({ error: 'missing-schedule', postId: postId || undefined }, 'composer') as Route);
  }

  const { error, post } = await createOrUpdateBasePost(formData, 'scheduled');
  if (error || !post) redirect(buildContentPath({ error: error ?? 'invalid' }, 'composer') as Route);

  const target = await attachTarget(post.id, post.workspaceId, formData);
  if (!target) redirect(buildContentPath({ error: 'missing-target', postId: post.id }, 'target-selection') as Route);
  const metadata = await getExistingPostMetadata(post.workspaceId, post.id);
  if (!postHasRenderableAssets(requiredString(formData, 'postType') || 'text', metadata)) redirect(buildContentPath({ error: 'missing-assets', postId: post.id }, 'composer') as Route);

  const publishJobId = await upsertQueuedPublishJob(post.id, target.id, post.scheduledFor ?? new Date());

  await maybeDispatchScheduledPost({
    publishJobId,
    postId: post.id,
    postTargetId: target.id,
    scheduledFor: post.scheduledFor,
  });

  await refreshWorkflowPages();
  redirect(buildContentPath({ ok: 'scheduled', postId: post.id }, 'target-selection') as Route);
}

async function generateAiVisualDraft(formData: FormData, format: 'image' | 'carousel') {
  const workspaceId = requiredString(formData, 'workspaceId');
  const access = workspaceId ? await requireWorkspaceRole(workspaceId, ['owner', 'admin', 'editor']) : null;
  const authorId = access?.userId ?? '';
  const brandId = await resolveBrandId(formData, workspaceId);
  const title = requiredString(formData, 'title') || 'AI-generated visual';
  const body = requiredString(formData, 'body');
  const brief = requiredString(formData, 'brief') || body || title;

  if (!workspaceId || !authorId || !brandId || !title) {
    redirect(buildContentPath({ error: 'invalid' }, 'composer') as Route);
  }

  const brand = await getBrand(workspaceId, brandId!);
  if (!brand) {
    redirect(buildContentPath({ error: 'missing-brand' }, 'composer') as Route);
  }

  const desiredPostType = format === 'image' ? 'image' : 'multi_image';
  const baseResult = await createOrUpdateBasePost(formData, 'draft');
  if (baseResult.error || !baseResult.post) {
    redirect(buildContentPath({ error: baseResult.error ?? 'invalid' }, 'composer') as Route);
  }

  const visualAssets = await generateVisualAssets({
    brandName: brand.name,
    brief,
    postTitle: title,
    body,
    tone: brand.defaultTone,
    audience: brand.audience,
    primaryCta: brand.primaryCta,
    format,
  });

  const existingMetadata = await getExistingPostMetadata(workspaceId, baseResult.post.id);
  const metadata = mergePostMetadata(existingMetadata, {
    brief,
    assetGeneration: {
      latestMode: format,
      generatedAt: new Date().toISOString(),
    },
    aiAssets: {
      ...(existingMetadata?.aiAssets && typeof existingMetadata.aiAssets === 'object' ? existingMetadata.aiAssets as Record<string, unknown> : {}),
      ...(visualAssets.image ? { image: visualAssets.image } : {}),
      ...(visualAssets.carousel ? { carousel: visualAssets.carousel } : {}),
      generatedAt: visualAssets.generatedAt,
    },
  });

  await db
    .update(posts)
    .set({
      postType: desiredPostType as 'image' | 'multi_image',
      metadata,
      updatedAt: new Date(),
    })
    .where(and(eq(posts.id, baseResult.post.id), eq(posts.workspaceId, workspaceId)));

  await refreshWorkflowPages();
  redirect(buildContentPath({ ok: format === 'image' ? 'image-assets' : 'carousel-assets', postId: baseResult.post.id }, 'composer') as Route);
}

export async function generateAiImageAssets(formData: FormData) {
  await generateAiVisualDraft(formData, 'image');
}

export async function generateAiCarouselAssets(formData: FormData) {
  await generateAiVisualDraft(formData, 'carousel');
}

export async function generateAiDrafts(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const access = workspaceId ? await requireWorkspaceRole(workspaceId, ['owner', 'admin', 'editor']) : null;
  const authorId = access?.userId ?? '';
  const brandId = requiredString(formData, 'brandId');
  const brief = requiredString(formData, 'brief');
  const count = parseCount(formData);
  const commercialGoal = requiredString(formData, 'commercialGoal');
  const postFormat: GenerateContentDraftsArgs['postFormat'] =
    (requiredString(formData, 'postFormat') || 'auto') as GenerateContentDraftsArgs['postFormat'];
  const cadence = requiredString(formData, 'cadence') || 'weekly';
  const preferredTimeOfDay = requiredString(formData, 'preferredTimeOfDay') || 'morning';
  const campaignWindowDays = parseCampaignWindowDays(formData);
  const sourceMaterial = requiredString(formData, 'sourceMaterial') || null;
  const voiceNotes = requiredString(formData, 'voiceNotes') || null;
  const blockedTerms = requiredString(formData, 'blockedTerms')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const targetPlatforms = requiredString(formData, 'targetPlatforms')
    .split(/[\n,]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (!workspaceId || !authorId || !brandId || !brief) {
    redirect(buildContentPath({ error: 'invalid' }, 'campaign-planner') as Route);
  }

  if (!process.env.DATABASE_URL) {
    redirect(buildContentPath({ error: 'generate-failed-save' }, 'campaign-planner') as Route);
  }

  const [brand, performanceContext] = await Promise.all([
    getBrand(workspaceId, brandId),
    getBrandPerformanceContext(workspaceId, brandId),
  ]);

  if (!brand) {
    redirect(buildContentPath({ error: 'missing-brand' }, 'campaign-planner') as Route);
  }

  await persistSavedCampaign(formData);

  const brandIntelligence = await buildBrandIntelligence({
    brandName: brand.name,
    website: brand.website,
    audience: brand.audience,
    defaultTone: brand.defaultTone,
    primaryCta: brand.primaryCta,
    secondaryCta: brand.secondaryCta,
    linkedinProfileUrl: brand.linkedinProfileUrl,
    linkedinCompanyUrl: brand.linkedinCompanyUrl,
    metadata: brand.metadata,
  });

  const aiProfile = (brand.metadata && typeof brand.metadata === 'object'
    ? (brand.metadata as Record<string, unknown>).aiProfile
    : null) as Record<string, unknown> | null;

  const mergedVoiceNotes = [String(aiProfile?.voiceNotes ?? ''), voiceNotes].filter(Boolean).join(' | ') || null;
  const mergedBlockedTerms = [String(aiProfile?.blockedTerms ?? ''), ...blockedTerms]
    .join(',')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const mergedComplianceRules = [String(aiProfile?.complianceRules ?? ''), ...(brandIntelligence.restrictedClaims ?? [])]
    .join(',')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const mergedProofPoints = [String(aiProfile?.proofPoints ?? ''), ...(brandIntelligence.proofPoints ?? [])]
    .join('\n')
    .split(/[\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

  const generationArgs: GenerateContentDraftsArgs = {
    brandName: brand.name,
    brandTone: brand.defaultTone,
    audience: brand.audience,
    primaryCta: brand.primaryCta,
    secondaryCta: brand.secondaryCta,
    hashtags: brand.hashtags ?? [],
    brief,
    count,
    commercialGoal,
    postFormat: postFormat as GenerateContentDraftsArgs['postFormat'],
    cadence,
    preferredTimeOfDay,
    campaignWindowDays,
    sourceMaterial,
    voiceNotes: mergedVoiceNotes,
    blockedTerms: mergedBlockedTerms,
    targetPlatforms: targetPlatforms.length ? targetPlatforms : ['linkedin'],
    performanceContext,
    complianceRules: mergedComplianceRules,
    websiteSummary: brandIntelligence.websiteSummary,
    websiteEvidence: brandIntelligence.websiteEvidence,
    proofPoints: mergedProofPoints,
  };

  let drafts: ContentDraft[];
  try {
    drafts = await generateContentDrafts(generationArgs);
  } catch (error) {
    console.error('generateAiDrafts: content generation failed, falling back to deterministic drafts', error);
    drafts = buildFallbackContentDrafts(generationArgs);
  }

  const tryInsert = async (draftBatch: ContentDraft[]) => {
    return db.insert(posts).values(buildGeneratedDraftRows({
      workspaceId,
      brandId,
      authorId,
      brief,
      cadence,
      preferredTimeOfDay,
      generationArgs,
      drafts: draftBatch,
    })).returning({ id: posts.id });
  };

  let inserted: Array<{ id: string }> = [];

  try {
    inserted = await tryInsert(drafts);
  } catch (error) {
    console.error('generateAiDrafts: initial draft save failed, retrying with fallback drafts', error);
    try {
      const fallbackDrafts = buildFallbackContentDrafts(generationArgs);
      inserted = await tryInsert(fallbackDrafts);
    } catch (fallbackError) {
      console.error('generateAiDrafts: fallback draft save failed', fallbackError);
      redirect(buildContentPath({ error: 'generate-failed-save' }, 'campaign-planner') as Route);
    }
  }

  await refreshWorkflowPages();
  const generatedIds = inserted.map((row) => row.id).filter(Boolean).join(',');
  redirect(buildContentPath({ ok: 'generated', postId: inserted[0]?.id ?? '', generatedIds }, 'generated-drafts') as Route);
}
