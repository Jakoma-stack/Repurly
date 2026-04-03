export type PublishPayload = {
  authorUrn: string;
  commentary: string;
  targetType: "member" | "organization";
  postType?: "text" | "image" | "multi_image" | "video" | "link";
  media?: Array<{ type: "image" | "video"; mediaUrn?: string; publicUrl?: string }>;
};

export async function publishLinkedInPost(accessToken: string, payload: PublishPayload) {
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

  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": "202503",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LinkedIn publish failed: ${response.status} ${text}`);
  }

  return {
    id: response.headers.get("x-restli-id") || "",
    status: "published" as const,
  };
}
