import { discoverInstagramAccounts, getValidInstagramAccessToken } from "@/lib/instagram/service";
import { publishInstagramContent } from "@/lib/instagram/publisher";
import { PLATFORM_CAPABILITIES } from "@/lib/platforms/capabilities";
import type { PlatformAdapter } from "@/lib/platforms/types";

export const instagramAdapter: PlatformAdapter = {
  key: "instagram",
  label: "Instagram Business",
  capabilities: PLATFORM_CAPABILITIES.instagram,
  connectPath: "/api/instagram/connect",
  getAuthScopes: () => ["instagram_basic", "instagram_content_publish", "pages_show_list", "business_management"],
  discoverAccounts: discoverInstagramAccounts,
  refreshAccessToken: async (workspaceId: string) => {
    await getValidInstagramAccessToken(workspaceId);
  },
  publish: async (input) => {
    const accessToken = await getValidInstagramAccessToken(input.workspaceId);
    return publishInstagramContent(input.workspaceId, accessToken, input);
  },
};
