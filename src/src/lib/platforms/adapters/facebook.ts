import { PLATFORM_CAPABILITIES } from "@/lib/platforms/capabilities";
import { discoverFacebookAccounts, getValidFacebookAccessToken } from "@/lib/facebook/service";
import { publishFacebookContent } from "@/lib/facebook/publisher";
import type { PlatformAdapter } from "@/lib/platforms/types";

export const facebookAdapter: PlatformAdapter = {
  key: "facebook",
  label: "Facebook Pages",
  capabilities: PLATFORM_CAPABILITIES.facebook,
  connectPath: "/api/facebook/connect",
  getAuthScopes: () => ["pages_show_list", "pages_manage_posts", "pages_read_engagement", "business_management"],
  discoverAccounts: discoverFacebookAccounts,
  refreshAccessToken: async (workspaceId: string) => {
    await getValidFacebookAccessToken(workspaceId);
  },
  publish: async (input) => {
    const accessToken = await getValidFacebookAccessToken(input.workspaceId);
    return publishFacebookContent(input.workspaceId, accessToken, input);
  },
};
