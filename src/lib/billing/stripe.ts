import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-08-27.basil',
  typescript: true,
});

export const plans = {
  core: process.env.STRIPE_PRICE_CORE,
  growth: process.env.STRIPE_PRICE_GROWTH,
  scale: process.env.STRIPE_PRICE_SCALE,
} as const;

export type StripePlanKey = keyof typeof plans;

export function getPlanFromPriceId(priceId: string | null | undefined): StripePlanKey | null {
  if (!priceId) return null;

  const entries = Object.entries(plans) as Array<[StripePlanKey, string | undefined]>;
  const matched = entries.find(([, candidate]) => candidate === priceId);

  return matched?.[0] ?? null;
}