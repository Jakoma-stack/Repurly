/** Strict, auditable subscription entitlement policy. */
export type SubscriptionAccessRecord = {
  stripeSubscriptionId: string | null;
  stripeSubscriptionStatus: string | null;
};

export function hasPaidWorkspaceAccess(record: SubscriptionAccessRecord): boolean {
  // An ID alone can exist for an incomplete or unpaid subscription.
  // Past-due and cancelled subscriptions need an explicit billing recovery flow.
  return Boolean(record.stripeSubscriptionId) &&
    (record.stripeSubscriptionStatus === 'active' || record.stripeSubscriptionStatus === 'trialing');
}
