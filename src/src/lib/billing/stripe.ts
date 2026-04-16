import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

export const stripe = new Stripe(stripeSecretKey || 'sk_test_placeholder', {
  apiVersion: '2025-08-27.basil',
  typescript: true,
});

export const plans = {
  core: process.env.STRIPE_PRICE_CORE?.trim(),
  growth: process.env.STRIPE_PRICE_GROWTH?.trim(),
  scale: process.env.STRIPE_PRICE_SCALE?.trim(),
} as const;

export type StripePlanKey = keyof typeof plans;
export type StripeCheckoutPlanKey = StripePlanKey;

export function isStripeConfigured() {
  return Boolean(stripeSecretKey);
}

export function getCheckoutPriceId(plan: StripeCheckoutPlanKey): string | null {
  const priceId = plans[plan] ?? null;

  if (!priceId) {
    console.error('[billing.stripe] Missing price id for self-serve plan', {
      plan,
      hasCore: Boolean(plans.core),
      hasGrowth: Boolean(plans.growth),
      hasScale: Boolean(plans.scale),
    });
  }

  return priceId;
}

export function getPlanFromPriceId(priceId: string | null | undefined): StripePlanKey | null {
  if (!priceId) return null;

  const entries = Object.entries(plans) as Array<[StripePlanKey, string | undefined]>;
  const matched = entries.find(([, candidate]) => candidate === priceId);

  return matched?.[0] ?? null;
}
