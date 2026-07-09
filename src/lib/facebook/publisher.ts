import { getIntegration } from "@/lib/integrations/service";
import { publishFacebookPagePost } from "@/lib/facebook/client";
import type { PublishRequest, PublishResult } from "@/lib/platforms/types";

export async function publishFacebookContent(workspaceId: string, _accessToken: string, input: PublishRequest): Promise<PublishResult> {
  const integration = await getIntegration(workspaceId, "facebook");
  const pages = Array.isArray((integration?.metadata as { pages?: unknown[] } | null)?.pages)
    ? ((integration?.metadata as { pages?: Array<{ id: string; name: string; access_token?: string }> }).pages ?? [])
    : [];

  const page = pages.find((entry) => entry.id === input.authorUrnOrId) ?? pages[0];
  if (!page?.id || !page.access_token) {
    return {
      id: `facebook_pending_${Date.now()}`,
      status: "queued",
      raw: { note: "Facebook page discovered, but a page access token must be stored to publish live.", pageId: input.authorUrnOrId },
    };
  }

  if (input.postType !== "text" && input.postType !== "link") {
    return {
      id: `facebook_pending_media_${Date.now()}`,
      status: "queued",
      raw: { note: "Facebook Pages text and link posting are wired. Image/video posting still needs media upload flow.", postType: input.postType },
    };
  }

  const result = await publishFacebookPagePost(page.access_token, page.id, input.body, typeof input.metadata?.linkUrl === "string" ? input.metadata.linkUrl : undefined);

  return {
    id: result.id,
    status: "published",
    url: `https://www.facebook.com/${page.id}/posts/${result.id.split("_")[1] ?? result.id}`,
    raw: result as unknown as Record<string, unknown>,
  };
}
