import { PLATFORM_CAPABILITIES } from "@/lib/platforms/capabilities";
import { discoverXAccounts, getValidXAccessToken } from "@/lib/x/service";
import { publishXContent } from "@/lib/x/publisher";
import type { PlatformAdapter } from "@/lib/platforms/types";

export const xAdapter: PlatformAdapter = {
  key: "x",
  label: "X",
  capabilities: PLATFORM_CAPABILITIES.x,
  connectPath: "/api/x/connect",
  getAuthScopes: () => ["tweet.read", "tweet.write", "users.read", "offline.access", "media.write"],
  discoverAccounts: discoverXAccounts,
  refreshAccessToken: async (workspaceId: string) => {
    await getValidXAccessToken(workspaceId);
  },
  publish: async (input) => {
    const accessToken = await getValidXAccessToken(input.workspaceId);
    return publishXContent(accessToken, input);
  },
};
