import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PlatformGrid } from '@/components/channels/platform-grid';
import { ReconnectNudges } from '@/components/channels/reconnect-nudges';

export default async function ChannelsPage() {
  const session = await requireWorkspaceSession();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Channel setup</h2>
          <p className="text-sm text-muted-foreground">
            Keep the platform focused. LinkedIn is the primary workflow. X, Facebook Pages, and Instagram can remain available as secondary paths, but they should not define the commercial story.
          </p>
        </CardHeader>
        <CardContent>
          <PlatformGrid />
        </CardContent>
      </Card>
      <ReconnectNudges workspaceId={session.workspaceId} />
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Operator rules</h3>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
          <div className="rounded-2xl border border-border p-4">1. Connect LinkedIn first and confirm the default profile or company page for this workspace.</div>
          <div className="rounded-2xl border border-border p-4">2. Activate secondary channels only after the LinkedIn workflow is operating cleanly end to end.</div>
          <div className="rounded-2xl border border-border p-4">3. Keep job detail, reconnect, and retry controls consistent across every provider.</div>
          <div className="rounded-2xl border border-border p-4">4. Do not market hidden or scaffolded channels before the workflow genuinely supports them.</div>
        </CardContent>
      </Card>
    </div>
  );
}
