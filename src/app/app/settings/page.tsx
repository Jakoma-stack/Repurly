import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireWorkspaceSession } from '@/lib/auth/workspace';

export default async function SettingsPage() {
  const workspaceSession = await requireWorkspaceSession();
  const canManageBilling = workspaceSession.role === 'owner' || workspaceSession.role === 'admin';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">LinkedIn setup</h2>
          <p className="text-sm text-muted-foreground">
            Use the guided connection flow first. Do not send a new user into composer until LinkedIn connection and
            target defaults are clean.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-2xl border border-border p-4 text-sm text-muted-foreground">
            Workspace: <span className="font-medium text-slate-950">{workspaceSession.workspaceName}</span>
          </div>
          <Link
            href={`/api/linkedin/connect?workspaceId=${workspaceSession.workspaceId}`}
            className="inline-flex rounded-2xl border border-border px-4 py-2 text-sm font-medium text-primary"
          >
            Connect LinkedIn
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Billing</h2>
          <p className="text-sm text-muted-foreground">
            Billing is workspace-aware and should stay restricted to owners and admins during the pilot phase.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-2xl border border-border p-4 text-muted-foreground">
            Your workspace role is <span className="font-medium text-slate-950">{workspaceSession.role}</span>.
          </div>
          {canManageBilling ? (
            <>
              <Link href="/api/billing/portal" className="block font-medium text-primary">
                Open billing portal
              </Link>
              <Link href="/app/billing" className="block font-medium text-primary">
                Review plan usage
              </Link>
            </>
          ) : (
            <div className="rounded-2xl border border-border p-4 text-muted-foreground">
              Ask a workspace owner or admin to manage billing changes.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Reliability</h2>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link href="/app/reliability" className="block text-sm font-medium text-primary">
            Open reliability console
          </Link>
          <Link href="/app/billing" className="block text-sm font-medium text-primary">
            Review plan usage
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Notifications</h2>
          <p className="text-sm text-muted-foreground">Control in-app and email delivery of publish outcomes and digests.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link href="/app/notifications" className="block text-sm font-medium text-primary">
            Open notifications center
          </Link>
          <Link href="/app/settings/notifications" className="block text-sm font-medium text-primary">
            Edit notification preferences
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
