import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

let stripeClient: Stripe | null = null;

function requireStripeSecretKey() {
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY is required before Stripe operations can run. Configure it in the environment; do not use placeholders.');
  }

  return stripeSecretKey;
}

function getStripeClient() {
  if (!stripeClient) {
    stripeClient = new Stripe(requireStripeSecretKey(), {
      apiVersion: '2025-08-27.basil',
      typescript: true,
    });
  }

  return stripeClient;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, property) {
    const client = getStripeClient();
    const value = (client as unknown as Record<PropertyKey, unknown>)[property];

    if (typeof value === 'function') {
      return value.bind(client);
    }

    return value;
  },
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
