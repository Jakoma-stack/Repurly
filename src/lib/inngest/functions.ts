import { and, eq, lte, or } from "drizzle-orm";
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { db } from "@/lib/db/client";
import { deliveryLogs, postTargets, posts, publishJobs } from "../../../drizzle/schema";
import { publishToPlatform } from "@/lib/platforms/publish";
import { buildPublishIdempotencyKey } from "@/lib/publish/idempotency";
import { sendOpsAlert } from "@/lib/alerts/service";
import { extractProviderCorrelation } from "@/lib/publish/correlation";
import { recordUsageEvent } from "@/lib/usage/metering";
import { createNotificationDeliveries } from "@/lib/notifications/delivery";
import type { PlatformKey, PublishMedia, PostType, TargetType } from "@/lib/platforms/types";

const PROVIDER_RETRY_LIMITS: Record<string, number> = {
  linkedin: 4,
  facebook: 5,
  instagram: 6,
  x: 4,
  threads: 4,
  youtube: 5,
  tiktok: 5,
};


function toDateValue(value: string | Date | null | undefined, fallback = new Date()) {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && value) return new Date(value);
  return fallback;
}

export const publishDuePosts = inngest.createFunction(
  { id: "publish-due-posts", retries: 3 },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    const dueJobs = await step.run("load-due-jobs", async () => {
      return db
        .select()
        .from(publishJobs)
        .where(
          and(
            or(eq(publishJobs.status, "queued"), eq(publishJobs.status, "retry_scheduled")),
            lte(publishJobs.scheduledFor, new Date())
          )
        );
    });

    for (const job of dueJobs) {
      await step.sendEvent("enqueue-single-publish", {
        name: "repurly/post.publish.requested",
        data: { postId: job.postId, postTargetId: job.postTargetId },
      });
    }

    return { queued: dueJobs.length };
  }
);

export const publishSinglePost = inngest.createFunction(
  { id: "publish-single-post", retries: 4 },
  { event: "repurly/post.publish.requested" },
  async ({ event, step }) => {
    const payload = await step.run("load-post-and-target", async () => {
      const [post] = await db.select().from(posts).where(eq(posts.id, event.data.postId)).limit(1);
      const [target] = event.data.postTargetId
        ? await db.select().from(postTargets).where(eq(postTargets.id, event.data.postTargetId)).limit(1)
        : [];
      const [job] = await db.select().from(publishJobs).where(eq(publishJobs.postId, event.data.postId)).limit(1);
      return { post, target, job };
    });

    if (!payload.post) throw new Error("Post not found");

    const provider = (payload.target?.provider ?? (payload.post.metadata?.provider as PlatformKey | undefined) ?? "linkedin") as PlatformKey;
    const idempotencyKey = buildPublishIdempotencyKey({
      postId: payload.post.id,
      postTargetId: payload.target?.id,
      provider,
      scheduledFor: payload.job?.scheduledFor ?? payload.post.scheduledFor ?? new Date(),
    });

    if (payload.job?.idempotencyKey && payload.job.idempotencyKey === idempotencyKey && payload.job.status === 'completed') {
      return { status: 'published', id: payload.target?.publishedExternalId ?? payload.post.publishedExternalId ?? 'already-published', raw: { deduplicated: true } };
    }

    const result = await step.run("publish-via-platform-adapter", async () => {
      return publishToPlatform({
        workspaceId: payload.post!.workspaceId,
        provider,
        authorUrnOrId: String(payload.target?.result?.authorUrn ?? payload.post!.metadata?.authorUrn ?? ""),
        targetType: (payload.target?.targetType ?? payload.post!.metadata?.targetType ?? "member") as TargetType,
        postType: payload.post!.postType as PostType,
        body: payload.post!.body,
        title: payload.post!.title,
        media: (payload.post!.metadata?.media ?? []) as PublishMedia[],
        metadata: payload.post!.metadata ?? {},
      });
    });

    await step.run("persist-publish-state", async () => {
      const now = new Date();
      const attemptCount = (payload.job?.attemptCount ?? 0) + 1;
      const retryLimit = PROVIDER_RETRY_LIMITS[provider] ?? 4;
      const shouldRetry = result.status === 'queued' || (result.status === 'failed' && attemptCount < retryLimit && result.raw?.retryable !== false);
      const nextJobStatus = result.status === "published" ? "completed" : shouldRetry ? "retry_scheduled" : "failed";
      const nextPostStatus = result.status === "published" ? "published" : result.status === "failed" && !shouldRetry ? "failed" : payload.post!.status;
      const nextTargetStatus = result.status === "published" ? "published" : result.status === "failed" && !shouldRetry ? "failed" : "processing";
      const lastError = result.status === "failed"
        ? String(result.raw?.userMessage ?? result.raw?.note ?? "Platform publish failed")
        : result.status === "queued"
          ? String(result.raw?.userMessage ?? "Waiting for platform processing")
          : null;
      const correlation = extractProviderCorrelation(result.raw ?? {}, result.id);

      await db.update(posts).set({
        status: nextPostStatus,
        publishedAt: result.status === "published" ? now : toDateValue(payload.post!.publishedAt, now),
        publishedExternalId: result.status === "published" ? result.id : payload.post!.publishedExternalId,
        updatedAt: now,
        metadata: {
          ...(payload.post!.metadata ?? {}),
          lastPublishResult: result.raw ?? {},
        },
      }).where(eq(posts.id, payload.post!.id));

      await db.update(publishJobs).set({
        status: nextJobStatus,
        completedAt: result.status === "published" || (result.status === "failed" && !shouldRetry) ? now : null,
        lastAttemptAt: now,
        lastError,
        attemptCount,
        scheduledFor: shouldRetry ? new Date(Date.now() + 5 * 60 * 1000) : toDateValue(payload.job?.scheduledFor, now),
        idempotencyKey,
        providerCorrelationId: correlation.correlationId ?? null,
        providerContainerId: correlation.containerId ?? null,
        providerUploadId: correlation.uploadId ?? null,
      }).where(eq(publishJobs.postId, payload.post!.id));

      if (payload.target) {
        await db.update(postTargets).set({
          platformStatus: nextTargetStatus,
          publishedAt: result.status === "published" ? now : toDateValue(payload.target.publishedAt, now),
          publishedExternalId: result.status === "published" ? result.id : payload.target.publishedExternalId,
          providerCorrelationId: correlation.correlationId ?? null,
          providerContainerId: correlation.containerId ?? null,
          providerUploadId: correlation.uploadId ?? null,
          result: {
            ...(payload.target.result ?? {}),
            ...(result.raw ?? {}),
            idempotencyKey,
            providerCorrelationId: correlation.correlationId,
            providerContainerId: correlation.containerId,
            providerUploadId: correlation.uploadId,
          },
          updatedAt: now,
        }).where(eq(postTargets.id, payload.target.id));
      }

      if (result.status === 'failed' && !shouldRetry) {
        await sendOpsAlert({
          source: `${provider}.publish`,
          title: 'Publish job failed permanently',
          severity: 'critical',
          message: lastError ?? 'A publish job failed and exhausted its retries.',
          metadata: {
            postId: payload.post?.id,
            postTargetId: payload.target?.id,
            attemptCount,
          },
        });
      }

      await db.insert(deliveryLogs).values({
        workspaceId: payload.post!.workspaceId,
        publishJobId: payload.job?.id ?? null,
        postTargetId: payload.target?.id ?? null,
        provider,
        eventType: result.status === 'published' ? 'publish.accepted' : result.status === 'queued' ? 'publish.processing' : 'publish.failed',
        level: result.status === 'failed' ? 'error' : result.status === 'queued' ? 'warning' : 'info',
        message: result.status === 'published'
          ? `${provider} accepted the publish request and returned provider identifiers.`
          : result.status === 'queued'
            ? String(result.raw?.userMessage ?? 'The provider is still processing this publish request.')
            : String(lastError ?? 'The provider rejected the publish request.'),
        correlationId: correlation.correlationId ?? null,
        providerStatus: result.status,
        payload: {
          ...(result.raw ?? {}),
          providerCorrelationId: correlation.correlationId,
          providerContainerId: correlation.containerId,
          providerUploadId: correlation.uploadId,
          idempotencyKey,
        },
      }).catch(() => undefined);

      await createNotificationDeliveries({
        workspaceId: payload.post!.workspaceId,
        publishJobId: payload.job?.id ?? null,
        deliveryLogId: null,
        eventGroup: 'publish_updates',
        title: result.status === 'published' ? `${provider} publish accepted` : `${provider} publish update`,
        message: result.status === 'published'
          ? `${provider} accepted the publish request and Repurly stored the provider identifiers.`
          : String(lastError ?? result.raw?.userMessage ?? 'The provider reported a publish state change.'),
        actionHref: payload.job?.id ? `/app/activity/${payload.job.id}` : '/app/activity',
      }).catch(() => undefined);

      if (result.status === 'published' && payload.post?.workspaceId) {
        await recordUsageEvent({
          workspaceId: payload.post.workspaceId,
          metricKey: 'published_post',
          quantity: 1,
          metadata: { provider, postId: payload.post.id, postTargetId: payload.target?.id },
        });
      }

      const refreshExpiry = payload.post?.metadata?.refreshTokenExpiresAt;
      if (typeof refreshExpiry === 'string') {
        const msLeft = new Date(refreshExpiry).getTime() - Date.now();
        if (msLeft < 7 * 24 * 60 * 60 * 1000) {
          await sendOpsAlert({
            source: `${provider}.auth`,
            title: 'Channel token nearing expiry',
            severity: 'warning',
            message: 'A connected channel will require reauthorization soon.',
            metadata: { postId: payload.post?.id, refreshTokenExpiresAt: refreshExpiry },
          });
        }
      }
    });

    return result;
  }
);

export const functions = [publishDuePosts, publishSinglePost];
export const { GET, POST, PUT } = serve({ client: inngest, functions });
