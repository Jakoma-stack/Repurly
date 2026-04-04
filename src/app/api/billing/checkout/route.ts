import { NextRequest, NextResponse } from 'next/server';
import { plans, stripe } from '@/lib/billing/stripe';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { getOrCreateStripeCustomer } from '@/lib/billing/workspace-billing';

type PlanKey = keyof typeof plans;

type CheckoutSessionResult =
  | { error: 'checkout-unavailable'; url: null }
  | { error: 'forbidden'; url: null }
  | { error: 'invalid-plan'; url: null }
  | { error: null; url: string };

function isSelfServePlan(plan: string): plan is Extract<PlanKey, 'core' | 'growth'> {
  return plan === 'core' || plan === 'growth';
}

function normalizePlan(input: unknown): Extract<PlanKey, 'core' | 'growth'> {
  if (typeof input === 'string' && isSelfServePlan(input)) {
    return input;
  }
  return 'core';
}

async function createCheckoutSession(
  request: NextRequest,
  plan: Extract<PlanKey, 'core' | 'growth'>,
): Promise<CheckoutSessionResult> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { error: 'checkout-unavailable', url: null };
  }

  const price = plans[plan];
  if (!price) {
    return { error: 'checkout-unavailable', url: null };
  }

  const session = await requireWorkspaceSession();

  if (!['owner', 'admin'].includes(session.role)) {
    return { error: 'forbidden', url: null };
  }

  try {
    const customerId = await getOrCreateStripeCustomer(session.workspaceId);

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${origin}/app/billing?checkout=success`,
      cancel_url: `${origin}/app/billing?checkout=cancelled`,
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
      return { error: 'checkout-unavailable', url: null };
    }

    return { error: null, url: checkout.url };
  } catch {
    return { error: 'checkout-unavailable', url: null };
  }
}

export async function GET(request: NextRequest) {
  const plan = normalizePlan(request.nextUrl.searchParams.get('plan'));
  const result = await createCheckoutSession(request, plan);

  if (result.error === 'forbidden') {
    return NextResponse.redirect(new URL('/app/billing?billing=forbidden', request.url));
  }

  if (result.error || !result.url) {
    return NextResponse.redirect(new URL('/app/billing?billing=checkout-unavailable', request.url));
  }

  return NextResponse.redirect(result.url);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { plan?: string };
  const plan = normalizePlan(body.plan);
  const result = await createCheckoutSession(request, plan);

  if (result.error === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (result.error || !result.url) {
    return NextResponse.json({ error: 'Checkout unavailable' }, { status: 400 });
  }

  return NextResponse.json({ url: result.url });
}
