import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlatformGrid } from '@/components/channels/platform-grid';
import { ReconnectNudges } from '@/components/channels/reconnect-nudges';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { getWorkspaceSetupState } from '@/lib/onboarding/setup';

export default async function ChannelsPage() {
  const session = await requireWorkspaceSession();
  const setup = await getWorkspaceSetupState(session.workspaceId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">LinkedIn-first setup</h2>
          <p className="text-sm text-muted-foreground">
            Finish the live LinkedIn path before opening composer. This keeps the first workflow grounded in a real target, approval path, and queue.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border p-4 text-sm">
              <div className="font-medium text-slate-950">LinkedIn connection</div>
              <div className="mt-1 text-muted-foreground">{setup.linkedInConnected ? 'Connected' : 'Not connected yet'}</div>
            </div>
            <div className="rounded-2xl border border-border p-4 text-sm">
              <div className="font-medium text-slate-950">Available targets</div>
              <div className="mt-1 text-muted-foreground">{setup.linkedInTargetCount}</div>
            </div>
            <div className="rounded-2xl border border-border p-4 text-sm">
              <div className="font-medium text-slate-950">Default target</div>
              <div className="mt-1 text-muted-foreground">{setup.hasDefaultLinkedInTarget ? 'Confirmed' : 'Needs confirmation'}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {!setup.linkedInConnected ? (
              <Link href={`/api/linkedin/connect?workspaceId=${session.workspaceId}`}><Button>Connect LinkedIn</Button></Link>
            ) : !setup.hasDefaultLinkedInTarget ? (
              <Link href="/app/settings?provider=linkedin"><Button>Review LinkedIn target</Button></Link>
            ) : (
              <Link href="/app/content"><Button>Continue to composer</Button></Link>
            )}
            <Link href="/app/reliability"><Button variant="outline">Open reliability</Button></Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Setup checklist</h3>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
          <div className="rounded-2xl border border-border p-4">1. Connect LinkedIn first and make that the live launch channel for this workspace.</div>
          <div className="rounded-2xl border border-border p-4">2. Confirm the correct profile or company page is present as the workspace default target.</div>
          <div className="rounded-2xl border border-border p-4">3. Only after LinkedIn is clean end to end should the workflow move into drafting, approval, and scheduling.</div>
          <div className="rounded-2xl border border-border p-4">4. Keep secondary channels out of the launch path until the core workflow is stable.</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Primary channel</h3>
        </CardHeader>
        <CardContent>
          <PlatformGrid workspaceId={session.workspaceId} linkedInConnected={setup.linkedInConnected} />
        </CardContent>
      </Card>

      <ReconnectNudges workspaceId={session.workspaceId} />
    </div>
  );
}
