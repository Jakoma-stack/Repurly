import { eq } from 'drizzle-orm';
import { formatDistanceToNowStrict } from 'date-fns';

import { db } from '@/lib/db/client';
import { platformAccounts, postTargets, posts, publishJobs } from '../../../drizzle/schema';

export type ActivityStatus = 'published' | 'processing' | 'retrying' | 'failed' | 'scheduled';
export type Provider = 'linkedin' | 'facebook' | 'instagram' | 'x' | 'threads' | 'youtube' | 'tiktok';

export interface PublishActivityDetail {
  item: {
    id: string;
    postId?: string;
    publishJobId?: string;
    postTargetId?: string;
    title: string;
    provider: Provider;
    targetLabel: string;
    targetType?: string;
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
    externalId?: string;
  };
  ids: {
    publishJobId?: string;
    postTargetId?: string;
    postId?: string;
    platformAccountId?: string;
    providerExternalId?: string;
    containerId?: string;
    uploadId?: string;
    mediaId?: string;
  };
  rawProviderPayload?: unknown;
  rawResult?: unknown;
  deliveryLogTrail: Array<{
    id: string;
    eventType: string;
    message: string;
    level: string;
    providerStatus?: string;
    correlationId?: string;
    payload?: unknown;
    relativeCreatedAt: string;
  }>;
  auditTrail: Array<{
    id: string;
    eventType: string;
    entityType: string;
    entityId: string;
    actorLabel: string;
    payload?: unknown;
    relativeCreatedAt: string;
  }>;
  retryGuidance: Array<{
    title: string;
    body: string;
    actionLabel?: string;
    actionHref?: string;
  }>;
  notificationDeliveries: Array<{
    id: string;
    channel: string;
    status: string;
    subject?: string;
    destination?: string;
    message: string;
    createdAt: string;
  }>;
  dataSource: 'database' | 'preview';
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

function deriveRetryGuidance(status: ActivityStatus, provider: Provider, lastError?: string | null) {
  if (status === 'failed') {
    return [
      {
        title: 'Reconnect or refresh channel access',
        body: lastError ?? `The ${provider} publish request failed. Verify account health and token validity before retrying.`,
        actionLabel: 'Open settings',
        actionHref: '/app/settings?provider=linkedin',
      },
      {
        title: 'Retry from this screen',
        body: 'Use Retry now after confirming the target is still healthy.',
      },
    ];
  }

  if (status === 'retrying') {
    return [
      {
        title: 'Allow automatic recovery first',
        body: 'Repurly already has this job in a retry path. Only intervene if it stalls.',
      },
    ];
  }

  if (status === 'scheduled') {
    return [
      {
        title: 'Edit the queued post',
        body: 'Open the composer to adjust time, copy, or target without creating a new workflow item.',
        actionLabel: 'Edit post',
        actionHref: undefined,
      },
    ];
  }

  return [
    {
      title: 'No recovery action needed',
      body: 'This job does not currently require operator intervention.',
    },
  ];
}

export async function getPublishActivityDetail(publishJobId: string): Promise<PublishActivityDetail | null> {
  if (!process.env.DATABASE_URL || !publishJobId) {
    return null;
  }

  const rows = await db
    .select({
      publishJobId: publishJobs.id,
      postId: posts.id,
      postTargetId: postTargets.id,
      platformAccountId: platformAccounts.id,
      title: posts.title,
      provider: postTargets.provider,
      targetLabel: platformAccounts.displayName,
      targetHandle: platformAccounts.handle,
      targetType: postTargets.targetType,
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
      providerExternalId: platformAccounts.externalAccountId,
    })
    .from(publishJobs)
    .innerJoin(postTargets, eq(postTargets.id, publishJobs.postTargetId))
    .innerJoin(posts, eq(posts.id, publishJobs.postId))
    .innerJoin(platformAccounts, eq(platformAccounts.id, postTargets.platformAccountId))
    .where(eq(publishJobs.id, publishJobId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const status = mapStatus(row.jobStatus, row.platformStatus);
  const startedAtValue = row.lastAttemptAt ?? row.scheduledFor ?? new Date();
  const resultObj = (row.result as Record<string, unknown> | null | undefined) ?? undefined;
  const userMessage =
    typeof resultObj?.userMessage === 'string'
      ? resultObj.userMessage
      : status === 'scheduled'
        ? 'Queued for its scheduled window with a healthy publish target.'
        : status === 'failed'
          ? row.lastError ?? 'The provider rejected the publish request. Review the connection and retry.'
          : status === 'processing'
            ? 'The provider accepted the request and Repurly is waiting for confirmation.'
            : status === 'retrying'
              ? 'Repurly queued another attempt because the provider reported a retryable condition.'
              : 'The publish completed successfully.';
  const summary =
    typeof resultObj?.summary === 'string'
      ? resultObj.summary
      : status === 'scheduled'
        ? 'Ready for scheduled publish'
        : status === 'failed'
          ? 'Needs attention before another publish attempt'
          : status === 'processing'
            ? 'Provider still processing'
            : status === 'retrying'
              ? 'Retry scheduled automatically'
              : 'Published successfully';

  return {
    item: {
      id: `${row.publishJobId}:${row.postTargetId}`,
      postId: row.postId,
      publishJobId: row.publishJobId,
      postTargetId: row.postTargetId,
      title: row.title,
      provider: row.provider as Provider,
      targetLabel: row.targetLabel || row.targetHandle || 'LinkedIn target',
      targetType: row.targetType ?? undefined,
      status,
      postType: (row.postType ?? 'text') as PublishActivityDetail['item']['postType'],
      startedAt: startedAtValue.toISOString(),
      completedAt: row.completedAt?.toISOString(),
      attempts: row.attempts ?? 0,
      summary,
      userMessage,
      actionLabel: status === 'scheduled' ? 'Edit post' : undefined,
      actionHref: status === 'scheduled' ? `/app/content?postId=${row.postId}` : undefined,
      actionType: undefined,
      externalLabel: row.externalId ? 'Open live post' : undefined,
      relativeStartedAt:
        status === 'scheduled'
          ? `Scheduled in ${formatDistanceToNowStrict(startedAtValue)}`
          : `${formatDistanceToNowStrict(startedAtValue)} ago`,
      relativeNextRetryAt: undefined,
      externalId: row.externalId ?? undefined,
    },
    ids: {
      publishJobId: row.publishJobId,
      postTargetId: row.postTargetId,
      postId: row.postId,
      platformAccountId: row.platformAccountId,
      providerExternalId: row.providerExternalId ?? undefined,
      containerId: undefined,
      uploadId: undefined,
      mediaId: undefined,
    },
    rawProviderPayload: row.result ?? null,
    rawResult: row.result ?? null,
    deliveryLogTrail: [],
    auditTrail: [
      {
        id: `${row.publishJobId}-created`,
        eventType: 'publish_job_recorded',
        entityType: 'publish_job',
        entityId: row.publishJobId,
        actorLabel: 'Repurly workflow',
        payload: {
          status: row.jobStatus,
          scheduledFor: row.scheduledFor?.toISOString() ?? null,
        },
        relativeCreatedAt: `${formatDistanceToNowStrict(startedAtValue)} ago`,
      },
    ],
    retryGuidance: deriveRetryGuidance(status, row.provider as Provider, row.lastError).map((entry) => ({
      ...entry,
      actionHref: entry.actionHref ?? (status === 'scheduled' ? `/app/content?postId=${row.postId}` : undefined),
    })),
    notificationDeliveries: [],
    dataSource: 'database',
  };
}
