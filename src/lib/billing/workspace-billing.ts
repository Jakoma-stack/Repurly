import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/billing/stripe';
import { db } from '@/lib/db/client';
import { workspaces } from '../../../drizzle/schema';

export type WorkspaceBillingRecord = {
  id: string;
  name: string;
  slug: string;
  plan: 'core' | 'growth' | 'scale';
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionStatus: string | null;
};

const PAID_STATUSES = new Set(['active', 'trialing', 'past_due']);

export function hasPaidWorkspaceAccess(
  record: Pick<WorkspaceBillingRecord, 'stripeSubscriptionId' | 'stripeSubscriptionStatus'>,
) {
  if (record.stripeSubscriptionStatus && PAID_STATUSES.has(record.stripeSubscriptionStatus)) {
    return true;
  }

  return !record.stripeSubscriptionStatus && Boolean(record.stripeSubscriptionId);
}

export async function getWorkspaceBillingRecord(workspaceId: string): Promise<WorkspaceBillingRecord | null> {
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      plan: workspaces.plan,
      stripeCustomerId: workspaces.stripeCustomerId,
      stripeSubscriptionId: workspaces.stripeSubscriptionId,
      stripeSubscriptionStatus: workspaces.stripeSubscriptionStatus,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getWorkspaceStripeCustomerId(workspaceId: string) {
  const workspace = await getWorkspaceBillingRecord(workspaceId);
  return workspace?.stripeCustomerId ?? null;
}

export async function getWorkspaceBillingAccessState(workspaceId: string) {
  const workspace = await getWorkspaceBillingRecord(workspaceId);

  if (!workspace) {
    return null;
  }

  return {
    ...workspace,
    hasPaidAccess: hasPaidWorkspaceAccess(workspace),
  };
}

export async function getOrCreateStripeCustomer(workspaceId: string) {
  const workspace = await getWorkspaceBillingRecord(workspaceId);

  if (!workspace) {
    throw new Error('Workspace not found');
  }

  if (workspace.stripeCustomerId) {
    return workspace.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    name: workspace.name,
    metadata: {
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
    },
  });

  await db
    .update(workspaces)
    .set({
      stripeCustomerId: customer.id,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspace.id));

  return customer.id;
}
