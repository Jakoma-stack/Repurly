'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, desc, eq, ne } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { inngest } from '@/lib/inngest/client';
import { buildBrandIntelligence } from '@/lib/ai/brand-context';
import {
  buildAiReview,
  buildFallbackContentDrafts,
  buildSuggestedSchedule,
  generateContentDrafts,
  type ContentDraft,
  type GenerateContentDraftsArgs,
} from '@/lib/ai/content';
import { approvalRequests, brands, platformAccounts, postTargets, posts, publishJobs } from '../../../drizzle/schema';

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

  const approvalNote = requiredString(formData, 'approvalOwner') || null;

  if (existingApproval[0]?.id) {
    await db
      .update(approvalRequests)
      .set({ requestedById: requiredString(formData, 'authorId'), status: 'pending', note: approvalNote, updatedAt: new Date() })
      .where(eq(approvalRequests.id, existingApproval[0].id));
  } else {
    await db.insert(approvalRequests).values({ workspaceId: post.workspaceId, postId: post.id, requestedById: requiredString(formData, 'authorId'), status: 'pending', note: approvalNote });
  }

  await refreshWorkflowPages();
  redirect(buildContentPath({ ok: 'approval', postId: post.id }, 'target-selection') as Route);
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

export async function generateAiDrafts(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const authorId = requiredString(formData, 'authorId');
  const brandId = requiredString(formData, 'brandId');
  const brief = requiredString(formData, 'brief');
  const count = parseCount(formData);
  const commercialGoal = requiredString(formData, 'commercialGoal');
  const postFormat = requiredString(formData, 'postFormat') || 'auto';
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
    voiceNotes,
    blockedTerms,
    targetPlatforms: targetPlatforms.length ? targetPlatforms : ['linkedin'],
    performanceContext,
    complianceRules: brandIntelligence.restrictedClaims,
    websiteSummary: brandIntelligence.websiteSummary,
    websiteEvidence: brandIntelligence.websiteEvidence,
    proofPoints: brandIntelligence.proofPoints,
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
