import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { UsageMeter } from '@/components/billing/usage-meter';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { getWorkspaceBillingAccessState } from '@/lib/billing/workspace-billing';
import { getBillingSnapshot } from '@/server/queries/billing';
import { PLAN_CATALOG, PLAN_ORDER } from '@/lib/billing/catalog';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type SelfServePlan = 'core' | 'growth' | 'scale';

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
  const billingState = firstParam(params.billing);

  return (
    <div className="space-y-6">
      {billingState === 'checkout-created' ? <Banner kind="success">Checkout opened successfully.</Banner> : null}
      {billingState === 'checkout-unavailable' ? (
        <Banner kind="error">
          Checkout is not available for that plan yet. Configure the Stripe price IDs using STRIPE_PRICE_SOLO / TEAM / AGENCY
          or keep the older CORE / GROWTH / SCALE aliases.
        </Banner>
      ) : null}
      {billingState === 'portal-unavailable' ? <Banner kind="warning">Billing portal is not available yet for this workspace.</Banner> : null}

      <Card>
        <CardHeader>
          <h2 className="text-2xl font-semibold">Billing and plan usage</h2>
          <p className="text-sm text-muted-foreground">
            Stripe is the commercial source of truth. Repurly self-serve pricing should match Solo (£59), Team (£199), and Agency (£499).
          </p>
        </CardHeader>
        <CardContent>
          <UsageMeter snapshot={snapshot} />
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-3">
        {PLAN_ORDER.map((key) => {
          const plan = PLAN_CATALOG[key];
          return (
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
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Stripe mapping: <strong className="text-slate-900">{plan.stripeEnvKey}</strong>
                  <span className="text-slate-500"> (legacy alias: {plan.stripeLegacyEnvKey})</span>
                </div>
                <a href={plan.ctaHref} className="inline-flex rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                  {plan.ctaLabel}
                </a>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Current access state</h3>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>
            Workspace plan:{' '}
            <strong className="text-slate-950">{billingAccess ? PLAN_CATALOG[billingAccess.plan].name : 'Solo'}</strong>
          </div>
          <div>
            Commercial keys in use: <strong className="text-slate-950">STRIPE_PRICE_SOLO / TEAM / AGENCY</strong>
            <span className="text-slate-500"> with backward compatibility for CORE / GROWTH / SCALE.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
