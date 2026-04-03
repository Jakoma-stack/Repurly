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
};

export const PLAN_CATALOG: Record<PlanKey, PlanCatalogEntry> = {
  starter: {
    key: 'starter',
    name: 'Core',
    eyebrow: 'For focused teams',
    priceLabel: '£149/mo',
    monthlyPriceGbp: 149,
    summary: 'A premium entry point for teams running a tight LinkedIn workflow with approval, queue visibility, and recovery in one product.',
    bullets: [
      'Up to 3 workspace members',
      '120 posts per month',
      '3 connected channels',
      'LinkedIn composer, queue, job detail, and recovery',
    ],
    ctaLabel: 'Start with Core',
    ctaHref: '/api/billing/checkout?plan=starter',
  },
  growth: {
    key: 'growth',
    name: 'Growth',
    eyebrow: 'For agencies and multi-brand teams',
    priceLabel: '£399/mo',
    monthlyPriceGbp: 399,
    summary: 'The commercial default for teams that need multi-brand operations, approvals, AI-assisted drafting, engagement workflow, and lead follow-up in the same system.',
    bullets: [
      'Up to 10 workspace members',
      '1,000 posts per month',
      '10 connected channels',
      'Approvals, multi-brand workspaces, AI drafts, engagement, and leads',
    ],
    ctaLabel: 'Upgrade to Growth',
    ctaHref: '/api/billing/checkout?plan=growth',
    featured: true,
  },
  scale: {
    key: 'scale',
    name: 'Scale',
    eyebrow: 'For high-volume operations',
    priceLabel: 'Custom',
    summary: 'For larger teams that need tailored volume, implementation support, and a more controlled rollout across brands and publishing operations.',
    bullets: [
      'Up to 50 workspace members',
      '10,000 posts per month',
      '30 connected channels',
      'Tailored onboarding, workflow design, and commercial support',
    ],
    ctaLabel: 'Talk to sales',
    ctaHref: 'mailto:support@repurly.org?subject=Repurly%20Scale%20plan',
  },
};

export const PLAN_ORDER: PlanKey[] = ['starter', 'growth', 'scale'];
