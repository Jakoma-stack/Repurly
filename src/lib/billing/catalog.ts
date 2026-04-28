import type { PlanKey } from '@/lib/billing/plans';

export type PlanCatalogEntry = {
  key: PlanKey;
  name: string;
  eyebrow: string;
  priceLabel: string;
  monthlyPriceGbp?: number;
  summary: string;
  bullets: string[];
  ctaLabel: string;
  ctaHref: string;
  featured?: boolean;
  selfServe?: boolean;
};

export const PLAN_CATALOG: Record<PlanKey, PlanCatalogEntry> = {
  core: {
    key: 'core',
    name: 'Core',
    eyebrow: 'For founder-led and focused teams',
    priceLabel: '£297/mo',
    monthlyPriceGbp: 297,
    summary: 'For one-brand LinkedIn workflows that need reliable drafting, approvals, scheduling, queue visibility, and recovery.',
    bullets: [
      'Up to 2 workspace members',
      '1 brand',
      '120 posts per month',
      'LinkedIn composer, queue, job detail, and recovery',
    ],
    ctaLabel: 'Start Core',
    ctaHref: '/api/billing/checkout?plan=core',
    selfServe: true,
  },
  growth: {
    key: 'growth',
    name: 'Growth',
    eyebrow: 'For agencies and multi-brand teams',
    priceLabel: '£697/mo',
    monthlyPriceGbp: 697,
    summary: 'The commercial default for agencies and B2B teams that need multi-brand operations, approvals, AI-assisted drafting, and reporting in one focused system.',
    bullets: [
      'Up to 5 workspace members',
      'Up to 3 brands',
      '1,000 posts per month',
      'Approvals, AI drafts, engagement workflow, reports, and notifications',
    ],
    ctaLabel: 'Start Growth',
    ctaHref: '/api/billing/checkout?plan=growth',
    featured: true,
    selfServe: true,
  },
  scale: {
    key: 'scale',
    name: 'Scale',
    eyebrow: 'For higher-volume client operations',
    priceLabel: 'Custom',
    summary: 'For larger multi-brand client operations that need higher limits, priority support, onboarding help, and a stronger commercial operating posture.',
    bullets: [
      'Custom workspace and brand limits',
      'Higher publishing volume',
      'Priority support',
      'Commercial onboarding support',
    ],
    ctaLabel: 'Talk to us',
    ctaHref: 'mailto:support@repurly.org?subject=Repurly%20Scale%20plan',
    selfServe: false,
  },
};

export const PLAN_ORDER: PlanKey[] = ['core', 'growth', 'scale'];
