import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { UsageMeter } from '@/components/billing/usage-meter';
import { getBillingSnapshot } from '@/server/queries/billing';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { PLAN_CATALOG, PLAN_ORDER } from '@/lib/billing/catalog';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function Banner({ kind, children }: { kind: 'success' | 'error'; children: React.ReactNode }) {
  const styles = kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900';
  return <div className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

export default async function BillingPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = await requireWorkspaceSession();
  const snapshot = await getBillingSnapshot(session.workspaceId);
  const params = (await searchParams) ?? {};
  const checkout = firstParam(params.checkout);
  const billingState = firstParam(params.billing);

  return (
    <div className="space-y-6">
      {checkout === 'success' && <Banner kind="success">Checkout completed. Refresh billing in a moment if your plan is still updating.</Banner>}
      {checkout === 'cancelled' && <Banner kind="error">Checkout was cancelled before payment completed.</Banner>}
      {billingState === 'no-customer' && <Banner kind="error">No billing customer is attached to this workspace yet. Start with checkout first, then reopen the portal.</Banner>}
      {billingState === 'portal-unavailable' && <Banner kind="error">Billing portal is not available until Stripe is configured and a customer exists for this workspace.</Banner>}
      {billingState === 'checkout-unavailable' && <Banner kind="error">Checkout is not available until Stripe price IDs are configured for this environment.</Banner>}

      <UsageMeter snapshot={snapshot} />

      <section className="grid gap-5 lg:grid-cols-3">
        {PLAN_ORDER.map((key) => {
          const plan = PLAN_CATALOG[key];
          const current = snapshot.plan === key;
          return (
            <Card key={plan.key} className={current ? 'border-slate-950 bg-slate-950 text-white' : undefined}>
              <CardHeader>
                <div className={current ? 'text-sm font-medium text-slate-300' : 'text-sm font-medium text-primary'}>{plan.eyebrow}</div>
                <div className="mt-2 text-2xl font-semibold">{plan.name}</div>
                <div className={current ? 'mt-2 text-xl font-semibold text-white' : 'mt-2 text-xl font-semibold text-slate-950'}>{plan.priceLabel}</div>
              </CardHeader>
              <CardContent>
                <p className={current ? 'text-sm leading-6 text-slate-300' : 'text-sm leading-6 text-muted-foreground'}>{plan.summary}</p>
                <div className="mt-5 space-y-2">
                  {plan.bullets.map((item) => (
                    <div key={item} className={current ? 'rounded-2xl border border-white/10 px-3 py-2 text-sm text-slate-200' : 'rounded-2xl border border-border px-3 py-2 text-sm text-slate-700'}>
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  {current ? (
                    <span className="rounded-2xl bg-white px-4 py-2 text-sm font-medium text-slate-950">Current plan</span>
                  ) : plan.ctaHref.startsWith('mailto:') ? (
                    <a href={plan.ctaHref} className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700">
                      {plan.ctaLabel}
                    </a>
                  ) : (
                    <a href={plan.ctaHref} className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700">
                      {plan.ctaLabel}
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Commercial controls</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Usage now comes from live workspace data, so seats, posts, storage, and channels can drive commercial prompts consistently inside the app.</p>
            <p>Repurly is intentionally priced as a premium, focused workflow product rather than a broad, low-cost scheduling tool.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Billing actions</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <a href="/api/billing/portal" className="block font-medium text-primary">Open billing portal</a>
            <a href="/api/billing/checkout?plan=growth" className="block font-medium text-primary">Upgrade to Growth</a>
            <a href="mailto:support@repurly.org?subject=Repurly%20Scale%20plan" className="block font-medium text-primary">Talk to sales about Scale</a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
