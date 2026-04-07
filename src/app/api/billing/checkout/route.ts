import { NextRequest, NextResponse } from 'next/server';
import { getCheckoutPriceId, isStripeConfigured, plans, stripe } from '@/lib/billing/stripe';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { getOrCreateStripeCustomer } from '@/lib/billing/workspace-billing';

export const runtime = 'nodejs';

type PlanKey = keyof typeof plans;
type SelfServePlan = Extract<PlanKey, 'core' | 'growth'>;
type CheckoutError = 'checkout-not-configured' | 'checkout-unavailable' | 'forbidden' | 'invalid-plan' | 'checkout-error';

type CheckoutSessionResult =
  | { error: CheckoutError; plan: SelfServePlan; url: null }
  | { error: null; plan: SelfServePlan; url: string };

const BILLING_ROLES = new Set(['owner', 'admin']);

function normalizePlan(input: unknown): SelfServePlan | null {
  return input === 'core' || input === 'growth' ? input : null;
}

function getOrigin(request: NextRequest) {
  return (process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin).replace(/\/$/, '');
}

async function readPlanFromRequest(request: NextRequest): Promise<SelfServePlan | null> {
  const queryPlan = normalizePlan(request.nextUrl.searchParams.get('plan'));
  if (queryPlan) {
    return queryPlan;
  }

  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as { plan?: unknown };
    return normalizePlan(body.plan);
  }

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const formData = await request.formData().catch(() => null);
    return normalizePlan(formData?.get('plan'));
  }

  return null;
}

async function createCheckoutSession(
  request: NextRequest,
  plan: SelfServePlan,
): Promise<CheckoutSessionResult> {
  if (!isStripeConfigured()) {
    return { error: 'checkout-not-configured', plan, url: null };
  }

  const price = getCheckoutPriceId(plan);
  if (!price) {
    return { error: 'checkout-unavailable', plan, url: null };
  }

  const session = await requireWorkspaceSession();

  if (!BILLING_ROLES.has(session.role)) {
    return { error: 'forbidden', plan, url: null };
  }

  try {
    const customerId = await getOrCreateStripeCustomer(session.workspaceId);
    if (!customerId) {
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
      return { error: 'checkout-error', plan, url: null };
    }

    return { error: null, plan, url: checkout.url };
  } catch {
    return { error: 'checkout-error', plan, url: null };
  }
}

function buildBillingRedirect(request: NextRequest, billingState: CheckoutError, plan: SelfServePlan | null) {
  const redirectUrl = new URL('/app/billing', request.url);
  redirectUrl.searchParams.set('billing', billingState);

  if (plan) {
    redirectUrl.searchParams.set('plan', plan);
  }

  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: NextRequest) {
  const plan = normalizePlan(request.nextUrl.searchParams.get('plan'));
  if (!plan) {
    return buildBillingRedirect(request, 'invalid-plan', null);
  }

  const result = await createCheckoutSession(request, plan);

  if (result.error || !result.url) {
    return buildBillingRedirect(request, result.error, result.plan);
  }

  return NextResponse.redirect(result.url);
}

export async function POST(request: NextRequest) {
  const plan = await readPlanFromRequest(request);
  if (!plan) {
    if (request.headers.get('content-type')?.includes('application/json')) {
      return NextResponse.json({ error: 'Invalid plan', code: 'invalid-plan' }, { status: 400 });
    }

    return buildBillingRedirect(request, 'invalid-plan', null);
  }

  const result = await createCheckoutSession(request, plan);

  if (request.headers.get('content-type')?.includes('application/json')) {
    if (result.error === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden', code: result.error }, { status: 403 });
    }

    if (result.error === 'checkout-not-configured' || result.error === 'checkout-unavailable') {
      return NextResponse.json({ error: 'Checkout unavailable', code: result.error }, { status: 503 });
    }

    if (result.error || !result.url) {
      return NextResponse.json({ error: 'Checkout error', code: result.error ?? 'checkout-error' }, { status: 500 });
    }

    return NextResponse.json({ url: result.url });
  }

  if (result.error || !result.url) {
    return buildBillingRedirect(request, result.error, result.plan);
  }

  return NextResponse.redirect(result.url);
}
