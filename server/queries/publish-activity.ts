import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { formatDistanceToNowStrict } from 'date-fns';

import { db } from '@/lib/db/client';
import { platformAccounts, postTargets, posts, publishJobs } from '../../../drizzle/schema';

export type ActivityStatus = 'published' | 'processing' | 'retrying' | 'failed' | 'scheduled';
export type Provider = 'linkedin' | 'facebook' | 'instagram' | 'x' | 'threads' | 'youtube' | 'tiktok';

export interface PublishActivityItem {
  id: string;
  postId?: string;
  publishJobId?: string;
  postTargetId?: string;
  title: string;
  provider: Provider;
  targetLabel: string;
  status: ActivityStatus;
  postType: 'text' | 'image' | 'multi_image' | 'video' | 'link';
  startedAt: string;
  completedAt?: string;
  nextRetryAt?: string;
  attempts: number;
  summary: string;
  userMessage: string;
  actionLabel?: string;
  actionHref?: string;
  actionType?: 'retry' | 'requeue';
  externalLabel?: string;
  relativeStartedAt?: string;
  relativeNextRetryAt?: string;
}

export interface ActivityFilters {
  status: 'all' | ActivityStatus;
  provider: 'all' | Provider;
  q: string;
}

export interface PublishActivityData {
  highlights: { label: string; value: string }[];
  filters: ActivityFilters;
  items: PublishActivityItem[];
  availableProviders: Array<'all' | Provider>;
  availableStatuses: Array<'all' | ActivityStatus>;
  dataSource: 'database' | 'unavailable';
}

const statusOptions: Array<'all' | ActivityStatus> = ['all', 'published', 'processing', 'retrying', 'failed', 'scheduled'];
const providerOptions: Array<'all' | Provider> = ['all', 'linkedin', 'facebook', 'instagram', 'x'];

function computeRelative(item: PublishActivityItem): PublishActivityItem {
  return {
    ...item,
    relativeStartedAt:
      item.status === 'scheduled'
        ? `Scheduled in ${formatDistanceToNowStrict(new Date(item.startedAt))}`
        : `${formatDistanceToNowStrict(new Date(item.startedAt))} ago`,
    relativeNextRetryAt: item.nextRetryAt
      ? `Retry in ${formatDistanceToNowStrict(new Date(item.nextRetryAt))}`
      : undefined,
  };
}

function mapStatus(jobStatus: string, platformStatus: string): ActivityStatus {
  if (platformStatus === 'published' || jobStatus === 'completed') return 'published';
  if (jobStatus === 'retrying' || jobStatus === 'retry_scheduled') return 'retrying';
  if (jobStatus === 'failed' || platformStatus === 'failed') return 'failed';
  if (
    platformStatus === 'processing' ||
    platformStatus === 'publishing' ||
    jobStatus === 'processing' ||
    jobStatus === 'publishing' ||
    jobStatus === 'running'
  ) {
    return 'processing';
  }
  if (platformStatus === 'scheduled' || platformStatus === 'queued' || jobStatus === 'queued') return 'scheduled';
  return 'scheduled';
}

function deriveMessages(
  status: ActivityStatus,
  provider: Provider,
  result?: Record<string, unknown> | null,
  lastError?: string | null,
) {
  const userMessage = typeof result?.userMessage === 'string' ? result.userMessage : undefined;
  const summary = typeof result?.summary === 'string' ? result.summary : undefined;
  const action = typeof result?.action === 'string' ? result.action : undefined;
  const actionHref = typeof result?.actionHref === 'string' ? result.actionHref : undefined;
  const retryable = result?.retryable === true;
  const externalLabel = typeof result?.externalLabel === 'string' ? result.externalLabel : undefined;

  if (userMessage || summary) {
    return {
      summary: summary ?? 'Publish state updated',
      userMessage: userMessage ?? 'Repurly recorded a provider update for this publish target.',
      actionLabel: action,
      actionHref,
      actionType: retryable ? ('retry' as const) : undefined,
      externalLabel,
    };
  }

  switch (status) {
    case 'published':
      return {
        summary: 'Published successfully',
        userMessage: `The ${provider} publish completed and the post target is marked live.`,
        externalLabel: 'Open live post',
      };
    case 'processing':
      return {
        summary: 'Provider still processing',
        userMessage: `${provider[0].toUpperCase() + provider.slice(1)} accepted the request and is still processing it. Repurly will keep polling automatically.`,
      };
    case 'retrying':
      return {
        summary: 'Retry scheduled automatically',
        userMessage: 'Repurly queued another attempt because the provider reported a retryable condition.',
        actionLabel: 'Open job detail',
        actionHref: '/app/channels',
      };
    case 'failed':
      return {
        summary: 'Needs attention before another publish attempt',
        userMessage: lastError ?? 'The provider rejected the publish request. Review the connection or media and retry.',
        actionLabel: 'Retry now',
        actionType: 'retry' as const,
      };
    case 'scheduled':
    default:
      return {
        summary: 'Ready for scheduled publish',
        userMessage: 'Queued for its scheduled window with a healthy publish target.',
      };
  }
}

function applyFilters(items: PublishActivityItem[], filters: ActivityFilters) {
  return items.filter((item) => {
    const statusMatch = filters.status === 'all' || item.status === filters.status;
    const providerMatch = filters.provider === 'all' || item.provider === filters.provider;
    const q = filters.q.trim().toLowerCase();
    const queryMatch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.targetLabel.toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q) ||
      item.userMessage.toLowerCase().includes(q);
    return statusMatch && providerMatch && queryMatch;
  });
}

function buildResponse(
  items: PublishActivityItem[],
  filters: ActivityFilters,
  dataSource: 'database' | 'unavailable',
): PublishActivityData {
  const filtered = applyFilters(items.map(computeRelative), filters);
  const successful = items.filter((item) => item.status === 'published').length;
  const processing = items.filter((item) => item.status === 'processing' || item.status === 'retrying').length;
  const needsAttention = items.filter((item) => item.status === 'failed').length;
  const completedDurations = items
    .filter((item) => item.completedAt)
    .map((item) => new Date(item.completedAt as string).getTime() - new Date(item.startedAt).getTime())
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  const medianMs = completedDurations.length ? completedDurations[Math.floor(completedDurations.length / 2)] : 0;
  const medianLabel = medianMs ? `${Math.floor(medianMs / 60000)}m ${Math.round((medianMs % 60000) / 1000)}s` : 'n/a';

  return {
    highlights: [
      { label: 'Successful in last 7 days', value: String(successful) },
      { label: 'Processing now', value: String(processing) },
      { label: 'Need attention', value: String(needsAttention) },
      { label: 'Median publish time', value: medianLabel },
    ],
    filters,
    items: filtered,
    availableProviders: providerOptions,
    availableStatuses: statusOptions,
    dataSource,
  };
}

export async function getPublishActivity(filters: Partial<ActivityFilters> = {}): Promise<PublishActivityData> {
  const resolvedFilters: ActivityFilters = {
    status: statusOptions.includes((filters.status as ActivityFilters['status']) ?? 'all')
      ? ((filters.status as ActivityFilters['status']) ?? 'all')
      : 'all',
    provider: providerOptions.includes((filters.provider as ActivityFilters['provider']) ?? 'all')
      ? ((filters.provider as ActivityFilters['provider']) ?? 'all')
      : 'all',
    q: filters.q?.trim() ?? '',
  };

  if (!process.env.DATABASE_URL) {
    return buildResponse([], resolvedFilters, 'unavailable');
  }

  try {
    const conditions = [];
    if (resolvedFilters.provider !== 'all') {
      conditions.push(eq(postTargets.provider, resolvedFilters.provider));
    }
    if (resolvedFilters.q) {
      const pattern = `%${resolvedFilters.q}%`;
      conditions.push(
        or(
          ilike(posts.title, pattern),
          ilike(platformAccounts.displayName, pattern),
          ilike(platformAccounts.handle, pattern),
        )!,
      );
    }

    const rows = await db
      .select({
        postId: posts.id,
        jobId: publishJobs.id,
        postTargetId: postTargets.id,
        title: posts.title,
        provider: postTargets.provider,
        targetLabel: platformAccounts.displayName,
        targetHandle: platformAccounts.handle,
        platformStatus: postTargets.platformStatus,
        jobStatus: publishJobs.status,
        postType: posts.postType,
        scheduledFor: publishJobs.scheduledFor,
        completedAt: publishJobs.completedAt,
        attempts: publishJobs.attemptCount,
        lastAttemptAt: publishJobs.lastAttemptAt,
        lastError: publishJobs.lastError,
        result: postTargets.result,
        externalId: postTargets.publishedExternalId,
      })
      .from(publishJobs)
      .innerJoin(postTargets, eq(postTargets.id, publishJobs.postTargetId))
      .innerJoin(posts, eq(posts.id, publishJobs.postId))
      .innerJoin(platformAccounts, eq(platformAccounts.id, postTargets.platformAccountId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(sql`coalesce(${publishJobs.lastAttemptAt}, ${publishJobs.scheduledFor})`))
      .limit(100);

    const items: PublishActivityItem[] = rows.map((row) => {
      const status = mapStatus(row.jobStatus, row.platformStatus);
      const details = deriveMessages(
        status,
        row.provider as Provider,
        row.result as Record<string, unknown> | null,
        row.lastError,
      );
      const nextRetryAt =
        status === 'retrying' && row.lastAttemptAt
          ? new Date(new Date(row.lastAttemptAt).getTime() + 5 * 60 * 1000).toISOString()
          : undefined;
      const scheduledActionHref = status === 'scheduled' ? `/app/content?postId=${row.postId}` : undefined;
      const scheduledActionLabel = status === 'scheduled' ? 'Edit post' : undefined;

      return {
        id: `${row.jobId}:${row.postTargetId}`,
        postId: row.postId,
        publishJobId: row.jobId,
        postTargetId: row.postTargetId,
        title: row.title,
        provider: row.provider as Provider,
        targetLabel: row.targetLabel || row.targetHandle,
        status,
        postType: (row.postType ?? 'text') as PublishActivityItem['postType'],
        startedAt: (row.lastAttemptAt ?? row.scheduledFor ?? new Date()).toISOString(),
        completedAt: row.completedAt?.toISOString(),
        nextRetryAt,
        attempts: row.attempts ?? 0,
        summary: details.summary,
        userMessage: details.userMessage,
        actionLabel: scheduledActionLabel ?? details.actionLabel,
        actionHref: scheduledActionHref ?? details.actionHref,
        actionType: status === 'scheduled' ? undefined : details.actionType,
        externalLabel: row.externalId ? details.externalLabel ?? 'Open live post' : details.externalLabel,
      };
    });

    return buildResponse(items, resolvedFilters, 'database');
  } catch {
    return buildResponse([], resolvedFilters, 'unavailable');
  }
}
