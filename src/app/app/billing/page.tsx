import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { UsageMeter } from '@/components/billing/usage-meter';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { getBillingSnapshot } from '@/server/queries/billing';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type PlanCard = {
  key: 'core' | 'growth' | 'scale';
  name: string;
  priceLabel: string;
  summary: string;
  bullets: string[];
  ctaLabel: string;
  ctaHref: string;
};

const PLAN_CARDS: PlanCard[] = [
  {
    key: 'core',
    name: 'Core',
    priceLabel: 'From £297/mo',
    summary: 'For small teams that need a clean LinkedIn workflow and reliable publishing without broad suite sprawl.',
    bullets: ['3 workspace members', '120 posts per month', '3 connected channels'],
    ctaLabel: 'Choose Core',
    ctaHref: '/api/billing/checkout?plan=core',
  },
  {
    key: 'growth',
    name: 'Growth',
    priceLabel: 'From £697/mo',
    summary: 'For agencies and B2B teams running approvals, more volume, and tighter operational control.',
    bullets: ['10 workspace members', '1000 posts per month', 'Approval flows included'],
    ctaLabel: 'Upgrade to Growth',
    ctaHref: '/api/billing/checkout?plan=growth',
  },
  {
    key: 'scale',
    name: 'Scale',
    priceLabel: 'Custom',
    summary: 'For higher-governance pilots and service-heavy accounts that need commercial review before rollout.',
    bullets: ['Priority support', 'Higher operational limits', 'Commercial review before activation'],
    ctaLabel: 'Talk to sales',
    ctaHref: 'mailto:support@repurly.org?subject=Repurly%20Scale%20plan',
  },
];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function Banner({ kind, children }: { kind: 'success' | 'error'; children: ReactNode }) {
  const styles =
    kind === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : 'border-rose-200 bg-rose-50 text-rose-900';

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

export default async function BillingPage({ searchParams }: { searchParams?: SearchParams }) {
  const workspaceSession = await requireWorkspaceSession();
  const snapshot = await getBillingSnapshot(workspaceSession.workspaceId);
  const params = (await searchParams) ?? {};
  const checkout = firstParam(params.checkout);
  const billingState = firstParam(params.billing);
  const canManageBilling = workspaceSession.role === 'owner' || workspaceSession.role === 'admin';

  return (
    <div className="space-y-6">
      {checkout === 'success' && (
        <Banner kind="success">Checkout completed. Refresh billing in a moment if your plan is still updating.</Banner>
      )}
      {checkout === 'cancelled' && (
        <Banner kind="error">Checkout was cancelled before payment completed.</Banner>
      )}
      {billingState === 'no-customer' && (
        <Banner kind="error">No billing customer is attached to this workspace yet. Start with checkout first, then reopen the portal.</Banner>
      )}
      {billingState === 'portal-unavailable' && (
        <Banner kind="error">Billing portal is not available until Stripe is configured and a workspace customer exists.</Banner>
      )}
      {billingState === 'checkout-unavailable' && (
        <Banner kind="error">Checkout is not available until Stripe price IDs are configured for this environment.</Banner>
      )}
      {billingState === 'forbidden' && (
        <Banner kind="error">Only workspace owners and admins can change billing.</Banner>
      )}

      <UsageMeter snapshot={snapshot} />

      <section className="grid gap-5 lg:grid-cols-3">
        {PLAN_CARDS.map((plan) => {
          const isCurrentPlan = snapshot.plan === plan.key;
          return (
            <Card key={plan.key} className={isCurrentPlan ? 'border-slate-950 bg-slate-950 text-white' : undefined}>
              <CardHeader>
                <div className={isCurrentPlan ? 'text-sm font-medium text-slate-300' : 'text-sm font-medium text-primary'}>
                  {plan.name}
                </div>
                <div className="mt-2 text-2xl font-semibold">{plan.priceLabel}</div>
              </CardHeader>
              <CardContent>
                <p className={isCurrentPlan ? 'text-sm leading-6 text-slate-300' : 'text-sm leading-6 text-muted-foreground'}>
                  {plan.summary}
                </p>
                <div className="mt-5 space-y-2">
                  {plan.bullets.map((item) => (
                    <div
                      key={item}
                      className={
                        isCurrentPlan
                          ? 'rounded-2xl border border-white/10 px-3 py-2 text-sm text-slate-200'
                          : 'rounded-2xl border border-border px-3 py-2 text-sm text-slate-700'
                      }
                    >
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  {isCurrentPlan ? (
                    <span className="rounded-2xl bg-white px-4 py-2 text-sm font-medium text-slate-950">Current plan</span>
                  ) : canManageBilling ? (
                    <a
                      href={plan.ctaHref}
                      className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700"
                    >
                      {plan.ctaLabel}
                    </a>
                  ) : (
                    <span className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-medium text-slate-500">
                      Billing managed by owner/admin
                    </span>
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
            <p>
              Usage now comes from live workspace data, so seats, posts, storage, and channels can drive upgrade prompts
              consistently inside the app.
            </p>
            <p>
              Repurly is intentionally priced as a premium, focused workflow product rather than a broad, low-cost
              scheduling tool.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Billing actions</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {canManageBilling ? (
              <>
                <a href="/api/billing/portal" className="block font-medium text-primary">
                  Open billing portal
                </a>
                <a href="/api/billing/checkout?plan=growth" className="block font-medium text-primary">
                  Upgrade to Growth
                </a>
              </>
            ) : (
              <div className="rounded-2xl border border-border p-4 text-muted-foreground">
                Billing can only be changed by a workspace owner or admin.
              </div>
            )}
            <a href="mailto:support@repurly.org?subject=Repurly%20Scale%20plan" className="block font-medium text-primary">
              Talk to sales about Scale
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
