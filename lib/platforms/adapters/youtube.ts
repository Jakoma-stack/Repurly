import { PLATFORM_CAPABILITIES } from "@/lib/platforms/capabilities";
import type { PlatformAdapter } from "@/lib/platforms/types";

export const youtubeAdapter: PlatformAdapter = {
  key: "youtube",
  label: "YouTube",
  capabilities: PLATFORM_CAPABILITIES.youtube,
  connectPath: "/app/channels?connect=youtube",
  getAuthScopes: () => ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"],
  publish: async (input) => ({
    id: `youtube_stub_${input.workspaceId}`,
    status: "queued",
    raw: { note: "YouTube adapter scaffold ready for resumable upload and publish flow." },
  }),
};
