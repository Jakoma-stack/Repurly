import { NextRequest, NextResponse } from 'next/server';
import { getCheckoutPriceId, isStripeConfigured, plans, stripe } from '@/lib/billing/stripe';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { getOrCreateStripeCustomer } from '@/lib/billing/workspace-billing';

export const runtime = 'nodejs';

type PlanKey = keyof typeof plans;
type BillingPlan = PlanKey;
type CheckoutError =
  | 'checkout-not-configured'
  | 'checkout-unavailable'
  | 'forbidden'
  | 'invalid-plan'
  | 'checkout-error';

type CheckoutSessionResult =
  | { error: CheckoutError; plan: BillingPlan; url: null }
  | { error: null; plan: BillingPlan; url: string };

const BILLING_ROLES = new Set(['owner', 'admin']);

function normalizeBillingPlan(input: unknown): BillingPlan | null {
  switch (input) {
    case 'solo':
    case 'core':
      return 'core';
    case 'team':
    case 'growth':
      return 'growth';
    case 'agency':
    case 'scale':
      return 'scale';
    default:
      return null;
  }
}


function getOrigin(request: NextRequest) {
  return (process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin).replace(/\/$/, '');
}

async function readBillingPlanFromRequest(request: NextRequest): Promise<BillingPlan | null> {
  const queryPlan = normalizeBillingPlan(request.nextUrl.searchParams.get('plan'));
  if (queryPlan) return queryPlan;

  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as { plan?: unknown };
    return normalizeBillingPlan(body.plan);
  }

  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    const formData = await request.formData().catch(() => null);
    return normalizeBillingPlan(formData?.get('plan'));
  }

  return null;
}

async function createCheckoutSession(
  request: NextRequest,
  plan: BillingPlan,
): Promise<CheckoutSessionResult> {
  if (!isStripeConfigured()) {
    console.error('[billing.checkout] Stripe is not configured');
    return { error: 'checkout-not-configured', plan, url: null };
  }

  const price = getCheckoutPriceId(plan);
  if (!price) {
    console.error('[billing.checkout] Missing checkout price for plan', { plan });
    return { error: 'checkout-unavailable', plan, url: null };
  }

  const session = await requireWorkspaceSession();

  if (!BILLING_ROLES.has(session.role)) {
    console.error('[billing.checkout] User does not have billing role', {
      workspaceId: session.workspaceId,
      role: session.role,
    });
    return { error: 'forbidden', plan, url: null };
  }

  try {
    const customerId = await getOrCreateStripeCustomer(session.workspaceId);
    if (!customerId) {
      console.error('[billing.checkout] Could not get or create Stripe customer', {
        workspaceId: session.workspaceId,
      });
      return { error: 'checkout-error', plan, url: null };
    }

    const origin = getOrigin(request);

    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${origin}/app/billing?checkout=success`,
      cancel_url: `${origin}/app/billing?checkout=cancelled&plan=${plan}`,
      metadata: {
        workspaceId: session.workspaceId,
        plan,
      },
      subscription_data: {
        metadata: {
          workspaceId: session.workspaceId,
          plan,
        },
      },
    });

    if (!checkout.url) {
      console.error('[billing.checkout] Stripe returned checkout session without url', {
        workspaceId: session.workspaceId,
        plan,
        checkoutId: checkout.id,
      });
      return { error: 'checkout-error', plan, url: null };
    }

    return { error: null, plan, url: checkout.url };
  } catch (error) {
    console.error('[billing.checkout] Stripe checkout session creation failed', {
      plan,
      error,
    });
    return { error: 'checkout-error', plan, url: null };
  }
}

function buildBillingRedirect(
  request: NextRequest,
  billingState: CheckoutError,
  plan: BillingPlan | null,
) {
  const redirectUrl = new URL('/app/billing', getOrigin(request));
  redirectUrl.searchParams.set('billing', billingState);

  if (plan) {
    redirectUrl.searchParams.set('plan', plan);
  }

  return NextResponse.redirect(redirectUrl, { status: 303 });
}

export async function GET(request: NextRequest) {
  const billingPlan = normalizeBillingPlan(request.nextUrl.searchParams.get('plan'));

  if (!billingPlan) {
    return buildBillingRedirect(request, 'invalid-plan', null);
  }

  const result = await createCheckoutSession(request, billingPlan);

  if (result.error) {
    return buildBillingRedirect(request, result.error, result.plan);
  }

  if (!result.url) {
    return buildBillingRedirect(request, 'checkout-error', result.plan);
  }

  return NextResponse.redirect(result.url, { status: 303 });
}

export async function POST(request: NextRequest) {
  const isJsonRequest = request.headers.get('content-type')?.includes('application/json') ?? false;
  const billingPlan = await readBillingPlanFromRequest(request);

  if (!billingPlan) {
    if (isJsonRequest) {
      return NextResponse.json({ error: 'Invalid plan', code: 'invalid-plan' }, { status: 400 });
    }

    return buildBillingRedirect(request, 'invalid-plan', null);
  }

  const result = await createCheckoutSession(request, billingPlan);

  if (isJsonRequest) {
    if (result.error === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden', code: result.error }, { status: 403 });
    }

    if (result.error === 'checkout-not-configured' || result.error === 'checkout-unavailable') {
      return NextResponse.json(
        { error: 'Checkout unavailable', code: result.error },
        { status: 503 },
      );
    }

    if (result.error) {
      return NextResponse.json({ error: 'Checkout error', code: result.error }, { status: 500 });
    }

    if (!result.url) {
      return NextResponse.json(
        { error: 'Checkout error', code: 'checkout-error' },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: result.url });
  }

  if (result.error) {
    return buildBillingRedirect(request, result.error, result.plan);
  }

  if (!result.url) {
    return buildBillingRedirect(request, 'checkout-error', result.plan);
  }

  return NextResponse.redirect(result.url, { status: 303 });
}
