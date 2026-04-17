import { publishXPost } from "@/lib/x/client";
import type { PublishRequest, PublishResult } from "@/lib/platforms/types";

export async function publishXContent(accessToken: string, input: PublishRequest): Promise<PublishResult> {
  if (input.postType === "video") {
    throw new Error("X video publishing needs chunked media upload implementation before going live.");
  }

  const hasMedia = Array.isArray(input.media) && input.media.length > 0;
  if (hasMedia) {
    return {
      id: `x_pending_media_${Date.now()}`,
      status: "queued",
      raw: {
        note: "Text posting is live-ready. Media posting needs X media upload wiring in this scaffold.",
        requestedMediaCount: input.media?.length ?? 0,
      },
    };
  }

  const result = await publishXPost(accessToken, input.body);
  return {
    id: result.data.id,
    status: "published",
    url: `https://x.com/i/web/status/${result.data.id}`,
    raw: result as unknown as Record<string, unknown>,
  };
}
