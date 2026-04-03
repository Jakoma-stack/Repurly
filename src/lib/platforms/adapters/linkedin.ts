import { getValidLinkedInAccessToken } from "@/lib/linkedin/service";
import { publishLinkedInPost } from "@/lib/linkedin/publisher";
import { PLATFORM_CAPABILITIES } from "@/lib/platforms/capabilities";
import type { PlatformAdapter } from "@/lib/platforms/types";

export const linkedInAdapter: PlatformAdapter = {
  key: "linkedin",
  label: "LinkedIn",
  capabilities: PLATFORM_CAPABILITIES.linkedin,
  connectPath: "/api/linkedin/connect",
  getAuthScopes: () => ["openid", "profile", "email", "w_member_social", "w_organization_social"],
  publish: async (input) => {
    const accessToken = await getValidLinkedInAccessToken(input.workspaceId);
    return publishLinkedInPost(accessToken, {
      authorUrn: input.authorUrnOrId,
      commentary: input.body,
      targetType: input.targetType === "organization" || input.targetType === "page" ? "organization" : "member",
      media: input.media,
      postType: input.postType,
    });
  },
};
