import { PLATFORM_CAPABILITIES } from "@/lib/platforms/capabilities";
import type { PlatformAdapter } from "@/lib/platforms/types";

export const tiktokAdapter: PlatformAdapter = {
  key: "tiktok",
  label: "TikTok",
  capabilities: PLATFORM_CAPABILITIES.tiktok,
  connectPath: "/app/channels?connect=tiktok",
  getAuthScopes: () => ["user.info.basic", "video.publish"],
  publish: async (input) => ({
    id: `tiktok_stub_${input.workspaceId}`,
    status: "queued",
    raw: {
      note: "TikTok adapter scaffold ready for upload/publish/status lifecycle implementation.",
      requiredCapabilities: ["upload", "publish", "status-polling", "webhook-receive"],
    },
  }),
};
