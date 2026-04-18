import { getLinkedInApiVersion } from "@/lib/linkedin/config";

export type PublishPayload = {
  authorUrn: string;
  commentary: string;
  targetType: "member" | "organization";
  postType?: "text" | "image" | "multi_image" | "video" | "link";
  media?: Array<{ type: "image" | "video"; mediaUrn?: string; publicUrl?: string }>;
};

const LINKEDIN_PUBLISH_TIMEOUT_MS = Number(process.env.LINKEDIN_PUBLISH_TIMEOUT_MS ?? 25000);

export async function publishLinkedInPost(accessToken: string, payload: PublishPayload) {
  const apiVersion = getLinkedInApiVersion();
  const body: Record<string, unknown> = {
    author: payload.authorUrn,
    commentary: payload.commentary,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  if ((payload.postType === "image" || payload.postType === "multi_image" || payload.postType === "video") && payload.media?.length) {
    if (payload.media.length === 1) {
      body.content = {
        media: {
          altText: "Repurly asset",
          id: payload.media[0].mediaUrn ?? payload.media[0].publicUrl,
        },
      };
    }

    if (payload.media.length > 1) {
      body.content = {
        multiImage: {
          images: payload.media.map((item) => ({ id: item.mediaUrn ?? item.publicUrl })),
        },
      };
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LINKEDIN_PUBLISH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "LinkedIn-Version": apiVersion,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);

    if (error instanceof Error && error.name === "AbortError") {
      throw Object.assign(new Error(`LinkedIn publish timed out after ${LINKEDIN_PUBLISH_TIMEOUT_MS}ms`), { retryable: true });
    }

    throw Object.assign(
      new Error(error instanceof Error ? error.message : "LinkedIn publish request failed"),
      { retryable: true }
    );
  }

  clearTimeout(timeout);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const retryable = response.status >= 500 || response.status === 429 || response.status === 408;
    throw Object.assign(new Error(`LinkedIn publish failed: ${response.status} ${text}`.trim()), { retryable });
  }

  return {
    id: response.headers.get("x-restli-id") || "",
    status: "published" as const,
  };
}
