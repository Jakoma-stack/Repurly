import { PLATFORM_CAPABILITIES } from "@/lib/platforms/capabilities";
import type { PlatformAdapter } from "@/lib/platforms/types";

export const threadsAdapter: PlatformAdapter = {
  key: "threads",
  label: "Threads",
  capabilities: PLATFORM_CAPABILITIES.threads,
  connectPath: "/app/channels?connect=threads",
  getAuthScopes: () => ["threads_basic", "threads_content_publish"],
  publish: async (input) => ({
    id: `threads_stub_${input.workspaceId}`,
    status: "queued",
    raw: { note: "Threads adapter scaffold ready for Meta Threads API implementation." },
  }),
};
