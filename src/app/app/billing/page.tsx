import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { UsageMeter } from '@/components/billing/usage-meter';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { getWorkspaceBillingAccessState } from '@/lib/billing/workspace-billing';
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
    priceLabel: '£149/mo',
    summary: 'For focused LinkedIn workflows with a smaller team, tighter limits, and reliable publishing fundamentals.',
    bullets: ['3 workspace members', '120 posts per month', '3 connected channels'],
    ctaLabel: 'Activate Core',
    ctaHref: '/api/billing/checkout?plan=core',
  },
  {
    key: 'growth',
    name: 'Growth',
    priceLabel: '£399/mo',
    summary: 'For agencies and B2B teams that need approvals, more operational capacity, and stronger commercial control.',
    bullets: ['10 workspace members', '1000 posts per month', 'Approval flows included'],
    ctaLabel: 'Activate Growth',
    ctaHref: '/api/billing/checkout?plan=growth',
  },
  {
    key: 'scale',
    name: 'Scale',
    priceLabel: 'Custom',
    summary: 'For larger rollouts that should be sold deliberately rather than opened as self-serve.',
    bullets: ['Higher operational limits', 'Priority support', 'Commercial review before activation'],
    ctaLabel: 'Talk to sales',
    ctaHref: 'mailto:support@repurly.org?subject=Repurly%20Scale%20plan',
  },
];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSelectedPlan(value: string | undefined): 'core' | 'growth' | null {
  if (value === 'core' || value === 'growth') {
    return value;
  }

  return null;
}

function Banner({ kind, children }: { kind: 'success' | 'error' | 'warning'; children: ReactNode }) {
  const styles =
    kind === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : kind === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-rose-200 bg-rose-50 text-rose-900';

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

export default async function BillingPage({ searchParams }: { searchParams?: SearchParams }) {
  const workspaceSession = await requireWorkspaceSession();
  const [snapshot, billingAccess] = await Promise.all([
    getBillingSnapshot(workspaceSession.workspaceId),
    getWorkspaceBillingAccessState(workspaceSession.workspaceId),
  ]);

  const params = (await searchParams) ?? {};
  const checkout = firstParam(params.checkout);
  const billingState = firstParam(params.billing);
  const selectedPlan = normalizeSelectedPlan(firstParam(params.plan));
  const canManageBilling = workspaceSession.role === 'owner' || workspaceSession.role === 'admin';
  const hasPaidAccess = billingAccess?.hasPaidAccess ?? false;

  return (
    <div className="space-y-6">
      {checkout === 'success' && (
        <Banner kind="success">Checkout completed. Stripe can take a moment to confirm the subscription. Refresh this page if access is still updating.</Banner>
      )}
      {checkout === 'cancelled' && <Banner kind="error">Checkout was cancelled before payment completed.</Banner>}
      {billingState === 'payment-required' && (
        <Banner kind="warning">Choose Core or Growth to activate this workspace. Repurly does not unlock the product before payment.</Banner>
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
      {billingState === 'forbidden' && <Banner kind="error">Only workspace owners and admins can change billing.</Banner>}

      {!hasPaidAccess ? (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <h2 className="text-2xl font-semibold">Activate your workspace before using Repurly</h2>
            <p className="text-sm text-slate-700">
              Account creation is complete, but the product stays locked until this workspace is on Core or Growth.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p>
              Repurly is intentionally sold as a paid workflow product, not a free scheduler. Choose the paid plan that fits your team and the rest of the app will unlock after Stripe confirms the subscription.
            </p>
            {selectedPlan ? (
              <div className="rounded-2xl border border-amber-200 bg-white px-4 py-3">
                Selected plan from sign-up: <span className="font-medium text-slate-950">{selectedPlan === 'core' ? 'Core' : 'Growth'}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <UsageMeter snapshot={snapshot} />
      )}

      <section className="grid gap-5 lg:grid-cols-3">
        {PLAN_CARDS.map((plan) => {
          const isCurrentPlan = hasPaidAccess && snapshot.plan === plan.key;
          const isHighlighted = !hasPaidAccess && selectedPlan === plan.key;
          const emphasized = isCurrentPlan || isHighlighted;

          return (
            <Card key={plan.key} className={emphasized ? 'border-slate-950 bg-slate-950 text-white' : undefined}>
              <CardHeader>
                <div className={emphasized ? 'text-sm font-medium text-slate-300' : 'text-sm font-medium text-primary'}>{plan.name}</div>
                <div className="mt-2 text-2xl font-semibold">{plan.priceLabel}</div>
              </CardHeader>
              <CardContent>
                <p className={emphasized ? 'text-sm leading-6 text-slate-300' : 'text-sm leading-6 text-muted-foreground'}>{plan.summary}</p>
                <div className="mt-5 space-y-2">
                  {plan.bullets.map((item) => (
                    <div
                      key={item}
                      className={
                        emphasized
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
                    <span className="rounded-2xl bg-white px-4 py-2 text-sm font-medium text-slate-950">Current paid plan</span>
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
              Repurly is intentionally sold as a premium, focused workflow product rather than a broad, low-cost scheduling tool.
            </p>
            <p>
              New workspaces should pay first, then use the workflow. This keeps the launch aligned with paid pilots rather than free access.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Billing actions</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {canManageBilling ? (
              hasPaidAccess ? (
                <>
                  <a href="/api/billing/portal" className="block font-medium text-primary">
                    Open billing portal
                  </a>
                  <a href="/api/billing/checkout?plan=growth" className="block font-medium text-primary">
                    Upgrade to Growth
                  </a>
                </>
              ) : (
                <>
                  <a href="/api/billing/checkout?plan=core" className="block font-medium text-primary">
                    Activate Core
                  </a>
                  <a href="/api/billing/checkout?plan=growth" className="block font-medium text-primary">
                    Activate Growth
                  </a>
                </>
              )
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
