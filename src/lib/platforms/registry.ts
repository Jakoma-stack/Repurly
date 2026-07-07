import { facebookAdapter } from "@/lib/platforms/adapters/facebook";
import { instagramAdapter } from "@/lib/platforms/adapters/instagram";
import { linkedInAdapter } from "@/lib/platforms/adapters/linkedin";
import { threadsAdapter } from "@/lib/platforms/adapters/threads";
import { tiktokAdapter } from "@/lib/platforms/adapters/tiktok";
import { xAdapter } from "@/lib/platforms/adapters/x";
import { youtubeAdapter } from "@/lib/platforms/adapters/youtube";
import type { PlatformAdapter, PlatformKey } from "@/lib/platforms/types";

export const platformRegistry: Record<PlatformKey, PlatformAdapter> = {
  linkedin: linkedInAdapter,
  x: xAdapter,
  facebook: facebookAdapter,
  instagram: instagramAdapter,
  threads: threadsAdapter,
  youtube: youtubeAdapter,
  tiktok: tiktokAdapter,
};

export function getPlatformAdapter(provider: PlatformKey) {
  return platformRegistry[provider];
}

export function listPlatformAdapters() {
  return Object.values(platformRegistry);
}
