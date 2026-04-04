import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { UsageMeter } from '@/components/billing/usage-meter';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { getWorkspaceBillingAccessState } from '@/lib/billing/workspace-billing';
import { getBillingSnapshot } from '@/server/queries/billing';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type SelfServePlanKey = 'core' | 'growth';

type PlanCard = {
  key: SelfServePlanKey;
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
    ctaLabel: 'Choose Growth',
    ctaHref: '/api/billing/checkout?plan=growth',
  },
];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSelectedPlan(value: string | undefined): SelfServePlanKey {
  return value === 'core' ? 'core' : 'growth';
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
  const snapshot = await getBillingSnapshot(workspaceSession.workspaceId);
  const billing = await getWorkspaceBillingAccessState(workspaceSession.workspaceId);
  const params = (await searchParams) ?? {};
  const checkout = firstParam(params.checkout);
  const billingState = firstParam(params.billing);
  const selectedPlan = normalizeSelectedPlan(firstParam(params.plan));
  const canManageBilling = workspaceSession.role === 'owner' || workspaceSession.role === 'admin';
  const activePlan = billing?.hasPaidAccess ? snapshot.plan : null;

  return (
    <div className="space-y-6">
      {billingState === 'payment-required' && (
        <Banner kind="warning">Choose Core or Growth and complete payment before using the app.</Banner>
      )}
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

      {!billing?.hasPaidAccess ? (
        <Card>
          <CardHeader>
            <h2 className="text-2xl font-semibold">Activate this workspace before entering the product</h2>
            <p className="text-sm text-muted-foreground">
              Repurly is paid-access only. Every workspace must start on Core or Growth before composer, calendar,
              approvals, and workflow surfaces unlock.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Your account is created, but this workspace is not active yet. Complete checkout on a paid plan to continue.
            </p>
            {!canManageBilling && (
              <div className="rounded-2xl border border-border p-4">
                Billing can only be completed by a workspace owner or admin.
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <UsageMeter snapshot={snapshot} />
      )}

      <section className="grid gap-5 lg:grid-cols-2">
        {PLAN_CARDS.map((plan) => {
          const isCurrentPlan = activePlan === plan.key;
          const isSelectedPlan = !activePlan && selectedPlan === plan.key;
          const cardClass = isCurrentPlan || isSelectedPlan ? 'border-slate-950 bg-slate-950 text-white' : undefined;

          return (
            <Card key={plan.key} className={cardClass}>
              <CardHeader>
                <div className={isCurrentPlan || isSelectedPlan ? 'text-sm font-medium text-slate-300' : 'text-sm font-medium text-primary'}>
                  {plan.name}
                </div>
                <div className="mt-2 text-2xl font-semibold">{plan.priceLabel}</div>
              </CardHeader>
              <CardContent>
                <p className={isCurrentPlan || isSelectedPlan ? 'text-sm leading-6 text-slate-300' : 'text-sm leading-6 text-muted-foreground'}>
                  {plan.summary}
                </p>
                <div className="mt-5 space-y-2">
                  {plan.bullets.map((item) => (
                    <div
                      key={item}
                      className={
                        isCurrentPlan || isSelectedPlan
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
                      {billing?.hasPaidAccess ? (plan.key === 'growth' ? 'Upgrade to Growth' : 'Switch to Core') : `Start ${plan.name}`}
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
            <h2 className="text-xl font-semibold">Access policy</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Unpaid workspaces can sign in, but they cannot use the product until Core or Growth checkout completes.
            </p>
            <p>
              This keeps the launch commercial posture clean: paid pilots first, workflow access second.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Billing actions</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {billing?.hasPaidAccess && canManageBilling ? (
              <a href="/api/billing/portal" className="block font-medium text-primary">
                Open billing portal
              </a>
            ) : null}
            <a href="mailto:support@repurly.org?subject=Repurly%20Scale%20plan" className="block font-medium text-primary">
              Need a larger rollout? Talk to sales
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
