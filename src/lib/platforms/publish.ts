import { getPlatformAdapter } from "@/lib/platforms/registry";
import { isPrivatePilotMode } from "@/lib/billing/private-pilot";
import type { PlatformKey, PublishRequest } from "@/lib/platforms/types";

export async function publishToPlatform(input: PublishRequest & { provider: PlatformKey }) {
  if (isPrivatePilotMode()) {
    throw new Error('External publishing is disabled in private pilot mode. Draft and copy your content manually.');
  }
  const adapter = getPlatformAdapter(input.provider);
  return adapter.publish(input);
}
