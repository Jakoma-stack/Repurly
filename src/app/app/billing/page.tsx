import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { UsageMeter } from '@/components/billing/usage-meter';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { PLAN_CATALOG, PLAN_ORDER } from '@/lib/billing/catalog';
import { formatPlanLabel } from '@/lib/billing/plans';
import type { PlanKey } from '@/lib/billing/plans';
import { getWorkspaceBillingAccessState } from '@/lib/billing/workspace-billing';
import { getBillingSnapshot } from '@/server/queries/billing';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type SelfServePlan = PlanKey;

type PlanCard = {
  key: SelfServePlan;
  name: string;
  priceLabel: string;
  summary: string;
  bullets: string[];
  ctaLabel: string;
  checkoutPlan?: SelfServePlan;
  ctaHref?: string;
};

const PLAN_CARDS: PlanCard[] = PLAN_ORDER.map((key) => {
  const plan = PLAN_CATALOG[key];

  return {
    key,
    name: plan.name,
    priceLabel: plan.priceLabel,
    summary: plan.summary,
    bullets: plan.bullets,
    ctaLabel: plan.selfServe ? `Activate ${plan.name}` : plan.ctaLabel,
    checkoutPlan: plan.selfServe ? key : undefined,
    ctaHref: plan.selfServe ? undefined : plan.ctaHref,
  };
});

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSelectedPlan(value: string | undefined): SelfServePlan | null {
  if (value === 'core' || value === 'solo') return 'core';
  if (value === 'growth' || value === 'team') return 'growth';
  if (value === 'scale' || value === 'agency') return 'scale';
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
  const session = await requireWorkspaceSession();
  const billingAccess = await getWorkspaceBillingAccessState(session.workspaceId);
  const snapshot = await getBillingSnapshot(session.workspaceId);
  const params = (await searchParams) ?? {};
  const selectedPlan = normalizeSelectedPlan(firstParam(params.plan));
  const billingState = firstParam(params.billing) ?? firstParam(params.checkout);

  return (
    <div className="space-y-6">
      {billingState === 'success' || billingState === 'checkout-created' ? <Banner kind="success">Checkout completed or opened successfully. Your workspace access should update after Stripe confirms the subscription.</Banner> : null}
      {billingState === 'cancelled' ? <Banner kind="warning">Checkout was cancelled. Choose Core or Growth when you are ready to activate the workspace.</Banner> : null}
      {billingState === 'checkout-unavailable' ? <Banner kind="error">Checkout is not available for that plan yet. Check the configured Stripe price IDs.</Banner> : null}
      {billingState === 'checkout-not-configured' ? <Banner kind="error">Stripe checkout is not configured yet. Add the live Stripe secret and price IDs before testing customers.</Banner> : null}
      {billingState === 'invalid-plan' ? <Banner kind="error">That plan is not available for checkout. Choose Core or Growth, or contact us for Scale.</Banner> : null}
      {billingState === 'portal-unavailable' || billingState === 'no-customer' ? <Banner kind="warning">Billing portal is not available yet for this workspace.</Banner> : null}
      {billingState === 'forbidden' ? <Banner kind="error">Only workspace owners and admins can manage billing.</Banner> : null}

      <Card>
        <CardHeader>
          <h2 className="text-2xl font-semibold">Billing and plan usage</h2>
          <p className="text-sm text-muted-foreground">
            Repurly is priced for premium LinkedIn-first workflows: clear controls, multi-brand operations, and dependable execution.
          </p>
        </CardHeader>
        <CardContent>
          <UsageMeter snapshot={snapshot} />
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-3">
        {PLAN_CARDS.map((plan) => (
          <Card key={plan.key} className={selectedPlan === plan.key ? 'border-slate-950 shadow-sm' : ''}>
            <CardHeader>
              <div className="text-sm font-medium text-primary">{plan.name}</div>
              <div className="mt-2 text-3xl font-semibold">{plan.priceLabel}</div>
              <p className="mt-2 text-sm text-muted-foreground">{plan.summary}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                {plan.bullets.map((bullet) => <li key={bullet}>• {bullet}</li>)}
              </ul>
              {plan.checkoutPlan ? (
                <a href={`/api/billing/checkout?plan=${plan.key}`} className="inline-flex rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                  {plan.ctaLabel}
                </a>
              ) : plan.ctaHref ? (
                <a href={plan.ctaHref} className="inline-flex rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                  {plan.ctaLabel}
                </a>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Current access state</h3>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>Workspace plan: <strong className="text-slate-950">{formatPlanLabel(billingAccess?.plan ?? 'core')}</strong></div>
          <div>Raw billing key: <strong className="text-slate-950">{billingAccess?.plan ?? 'core'}</strong></div>
          <div>Stripe state: <strong className="text-slate-950">{billingAccess?.stripeSubscriptionStatus ?? (billingAccess?.hasPaidAccess ? 'subscription-linked' : 'payment-required')}</strong></div>
          <div>
            Manage subscription:{' '}
            <a href="/api/billing/portal" className="font-medium text-primary">open Stripe billing portal</a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
