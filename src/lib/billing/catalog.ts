import type { PlanKey } from '@/lib/billing/plans';

export type PlanCatalogEntry = {
  key: PlanKey;
  legacyKey: 'solo' | 'team' | 'agency';
  name: string;
  eyebrow: string;
  priceLabel: string;
  monthlyPriceGbp?: number;
  summary: string;
  bullets: string[];
  ctaLabel: string;
  ctaHref: string;
  stripeEnvKey: string;
  stripeLegacyEnvKey: string;
  featured?: boolean;
};

export const PLAN_CATALOG: Record<PlanKey, PlanCatalogEntry> = {
  core: {
    key: 'core',
    legacyKey: 'solo',
    name: 'Solo',
    eyebrow: 'For founder-led and solo teams',
    priceLabel: '£59/mo',
    monthlyPriceGbp: 59,
    summary: 'A premium entry point for one-brand LinkedIn workflows with clear drafting, scheduling, queue visibility, and recovery.',
    bullets: [
      'Up to 2 workspace members',
      '1 brand',
      '120 posts per month',
      'LinkedIn composer, queue, job detail, and recovery',
    ],
    ctaLabel: 'Start Solo',
    ctaHref: '/api/billing/checkout?plan=solo',
    stripeEnvKey: 'STRIPE_PRICE_SOLO',
    stripeLegacyEnvKey: 'STRIPE_PRICE_CORE',
  },
  growth: {
    key: 'growth',
    legacyKey: 'team',
    name: 'Team',
    eyebrow: 'For agencies and multi-brand teams',
    priceLabel: '£199/mo',
    monthlyPriceGbp: 199,
    summary: 'The commercial default for teams that need multi-brand operations, approvals, AI-assisted drafting, engagement workflow, and reporting in the same system.',
    bullets: [
      'Up to 5 workspace members',
      'Up to 3 brands',
      '1,000 posts per month',
      'Approvals, AI drafts, engagement, reports, and notifications',
    ],
    ctaLabel: 'Start Team',
    ctaHref: '/api/billing/checkout?plan=team',
    stripeEnvKey: 'STRIPE_PRICE_TEAM',
    stripeLegacyEnvKey: 'STRIPE_PRICE_GROWTH',
    featured: true,
  },
  scale: {
    key: 'scale',
    legacyKey: 'agency',
    name: 'Agency',
    eyebrow: 'For higher-volume client operations',
    priceLabel: '£499/mo',
    monthlyPriceGbp: 499,
    summary: 'For larger multi-brand teams that need higher limits, priority support, and a stronger commercial operating posture.',
    bullets: [
      'Up to 15 workspace members',
      'Up to 10 brands',
      '10,000 posts per month',
      'Priority support and onboarding support',
    ],
    ctaLabel: 'Start Agency',
    ctaHref: '/api/billing/checkout?plan=agency',
    stripeEnvKey: 'STRIPE_PRICE_AGENCY',
    stripeLegacyEnvKey: 'STRIPE_PRICE_SCALE',
  },
};

export const PLAN_ORDER: PlanKey[] = ['core', 'growth', 'scale'];
