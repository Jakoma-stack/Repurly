import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { getWorkspaceSetupState } from '@/lib/onboarding/setup';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function Banner({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{children}</div>;
}

export default async function SettingsPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = await requireWorkspaceSession();
  const setup = await getWorkspaceSetupState(session.workspaceId);
  const params = (await searchParams) ?? {};
  const provider = firstParam(params.provider);
  const linkedInState = firstParam(params.linkedin);

  return (
    <div className="space-y-6">
      {linkedInState === 'connected' && <Banner>LinkedIn connected. Review the target status, then continue to composer.</Banner>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className={provider === 'linkedin' ? 'border-slate-950' : undefined}>
          <CardHeader>
            <h2 className="text-xl font-semibold">LinkedIn setup</h2>
            <p className="text-sm text-muted-foreground">Use the guided connection flow first. Do not send a new user into composer until this is clean.</p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-2xl border border-border p-4">
              <div className="font-medium text-slate-950">Connection status</div>
              <div className="mt-1 text-muted-foreground">{setup.linkedInConnected ? 'Connected' : 'Not connected yet'}</div>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <div className="font-medium text-slate-950">Workspace targets</div>
              <div className="mt-1 text-muted-foreground">
                {setup.linkedInTargetCount} available · {setup.hasDefaultLinkedInTarget ? 'default target confirmed' : 'default target needs confirmation'}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {!setup.linkedInConnected ? (
                <Link href={`/api/linkedin/connect?workspaceId=${session.workspaceId}`}><Button>Connect LinkedIn</Button></Link>
              ) : (
                <Link href="/app/channels"><Button variant="outline">Return to channel setup</Button></Link>
              )}
              {setup.isReadyForComposer && <Link href="/app/content"><Button>Continue to composer</Button></Link>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Billing</h2>
          </CardHeader>
          <CardContent>
            <Link href="/api/billing/portal" className="text-sm font-medium text-primary">Open billing portal</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Reliability</h2>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/app/reliability" className="block text-sm font-medium text-primary">Open reliability console</Link>
            <Link href="/app/billing" className="block text-sm font-medium text-primary">Review plan usage</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Notifications</h2>
            <p className="text-sm text-muted-foreground">Control in-app and email delivery of publish outcomes and digests.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/app/notifications" className="block text-sm font-medium text-primary">Open notifications centre</Link>
            <Link href="/app/settings/notifications" className="block text-sm font-medium text-primary">Edit notification preferences</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Team access</h2>
            <p className="text-sm text-muted-foreground">Workspace memberships exist in the data model, but self-serve domain-restricted invites are not in the pilot UI yet.</p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border p-4">For the pilot, keep team access narrow and add members manually through your identity admin flow if needed.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
