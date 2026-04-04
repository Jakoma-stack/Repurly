import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getPlanFromPriceId, stripe } from '@/lib/billing/stripe';
import { db } from '@/lib/db/client';
import { workspaces } from '../../../../../drizzle/schema';

export const runtime = 'nodejs';

function getSubscriptionPriceId(subscription: Stripe.Subscription) {
  return subscription.items.data[0]?.price?.id ?? null;
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription) {
  if (!subscription.current_period_end) return null;
  return new Date(subscription.current_period_end * 1000);
}

async function updateWorkspaceBillingState(input: {
  workspaceId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  stripeSubscriptionStatus?: string | null;
  stripeCurrentPeriodEnd?: Date | null;
  stripeCancelAtPeriodEnd?: boolean;
  plan?: 'core' | 'growth' | 'scale';
  clearSubscription?: boolean;
}) {
  let workspaceId = input.workspaceId ?? null;

  if (!workspaceId && input.stripeCustomerId) {
    const rows = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.stripeCustomerId, input.stripeCustomerId))
      .limit(1);

    workspaceId = rows[0]?.id ?? null;
  }

  if (!workspaceId) {
    return;
  }

  const updatePayload: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.stripeCustomerId !== undefined) updatePayload.stripeCustomerId = input.stripeCustomerId;
  if (input.stripeSubscriptionId !== undefined) updatePayload.stripeSubscriptionId = input.clearSubscription ? null : input.stripeSubscriptionId;
  if (input.stripePriceId !== undefined) updatePayload.stripePriceId = input.clearSubscription ? null : input.stripePriceId;
  if (input.stripeSubscriptionStatus !== undefined) updatePayload.stripeSubscriptionStatus = input.stripeSubscriptionStatus;
  if (input.stripeCurrentPeriodEnd !== undefined) updatePayload.stripeCurrentPeriodEnd = input.clearSubscription ? null : input.stripeCurrentPeriodEnd;
  if (input.stripeCancelAtPeriodEnd !== undefined) updatePayload.stripeCancelAtPeriodEnd = input.stripeCancelAtPeriodEnd;
  if (input.plan !== undefined) updatePayload.plan = input.plan;

  await db.update(workspaces).set(updatePayload).where(eq(workspaces.id, workspaceId));
}

async function syncSubscription(subscription: Stripe.Subscription, explicitWorkspaceId?: string | null) {
  const stripePriceId = getSubscriptionPriceId(subscription);
  const resolvedPlan = getPlanFromPriceId(stripePriceId ?? undefined) ?? undefined;

  await updateWorkspaceBillingState({
    workspaceId: explicitWorkspaceId ?? subscription.metadata.workspaceId,
    stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    stripeSubscriptionId: subscription.id,
    stripePriceId,
    stripeSubscriptionStatus: subscription.status,
    stripeCurrentPeriodEnd: getSubscriptionPeriodEnd(subscription),
    stripeCancelAtPeriodEnd: subscription.cancel_at_period_end,
    plan: resolvedPlan,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = (await headers()).get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing webhook secret' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = typeof checkoutSession.subscription === 'string' ? checkoutSession.subscription : checkoutSession.subscription?.id;

      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscription(subscription, checkoutSession.metadata?.workspaceId ?? null);
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await updateWorkspaceBillingState({
        workspaceId: subscription.metadata.workspaceId,
        stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
        stripeSubscriptionId: subscription.id,
        stripePriceId: getSubscriptionPriceId(subscription),
        stripeSubscriptionStatus: subscription.status,
        stripeCurrentPeriodEnd: getSubscriptionPeriodEnd(subscription),
        stripeCancelAtPeriodEnd: subscription.cancel_at_period_end,
        plan: 'core',
        clearSubscription: true,
      });
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
