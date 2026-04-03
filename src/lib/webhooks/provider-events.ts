import { eq, or } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { alertEvents, auditEvents, deliveryLogs, postTargets, posts, publishJobs } from '../../../drizzle/schema';
import { sendOpsAlert } from '@/lib/alerts/service';
import { extractProviderCorrelation } from '@/lib/publish/correlation';
import { createNotificationDeliveries } from '@/lib/notifications/delivery';

type Provider = 'meta' | 'x' | 'youtube';
type ProviderStatus = 'processing' | 'published' | 'failed' | 'retrying';

type Match = {
  jobId?: string;
  postTargetId?: string;
  workspaceId: string;
  existingResult: Record<string, unknown> | null;
};

function parseProviderStatus(payload: Record<string, unknown>): ProviderStatus {
  const raw = String(payload.status ?? payload.event ?? payload.state ?? payload.containerStatus ?? payload.processingStatus ?? '').toLowerCase();
  if (/(finish|publish|success|ready)/.test(raw)) return 'published';
  if (/(fail|reject|error|expired)/.test(raw)) return 'failed';
  if (/retry/.test(raw)) return 'retrying';
  return 'processing';
}

function deriveEntityId(payload: Record<string, unknown>) {
  return String(payload.id ?? payload.eventId ?? payload.containerId ?? payload.uploadId ?? payload.mediaId ?? payload.externalPostId ?? Date.now());
}

function buildMessage(provider: Provider, status: ProviderStatus, payload: Record<string, unknown>) {
  if (typeof payload.userMessage === 'string') return payload.userMessage;
  if (status === 'published') return `${provider} confirmed the publish workflow completed successfully.`;
  if (status === 'failed') return `${provider} reported a publish failure. Review the provider payload and retry once the issue is resolved.`;
  if (status === 'retrying') return `${provider} signalled a temporary issue. Repurly will retry automatically.`;
  return `${provider} accepted the publish request and is still processing it.`;
}

async function lookupByCorrelation(correlationId?: string, containerId?: string, uploadId?: string): Promise<Match | undefined> {
  const conditions = [
    correlationId ? eq(postTargets.providerCorrelationId, correlationId) : undefined,
    correlationId ? eq(publishJobs.providerCorrelationId, correlationId) : undefined,
    containerId ? eq(postTargets.providerContainerId, containerId) : undefined,
    containerId ? eq(publishJobs.providerContainerId, containerId) : undefined,
    uploadId ? eq(postTargets.providerUploadId, uploadId) : undefined,
    uploadId ? eq(publishJobs.providerUploadId, uploadId) : undefined,
  ].filter(Boolean) as any[];

  if (!conditions.length) return undefined;

  const rows = await db
    .select({
      jobId: publishJobs.id,
      postTargetId: postTargets.id,
      workspaceId: posts.workspaceId,
      existingResult: postTargets.result,
    })
    .from(postTargets)
    .leftJoin(publishJobs, eq(publishJobs.postTargetId, postTargets.id))
    .innerJoin(posts, eq(posts.id, postTargets.postId))
    .where(or(...conditions))
    .limit(1)
    .catch(() => []);

  const row = rows[0];
  if (!row) return undefined;
  return {
    jobId: row.jobId ?? undefined,
    postTargetId: row.postTargetId,
    workspaceId: row.workspaceId,
    existingResult: (row.existingResult as Record<string, unknown> | null) ?? null,
  };
}

export async function mapProviderWebhookToPublishState(provider: Provider, payload: Record<string, unknown>) {
  const status = parseProviderStatus(payload);
  const message = buildMessage(provider, status, payload);
  const entityId = deriveEntityId(payload);
  const correlation = extractProviderCorrelation(payload);
  const workspaceId = String(payload.workspaceId ?? '00000000-0000-0000-0000-000000000000');
  const match = process.env.DATABASE_URL ? await lookupByCorrelation(correlation.correlationId, correlation.containerId, correlation.uploadId) : undefined;
  const resolvedWorkspaceId = match?.workspaceId ?? workspaceId;

  if (process.env.DATABASE_URL && match?.postTargetId) {
    await db.update(postTargets).set({
      platformStatus: status === 'retrying' ? 'queued' : status,
      publishedAt: status === 'published' ? new Date() : undefined,
      providerCorrelationId: correlation.correlationId,
      providerContainerId: correlation.containerId,
      providerUploadId: correlation.uploadId,
      updatedAt: new Date(),
      result: {
        ...(match.existingResult ?? {}),
        callbackMappedAt: new Date().toISOString(),
        userMessage: message,
        providerPayload: payload,
        providerCorrelationId: correlation.correlationId,
        providerContainerId: correlation.containerId,
        providerUploadId: correlation.uploadId,
      },
    }).where(eq(postTargets.id, match.postTargetId)).catch(() => undefined);

    if (match.jobId) {
      await db.update(publishJobs).set({
        status: status === 'published' ? 'completed' : status === 'failed' ? 'failed' : status === 'retrying' ? 'queued' : 'processing',
        lastError: status === 'failed' ? message : null,
        lastAttemptAt: new Date(),
        completedAt: status === 'published' ? new Date() : null,
        providerCorrelationId: correlation.correlationId,
        providerContainerId: correlation.containerId,
        providerUploadId: correlation.uploadId,
      }).where(eq(publishJobs.id, match.jobId)).catch(() => undefined);
    }
  }

  const providerKey = provider === 'meta' ? 'instagram' : provider;

  const insertedLog = await db.insert(deliveryLogs).values({
    workspaceId: resolvedWorkspaceId,
    publishJobId: match?.jobId ?? null,
    postTargetId: match?.postTargetId ?? null,
    provider: providerKey,
    eventType: 'provider.callback',
    level: status === 'failed' ? 'error' : status === 'retrying' ? 'warning' : 'info',
    message,
    correlationId: correlation.correlationId ?? null,
    providerStatus: status,
    payload: {
      ...payload,
      mappedPublishJobId: match?.jobId,
      mappedPostTargetId: match?.postTargetId,
      providerCorrelationId: correlation.correlationId,
      providerContainerId: correlation.containerId,
      providerUploadId: correlation.uploadId,
    },
  }).returning({ id: deliveryLogs.id }).catch(() => []);

  await db.insert(auditEvents).values({
    workspaceId: resolvedWorkspaceId,
    actorId: null,
    eventType: 'provider.webhook.mapped',
    entityType: provider,
    entityId,
    payload: {
      providerPayload: payload,
      providerStatus: status,
      providerCorrelationId: correlation.correlationId,
      mappedPublishJobId: match?.jobId,
      mappedPostTargetId: match?.postTargetId,
    },
  }).catch(() => undefined);

  const actionHref = match?.jobId ? `/app/activity/${match.jobId}` : '/app/activity';

  await createNotificationDeliveries({
    workspaceId: resolvedWorkspaceId,
    publishJobId: match?.jobId ?? null,
    deliveryLogId: insertedLog[0]?.id ?? null,
    eventGroup: 'publish_updates',
    title: status === 'published' ? `${providerKey} publish completed` : `${providerKey} publish update`,
    message,
    actionHref,
  }).catch(() => undefined);

  if (status !== 'published') {
    await db.insert(alertEvents).values({
      workspaceId: resolvedWorkspaceId,
      severity: status === 'failed' ? 'critical' : 'warning',
      source: `${provider}.publish`,
      title: status === 'failed' ? `${provider} publish needs attention` : `${provider} publish update recorded`,
      body: message,
      metadata: { actionLabel: 'Open activity', actionHref },
    }).catch(() => undefined);

    await sendOpsAlert({
      source: `${provider}.publish`,
      title: status === 'failed' ? `${provider} publish failed` : `${provider} publish update`,
      severity: status === 'failed' ? 'critical' : 'warning',
      message,
      metadata: { providerCorrelationId: correlation.correlationId, publishJobId: match?.jobId, postTargetId: match?.postTargetId },
    });
  }

  return {
    provider,
    mapped: Boolean(match?.postTargetId || match?.jobId),
    workspaceId: resolvedWorkspaceId,
    publishJobId: match?.jobId,
    postTargetId: match?.postTargetId,
    status,
    message,
    entityId,
    payload,
  };
}
