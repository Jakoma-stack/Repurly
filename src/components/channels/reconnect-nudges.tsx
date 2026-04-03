import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getReconnectNudges } from '@/lib/usage/metering';

const toneClasses = {
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  critical: 'bg-rose-50 text-rose-800 border-rose-200',
};

export async function ReconnectNudges({ workspaceId }: { workspaceId?: string }) {
  const items = await getReconnectNudges(workspaceId);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Reconnect nudges</h3>
        <p className="text-sm text-muted-foreground">Show customers what needs attention before a scheduled publish fails. These nudges are designed to surface expiring tokens and missing permissions early.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl border border-border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-medium text-slate-900">{item.label}</div>
                <div className="mt-1 text-sm text-muted-foreground">{item.description}</div>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide ${toneClasses[item.severity]}`}>{item.severity}</span>
            </div>
            <div className="mt-3">
              <a href={item.href} className="text-sm font-medium text-primary">{item.actionLabel}</a>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
