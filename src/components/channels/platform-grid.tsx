import Link from 'next/link';
import { listPlatformAdapters } from '@/lib/platforms/registry';

type PlatformGridProps = {
  workspaceId: string;
  linkedInConnected: boolean;
};

export function PlatformGrid({ workspaceId, linkedInConnected }: PlatformGridProps) {
  const linkedIn = listPlatformAdapters().find((platform) => platform.key === 'linkedin');
  if (!linkedIn) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">{linkedIn.label}</div>
            <div className="text-sm text-muted-foreground">Primary launch workflow</div>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">linkedin</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {linkedIn.capabilities.text && <span className="rounded-full bg-secondary px-2 py-1">Text</span>}
          {linkedIn.capabilities.image && <span className="rounded-full bg-secondary px-2 py-1">Image</span>}
          {linkedIn.capabilities.multiImage && <span className="rounded-full bg-secondary px-2 py-1">Multi-image</span>}
          {linkedIn.capabilities.video && <span className="rounded-full bg-secondary px-2 py-1">Video</span>}
          {linkedIn.capabilities.scheduling && <span className="rounded-full bg-secondary px-2 py-1">Scheduling</span>}
        </div>
        <div className="mt-5 flex items-center justify-between text-sm">
          {linkedInConnected ? (
            <Link href="/app/settings?provider=linkedin" className="font-medium text-primary">
              Review setup
            </Link>
          ) : (
            <Link href={`/api/linkedin/connect?workspaceId=${workspaceId}`} className="font-medium text-primary">
              Connect LinkedIn
            </Link>
          )}
          <span className="text-muted-foreground">{linkedInConnected ? 'Ready for target review' : 'Connect before composer'}</span>
        </div>
      </div>

      <div className="rounded-3xl border border-dashed border-border bg-slate-50 p-5 text-sm text-muted-foreground">
        Secondary channels stay behind the main workflow for now. Keep X, Facebook, Instagram, Threads, YouTube, and TikTok out of the onboarding path until paid pilots prove the LinkedIn wedge.
      </div>
    </div>
  );
}
