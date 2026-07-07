import { getPlatformAdapter } from "@/lib/platforms/registry";
import type { PlatformKey, PublishRequest } from "@/lib/platforms/types";

export async function publishToPlatform(input: PublishRequest & { provider: PlatformKey }) {
  const adapter = getPlatformAdapter(input.provider);
  return adapter.publish(input);
}
