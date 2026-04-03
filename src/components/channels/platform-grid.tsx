import { listPlatformAdapters } from '@/lib/platforms/registry';
import type { PlatformKey } from '@/lib/platforms/types';

const badges: Record<PlatformKey, string> = {
  linkedin: 'Primary workflow',
  x: 'Secondary path',
  facebook: 'Secondary path',
  instagram: 'Secondary path',
  threads: 'Hidden from launch',
  youtube: 'Hidden from launch',
  tiktok: 'Hidden from launch',
};

const launchVisible: PlatformKey[] = ['linkedin', 'x', 'facebook', 'instagram'];

export function PlatformGrid() {
  const adapters = listPlatformAdapters().filter((platform) => launchVisible.includes(platform.key));

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
      {adapters.map((platform) => (
        <div key={platform.key} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">{platform.label}</div>
              <div className="text-sm text-muted-foreground">{badges[platform.key]}</div>
            </div>
            <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">{platform.key}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {platform.capabilities.text && <span className="rounded-full bg-secondary px-2 py-1">Text</span>}
            {platform.capabilities.image && <span className="rounded-full bg-secondary px-2 py-1">Image</span>}
            {platform.capabilities.multiImage && <span className="rounded-full bg-secondary px-2 py-1">Multi-image</span>}
            {platform.capabilities.video && <span className="rounded-full bg-secondary px-2 py-1">Video</span>}
            {platform.capabilities.scheduling && <span className="rounded-full bg-secondary px-2 py-1">Scheduling</span>}
          </div>
          <div className="mt-5 flex items-center justify-between text-sm">
            <a href={`/app/settings?provider=${platform.key}`} className="font-medium text-primary">
              Connect
            </a>
            <span className="text-muted-foreground">{platform.key === 'linkedin' ? 'Set as primary' : 'Keep secondary'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
