import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { WorkspaceNotification } from '@/server/queries/notifications';

const toneClasses = {
  info: 'bg-sky-50 text-sky-800 border-sky-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  critical: 'bg-rose-50 text-rose-800 border-rose-200',
};

export function NotificationsCenter({ items }: { items: WorkspaceNotification[] }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold">Notifications centre</h2>
        <p className="text-sm text-muted-foreground">
          Workspace-aware alerts, reconnect nudges, and live provider delivery signals surface here alongside the in-app or email delivery channel that carried the update.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="font-medium text-slate-900">{item.title}</div>
                <div className="text-sm text-muted-foreground">{item.body}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                  <span>{item.source} • {new Date(item.createdAt).toLocaleString()}</span>
                  {item.deliveryState ? <span className="rounded-full border border-border px-2 py-0.5 text-[10px]">{item.deliveryState}</span> : null}
                  {item.correlationId ? <span className="rounded-full border border-border px-2 py-0.5 text-[10px]">corr {item.correlationId}</span> : null}
                  {item.channel ? <span className="rounded-full border border-border px-2 py-0.5 text-[10px]">{item.channel}</span> : null}
                  {item.channelStatus ? <span className="rounded-full border border-border px-2 py-0.5 text-[10px]">{item.channelStatus}</span> : null}
                </div>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide ${toneClasses[item.severity]}`}>{item.severity}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {item.actionableHref ? (
                <a href={item.actionableHref} className="text-sm font-medium text-primary">{item.actionableLabel ?? 'View details'}</a>
              ) : null}
              <Link href="/app/settings/notifications" className="text-sm font-medium text-slate-600">Notification settings</Link>
            </div>
          </div>
        )) : (
          <div className="rounded-2xl border border-dashed border-border p-8 text-sm text-muted-foreground">
            No open notifications. Repurly will show reconnect warnings, repeated provider failures, and webhook-driven delivery signals here.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
