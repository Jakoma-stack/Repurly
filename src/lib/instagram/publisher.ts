import { getIntegration } from "@/lib/integrations/service";
import {
  createInstagramCarouselContainer,
  createInstagramMediaContainer,
  getInstagramContainerStatus,
  publishInstagramContainer,
} from "@/lib/instagram/client";
import { formatInstagramStatusMessage, normalizeInstagramContainerStatus } from "@/lib/instagram/status";
import type { PublishRequest, PublishResult } from "@/lib/platforms/types";

const DEFAULT_POLL_ATTEMPTS = Number(process.env.INSTAGRAM_STATUS_MAX_POLLS ?? 12);
const DEFAULT_POLL_INTERVAL_MS = Number(process.env.INSTAGRAM_STATUS_POLL_INTERVAL_MS ?? 5000);

type InstagramAccountMetadata = {
  instagramId: string;
  username: string;
  pageAccessToken?: string;
};

function buildQueuedResult(id: string, message: string, extra?: Record<string, unknown>): PublishResult {
  return {
    id,
    status: "queued",
    raw: {
      phase: "processing",
      retryable: true,
      userMessage: message,
      ...extra,
    },
  };
}

function buildFailedResult(id: string, message: string, extra?: Record<string, unknown>): PublishResult {
  return {
    id,
    status: "failed",
    raw: {
      phase: "failed",
      retryable: false,
      userMessage: message,
      ...extra,
    },
  };
}

function getInstagramAccounts(integration: Awaited<ReturnType<typeof getIntegration>>): InstagramAccountMetadata[] {
  return Array.isArray((integration?.metadata as { instagramAccounts?: unknown[] } | null)?.instagramAccounts)
    ? ((integration?.metadata as { instagramAccounts?: InstagramAccountMetadata[] }).instagramAccounts ?? [])
    : [];
}

async function waitForInstagramContainerReady(containerId: string, accessToken: string) {
  let lastStatus = normalizeInstagramContainerStatus({ id: containerId, status_code: "PENDING" });

  for (let attempt = 1; attempt <= DEFAULT_POLL_ATTEMPTS; attempt += 1) {
    const payload = await getInstagramContainerStatus(containerId, accessToken);
    lastStatus = normalizeInstagramContainerStatus(payload);

    if (lastStatus.isReady || lastStatus.isFailure) {
      return { status: lastStatus, attempts: attempt };
    }

    if (attempt < DEFAULT_POLL_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, DEFAULT_POLL_INTERVAL_MS));
    }
  }

  return { status: lastStatus, attempts: DEFAULT_POLL_ATTEMPTS };
}

async function createReadyMediaContainer(args: {
  igUserId: string;
  accessToken: string;
  mediaUrl: string;
  caption: string;
  isVideo?: boolean;
}) {
  const container = await createInstagramMediaContainer(args);
  const readiness = await waitForInstagramContainerReady(container.id, args.accessToken);
  return { containerId: container.id, ...readiness };
}

export async function publishInstagramContent(workspaceId: string, _accessToken: string, input: PublishRequest): Promise<PublishResult> {
  const integration = await getIntegration(workspaceId, "instagram");
  const instagramAccounts = getInstagramAccounts(integration);

  const account = instagramAccounts.find((entry) => entry.instagramId === input.authorUrnOrId) ?? instagramAccounts[0];
  if (!account?.instagramId || !account.pageAccessToken) {
    return buildQueuedResult(`instagram_pending_${Date.now()}`, "Connect an Instagram Business account with a usable Meta page token before publishing.", {
      accountId: input.authorUrnOrId,
      action: "reconnect_instagram",
    });
  }

  if (input.postType === "text") {
    return buildFailedResult(`instagram_text_blocked_${Date.now()}`, "Instagram does not support text-only publishing. Add image or video media.", {
      action: "attach_media",
    });
  }

  if (!input.media?.length) {
    return buildFailedResult(`instagram_no_media_${Date.now()}`, "Instagram publishing requires at least one media asset.", {
      action: "attach_media",
    });
  }

  if (input.postType === "multi_image") {
    const childIds: string[] = [];
    const childStatuses: Array<Record<string, unknown>> = [];

    for (const media of input.media) {
      if (!media.publicUrl) {
        return buildFailedResult(`instagram_media_url_missing_${Date.now()}`, "Instagram carousel publishing needs public HTTPS URLs for every image.", {
          action: "fix_asset_url",
        });
      }

      const child = await createReadyMediaContainer({
        igUserId: account.instagramId,
        accessToken: account.pageAccessToken,
        mediaUrl: media.publicUrl,
        caption: input.body,
        isVideo: false,
      });

      childStatuses.push({
        containerId: child.containerId,
        attempts: child.attempts,
        statusCode: child.status.statusCode,
        statusMessage: formatInstagramStatusMessage(child.status),
      });

      if (child.status.isFailure) {
        return buildFailedResult(child.containerId, `Instagram rejected one of the carousel items: ${formatInstagramStatusMessage(child.status)}`, {
          action: "replace_media",
          phase: "container_processing",
          containerStatus: childStatuses,
        });
      }

      if (!child.status.isReady) {
        return buildQueuedResult(child.containerId, "Instagram is still processing one of the carousel items. Repurly will retry automatically.", {
          action: "wait_for_processing",
          phase: "container_processing",
          containerStatus: childStatuses,
        });
      }

      childIds.push(child.containerId);
    }

    const carousel = await createInstagramCarouselContainer({
      igUserId: account.instagramId,
      accessToken: account.pageAccessToken,
      childContainerIds: childIds,
      caption: input.body,
    });

    const carouselReadiness = await waitForInstagramContainerReady(carousel.id, account.pageAccessToken);
    if (carouselReadiness.status.isFailure) {
      return buildFailedResult(carousel.id, `Instagram could not assemble the carousel: ${formatInstagramStatusMessage(carouselReadiness.status)}`, {
        action: "review_media_order",
        phase: "carousel_processing",
        containerStatus: childStatuses,
      });
    }

    if (!carouselReadiness.status.isReady) {
      return buildQueuedResult(carousel.id, "Instagram is still assembling the carousel. Repurly will keep polling and publish when ready.", {
        action: "wait_for_processing",
        phase: "carousel_processing",
        containerStatus: childStatuses,
      });
    }

    const result = await publishInstagramContainer(account.instagramId, carousel.id, account.pageAccessToken);
    return {
      id: result.id,
      status: "published",
      url: `https://www.instagram.com/${account.username}/`,
      raw: {
        phase: "published",
        userMessage: "Carousel published to Instagram.",
        containerStatus: childStatuses,
        publishResult: result,
      },
    };
  }

  const primary = input.media[0];
  if (!primary.publicUrl) {
    return buildFailedResult(`instagram_media_url_missing_${Date.now()}`, "Instagram publishing requires a public HTTPS media URL.", {
      action: "fix_asset_url",
    });
  }

  const creation = await createReadyMediaContainer({
    igUserId: account.instagramId,
    accessToken: account.pageAccessToken,
    mediaUrl: primary.publicUrl,
    caption: input.body,
    isVideo: input.postType === "video" || primary.type === "video",
  });

  if (creation.status.isFailure) {
    return buildFailedResult(creation.containerId, `Instagram could not finish processing this ${input.postType === "video" || primary.type === "video" ? "video" : "image"}: ${formatInstagramStatusMessage(creation.status)}`, {
      action: primary.type === "video" ? "replace_video" : "replace_media",
      phase: "container_processing",
      containerStatus: [
        {
          containerId: creation.containerId,
          attempts: creation.attempts,
          statusCode: creation.status.statusCode,
          statusMessage: formatInstagramStatusMessage(creation.status),
        },
      ],
    });
  }

  if (!creation.status.isReady) {
    return buildQueuedResult(creation.containerId, `Instagram is still processing this ${input.postType === "video" || primary.type === "video" ? "video" : "media"}. Repurly will retry automatically.`, {
      action: "wait_for_processing",
      phase: "container_processing",
      containerStatus: [
        {
          containerId: creation.containerId,
          attempts: creation.attempts,
          statusCode: creation.status.statusCode,
          statusMessage: formatInstagramStatusMessage(creation.status),
        },
      ],
    });
  }

  const result = await publishInstagramContainer(account.instagramId, creation.containerId, account.pageAccessToken);

  return {
    id: result.id,
    status: "published",
    url: `https://www.instagram.com/${account.username}/`,
    raw: {
      phase: "published",
      userMessage: `${input.postType === "video" || primary.type === "video" ? "Video" : "Post"} published to Instagram.`,
      containerStatus: [
        {
          containerId: creation.containerId,
          attempts: creation.attempts,
          statusCode: creation.status.statusCode,
          statusMessage: formatInstagramStatusMessage(creation.status),
        },
      ],
      publishResult: result,
    },
  };
}
