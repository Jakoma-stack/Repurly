import { NextRequest, NextResponse } from 'next/server';

import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { getOrCreateStripeCustomer } from '@/lib/billing/workspace-billing';
import { plans, stripe } from '@/lib/billing/stripe';

export const runtime = 'nodejs';

const BILLING_ROLES = new Set(['owner', 'admin']);
type SelfServePlanKey = 'core' | 'growth';

type CheckoutSessionResult =
  | { error: 'checkout-unavailable'; url: null }
  | { error: 'forbidden'; url: null }
  | { error: null; url: string };

function normalizePlan(input: unknown): SelfServePlanKey {
  return input === 'growth' ? 'growth' : 'core';
}

function getBaseUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

async function createCheckoutSession(request: NextRequest, plan: SelfServePlanKey): Promise<CheckoutSessionResult> {
  const workspaceSession = await requireWorkspaceSession();

  if (!BILLING_ROLES.has(workspaceSession.role)) {
    return { error: 'forbidden', url: null };
  }

  const price = plans[plan];
  if (!price || !process.env.STRIPE_SECRET_KEY) {
    return { error: 'checkout-unavailable', url: null };
  }

  try {
    const customerId = await getOrCreateStripeCustomer(workspaceSession.workspaceId);
    const baseUrl = getBaseUrl(request);

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      success_url: `${baseUrl}/app/billing?checkout=success`,
      cancel_url: `${baseUrl}/app/billing?checkout=cancelled&plan=${plan}`,
      metadata: {
        workspaceId: workspaceSession.workspaceId,
        workspaceSlug: workspaceSession.workspaceSlug,
        plan,
      },
      subscription_data: {
        metadata: {
          workspaceId: workspaceSession.workspaceId,
          workspaceSlug: workspaceSession.workspaceSlug,
          plan,
        },
      },
    });

    if (!checkoutSession.url) {
      return { error: 'checkout-unavailable', url: null };
    }

    return { error: null, url: checkoutSession.url };
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
    return NextResponse.redirect(new URL(`/app/billing?billing=checkout-unavailable&plan=${plan}`, request.url));
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
