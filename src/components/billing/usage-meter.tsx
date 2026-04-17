import { buildUsageRows, type UsageSnapshot } from '@/lib/billing/plans';
import { PLAN_CATALOG } from '@/lib/billing/catalog';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function UsageMeter({ snapshot }: { snapshot: UsageSnapshot }) {
  const rows = buildUsageRows(snapshot);

  const planKey =
    snapshot.plan && snapshot.plan in PLAN_CATALOG
      ? (snapshot.plan as keyof typeof PLAN_CATALOG)
      : 'core';

  const plan = PLAN_CATALOG[planKey];

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold">Plan usage</h2>
        <p className="text-sm text-muted-foreground">
          Current plan: <span className="font-medium text-slate-900">{plan.name}</span> · {plan.priceLabel}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row) => (
          <div key={row.key} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-900">{row.key}</span>
              <span className="text-muted-foreground">
                {row.used} / {row.limit} {row.unit}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className={`h-2 rounded-full ${
                  row.state === 'limit_reached'
                    ? 'bg-red-500'
                    : row.state === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-primary'
                }`}
                style={{ width: `${row.percent}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
