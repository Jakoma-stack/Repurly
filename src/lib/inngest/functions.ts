import { and, desc, eq, lte, or } from "drizzle-orm";
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { db } from "@/lib/db/client";
import { deliveryLogs, platformAccounts, postTargets, posts, publishJobs } from "../../../drizzle/schema";
import { publishToPlatform } from "@/lib/platforms/publish";
import { buildPublishIdempotencyKey } from "@/lib/publish/idempotency";
import { sendOpsAlert } from "@/lib/alerts/service";
import { extractProviderCorrelation } from "@/lib/publish/correlation";
import { recordUsageEvent } from "@/lib/usage/metering";
import { createNotificationDeliveries } from "@/lib/notifications/delivery";
import type { PlatformKey, PublishMedia, PostType, PublishResult, TargetType } from "@/lib/platforms/types";

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
  if (typeof value === "string" && value) return new Date(value);
  return fallback;
}

function buildFailureResult(error: unknown): PublishResult {
  const message = error instanceof Error ? error.message : "Platform publish failed";
  const retryable = typeof error === "object" && error !== null && "retryable" in error
    ? Boolean((error as { retryable?: unknown }).retryable)
    : true;

  return {
    id: "",
    status: "failed",
    raw: {
      userMessage: message,
      retryable,
    },
  };
}

export const publishDuePosts = inngest.createFunction(
  { id: "publish-due-posts", retries: 3 },
  { cron: "* * * * *" },
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
        data: { jobId: job.id, postId: job.postId, postTargetId: job.postTargetId },
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
      const [platformAccount] = target?.platformAccountId
        ? await db.select().from(platformAccounts).where(eq(platformAccounts.id, target.platformAccountId)).limit(1)
        : [];
      const [job] = event.data.jobId
        ? await db.select().from(publishJobs).where(eq(publishJobs.id, event.data.jobId)).limit(1)
        : await db
            .select()
            .from(publishJobs)
            .where(
              event.data.postTargetId
                ? and(eq(publishJobs.postId, event.data.postId), eq(publishJobs.postTargetId, event.data.postTargetId))
                : eq(publishJobs.postId, event.data.postId)
            )
            .orderBy(desc(publishJobs.scheduledFor))
            .limit(1);
      return { post, target, platformAccount, job };
    });

    if (!payload.post) throw new Error("Post not found");

    const provider = (payload.target?.provider ?? (payload.post.metadata?.provider as PlatformKey | undefined) ?? "linkedin") as PlatformKey;
    const idempotencyKey = buildPublishIdempotencyKey({
      postId: payload.post.id,
      postTargetId: payload.target?.id,
      provider,
      scheduledFor: payload.job?.scheduledFor ?? payload.post.scheduledFor ?? new Date(),
    });

    if (payload.job?.idempotencyKey && payload.job.idempotencyKey === idempotencyKey && payload.job.status === "completed") {
      return {
        status: "published" as const,
        id: payload.target?.publishedExternalId ?? payload.post.publishedExternalId ?? "already-published",
        raw: { deduplicated: true },
      };
    }

    const claimed = await step.run("claim-publish-job", async () => {
      if (!payload.job?.id) {
        return { proceed: true };
      }

      const now = new Date();
      const updated = await db
        .update(publishJobs)
        .set({
          status: "publishing",
          lastAttemptAt: now,
          lastError: null,
        })
        .where(
          and(
            eq(publishJobs.id, payload.job.id),
            or(eq(publishJobs.status, "queued"), eq(publishJobs.status, "retry_scheduled"))
          )
        )
        .returning({ id: publishJobs.id });

      if (!updated.length) {
        return { proceed: false };
      }

      await db.update(posts).set({ status: "publishing", updatedAt: now }).where(eq(posts.id, payload.post!.id));

      if (payload.target?.id) {
        await db.update(postTargets).set({ platformStatus: "processing", updatedAt: now }).where(eq(postTargets.id, payload.target.id));
      }

      return { proceed: true };
    });

    if (!claimed.proceed) {
      return {
        status: "published" as const,
        id: payload.target?.publishedExternalId ?? payload.post.publishedExternalId ?? "skipped",
        raw: { skipped: true, reason: "job-already-claimed" },
      };
    }

    const authorUrnOrId =
      (typeof payload.target?.result?.authorUrn === "string" && payload.target.result.authorUrn) ||
      (typeof payload.platformAccount?.handle === "string" && payload.platformAccount.handle) ||
      (typeof payload.post.metadata?.authorUrn === "string" && payload.post.metadata.authorUrn) ||
      "";

    const result = await step.run("publish-via-platform-adapter", async () => {
      try {
        if (!authorUrnOrId) {
          throw Object.assign(new Error("Missing LinkedIn author URN for selected publish target"), { retryable: false });
        }

        return await publishToPlatform({
          workspaceId: payload.post!.workspaceId,
          provider,
          authorUrnOrId,
          targetType: (payload.target?.targetType ?? payload.post!.metadata?.targetType ?? "member") as TargetType,
          postType: payload.post!.postType as PostType,
          body: payload.post!.body,
          title: payload.post!.title,
          media: (payload.post!.metadata?.media ?? []) as PublishMedia[],
          metadata: payload.post!.metadata ?? {},
        });
      } catch (error) {
        console.error("publish-single-post: publish failed", {
          postId: payload.post?.id,
          postTargetId: payload.target?.id,
          provider,
          authorUrnOrId,
          error,
        });
        return buildFailureResult(error);
      }
    });

    await step.run("persist-publish-state", async () => {
      const now = new Date();
      const attemptCount = (payload.job?.attemptCount ?? 0) + 1;
      const retryLimit = PROVIDER_RETRY_LIMITS[provider] ?? 4;
      const shouldRetry = result.status === "queued" || (result.status === "failed" && attemptCount < retryLimit && result.raw?.retryable !== false);
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
          authorUrn: authorUrnOrId,
          lastPublishResult: result.raw ?? {},
        },
      }).where(eq(posts.id, payload.post!.id));

      if (payload.job?.id) {
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
        }).where(eq(publishJobs.id, payload.job.id));
      } else {
        await db.update(publishJobs).set({
          status: nextJobStatus,
          completedAt: result.status === "published" || (result.status === "failed" && !shouldRetry) ? now : null,
          lastAttemptAt: now,
          lastError,
          attemptCount,
          scheduledFor: shouldRetry ? new Date(Date.now() + 5 * 60 * 1000) : now,
          idempotencyKey,
          providerCorrelationId: correlation.correlationId ?? null,
          providerContainerId: correlation.containerId ?? null,
          providerUploadId: correlation.uploadId ?? null,
        }).where(eq(publishJobs.postId, payload.post!.id));
      }

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
            authorUrn: authorUrnOrId,
            idempotencyKey,
            providerCorrelationId: correlation.correlationId,
            providerContainerId: correlation.containerId,
            providerUploadId: correlation.uploadId,
          },
          updatedAt: now,
        }).where(eq(postTargets.id, payload.target.id));
      }

      if (result.status === "failed" && !shouldRetry) {
        await sendOpsAlert({
          source: `${provider}.publish`,
          title: "Publish job failed permanently",
          severity: "critical",
          message: lastError ?? "A publish job failed and exhausted its retries.",
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
        eventType: result.status === "published" ? "publish.accepted" : result.status === "queued" ? "publish.processing" : "publish.failed",
        level: result.status === "failed" ? "error" : result.status === "queued" ? "warning" : "info",
        message: result.status === "published"
          ? `${provider} accepted the publish request and returned provider identifiers.`
          : result.status === "queued"
            ? String(result.raw?.userMessage ?? "The provider is still processing this publish request.")
            : String(lastError ?? "The provider rejected the publish request."),
        correlationId: correlation.correlationId ?? null,
        providerStatus: result.status,
        payload: {
          ...(result.raw ?? {}),
          authorUrn: authorUrnOrId,
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
        eventGroup: "publish_updates",
        title: result.status === "published" ? `${provider} publish accepted` : `${provider} publish update`,
        message: result.status === "published"
          ? `${provider} accepted the publish request and Repurly stored the provider identifiers.`
          : String(lastError ?? result.raw?.userMessage ?? "The provider reported a publish state change."),
        actionHref: payload.job?.id ? `/app/activity/${payload.job.id}` : "/app/activity",
      }).catch(() => undefined);

      if (result.status === "published" && payload.post?.workspaceId) {
        await recordUsageEvent({
          workspaceId: payload.post.workspaceId,
          metricKey: "published_post",
          quantity: 1,
          metadata: { provider, postId: payload.post.id, postTargetId: payload.target?.id },
        });
      }

      const refreshExpiry = payload.post?.metadata?.refreshTokenExpiresAt;
      if (typeof refreshExpiry === "string") {
        const msLeft = new Date(refreshExpiry).getTime() - Date.now();
        if (msLeft < 7 * 24 * 60 * 60 * 1000) {
          await sendOpsAlert({
            source: `${provider}.auth`,
            title: "Channel token nearing expiry",
            severity: "warning",
            message: "A connected channel will require reauthorization soon.",
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
