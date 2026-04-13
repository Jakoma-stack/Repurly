'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, desc, eq, gte, inArray, lt, ne } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { isFlagEnabled } from '@/lib/ops/feature-flags';
import { inngest } from '@/lib/inngest/client';
import { buildAiReview, buildFallbackContentDrafts, buildSuggestedSchedule, generateContentDrafts, type ContentDraft, type GenerateContentDraftsArgs } from '@/lib/ai/content';
import { approvalRequests, auditEvents, brands, platformAccounts, postTargets, posts, publishJobs } from '../../../drizzle/schema';

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

async function writeAuditEvent(workspaceId: string, actorId: string | null, eventType: string, entityType: string, entityId: string, payload?: Record<string, unknown>) {
  await db.insert(auditEvents).values({ workspaceId, actorId, eventType, entityType, entityId, payload: payload ?? null });
}

async function countLinkedInPostsScheduledForDay(workspaceId: string, scheduledFor: Date) {
  const dayStart = new Date(scheduledFor);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const rows = await db
    .select({ id: publishJobs.id })
    .from(publishJobs)
    .innerJoin(postTargets, eq(postTargets.id, publishJobs.postTargetId))
    .innerJoin(posts, eq(posts.id, publishJobs.postId))
    .where(
      and(
        eq(posts.workspaceId, workspaceId),
        eq(postTargets.provider, 'linkedin'),
        gte(publishJobs.scheduledFor, dayStart),
        lt(publishJobs.scheduledFor, dayEnd),
      ),
    );

  return rows.length;
}

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
  const row = await db.select({ id: brands.id }).from(brands).where(and(eq(brands.workspaceId, workspaceId), eq(brands.status, 'active'))).limit(1);
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
    const excerpt = String(row.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 140);
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
  return Math.max(1, Math.min(Number(requiredString(formData, 'count') || '3'), 30));
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

  const payload: SavedCampaign = {
    workspaceId,
    brandId,
    brief,
    commercialGoal: requiredString(formData, 'commercialGoal'),
    postFormat: requiredString(formData, 'postFormat') || 'text',
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
  const authorId = requiredString(formData, 'authorId');
  const postId = requiredString(formData, 'postId');
  const title = requiredString(formData, 'title');
  const body = requiredString(formData, 'body');
  const postType = requiredString(formData, 'postType') || 'text';
  const brief = requiredString(formData, 'brief');

  if (!process.env.DATABASE_URL || !workspaceId || !authorId || !title || !body) {
    return { error: 'invalid' as const, post: null };
  }

  const scheduledFor = parseScheduledFor(formData);
  const brandId = await resolveBrandId(formData, workspaceId);
  if (!brandId) return { error: 'missing-brand' as const, post: null };

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
      .returning({ id: posts.id, workspaceId: posts.workspaceId, scheduledFor: posts.scheduledFor });

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
      metadata: { source: 'manual', brief },
    })
    .returning({ id: posts.id, workspaceId: posts.workspaceId, scheduledFor: posts.scheduledFor });

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
  postFormat: string;
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
    postType: (args.postFormat || 'text') as 'text' | 'image' | 'multi_image' | 'video' | 'link',
    metadata: {
      source: 'ai-generated',
      brief: args.brief,
      cadence: args.cadence,
      preferredTimeOfDay: args.preferredTimeOfDay,
      titleHint: draft.titleHint,
      callToAction: draft.callToAction,
      hashtags: draft.hashtags,
      draftNumber: index + 1,
      suggestedSchedule: schedule[index] ?? null,
      aiReview: buildAiReview(args.generationArgs, draft, index + 1),
    },
  }));
}


function mergePostMetadata(existing: unknown, patch: Record<string, unknown>) {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing as Record<string, unknown> : {};
  return { ...base, ...patch };
}

async function autoScheduleDraftBatch(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const targetId = requiredString(formData, 'targetId');
  const generatedIds = requiredString(formData, 'generatedIds')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const startAt = parseScheduledFor(formData);

  if (!workspaceId || !targetId || !generatedIds.length || !startAt) {
    return { error: 'invalid' as const, count: 0 };
  }

  const target = await getTargetForWorkspace(workspaceId, targetId);
  if (!target) return { error: 'missing-target' as const, count: 0 };

  const draftRows = await db
    .select({
      id: posts.id,
      title: posts.title,
      metadata: posts.metadata,
    })
    .from(posts)
    .where(and(eq(posts.workspaceId, workspaceId), inArray(posts.id, generatedIds)));

  const byId = new Map(draftRows.map((row) => [row.id, row]));
  const ordered = generatedIds.map((id) => byId.get(id)).filter(Boolean);

  for (const row of ordered) {
    const suggestedDayOffset = Number((row!.metadata as Record<string, unknown> | null)?.aiReview && typeof (row!.metadata as Record<string, unknown>).aiReview === 'object'
      ? ((row!.metadata as Record<string, unknown>).aiReview as Record<string, unknown>).suggestedDayOffset ?? 0
      : ((row!.metadata as Record<string, unknown> | null)?.suggestedSchedule as Record<string, unknown> | undefined)?.dayOffset ?? 0);

    const scheduledFor = new Date(startAt.getTime() + Math.max(0, suggestedDayOffset) * 24 * 60 * 60 * 1000);

    await db
      .update(posts)
      .set({
        status: 'scheduled',
        scheduledFor,
        updatedAt: new Date(),
        metadata: mergePostMetadata(row!.metadata, {
          autoPlacedAt: new Date().toISOString(),
          autoPlacedFromBatch: true,
          autoPlacedStart: startAt.toISOString(),
        }),
      })
      .where(eq(posts.id, row!.id));

    const existingTarget = await db.select({ id: postTargets.id }).from(postTargets).where(eq(postTargets.postId, row!.id)).limit(1);
    let postTargetId: string | null = null;
    if (existingTarget[0]?.id) {
      const updated = await db.update(postTargets).set({ platformAccountId: target.id, provider: target.provider, targetType: target.targetType, platformStatus: 'queued', scheduledFor, updatedAt: new Date() }).where(eq(postTargets.id, existingTarget[0].id)).returning({ id: postTargets.id });
      postTargetId = updated[0]?.id ?? existingTarget[0].id;
    } else {
      const inserted = await db.insert(postTargets).values({ postId: row!.id, platformAccountId: target.id, provider: target.provider, targetType: target.targetType, platformStatus: 'queued', scheduledFor }).returning({ id: postTargets.id });
      postTargetId = inserted[0]?.id ?? null;
    }
    if (!postTargetId) continue;
    const publishJobId = await upsertQueuedPublishJob(row!.id, postTargetId, scheduledFor);
    await maybeDispatchScheduledPost({ publishJobId, postId: row!.id, postTargetId, scheduledFor });
  }

  return { error: null as const, count: ordered.length };
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

export async function autoPlaceGeneratedDrafts(formData: FormData) {
  const generatedIds = requiredString(formData, 'generatedIds');
  const result = await autoScheduleDraftBatch(formData);
  if (result.error) {
    redirect(buildContentPath({ error: result.error, generatedIds }, 'generated-drafts') as Route);
  }

  await refreshWorkflowPages();
  redirect(buildContentPath({ ok: 'auto-placed', generatedIds }, 'generated-drafts') as Route);
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

  const existingApproval = await db
    .select({ id: approvalRequests.id })
    .from(approvalRequests)
    .where(and(eq(approvalRequests.postId, post.id), eq(approvalRequests.workspaceId, post.workspaceId)))
    .limit(1);

  const currentPost = await db.select({ metadata: posts.metadata }).from(posts).where(eq(posts.id, post.id)).limit(1);
  const review = ((currentPost[0]?.metadata as Record<string, unknown> | null)?.aiReview ?? null) as Record<string, unknown> | null;
  const approvalNote = [
    requiredString(formData, 'approvalOwner') || null,
    review ? `AI review: ${String(review.approvalRecommendation ?? 'Review manually')} | Performance fit ${String(review.performanceFitScore ?? 'n/a')}/100 | Compliance ${String(review.complianceRisk ?? 'none')}` : null,
  ].filter(Boolean).join('\n');

  if (existingApproval[0]?.id) {
    await db
      .update(approvalRequests)
      .set({ requestedById: requiredString(formData, 'authorId'), status: 'pending', note: approvalNote || null, updatedAt: new Date() })
      .where(eq(approvalRequests.id, existingApproval[0].id));
  } else {
    await db.insert(approvalRequests).values({ workspaceId: post.workspaceId, postId: post.id, requestedById: requiredString(formData, 'authorId'), status: 'pending', note: approvalNote || null });
  }

  await refreshWorkflowPages();
  redirect(buildContentPath({ ok: 'approval', postId: post.id }, 'target-selection') as Route);
}

export async function schedulePost(formData: FormData) {
  const scheduledFor = requiredString(formData, 'scheduledFor');
  const postId = requiredString(formData, 'postId');
  const workspaceId = requiredString(formData, 'workspaceId');
  const authorId = requiredString(formData, 'authorId');

  if (!scheduledFor) {
    redirect(buildContentPath({ error: 'missing-schedule', postId: postId || undefined }, 'composer') as Route);
  }

  if (workspaceId && await isFlagEnabled(workspaceId, 'pause_publishing')) {
    redirect(buildContentPath({ error: 'publishing-paused', postId: postId || undefined }, 'target-selection') as Route);
  }

  const parsed = parseScheduledFor(formData);
  if (!parsed || Number.isNaN(parsed.getTime())) {
    redirect(buildContentPath({ error: 'invalid-schedule', postId: postId || undefined }, 'composer') as Route);
  }
  const parsedDate = parsed as Date;

  if (parsedDate.getTime() < Date.now() - 60 * 1000) {
    redirect(buildContentPath({ error: 'schedule-in-past', postId: postId || undefined }, 'composer') as Route);
  }

  const targetId = requiredString(formData, 'targetId');
  const targetRecord = await getTargetForWorkspace(workspaceId, targetId);
  if (targetRecord?.provider === 'linkedin') {
    const sameDayCount = await countLinkedInPostsScheduledForDay(workspaceId, parsedDate);
    if (sameDayCount >= 5) {
      redirect(buildContentPath({ error: 'linkedin-day-limit', postId: postId || undefined }, 'target-selection') as Route);
    }
  }

  const { error, post } = await createOrUpdateBasePost(formData, 'scheduled');
  if (error || !post) redirect(buildContentPath({ error: error ?? 'invalid' }, 'composer') as Route);

  const target = await attachTarget(post.id, post.workspaceId, formData);
  if (!target) redirect(buildContentPath({ error: 'missing-target', postId: post.id }, 'target-selection') as Route);

  const publishJobId = await upsertQueuedPublishJob(post.id, target.id, post.scheduledFor ?? new Date());

  await maybeDispatchScheduledPost({
    publishJobId,
    postId: post.id,
    postTargetId: target.id,
    scheduledFor: post.scheduledFor,
  });

  await writeAuditEvent(post.workspaceId, authorId || null, 'post_scheduled', 'post', post.id, { publishJobId, scheduledFor: post.scheduledFor?.toISOString?.() ?? null, provider: target.provider });
  await refreshWorkflowPages();
  redirect(buildContentPath({ ok: 'scheduled', postId: post.id }, 'target-selection') as Route);
}

export async function clearQueuedPosts(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const actorId = requiredString(formData, 'authorId');
  if (!workspaceId) redirect('/app/calendar?error=invalid' as Route);

  const queued = await db
    .select({ id: publishJobs.id })
    .from(publishJobs)
    .innerJoin(posts, eq(posts.id, publishJobs.postId))
    .where(and(eq(posts.workspaceId, workspaceId), eq(publishJobs.status, 'queued')));

  if (queued.length) {
    await db.delete(publishJobs).where(inArray(publishJobs.id, queued.map((row) => row.id)));
  }

  await writeAuditEvent(workspaceId, actorId || null, 'queue_cleared', 'publish_job', workspaceId, { clearedCount: queued.length });
  await refreshWorkflowPages();
  redirect('/app/calendar?ok=queue-cleared' as Route);
}

export async function generateAiDrafts(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const authorId = requiredString(formData, 'authorId');
  const brandId = requiredString(formData, 'brandId');
  const brief = requiredString(formData, 'brief');
  const count = parseCount(formData);
  const commercialGoal = requiredString(formData, 'commercialGoal');
  const postFormat = requiredString(formData, 'postFormat');
  const cadence = requiredString(formData, 'cadence') || 'weekly';
  const preferredTimeOfDay = requiredString(formData, 'preferredTimeOfDay') || 'morning';

  if (!workspaceId || !authorId || !brandId || !brief) {
    redirect(buildContentPath({ error: 'invalid' }, 'campaign-planner') as Route);
  }

  if (!process.env.DATABASE_URL) {
    redirect(buildContentPath({ error: 'generate-failed-save' }, 'campaign-planner') as Route);
  }

  const [brand, performanceContext] = await Promise.all([getBrand(workspaceId, brandId), getBrandPerformanceContext(workspaceId, brandId)]);
  if (!brand) {
    redirect(buildContentPath({ error: 'missing-brand' }, 'campaign-planner') as Route);
  }

  await persistSavedCampaign(formData);

  const aiProfile = (brand.metadata && typeof brand.metadata === 'object' ? (brand.metadata as Record<string, unknown>).aiProfile : null) as Record<string, unknown> | null;

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
    postFormat,
    cadence,
    preferredTimeOfDay,
    campaignWindowDays: parseCampaignWindowDays(formData),
    sourceMaterial: requiredString(formData, 'sourceMaterial') || null,
    voiceNotes: [String(aiProfile?.voiceNotes ?? ''), requiredString(formData, 'voiceNotes')].filter(Boolean).join(' | ') || null,
    blockedTerms: [String(aiProfile?.blockedTerms ?? ''), requiredString(formData, 'blockedTerms')].join(',').split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
    targetPlatforms: requiredString(formData, 'targetPlatforms').split(/[\n,]/).map((item) => item.trim().toLowerCase()).filter(Boolean),
    performanceContext,
    complianceRules: String(aiProfile?.complianceRules ?? '').split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
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
      postFormat,
      brief,
      cadence,
      preferredTimeOfDay,
      generationArgs,
      drafts: draftBatch,
    })).returning({ id: posts.id });
  };

  let inserted: Array<{ id: string }>;

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
