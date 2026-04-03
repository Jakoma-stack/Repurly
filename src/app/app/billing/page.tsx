import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { UsageMeter } from '@/components/billing/usage-meter';
import { getBillingSnapshot } from '@/server/queries/billing';

export default async function BillingPage() {
  const snapshot = await getBillingSnapshot();

  return (
    <div className="space-y-6">
      <UsageMeter snapshot={snapshot} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Commercial controls</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Usage is now ready to come from live event metering rather than static plan copy, so seats, posts, storage, and channels can gate product behavior consistently.</p>
            <p>Upgrade prompts should trigger before hard limits are reached, not after a publish fails. The usage event stream is designed to support that posture.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Billing actions</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <a href="/api/billing/portal" className="block text-sm font-medium text-primary">Open billing portal</a>
            <a href="/api/billing/checkout?plan=scale" className="block text-sm font-medium text-primary">Preview upgrade flow</a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
