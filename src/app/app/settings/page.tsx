import Link from 'next/link';
import { and, eq } from 'drizzle-orm';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { db } from '@/lib/db/client';
import { integrations, platformAccounts } from '../../../../drizzle/schema';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function Banner({ kind, children }: { kind: 'success' | 'error'; children: React.ReactNode }) {
  const styles =
    kind === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : 'border-rose-200 bg-rose-50 text-rose-900';

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

async function getWorkspaceConnectionState(workspaceId: string) {
  const rows = await db
    .select({
      provider: integrations.provider,
      status: integrations.status,
      connectedTargetName: platformAccounts.displayName,
      connectedHandle: platformAccounts.handle,
    })
    .from(integrations)
    .leftJoin(
      platformAccounts,
      and(eq(platformAccounts.integrationId, integrations.id), eq(platformAccounts.isDefault, true)),
    )
    .where(eq(integrations.workspaceId, workspaceId));

  const byProvider = new Map<
    string,
    {
      status: string;
      connectedTargetName?: string;
      connectedHandle?: string;
    }
  >();

  for (const row of rows) {
    if (!byProvider.has(row.provider)) {
      byProvider.set(row.provider, {
        status: row.status,
        connectedTargetName: row.connectedTargetName ?? undefined,
        connectedHandle: row.connectedHandle ?? undefined,
      });
    }
  }

  return byProvider;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const session = await requireWorkspaceSession();
  const params = (await searchParams) ?? {};
  const highlightProvider =
    typeof firstParam(params.provider) === 'string' ? String(firstParam(params.provider)) : 'linkedin';
  const linkedInStatus = firstParam(params.linkedin);
  const workspaceId = session.workspaceId;

  const connections = await getWorkspaceConnectionState(workspaceId);

  const connectLinks = [
    { key: 'linkedin', label: 'LinkedIn', href: `/api/linkedin/connect?workspaceId=${workspaceId}` },
    { key: 'x', label: 'X', href: `/api/x/connect?workspaceId=${workspaceId}` },
    { key: 'facebook', label: 'Facebook Pages', href: `/api/facebook/connect?workspaceId=${workspaceId}` },
    { key: 'instagram', label: 'Instagram Business', href: `/api/instagram/connect?workspaceId=${workspaceId}` },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="lg:col-span-2 space-y-3">
        {linkedInStatus === 'connected' && (
          <Banner kind="success">LinkedIn connected. Repurly stored the workspace integration.</Banner>
        )}
        {linkedInStatus === 'error' && (
          <Banner kind="error">LinkedIn connect failed. Check OAuth settings, scopes, and callback handling.</Banner>
        )}
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Workspace connections</h2>
          <p className="text-sm text-muted-foreground">
            Every connect flow is now workspace-aware. Start with LinkedIn for the launch path, then add secondary
            channels only if a pilot truly needs them.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {connectLinks.map((item) => {
            const state = connections.get(item.key);
            const isConnected = state?.status === 'connected';
            const highlighted = highlightProvider.toLowerCase().includes(item.key);

            return (
              <div
                key={item.label}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                  highlighted ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div>
                  <div className="font-medium">{item.label}</div>
                  <div className="text-sm text-muted-foreground">
                    {isConnected
                      ? `${state?.connectedTargetName ?? 'Connected'}${
                          state?.connectedHandle ? ` · ${state.connectedHandle}` : ''
                        }`
                      : item.label === 'LinkedIn'
                        ? 'Use this as the default pilot channel.'
                        : 'Keep secondary to the LinkedIn workflow.'}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isConnected ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                      Connected
                    </span>
                  ) : null}

                  <a href={item.href} className="text-sm font-medium text-primary">
                    {isConnected ? 'Reconnect' : 'Connect'}
                  </Link>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Billing</h2>
        </CardHeader>
        <CardContent>
          <Link href="/api/billing/portal" className="text-sm font-medium text-primary">
            Open billing portal
          </Link>
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
          <Link href="/app/activity" className="block text-sm font-medium text-primary">
            Review job detail and recovery history
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Notifications</h2>
          <p className="text-sm text-muted-foreground">
            Control in-app and email delivery of publish outcomes and digests.
          </p>
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