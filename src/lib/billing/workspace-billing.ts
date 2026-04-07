import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

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

  const hasPaidAccess = hasPaidWorkspaceAccess(workspace);

  return {
    ...workspace,
    hasPaidAccess,
    paymentRequired: !hasPaidAccess,
  };
}

export async function requirePaidWorkspaceAccess(workspaceId: string) {
  const billingState = await getWorkspaceBillingAccessState(workspaceId);

  if (!billingState?.hasPaidAccess) {
    redirect('/app/billing?billing=payment-required');
  }

  return billingState;
}

async function persistStripeCustomerId(workspaceId: string, stripeCustomerId: string) {
  await db
    .update(workspaces)
    .set({
      stripeCustomerId,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId));
}

async function createStripeCustomer(workspace: Pick<WorkspaceBillingRecord, 'id' | 'name' | 'slug'>) {
  const customer = await stripe.customers.create({
    name: workspace.name,
    metadata: {
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
    },
  });

  await persistStripeCustomerId(workspace.id, customer.id);
  return customer.id;
}

function isMissingCustomerError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const stripeError = error as {
    type?: string;
    rawType?: string;
    code?: string;
    param?: string;
    statusCode?: number;
  };

  return (
    (stripeError.type === 'StripeInvalidRequestError' || stripeError.rawType === 'invalid_request_error') &&
    stripeError.code === 'resource_missing' &&
    stripeError.param === 'customer' &&
    stripeError.statusCode === 400
  );
}

export async function getOrCreateStripeCustomer(workspaceId: string) {
  const workspace = await getWorkspaceBillingRecord(workspaceId);

  if (!workspace) {
    throw new Error('Workspace not found');
  }

  if (workspace.stripeCustomerId) {
    try {
      const existingCustomer = await stripe.customers.retrieve(workspace.stripeCustomerId);

      if ('deleted' in existingCustomer && existingCustomer.deleted) {
        throw new Error(`Stripe customer ${workspace.stripeCustomerId} is deleted`);
      }

      return workspace.stripeCustomerId;
    } catch (error) {
      if (!isMissingCustomerError(error)) {
        console.error('[billing.customer] Failed to retrieve existing Stripe customer', {
          workspaceId: workspace.id,
          stripeCustomerId: workspace.stripeCustomerId,
          error,
        });
        throw error;
      }

      console.error('[billing.customer] Stored Stripe customer missing in current Stripe account; recreating', {
        workspaceId: workspace.id,
        stripeCustomerId: workspace.stripeCustomerId,
      });
    }
  }

  try {
    return await createStripeCustomer(workspace);
  } catch (error) {
    console.error('[billing.customer] Failed to create Stripe customer', {
      workspaceId: workspace.id,
      error,
    });
    throw error;
  }
}
