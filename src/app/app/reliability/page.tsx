import Link from 'next/link';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { getReconnectNudges } from '@/lib/usage/metering';
import { ReliabilityOverview } from '@/components/reliability/reliability-overview';
import { WebhookStatus } from '@/components/reliability/webhook-status';

export default async function ReliabilityPage() {
  const session = await requireWorkspaceSession();
  const reconnectAlerts = await getReconnectNudges(session.workspaceId);

  return (
    <div className="space-y-6">
      <ReliabilityOverview />
      <WebhookStatus />

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Active reconnect and token alerts</h2>
          <p className="text-sm text-muted-foreground">This view now uses live workspace reconnect signals instead of a hardcoded warning list.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {reconnectAlerts.length ? reconnectAlerts.map((alert) => (
            <div key={alert.label} className="rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-900">{alert.label}</div>
                  <div className="text-sm text-muted-foreground">{alert.description}</div>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-700">{alert.severity}</span>
              </div>
              <div className="mt-3">
                <a className="text-sm font-medium text-primary" href={alert.href}>{alert.actionLabel}</a>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">No active reconnect or token-expiry alerts for this workspace right now.</div>
          )}
          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Workspace in scope: <span className="font-medium text-slate-900">{session.workspaceName}</span>. Customer-facing updates also surface in <Link className="text-primary" href="/app/notifications">Notifications</Link>.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Operator checks</h2>
          <p className="text-sm text-muted-foreground">Keep reliability narrow and practical for pilots.</p>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <div className="rounded-2xl border border-border p-4">1. Keep LinkedIn healthy before expanding channel count.</div>
          <div className="rounded-2xl border border-border p-4">2. Use Notifications and Activity to recover failed or stalled jobs quickly.</div>
          <div className="rounded-2xl border border-border p-4">3. Treat queue accuracy and reconnect clarity as launch-critical trust signals.</div>
        </CardContent>
      </Card>
    </div>
  );
}
