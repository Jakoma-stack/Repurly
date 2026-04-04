import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { stripe } from '@/lib/billing/stripe';
import { getWorkspaceStripeCustomerId } from '@/lib/billing/workspace-billing';

export const runtime = 'nodejs';

const BILLING_ROLES = new Set(['owner', 'admin']);

export async function GET(request: NextRequest) {
  const workspaceSession = await requireWorkspaceSession();

  if (!BILLING_ROLES.has(workspaceSession.role)) {
    return NextResponse.redirect(new URL('/app/billing?billing=forbidden', request.url));
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.redirect(new URL('/app/billing?billing=portal-unavailable', request.url));
  }

  const customerId = await getWorkspaceStripeCustomerId(workspaceSession.workspaceId);
  if (!customerId) {
    return NextResponse.redirect(new URL('/app/billing?billing=no-customer', request.url));
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin}/app/billing`,
    });

    return NextResponse.redirect(session.url);
  } catch {
    return NextResponse.redirect(new URL('/app/billing?billing=portal-unavailable', request.url));
  }
}
