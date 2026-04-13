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
  core: {
    key: 'core',
    name: 'Solo',
    eyebrow: 'For founder-led and solo operators',
    priceLabel: '£59/mo',
    monthlyPriceGbp: 59,
    summary: 'A premium entry point for focused LinkedIn workflow with drafting, scheduling, and queue visibility in one product.',
    bullets: [
      '1 workspace',
      '1 brand',
      'Starter AI drafting allowance',
      'Core scheduling and queue visibility',
    ],
    ctaLabel: 'Start Solo',
    ctaHref: '/api/billing/checkout?plan=solo',
  },
  growth: {
    key: 'growth',
    name: 'Team',
    eyebrow: 'For agencies and B2B teams',
    priceLabel: '£199/mo',
    monthlyPriceGbp: 199,
    summary: 'The commercial default for teams that need approvals, AI-assisted drafting, reporting, notifications, and stronger workflow control.',
    bullets: [
      'Multi-user workspace',
      'Approvals and workflow controls',
      'Operational reporting and notifications',
      'Higher AI and publishing allowance',
    ],
    ctaLabel: 'Start Team',
    ctaHref: '/api/billing/checkout?plan=team',
    featured: true,
  },
  scale: {
    key: 'scale',
    name: 'Agency',
    eyebrow: 'For multi-brand operators',
    priceLabel: '£499/mo',
    monthlyPriceGbp: 499,
    summary: 'For larger teams that need multi-brand operations, higher limits, onboarding support, and a more controlled commercial rollout.',
    bullets: [
      'Multi-brand workspaces',
      'Higher operational limits',
      'Priority support',
      'Commercial onboarding support',
    ],
    ctaLabel: 'Start Agency',
    ctaHref: '/api/billing/checkout?plan=agency',
  },
};

export const PLAN_ORDER: PlanKey[] = ['core', 'growth', 'scale'];
