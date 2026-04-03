import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { plans, stripe } from '@/lib/billing/stripe';
import { db } from '@/lib/db/client';
import { workspaces, workspaceMemberships } from '../../../../../drizzle/schema';

async function getWorkspaceForUser(userId: string) {
  const rows = await db
    .select({ workspaceId: workspaces.id, stripeCustomerId: workspaces.stripeCustomerId })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMemberships.workspaceId))
    .where(eq(workspaceMemberships.clerkUserId, userId))
    .limit(1);

  return rows[0] ?? null;
}

async function createCheckoutSession(request: NextRequest, userId: string, plan: keyof typeof plans) {
  const price = plans[plan];
  if (!price || !process.env.STRIPE_SECRET_KEY) {
    return { error: 'checkout-unavailable' as const, url: null };
  }

  const workspace = await getWorkspaceForUser(userId);
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

  return { error: null as const, url: session.url };
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL('/sign-in', request.url));

  const plan = (request.nextUrl.searchParams.get('plan') || 'growth') as keyof typeof plans;
  const result = await createCheckoutSession(request, userId, plan);
  if (result.error || !result.url) {
    return NextResponse.redirect(new URL('/app/billing?billing=checkout-unavailable', request.url));
  }

  return NextResponse.redirect(result.url);
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { plan } = await request.json() as { plan: keyof typeof plans };
  const result = await createCheckoutSession(request, userId, plan);
  if (result.error || !result.url) {
    return NextResponse.json({ error: 'Checkout unavailable' }, { status: 400 });
  }

  return NextResponse.json({ url: result.url });
}
