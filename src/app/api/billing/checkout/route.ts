import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { plans, stripe } from '@/lib/billing/stripe';
import { db } from '@/lib/db/client';
import { workspaces, workspaceMemberships } from '../../../../../drizzle/schema';

type PlanKey = keyof typeof plans;

type CheckoutSessionResult =
  | { error: 'checkout-unavailable'; url: null }
  | { error: null; url: string };

async function getWorkspaceForUser(userId: string) {
  const rows = await db
    .select({ workspaceId: workspaces.id, stripeCustomerId: workspaces.stripeCustomerId })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMemberships.workspaceId))
    .where(eq(workspaceMemberships.clerkUserId, userId))
    .limit(1);

  return rows[0] ?? null;
}

function normalizePlan(input: unknown): PlanKey {
  if (typeof input === 'string' && input in plans) {
    return input as PlanKey;
  }
  return 'growth';
}

async function createCheckoutSession(
  request: NextRequest,
  userId: string,
  plan: PlanKey,
): Promise<CheckoutSessionResult> {
  const price = plans[plan];

  if (!price || !process.env.STRIPE_SECRET_KEY) {
    return { error: 'checkout-unavailable', url: null };
  }

  const workspace = await getWorkspaceForUser(userId);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      success_url: new URL('/app/billing?checkout=success', request.url).toString(),
      cancel_url: new URL('/app/billing?checkout=cancelled', request.url).toString(),
      client_reference_id: workspace?.workspaceId ?? userId,
      customer: workspace?.stripeCustomerId ?? undefined,
      metadata: { plan },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return { error: 'checkout-unavailable', url: null };
    }

    return { error: null, url: session.url };
  } catch {
    return { error: 'checkout-unavailable', url: null };
  }
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL('/sign-in', request.url));

  const plan = normalizePlan(request.nextUrl.searchParams.get('plan'));
  const result = await createCheckoutSession(request, userId, plan);

  if (result.error || !result.url) {
    return NextResponse.redirect(new URL('/app/billing?billing=checkout-unavailable', request.url));
  }

  return NextResponse.redirect(result.url);
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as { plan?: string };
  const plan = normalizePlan(body.plan);
  const result = await createCheckoutSession(request, userId, plan);

  if (result.error || !result.url) {
    return NextResponse.json({ error: 'Checkout unavailable' }, { status: 400 });
  }

  return NextResponse.json({ url: result.url });
}
