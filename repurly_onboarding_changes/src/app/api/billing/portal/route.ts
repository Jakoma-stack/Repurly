import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/billing/stripe';
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

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL('/sign-in', request.url));

  const workspace = await getWorkspaceForUser(userId);

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.redirect(new URL('/app/billing?billing=portal-unavailable', request.url));
  }

  if (!workspace?.stripeCustomerId) {
    return NextResponse.redirect(new URL('/app/billing?billing=no-customer', request.url));
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: workspace.stripeCustomerId,
      return_url: new URL('/app/billing', request.url).toString(),
    });

    return NextResponse.redirect(session.url);
  } catch {
    return NextResponse.redirect(new URL('/app/billing?billing=portal-unavailable', request.url));
  }
}
