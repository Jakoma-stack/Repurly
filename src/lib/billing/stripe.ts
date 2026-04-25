import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

export const stripe = new Stripe(stripeSecretKey || 'sk_test_placeholder', {
  apiVersion: '2025-08-27.basil',
  typescript: true,
});

function firstConfigured(...values: Array<string | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }

  return undefined;
}

export const plans = {
  core: firstConfigured(process.env.STRIPE_PRICE_CORE, process.env.STRIPE_PRICE_SOLO),
  growth: firstConfigured(process.env.STRIPE_PRICE_GROWTH, process.env.STRIPE_PRICE_TEAM),
  scale: firstConfigured(process.env.STRIPE_PRICE_SCALE, process.env.STRIPE_PRICE_AGENCY),
} as const;

export const planEnvKeys = {
  core: ['STRIPE_PRICE_CORE', 'STRIPE_PRICE_SOLO'],
  growth: ['STRIPE_PRICE_GROWTH', 'STRIPE_PRICE_TEAM'],
  scale: ['STRIPE_PRICE_SCALE', 'STRIPE_PRICE_AGENCY'],
} as const;

export type StripePlanKey = keyof typeof plans;
export type StripeSelfServePlanKey = StripePlanKey;

export function isStripeConfigured() {
  return Boolean(stripeSecretKey);
}

export function getCheckoutPriceId(plan: StripeSelfServePlanKey): string | null {
  const priceId = plans[plan] ?? null;

  if (!priceId) {
    console.error('[billing.stripe] Missing price id for checkout plan', {
      plan,
      acceptedEnvKeys: planEnvKeys[plan],
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
