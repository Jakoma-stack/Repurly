import Link from "next/link";
import { requireWorkspaceSession } from "@/lib/auth/workspace";
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ReliabilityOverview } from '@/components/reliability/reliability-overview';
import { WebhookStatus } from '@/components/reliability/webhook-status';

const alerts = [
  { title: 'LinkedIn token expiring soon', severity: 'warning', action: 'Prompt reconnect within 7 days' },
  { title: 'Instagram container still processing', severity: 'info', action: 'Keep job queued and poll again' },
  { title: 'Facebook page publish failed twice', severity: 'critical', action: 'Route to support and hold future jobs' },
];

export default async function ReliabilityPage() {
  const session = await requireWorkspaceSession();
  return (
    <div className="space-y-6">
      <ReliabilityOverview />
      <WebhookStatus />
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Alert posture</h2>
          <p className="text-sm text-muted-foreground">This build adds a dedicated ops alert service for token expiry, repeated publish failures, provider workflow breakdowns, and webhook-driven status changes for the active workspace.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.title} className="rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-900">{alert.title}</div>
                  <div className="text-sm text-muted-foreground">{alert.action}</div>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-700">{alert.severity}</span>
              </div>
            </div>
          ))}
                  <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">Workspace in scope: <span className="font-medium text-slate-900">{session.workspaceName}</span>. Customer-facing updates now also surface in <Link className="text-primary" href="/app/notifications">Notifications</Link>.</div>
        </CardContent>
      </Card>
    </div>
  );
}
