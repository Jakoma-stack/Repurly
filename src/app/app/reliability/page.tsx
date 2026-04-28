import Link from 'next/link';
import { ShieldCheck, Siren, Workflow } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { getReconnectNudges } from '@/lib/usage/metering';
import { ReliabilityOverview } from '@/components/reliability/reliability-overview';
import { WebhookStatus } from '@/components/reliability/webhook-status';

export default async function ReliabilityPage() {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const reconnectAlerts = await getReconnectNudges(session.workspaceId);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <ShieldCheck className="size-5 text-emerald-500" />
            <div className="mt-4 text-3xl font-semibold">{reconnectAlerts.length ? 'Watch' : 'Healthy'}</div>
            <div className="mt-1 text-sm text-muted-foreground">Current workspace channel health posture</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Siren className="size-5 text-amber-500" />
            <div className="mt-4 text-3xl font-semibold">{reconnectAlerts.length}</div>
            <div className="mt-1 text-sm text-muted-foreground">Reconnect or token alerts requiring action</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Workflow className="size-5 text-cyan-500" />
            <div className="mt-4 text-3xl font-semibold">Trust</div>
            <div className="mt-1 text-sm text-muted-foreground">Reliability is part of the premium product surface</div>
          </CardContent>
        </Card>
      </section>

      <ReliabilityOverview />
      <WebhookStatus />

      <Card>
        <CardHeader>
          <div className="eyebrow">Active reconnect and token alerts</div>
          <h2 className="mt-2 text-2xl font-semibold">Reliability should be visible before customers feel friction</h2>
          <p className="mt-2 text-sm text-muted-foreground">This view uses live workspace reconnect signals instead of a hardcoded warning list.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {reconnectAlerts.length ? reconnectAlerts.map((alert) => (
            <div key={alert.label} className="rounded-[1.5rem] border border-slate-200/80 p-4">
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
            <div className="rounded-[1.5rem] border border-dashed border-border p-4 text-sm text-muted-foreground">No active reconnect or token-expiry alerts for this workspace right now.</div>
          )}
          <div className="rounded-[1.5rem] border border-dashed border-border p-4 text-sm text-muted-foreground">
            Workspace in scope: <span className="font-medium text-slate-900">{session.workspaceName}</span>. Customer-facing updates also surface in <Link className="text-primary" href="/app/notifications">Notifications</Link>.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
